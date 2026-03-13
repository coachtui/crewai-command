import { supabase } from '../supabase';
import type { Worker, WorkerSiteAssignment } from '../../types';

export async function fetchAllWorkers(orgId: string): Promise<Worker[]> {
  const { data, error } = await supabase
    .from('workers')
    .select(`
      *,
      job_site:job_sites(id, name)
    `)
    .eq('organization_id', orgId)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function moveWorker(workerId: string, toSiteId: string): Promise<Worker> {
  const { data, error } = await supabase
    .from('workers')
    .update({ job_site_id: toSiteId })
    .eq('id', workerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchWorkerSiteAssignments(workerId: string): Promise<WorkerSiteAssignment[]> {
  const { data, error } = await supabase
    .from('worker_site_assignments')
    .select('*, job_site:job_sites(id, name)')
    .eq('worker_id', workerId)
    .eq('is_active', true)
    .order('start_date', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

export async function assignWorkerToSite(params: {
  worker_id: string;
  job_site_id: string;
  start_date?: string;
  end_date?: string;
  assigned_by?: string;
  notes?: string;
}): Promise<WorkerSiteAssignment> {
  const { data, error } = await supabase
    .from('worker_site_assignments')
    .insert({ ...params, is_active: true })
    .select('*, job_site:job_sites(id, name)')
    .single();

  if (error) throw error;
  return data;
}

export async function removeWorkerSiteAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from('worker_site_assignments')
    .update({ is_active: false })
    .eq('id', assignmentId);

  if (error) throw error;
}

export async function updateWorkerSiteAssignment(
  assignmentId: string,
  updates: { start_date?: string; end_date?: string; notes?: string }
): Promise<WorkerSiteAssignment> {
  const { data, error } = await supabase
    .from('worker_site_assignments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', assignmentId)
    .select('*, job_site:job_sites(id, name)')
    .single();

  if (error) throw error;
  return data;
}
