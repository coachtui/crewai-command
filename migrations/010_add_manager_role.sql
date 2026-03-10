-- ============================================================================
-- Migration 010: Add Manager Role
--
-- Inserts 'manager' above 'admin' in the role hierarchy:
--   manager → admin → superintendent → foreman → worker
--
-- Manager: company-wide authority (what admin previously had)
-- Admin: job-site-scoped authority (can do everything within assigned sites)
--
-- SAFETY NOTE: Existing admin users are auto-assigned to all current job sites
-- so they don't lose access immediately after this change.
-- ============================================================================

-- ============================================================================
-- PART 1: WIDEN CHECK CONSTRAINT TO INCLUDE 'manager'
-- ============================================================================

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_base_role_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_base_role_check
  CHECK (base_role IN ('manager', 'admin', 'superintendent', 'engineer', 'foreman', 'worker'));

-- ============================================================================
-- PART 2: ADD is_user_manager() HELPER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION is_user_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT base_role = 'manager' FROM user_profiles WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PART 3: UPDATE user_has_job_site_access() — manager bypasses, admin scoped
-- ============================================================================

CREATE OR REPLACE FUNCTION user_has_job_site_access(site_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Managers have access to all sites in their org
  IF is_user_manager() THEN
    RETURN EXISTS (
      SELECT 1 FROM job_sites
      WHERE id = site_id
      AND organization_id = get_user_org_id()
    );
  END IF;

  -- Admins and non-admins need explicit assignment
  RETURN EXISTS (
    SELECT 1 FROM job_site_assignments
    WHERE user_id = auth.uid()
    AND job_site_id = site_id
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PART 4: DROP ALL AFFECTED RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "profiles_admin_manage_policy" ON user_profiles;
DROP POLICY IF EXISTS "profiles_manager_manage_policy" ON user_profiles;
DROP POLICY IF EXISTS "job_sites_admin_policy" ON job_sites;
DROP POLICY IF EXISTS "assignments_view_own_policy" ON job_site_assignments;
DROP POLICY IF EXISTS "assignments_manage_policy" ON job_site_assignments;
DROP POLICY IF EXISTS "workers_org_access_policy" ON workers;
DROP POLICY IF EXISTS "workers_admin_manage_policy" ON workers;
DROP POLICY IF EXISTS "tasks_view_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_manage_policy" ON tasks;
DROP POLICY IF EXISTS "task_assignments_view_policy" ON assignments;
DROP POLICY IF EXISTS "task_assignments_manage_policy" ON assignments;
DROP POLICY IF EXISTS "assignment_requests_view_policy" ON assignment_requests;
DROP POLICY IF EXISTS "assignment_requests_manage_policy" ON assignment_requests;

-- ============================================================================
-- PART 5: RECREATE RLS POLICIES WITH MANAGER/ADMIN SPLIT
-- ============================================================================

-- user_profiles: manager can manage all profiles in org
CREATE POLICY "profiles_manager_manage_policy" ON user_profiles
  FOR ALL USING (
    org_id = get_user_org_id() AND is_user_manager()
  );

-- user_profiles: admin can manage profiles of users sharing their job sites
CREATE POLICY "profiles_admin_manage_policy" ON user_profiles
  FOR ALL USING (
    org_id = get_user_org_id()
    AND is_user_admin()
    AND id IN (
      SELECT DISTINCT user_id FROM job_site_assignments
      WHERE job_site_id = ANY(get_user_job_site_ids())
      AND is_active = true
    )
  );

-- job_sites: manager gets ALL; admins fall through to job_sites_assigned_view_policy
CREATE POLICY "job_sites_admin_policy" ON job_sites
  FOR ALL USING (
    organization_id = get_user_org_id() AND is_user_manager()
  );

-- job_site_assignments: view own + manager/admin + supers on their sites
CREATE POLICY "assignments_view_own_policy" ON job_site_assignments
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_user_manager()
    OR is_user_admin()
    OR (
      job_site_id = ANY(get_user_job_site_ids())
      AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
    )
  );

-- job_site_assignments: manage — manager + admin + supers
CREATE POLICY "assignments_manage_policy" ON job_site_assignments
  FOR ALL USING (
    is_user_manager()
    OR is_user_admin()
    OR (
      job_site_id = ANY(get_user_job_site_ids())
      AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
    )
  );

-- workers: view — manager/admin see all in org; others see assigned sites
CREATE POLICY "workers_org_access_policy" ON workers
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (
      is_user_manager()
      OR is_user_admin()
      OR job_site_id IS NULL
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

-- workers: manage — manager = all; admin = assigned sites; supers = their sites
CREATE POLICY "workers_admin_manage_policy" ON workers
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND (
      is_user_manager()
      OR (is_user_admin() AND (job_site_id IS NULL OR job_site_id = ANY(get_user_job_site_ids())))
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
      )
    )
  );

