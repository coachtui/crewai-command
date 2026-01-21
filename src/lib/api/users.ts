import { supabase } from '../supabase';
import type { UserProfile, JobSiteAssignment, BaseRole, JobSiteRole } from '../../types';

export interface InviteUserData {
  email: string;
  name: string;
  phone?: string;
  base_role: BaseRole;
  organization_id: string;
  job_site_assignments?: Array<{
    job_site_id: string;
    role: JobSiteRole;
    start_date?: string;
  }>;
}

export interface AssignUserToSiteData {
  user_id: string;
  job_site_id: string;
  role: JobSiteRole;
  start_date?: string;
  end_date?: string;
  assigned_by: string;
}

export async function fetchUsers(orgId: string): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select(`
      *,
      job_site_assignments:job_site_assignments(
        id,
        job_site_id,
        role,
        is_active,
        start_date,
        end_date,
        job_site:job_sites(id, name)
      )
    `)
    .eq('organization_id', orgId)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function inviteUser(userData: InviteUserData): Promise<UserProfile> {
  // First, create the user profile
  const { data: userProfile, error: userError } = await supabase
    .from('user_profiles')
    .insert([{
      email: userData.email,
      name: userData.name,
      phone: userData.phone,
      base_role: userData.base_role,
      organization_id: userData.organization_id
    }])
    .select()
    .single();

  if (userError) throw userError;

  // Then, create job site assignments if provided
  if (userData.job_site_assignments && userData.job_site_assignments.length > 0) {
    const assignments = userData.job_site_assignments.map(assignment => ({
      user_id: userProfile.id,
      job_site_id: assignment.job_site_id,
      role: assignment.role,
      start_date: assignment.start_date || new Date().toISOString().split('T')[0],
      is_active: true,
      assigned_by: userProfile.id // Self-assignment for new users
    }));

    const { error: assignmentError } = await supabase
      .from('job_site_assignments')
      .insert(assignments);

    if (assignmentError) throw assignmentError;
  }

  // Fetch the complete user profile with assignments
  const { data: completeProfile, error: fetchError } = await supabase
    .from('user_profiles')
    .select(`
      *,
      job_site_assignments:job_site_assignments(
        id,
        job_site_id,
        role,
        is_active,
        start_date,
        end_date,
        job_site:job_sites(id, name)
      )
    `)
    .eq('id', userProfile.id)
    .single();

  if (fetchError) throw fetchError;
  return completeProfile;
}

export async function updateUserBaseRole(userId: string, role: BaseRole): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ base_role: role })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function assignUserToJobSite(assignmentData: AssignUserToSiteData): Promise<JobSiteAssignment> {
  // Check if user already has an active assignment to this job site
  const { data: existing, error: checkError } = await supabase
    .from('job_site_assignments')
    .select('id')
    .eq('user_id', assignmentData.user_id)
    .eq('job_site_id', assignmentData.job_site_id)
    .eq('is_active', true)
    .maybeSingle();

  if (checkError) throw checkError;

  if (existing) {
    throw new Error('User is already assigned to this job site');
  }

  const { data, error } = await supabase
    .from('job_site_assignments')
    .insert([{
      user_id: assignmentData.user_id,
      job_site_id: assignmentData.job_site_id,
      role: assignmentData.role,
      start_date: assignmentData.start_date || new Date().toISOString().split('T')[0],
      end_date: assignmentData.end_date,
      is_active: true,
      assigned_by: assignmentData.assigned_by
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeJobSiteAssignment(assignmentId: string): Promise<void> {
  // Instead of deleting, we set is_active to false and set end_date
  const { error } = await supabase
    .from('job_site_assignments')
    .update({
      is_active: false,
      end_date: new Date().toISOString().split('T')[0]
    })
    .eq('id', assignmentId);

  if (error) throw error;
}

export async function updateJobSiteAssignment(
  assignmentId: string,
  updates: Partial<JobSiteAssignment>
): Promise<JobSiteAssignment> {
  const { data, error } = await supabase
    .from('job_site_assignments')
    .update(updates)
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
