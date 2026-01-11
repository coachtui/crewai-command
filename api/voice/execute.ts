import { findWorkerByName, findTaskByName, parseRelativeDate, getCurrentUser, supabase } from './_helpers.js';

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

    // Get current user
    const user = await getCurrentUser();

    // Execute based on action type
    let result;
    switch (intent.action) {
      case 'reassign_worker':
        result = await handleReassignWorker(intent.data, user);
        break;
      
      case 'create_task':
        result = await handleCreateTask(intent.data, user);
        break;
      
      case 'query_info':
        result = await handleQueryInfo(intent.data, user);
        break;
      
      case 'update_timesheet':
        result = await handleUpdateTimesheet(intent.data, user);
        break;
      
      case 'approve_request':
        result = await handleApproveRequest(intent.data, user);
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
async function handleReassignWorker(data: any, user: any) {
  const { worker_name, to_task_name, dates } = data;
  
  // Find worker
  const worker = await findWorkerByName(worker_name, user.org_id);
  
  // Find target task
  const toTask = await findTaskByName(to_task_name, user.org_id);
  
  // Parse dates
  const targetDates = dates || parseRelativeDate('tomorrow');
  
  // For each date, remove existing assignment and create new one
  for (const date of targetDates) {
    // Delete existing assignments for this worker on this date
    await supabase
      .from('assignments')
      .delete()
      .eq('worker_id', worker.id)
      .eq('assigned_date', date);
    
    // Create new assignment
    await supabase
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
async function handleCreateTask(data: any, user: any) {
  const { task_name, location, required_operators, required_laborers, start_date } = data;
  
  const dates = start_date ? parseRelativeDate(start_date) : parseRelativeDate('tomorrow');
  
  const { data: task, error } = await supabase
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
async function handleQueryInfo(data: any, user: any) {
  const { query_type, worker_name, date } = data;
  
  if (query_type === 'worker_location') {
    // Find where worker is assigned today
    const worker = await findWorkerByName(worker_name, user.org_id);
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const { data: assignment, error } = await supabase
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
  
  // Add more query types as needed
  throw new Error('Query type not implemented');
}

// Handle timesheet updates
async function handleUpdateTimesheet(data: any, user: any) {
  const { worker_name, date, hours, status } = data;
  
  const worker = await findWorkerByName(worker_name, user.org_id);
  const targetDate = date ? parseRelativeDate(date)[0] : new Date().toISOString().split('T')[0];
  
  // Update assignment status or hours
  const updateData: any = {};
  
  if (status) {
    updateData.status = status; // e.g., 'completed', 'absent'
  }
  
  if (hours !== undefined) {
    updateData.hours_worked = hours;
  }
  
  const { error } = await supabase
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
async function handleApproveRequest(data: any, user: any) {
  const { worker_name } = data;
  
  // Find pending request for this worker
  const worker = await findWorkerByName(worker_name, user.org_id);
  
  const { data: request, error: requestError } = await supabase
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
  const { error: updateError } = await supabase
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
