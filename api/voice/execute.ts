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
  const { task_name, location, required_operators, required_laborers, start_date } = data;
  
  const dates = start_date ? parseRelativeDate(start_date) : parseRelativeDate('tomorrow');
  
  const { data: task, error } = await client
    .from('tasks')
    .insert({
      org_id: user.org_id,
      name: task_name,
      location: location || null,
      start_date: dates[0],
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
