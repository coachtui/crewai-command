-- ============================================================================
-- Migration 014: Fix Crews RLS for Manager Role
--
-- Problem: migrations/007_crews.sql defined crews_view_policy and
-- crews_manage_policy before the 'manager' role existed. Neither migration
-- 010 nor 012 updated these policies, so manager users:
--   - Cannot SELECT crews (get_user_job_site_ids() returns [] for managers)
--   - Cannot INSERT/UPDATE/DELETE crews (same reason)
--
-- Fix: Recreate both policies to check is_user_manager() first.
-- ============================================================================

DROP POLICY IF EXISTS "crews_view_policy"   ON crews;
DROP POLICY IF EXISTS "crews_manage_policy" ON crews;

-- SELECT: manager sees all org crews; admin/supers see their assigned sites
CREATE POLICY "crews_view_policy" ON crews
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (
      is_user_manager()
      OR is_user_admin()
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

-- ALL: manager = org-wide; admin = assigned sites; supers = their sites
CREATE POLICY "crews_manage_policy" ON crews
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND (
      is_user_manager()
      OR is_user_admin()
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
      )
    )
  );
