// ============================================================================
// OPS read layer — CRU-side integration contract for the OPS module.
// Read-only. No mutations. All queries are org-scoped and RLS-enforced.
// ============================================================================

import { supabase } from '../supabase';
import type {
  Worker,
  WorkerRole,
  WorkerAvailabilityStatus,
  Assignment,
  SiteEvent,
  SiteEventType,
} from '../../types';

// ── Workers ──────────────────────────────────────────────────────────────────

/**
 * All active workers in an org. Optionally narrow to a single job site.
 */
export async function getWorkersForOrg(
  orgId: string,
  siteId?: string
): Promise<Worker[]> {
  let query = supabase
    .from('workers')
    .select('*, job_site:job_sites(id, name)')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .order('name');

  if (siteId) query = query.eq('job_site_id', siteId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Active workers in an org filtered by primary role.
 */
export async function getWorkersByRole(
  orgId: string,
  role: WorkerRole
): Promise<Worker[]> {
  const { data, error } = await supabase
    .from('workers')
    .select('*, job_site:job_sites(id, name)')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .eq('role', role)
    .order('name');

  if (error) throw error;
  return data || [];
}

/**
 * Active workers in an org filtered by role and availability_status.
 * Defaults to 'available' when availabilityStatus is omitted.
 */
export async function getAvailableWorkersByRole(
  orgId: string,
  role: WorkerRole,
  availabilityStatus: WorkerAvailabilityStatus = 'available'
): Promise<Worker[]> {
  const { data, error } = await supabase
    .from('workers')
    .select('*, job_site:job_sites(id, name)')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .eq('role', role)
    .eq('availability_status', availabilityStatus)
    .order('name');

  if (error) throw error;
  return data || [];
}

/**
 * All active mechanics and drivers across the org.
 * These roles are org-level resources that span job sites.
 */
export async function getMechanicsAndDrivers(orgId: string): Promise<Worker[]> {
  const { data, error } = await supabase
    .from('workers')
    .select('*, job_site:job_sites(id, name)')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .in('role', ['mechanic', 'driver'])
    .order('role')
    .order('name');

  if (error) throw error;
  return data || [];
}

// ── Assignments ───────────────────────────────────────────────────────────────

/**
 * Active assignments in an org within a date range, joined with worker and
 * task data. Optionally narrow to a single job site.
 *
 * Uses assigned_date for the window. Task start_date/end_date are included
 * via the task join for callers that need the full task window.
 */
export async function getAssignmentsInDateRange(
  orgId: string,
  startDate: string,
  endDate: string,
  siteId?: string
): Promise<Assignment[]> {
  let query = supabase
    .from('assignments')
    .select(`
      *,
      worker:workers(id, name, role, availability_status, job_site_id),
      task:tasks(id, name, start_date, end_date, job_site_id)
    `)
    .eq('organization_id', orgId)
    .eq('status', 'assigned')
    .gte('assigned_date', startDate)
    .lte('assigned_date', endDate)
    .order('assigned_date');

  if (siteId) query = query.eq('job_site_id', siteId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Current and future task assignments for a specific worker, from fromDate
 * onward. Includes task and job site context for scheduling visibility.
 */
export async function getWorkerActiveAssignments(
  workerId: string,
  fromDate: string
): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      task:tasks(id, name, start_date, end_date, job_site_id,
        job_site:job_sites(id, name))
    `)
    .eq('worker_id', workerId)
    .eq('status', 'assigned')
    .gte('assigned_date', fromDate)
    .order('assigned_date');

  if (error) throw error;
  return data || [];
}

// ── Site Events ───────────────────────────────────────────────────────────────

/**
 * Site events across all job sites in an org within a date range.
 * Optionally filter by event_type (pour, paving, delivery, inspection, other).
 */
export async function getSiteEventsForOrg(
  orgId: string,
  startDate: string,
  endDate: string,
  eventType?: SiteEventType
): Promise<SiteEvent[]> {
  let query = supabase
    .from('site_events')
    .select('*, job_site:job_sites(id, name)')
    .eq('organization_id', orgId)
    .gte('event_date', startDate)
    .lte('event_date', endDate)
    .order('event_date')
    .order('start_time', { nullsFirst: true });

  if (eventType) query = query.eq('event_type', eventType);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
