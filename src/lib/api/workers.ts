import { supabase } from '../supabase';
import type { Worker } from '../../types';

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