-- tasks: view
CREATE POLICY "tasks_view_policy" ON tasks
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (
      is_user_manager()
      OR is_user_admin()
      OR job_site_id IS NULL
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

-- tasks: manage — manager = all; admin = assigned sites; supers = their sites
CREATE POLICY "tasks_manage_policy" ON tasks
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND (
      is_user_manager()
      OR (is_user_admin() AND (job_site_id IS NULL OR job_site_id = ANY(get_user_job_site_ids())))
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
      )
    )
  );

-- assignments (task-worker): view
CREATE POLICY "task_assignments_view_policy" ON assignments
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (
      is_user_manager()
      OR is_user_admin()
      OR job_site_id IS NULL
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

-- assignments (task-worker): manage
CREATE POLICY "task_assignments_manage_policy" ON assignments
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND (
      is_user_manager()
      OR (is_user_admin() AND (job_site_id IS NULL OR job_site_id = ANY(get_user_job_site_ids())))
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent', 'foreman')
      )
    )
  );

-- assignment_requests: view
CREATE POLICY "assignment_requests_view_policy" ON assignment_requests
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (
      is_user_manager()
      OR is_user_admin()
      OR job_site_id IS NULL
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

-- assignment_requests: manage
CREATE POLICY "assignment_requests_manage_policy" ON assignment_requests
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND (
      is_user_manager()
      OR (is_user_admin() AND (job_site_id IS NULL OR job_site_id = ANY(get_user_job_site_ids())))
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent', 'foreman')
      )
    )
  );

-- ============================================================================
-- PART 6: SAFETY — AUTO-ASSIGN EXISTING ADMINS TO ALL JOB SITES
-- Without this, admins who weren't previously assigned to sites will see nothing.
-- We assign them as 'superintendent' at all existing sites in their org.
-- ============================================================================

INSERT INTO job_site_assignments (user_id, job_site_id, role, is_active)
SELECT up.id, js.id, 'superintendent', true
FROM user_profiles up
JOIN job_sites js ON js.organization_id = up.org_id
WHERE up.base_role = 'admin'
  AND (js.is_system_site IS NOT TRUE OR js.is_system_site IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM job_site_assignments jsa
    WHERE jsa.user_id = up.id
    AND jsa.job_site_id = js.id
    AND jsa.is_active = true
  );

-- ============================================================================
-- PART 7: SET tuipaul@gmail.com TO MANAGER
-- ============================================================================

UPDATE user_profiles
  SET base_role = 'manager'
  WHERE email = 'tuipaul@gmail.com';

-- Keep legacy users table in sync (role stays 'admin' for backward compat; base_role is authoritative)
UPDATE users
  SET base_role = 'manager'
  WHERE email = 'tuipaul@gmail.com';

-- ============================================================================
-- VERIFICATION QUERY
-- Run this to confirm the migration worked:
-- SELECT id, email, base_role FROM user_profiles WHERE email = 'tuipaul@gmail.com';
-- ============================================================================
