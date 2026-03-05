import { findWorkerByName, findTaskByName, parseRelativeDate, createAuthenticatedClient } from './_helpers.js';

export const config = {
  runtime: 'edge',
};

interface VoiceIntent {
  action: string;
  confidence: number;
  data: any;
  summary: string;
  needs_confirmation: boolean;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { intent } = await req.json() as { intent: VoiceIntent };

    if (!intent) {
      return new Response(JSON.stringify({ error: 'No intent provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get auth token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Create authenticated Supabase client
    const authClient = createAuthenticatedClient(token);

    // Get current user - this validates the JWT and gets user ID
    const { data: { user: authUser }, error: authError } = await authClient.auth.getUser();
    
    if (authError) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ 
        error: 'Invalid authentication token',
        details: authError.message 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!authUser) {
      return new Response(JSON.stringify({ 
        error: 'No user found for token' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user details from users table
    const { data: user, error: userError } = await authClient
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (userError) {
      console.error('User query error:', userError);
      return new Response(JSON.stringify({ 
        error: 'Failed to get user details',
        details: userError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!user) {
      return new Response(JSON.stringify({ 
        error: 'User not found in database',
        details: `User ID ${authUser.id} exists in auth but not in users table`
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Execute based on action type
    let result;
    switch (intent.action) {
      case 'reassign_worker':
        result = await handleReassignWorker(intent.data, user, authClient);
        break;

      case 'create_task':
        result = await handleCreateTask(intent.data, user, authClient);
        break;

      case 'query_info':
        result = await handleQueryInfo(intent.data, user, authClient);
        break;

      case 'update_timesheet':
        result = await handleUpdateTimesheet(intent.data, user, authClient);
        break;

      case 'approve_request':
        result = await handleApproveRequest(intent.data, user, authClient);
        break;

      case 'create_worker':
        result = await handleCreateWorker(intent.data, user, authClient);
        break;

      case 'edit_worker':
        result = await handleEditWorker(intent.data, user, authClient);
        break;

      case 'create_job_site':
        result = await handleCreateJobSite(intent.data, user, authClient);
        break;

      case 'invite_user':
        result = await handleInviteUser(intent.data, user, token);
        break;

      case 'open_file':
        result = await handleOpenFile(intent.data, user, authClient);
        break;

      case 'navigate':
        result = handleNavigate(intent.data);
        break;

      default:
        throw new Error(`Unknown action: ${intent.action}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: intent.summary,
        data: result,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Execute API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to execute command',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Handle worker reassignment
async function handleReassignWorker(data: any, user: any, client: any) {
  const { worker_name, to_task_name, dates } = data;
  
  // Find worker
  const worker = await findWorkerByName(worker_name, user.org_id, client);
  
  // Find target task
  const toTask = await findTaskByName(to_task_name, user.org_id, client);
  
  // Parse dates
  const targetDates = dates || parseRelativeDate('tomorrow');
  
  // For each date, remove existing assignment and create new one
  for (const date of targetDates) {
    // Delete existing assignments for this worker on this date
    await client
      .from('assignments')
      .delete()
      .eq('worker_id', worker.id)
      .eq('assigned_date', date);
    
    // Create new assignment
    await client
      .from('assignments')
      .insert({
        org_id: user.org_id,
        worker_id: worker.id,
        task_id: toTask.id,
        assigned_date: date,
        status: 'assigned',
        assigned_by: user.id,
      });
  }
  
  return {
    worker: worker.name,
    task: toTask.name,
    dates: targetDates,
  };
}

// Handle task creation
async function handleCreateTask(data: any, user: any, client: any) {
  const { task_name, location, required_operators, required_laborers, start_date, end_date } = data;

  const dates = start_date ? parseRelativeDate(start_date) : parseRelativeDate('tomorrow');

  // If no end_date provided, default to same as start_date (single-day task)
  let taskEndDate = dates[0];
  if (end_date) {
    const endDates = parseRelativeDate(end_date);
    taskEndDate = endDates[0];
  }

  // Prefer the job_site_id injected by the client (currently selected job site).
  // Fall back to fuzzy-matching location or the first active site.
  let jobSiteId: string | null = data.job_site_id || null;
  let jobSites: any[] = [];

  if (!jobSiteId) {
    const { data: sites } = await client
      .from('job_sites')
      .select('id, name, location')
      .eq('organization_id', user.org_id)
      .eq('status', 'active');

    jobSites = sites || [];

    if (jobSites.length > 0) {
      if (location) {
        const normalizedLocation = location.toLowerCase();
        const matched = jobSites.find((s: any) =>
          s.name?.toLowerCase().includes(normalizedLocation) ||
          s.location?.toLowerCase().includes(normalizedLocation) ||
          normalizedLocation.includes(s.name?.toLowerCase())
        );
        jobSiteId = matched?.id || jobSites[0].id;
      } else {
        jobSiteId = jobSites[0].id;
      }
    }
  }

  const { data: task, error } = await client
    .from('tasks')
    .insert({
      organization_id: user.org_id,  // tasks table uses organization_id, not org_id
      job_site_id: jobSiteId,
      name: task_name,
      location: location || null,
      start_date: dates[0],
      end_date: taskEndDate,
      required_operators: required_operators || 0,
      required_laborers: required_laborers || 0,
      status: 'planned',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    task_id: task.id,
    task_name: task.name,
    job_site: jobSiteId ? (jobSites.find((s: any) => s.id === jobSiteId)?.name || null) : null,
  };
}

// Handle information queries
async function handleQueryInfo(data: any, user: any, client: any) {
  const { query_type, worker_name, date } = data;
  
  if (query_type === 'worker_location' || query_type === 'worker_assignment') {
    // Find where worker is assigned
    const worker = await findWorkerByName(worker_name, user.org_id, client);
    
    // Parse the date - could be "today", "tomorrow", "Monday", etc.
    let targetDate;
    if (date) {
      const parsed = parseRelativeDate(date);
      targetDate = parsed[0]; // Get first date from array
    } else {
      targetDate = new Date().toISOString().split('T')[0];
    }
    
    const { data: assignment, error } = await client
      .from('assignments')
      .select(`
        *,
        task:tasks(name, location)
      `)
      .eq('worker_id', worker.id)
      .eq('assigned_date', targetDate)
      .eq('status', 'assigned')
      .single();
    
    if (error || !assignment) {
      throw new Error(`${worker.name} has no assignment for ${targetDate}`);
    }
    
    return {
      worker: worker.name,
      task: assignment.task.name,
      location: assignment.task.location,
      date: targetDate,
    };
  }
  
  // Default handler - treat any query about a worker as location query
  if (worker_name) {
    const worker = await findWorkerByName(worker_name, user.org_id, client);
    
    let targetDate;
    if (date) {
      const parsed = parseRelativeDate(date);
      targetDate = parsed[0];
    } else {
      targetDate = new Date().toISOString().split('T')[0];
    }
    
    const { data: assignment, error } = await client
      .from('assignments')
      .select(`
        *,
        task:tasks(name, location)
      `)
      .eq('worker_id', worker.id)
      .eq('assigned_date', targetDate)
      .eq('status', 'assigned')
      .single();
    
    if (error || !assignment) {
      throw new Error(`${worker.name} has no assignment for ${targetDate}`);
    }
    
    return {
      worker: worker.name,
      task: assignment.task.name,
      location: assignment.task.location,
      date: targetDate,
    };
  }
  
  throw new Error('Query type not implemented');
}

// Handle timesheet updates
async function handleUpdateTimesheet(data: any, user: any, client: any) {
  const { worker_name, date, hours, status } = data;
  
  const worker = await findWorkerByName(worker_name, user.org_id, client);
  const targetDate = date ? parseRelativeDate(date)[0] : new Date().toISOString().split('T')[0];
  
  // Update assignment status or hours
  const updateData: any = {};
  
  if (status) {
    updateData.status = status; // e.g., 'completed', 'absent'
  }
  
  if (hours !== undefined) {
    updateData.hours_worked = hours;
  }
  
  const { error } = await client
    .from('assignments')
    .update(updateData)
    .eq('worker_id', worker.id)
    .eq('assigned_date', targetDate);
  
  if (error) throw error;
  
  return {
    worker: worker.name,
    date: targetDate,
    updated: updateData,
  };
}

// Handle approval of reassignment requests
async function handleApproveRequest(data: any, user: any, client: any) {
  const { worker_name } = data;
  
  // Find pending request for this worker
  const worker = await findWorkerByName(worker_name, user.org_id, client);
  
  const { data: request, error: requestError } = await client
    .from('assignment_requests')
    .select('*')
    .eq('worker_id', worker.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (requestError || !request) {
    throw new Error(`No pending request found for ${worker.name}`);
  }
  
  // Approve the request
  const { error: updateError } = await client
    .from('assignment_requests')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', request.id);
  
  if (updateError) throw updateError;
  
  // TODO: Actually execute the reassignment based on the request

  return {
    worker: worker.name,
    request_id: request.id,
  };
}

// ── New handlers ─────────────────────────────────────────────────────────────

// Create a new worker
async function handleCreateWorker(data: any, user: any, client: any) {
  const { worker_name, role, phone } = data;

  if (!worker_name) throw new Error('Worker name is required');

  const validRoles = ['operator', 'laborer', 'carpenter', 'mason'];
  const workerRole = validRoles.includes(role) ? role : 'laborer';

  // Use first active job site as default
  const { data: jobSites } = await client
    .from('job_sites')
    .select('id')
    .eq('organization_id', user.org_id)
    .eq('status', 'active')
    .limit(1);

  const { data: worker, error } = await client
    .from('workers')
    .insert({
      org_id: user.org_id,
      organization_id: user.org_id,
      job_site_id: jobSites?.[0]?.id || null,
      name: worker_name,
      role: workerRole,
      phone: phone || null,
      status: 'active',
      skills: [],
    })
    .select()
    .single();

  if (error) throw error;

  return { worker_id: worker.id, worker_name: worker.name, role: worker.role };
}

// Edit an existing worker's role, phone, or status
async function handleEditWorker(data: any, user: any, client: any) {
  const { worker_name, updates } = data;

  const worker = await findWorkerByName(worker_name, user.org_id, client);

  const allowedFields = ['role', 'phone', 'status'];
  const safeUpdates: Record<string, any> = {};
  for (const key of allowedFields) {
    if (updates?.[key] !== undefined) safeUpdates[key] = updates[key];
  }

  if (Object.keys(safeUpdates).length === 0) {
    throw new Error('No valid fields to update (allowed: role, phone, status)');
  }

  const { error } = await client
    .from('workers')
    .update(safeUpdates)
    .eq('id', worker.id);

  if (error) throw error;

  return { worker_name: worker.name, updated: safeUpdates };
}

// Create a new job site
async function handleCreateJobSite(data: any, user: any, client: any) {
  const { site_name, address, start_date } = data;

  if (!site_name) throw new Error('Job site name is required');

  const startDate = start_date ? parseRelativeDate(start_date)[0] : null;

  const { data: site, error } = await client
    .from('job_sites')
    .insert({
      organization_id: user.org_id,
      name: site_name,
      address: address || null,
      start_date: startDate,
      status: 'active',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  return { site_id: site.id, site_name: site.name };
}

// Invite a new user via the create-user edge function
async function handleInviteUser(data: any, user: any, token: string) {
  const { email, name, role } = data;

  if (!email) throw new Error('Email is required to invite a user');
  if (!name) throw new Error('Name is required to invite a user');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Supabase URL not configured');

  const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      email,
      name,
      role: role || 'worker',
      organization_id: user.org_id,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to invite user (${response.status})`);
  }

  return { email, name, role: role || 'worker' };
}

// Find and return a shared file URL
async function handleOpenFile(data: any, user: any, client: any) {
  const { file_name } = data;

  if (!file_name) throw new Error('File name is required');

  const { data: files, error } = await client
    .from('shared_files')
    .select('id, name, url')
    .eq('organization_id', user.org_id)
    .ilike('name', `%${file_name}%`)
    .limit(5);

  if (error) throw error;
  if (!files || files.length === 0) {
    throw new Error(`No file found matching "${file_name}"`);
  }

  // Return best match (first result from ilike)
  return { file_url: files[0].url, file_name: files[0].name };
}

// Resolve a page name to an app route
function handleNavigate(data: any) {
  const pageMap: Record<string, string> = {
    dashboard: '/dashboard',
    workers: '/workers',
    tasks: '/tasks',
    calendar: '/calendar',
    activities: '/activities',
    'daily-hours': '/daily-hours',
    'daily hours': '/daily-hours',
    timesheet: '/daily-hours',
    files: '/files',
    'shared files': '/files',
    documents: '/files',
    today: '/today',
    profile: '/profile',
  };

  const page = (data.page || '').toLowerCase();
  const path =
    pageMap[page] ||
    Object.entries(pageMap).find(([k]) => page.includes(k))?.[1];

  if (!path) throw new Error(`Unknown page: "${data.page}"`);

  return { navigate_to: path, page: data.page };
}
