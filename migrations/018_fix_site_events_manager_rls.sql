-- ============================================================================
-- Migration 018: Fix Site Events RLS for Manager Role
--
-- Problem: migrations/008_site_events.sql defined site_events_view_policy and
-- site_events_manage_policy before the 'manager' role existed (added in 010).
-- The existing policies never check is_user_manager(), so manager users:
--   - Cannot SELECT site events (get_user_job_site_ids() returns [] for managers)
--   - Cannot INSERT/UPDATE/DELETE site events (same reason)
--
-- Fix: Recreate both policies to check is_user_manager() first,
-- matching the pattern established in migration 014 (crews fix).
-- ============================================================================

DROP POLICY IF EXISTS "site_events_view_policy"   ON site_events;
DROP POLICY IF EXISTS "site_events_manage_policy" ON site_events;

-- SELECT: manager sees all org events; admin/supers see their assigned sites
CREATE POLICY "site_events_view_policy" ON site_events
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (
      is_user_manager()
      OR is_user_admin()
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

-- ALL: manager = org-wide; admin = org-wide; supers/engineers = their sites
CREATE POLICY "site_events_manage_policy" ON site_events
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND (
      is_user_manager()
      OR is_user_admin()
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN (
          'superintendent',
          'engineer_as_superintendent',
          'engineer'
        )
      )
    )
  );
