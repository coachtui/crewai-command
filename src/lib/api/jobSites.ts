import { supabase } from '../supabase';
import type { JobSite } from '../../types';

export interface CreateJobSiteData {
  name: string;
  address?: string;
  description?: string;
  status: 'active' | 'on_hold' | 'completed';
  start_date?: string;
  end_date?: string;
  organization_id: string;
  created_by?: string;
}

export async function fetchJobSites(orgId: string): Promise<JobSite[]> {
  const { data, error } = await supabase
    .from('job_sites')
    .select('*')
    .eq('organization_id', orgId)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function createJobSite(jobSiteData: CreateJobSiteData): Promise<JobSite> {
  const { data, error } = await supabase
    .from('job_sites')
    .insert([jobSiteData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJobSite(id: string, updates: Partial<JobSite>): Promise<JobSite> {
  const { data, error } = await supabase
    .from('job_sites')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteJobSite(id: string): Promise<void> {
  // Check if there are workers assigned to this job site
  const { data: workers, error: workerError } = await supabase
    .from('workers')
    .select('id')
    .eq('job_site_id', id)
    .limit(1);

  if (workerError) throw workerError;

  if (workers && workers.length > 0) {
    throw new Error('Cannot delete job site with active workers. Please reassign or remove workers first.');
  }

  // Check if there are tasks assigned to this job site
  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('id')
    .eq('job_site_id', id)
    .limit(1);

  if (taskError) throw taskError;

  if (tasks && tasks.length > 0) {
    throw new Error('Cannot delete job site with active tasks. Please reassign or remove tasks first.');
  }

  const { error } = await supabase
    .from('job_sites')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
