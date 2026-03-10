-- Migration 011: Fix daily_hours RLS policies and grant foreman write access
--
-- Problem: All existing daily_hours write policies reference the legacy `org_id`
-- column, which was renamed to `organization_id` in migration 001. This silently
-- breaks INSERT/UPDATE/DELETE for all users including superintendents.
--
-- Fix: Drop all stale policies, recreate using get_user_org_id() helper and
-- job_site_id-based access following the migration 010 manager/admin pattern.
-- Foreman site role is explicitly included in write access.
-- Manager check is inlined as a subquery (avoids dependency on is_user_manager()).

-- ============================================================================
-- PART 1: DROP ALL STALE daily_hours POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view daily hours in their organization"   ON daily_hours;
DROP POLICY IF EXISTS "Users can insert daily hours in their organization" ON daily_hours;
DROP POLICY IF EXISTS "Users can update daily hours in their organization" ON daily_hours;
DROP POLICY IF EXISTS "Users can delete daily hours in their organization" ON daily_hours;
DROP POLICY IF EXISTS "Users can view daily_hours in their org"            ON daily_hours;
DROP POLICY IF EXISTS "Viewers can view daily_hours"                       ON daily_hours;
DROP POLICY IF EXISTS "daily_hours_view_policy"                            ON daily_hours;
DROP POLICY IF EXISTS "daily_hours_insert_policy"                          ON daily_hours;
DROP POLICY IF EXISTS "daily_hours_update_policy"                          ON daily_hours;
DROP POLICY IF EXISTS "daily_hours_delete_policy"                          ON daily_hours;

-- ============================================================================
-- PART 2: RECREATE POLICIES
-- Uses only pre-existing helper functions: get_user_org_id(), is_user_admin(),
-- get_user_job_site_ids(), get_user_site_role()
-- Manager check is inlined to avoid dependency on is_user_manager()
-- ============================================================================

-- SELECT: manager/admin see all org hours; others see their assigned sites only
CREATE POLICY "daily_hours_view_policy" ON daily_hours
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND base_role = 'manager')
      OR is_user_admin()
      OR job_site_id IS NULL
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

-- INSERT: manager = all org; admin = their sites; superintendent/foreman = their sites
CREATE POLICY "daily_hours_insert_policy" ON daily_hours
  FOR INSERT WITH CHECK (
    organization_id = get_user_org_id()
    AND (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND base_role = 'manager')
      OR (is_user_admin() AND (job_site_id IS NULL OR job_site_id = ANY(get_user_job_site_ids())))
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent', 'foreman')
      )
    )
  );

-- UPDATE: same rules as INSERT
CREATE POLICY "daily_hours_update_policy" ON daily_hours
  FOR UPDATE USING (
    organization_id = get_user_org_id()
    AND (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND base_role = 'manager')
      OR (is_user_admin() AND (job_site_id IS NULL OR job_site_id = ANY(get_user_job_site_ids())))
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent', 'foreman')
      )
    )
  );

-- DELETE: same rules as INSERT
CREATE POLICY "daily_hours_delete_policy" ON daily_hours
  FOR DELETE USING (
    organization_id = get_user_org_id()
    AND (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND base_role = 'manager')
      OR (is_user_admin() AND (job_site_id IS NULL OR job_site_id = ANY(get_user_job_site_ids())))
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent', 'foreman')
      )
    )
  );

-- ============================================================================
-- VERIFICATION
-- Run these queries to confirm the migration worked:
--
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'daily_hours' ORDER BY cmd;
-- Expected: 4 policies (daily_hours_view_policy, daily_hours_insert_policy,
--           daily_hours_update_policy, daily_hours_delete_policy)
-- ============================================================================
