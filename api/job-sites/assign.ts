// ============================================================================
// CrewAI Command: Assign User to Job Site API
// POST /api/job-sites/assign
// ============================================================================

import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

interface AssignUserRequest {
  user_id: string;
  job_site_id: string;
  role: 'superintendent' | 'engineer' | 'engineer_as_superintendent' | 'foreman' | 'worker';
  start_date?: string;
  assigned_by: string;
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

    const body: AssignUserRequest = await req.json();

    // Validate required fields
    if (!body.user_id || !body.job_site_id || !body.role || !body.assigned_by) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the assigner's info
    const { data: assigner, error: assignerError } = await supabase
      .from('user_profiles')
      .select('base_role, org_id')
      .eq('id', body.assigned_by)
      .single();

    if (assignerError || !assigner) {
      return new Response(JSON.stringify({ error: 'Assigner not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify the job site exists and belongs to the same organization
    const { data: jobSite, error: jobSiteError } = await supabase
      .from('job_sites')
      .select('organization_id')
      .eq('id', body.job_site_id)
      .single();

    if (jobSiteError || !jobSite) {
      return new Response(JSON.stringify({ error: 'Job site not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (jobSite.organization_id !== assigner.org_id) {
      return new Response(JSON.stringify({ error: 'Job site not in your organization' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check assigner's permission
    const canAssign = assigner.base_role === 'admin' || assigner.base_role === 'superintendent';
    
    if (!canAssign) {
      // Check if they're a superintendent on this specific job site
      const { data: assignerAssignment } = await supabase
        .from('job_site_assignments')
        .select('role')
        .eq('user_id', body.assigned_by)
        .eq('job_site_id', body.job_site_id)
        .eq('is_active', true)
        .single();

      if (!assignerAssignment || !['superintendent', 'engineer_as_superintendent'].includes(assignerAssignment.role)) {
        return new Response(JSON.stringify({ error: 'Only admins and superintendents can assign users to job sites' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Verify the user to be assigned exists and is in the same organization
    const { data: targetUser, error: targetUserError } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('id', body.user_id)
      .single();

    if (targetUserError || !targetUser) {
      return new Response(JSON.stringify({ error: 'User to assign not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (targetUser.org_id !== assigner.org_id) {
      return new Response(JSON.stringify({ error: 'Cannot assign user from another organization' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user already has an active assignment to this job site
    const { data: existingAssignment } = await supabase
      .from('job_site_assignments')
      .select('id')
      .eq('user_id', body.user_id)
      .eq('job_site_id', body.job_site_id)
      .eq('is_active', true)
      .single();

    if (existingAssignment) {
      // Update the existing assignment instead of creating a new one
      const { data: updatedAssignment, error: updateError } = await supabase
        .from('job_site_assignments')
        .update({
          role: body.role,
          assigned_by: body.assigned_by,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAssignment.id)
        .select()
        .single();

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        success: true,
        assignment: updatedAssignment,
        updated: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create new assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('job_site_assignments')
      .insert({
        user_id: body.user_id,
        job_site_id: body.job_site_id,
        role: body.role,
        start_date: body.start_date || new Date().toISOString().split('T')[0],
        is_active: true,
        assigned_by: body.assigned_by,
      })
      .select()
      .single();

    if (assignmentError) {
      return new Response(JSON.stringify({ error: assignmentError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      assignment: assignment 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Assign user error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to assign user to job site',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
