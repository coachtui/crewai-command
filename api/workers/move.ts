// ============================================================================
// CrewAI Command: Move Worker Between Job Sites API
// POST /api/workers/move
// ============================================================================

import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

interface MoveWorkerRequest {
  worker_id: string;
  from_site_id: string;
  to_site_id: string;
  effective_date?: string;
  moved_by: string;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: MoveWorkerRequest = await req.json();

    // Validate required fields
    if (!body.worker_id || !body.from_site_id || !body.to_site_id || !body.moved_by) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the mover's info - only admins can move workers between sites
    const { data: mover, error: moverError } = await supabase
      .from('user_profiles')
      .select('base_role, org_id')
      .eq('id', body.moved_by)
      .single();

    if (moverError || !mover) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Only admins can move workers between job sites
    if (mover.base_role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can move workers between job sites' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify both job sites exist and belong to the same organization
    const { data: fromSite, error: fromSiteError } = await supabase
      .from('job_sites')
      .select('organization_id, name')
      .eq('id', body.from_site_id)
      .single();

    if (fromSiteError || !fromSite) {
      return new Response(JSON.stringify({ error: 'Source job site not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: toSite, error: toSiteError } = await supabase
      .from('job_sites')
      .select('organization_id, name')
      .eq('id', body.to_site_id)
      .single();

    if (toSiteError || !toSite) {
      return new Response(JSON.stringify({ error: 'Destination job site not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify job sites are in the same organization
    if (fromSite.organization_id !== toSite.organization_id) {
      return new Response(JSON.stringify({ error: 'Cannot move worker between different organizations' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify mover is in the same organization
    if (fromSite.organization_id !== mover.org_id) {
      return new Response(JSON.stringify({ error: 'Job sites not in your organization' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify the worker exists and belongs to the same organization
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('id, name, organization_id, job_site_id')
      .eq('id', body.worker_id)
      .single();

    if (workerError || !worker) {
      return new Response(JSON.stringify({ error: 'Worker not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (worker.organization_id !== mover.org_id) {
      return new Response(JSON.stringify({ error: 'Worker not in your organization' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const effectiveDate = body.effective_date || new Date().toISOString().split('T')[0];

    // Start transaction-like operations

    // 1. End any current job site assignment for the worker
    const { error: endAssignmentError } = await supabase
      .from('job_site_assignments')
      .update({
        end_date: effectiveDate,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', body.worker_id)
      .eq('job_site_id', body.from_site_id)
      .eq('is_active', true);

    if (endAssignmentError) {
      console.log('Note: Could not end previous assignment (may not exist):', endAssignmentError.message);
    }

    // 2. Create new job site assignment
    const { data: newAssignment, error: newAssignmentError } = await supabase
      .from('job_site_assignments')
      .insert({
        user_id: body.worker_id,
        job_site_id: body.to_site_id,
        role: 'worker',
        start_date: effectiveDate,
        is_active: true,
        assigned_by: body.moved_by,
      })
      .select()
      .single();

    if (newAssignmentError) {
      console.error('Failed to create new assignment:', newAssignmentError);
      // Don't fail completely - the worker update below is the main operation
    }

    // 3. Update the worker's job_site_id
    const { data: updatedWorker, error: updateWorkerError } = await supabase
      .from('workers')
      .update({
        job_site_id: body.to_site_id,
      })
      .eq('id', body.worker_id)
      .select()
      .single();

    if (updateWorkerError) {
      return new Response(JSON.stringify({ error: 'Failed to update worker: ' + updateWorkerError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Successfully moved ${worker.name} from ${fromSite.name} to ${toSite.name}`,
      worker: updatedWorker,
      assignment: newAssignment,
      effective_date: effectiveDate
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Move worker error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to move worker',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
