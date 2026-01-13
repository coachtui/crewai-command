// ============================================================================
// CrewAI Command: Create Job Site API
// POST /api/job-sites/create
// ============================================================================

import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

interface CreateJobSiteRequest {
  name: string;
  address?: string;
  description?: string;
  status?: 'active' | 'on_hold' | 'completed';
  start_date?: string;
  end_date?: string;
  organization_id: string;
  created_by: string;
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

    const body: CreateJobSiteRequest = await req.json();

    // Validate required fields
    if (!body.name || !body.organization_id || !body.created_by) {
      return new Response(JSON.stringify({ error: 'Missing required fields: name, organization_id, created_by' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify the creator is an admin in the organization
    const { data: creator, error: creatorError } = await supabase
      .from('user_profiles')
      .select('base_role, org_id')
      .eq('id', body.created_by)
      .single();

    if (creatorError || !creator) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (creator.base_role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can create job sites' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (creator.org_id !== body.organization_id) {
      return new Response(JSON.stringify({ error: 'Cannot create job site in another organization' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create the job site
    const { data: jobSite, error: jobSiteError } = await supabase
      .from('job_sites')
      .insert({
        name: body.name,
        address: body.address,
        description: body.description,
        status: body.status || 'active',
        start_date: body.start_date,
        end_date: body.end_date,
        organization_id: body.organization_id,
        created_by: body.created_by,
      })
      .select()
      .single();

    if (jobSiteError) {
      return new Response(JSON.stringify({ error: jobSiteError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      job_site: jobSite 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Create job site error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to create job site',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
