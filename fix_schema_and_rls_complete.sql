-- ============================================================================
-- COMPLETE SCHEMA + RLS FIX
-- This script fixes BOTH missing schema elements AND RLS policies
-- Safe to run multiple times (idempotent)
-- ============================================================================

BEGIN;

\echo ''
\echo '============================================'
\echo 'Starting Complete Schema + RLS Fix'
\echo '============================================'
\echo ''

-- ============================================================================
-- STEP 1: ADD MISSING COLUMNS
-- ============================================================================

\echo 'Step 1: Adding missing columns...'

-- Add job_site_id to assignments
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS job_site_id UUID REFERENCES job_sites(id);

-- Add job_site_id to workers
ALTER TABLE workers
ADD COLUMN IF NOT EXISTS job_site_id UUID REFERENCES job_sites(id);

-- Add job_site_id to tasks
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS job_site_id UUID REFERENCES job_sites(id);

-- Add job_site_id to assignment_requests
ALTER TABLE assignment_requests
ADD COLUMN IF NOT EXISTS job_site_id UUID REFERENCES job_sites(id);

-- Add organization_id to holidays if missing
ALTER TABLE holidays
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

\echo '✅ Columns added'
\echo ''

-- ============================================================================
-- STEP 2: RENAME org_id TO organization_id (FOR CONSISTENCY)
-- ============================================================================

\echo 'Step 2: Standardizing organization column names...'

-- Workers table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workers' AND column_name = 'org_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workers' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE workers RENAME COLUMN org_id TO organization_id;
    RAISE NOTICE 'Renamed workers.org_id → organization_id';
  END IF;
END $$;

-- Tasks table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'org_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE tasks RENAME COLUMN org_id TO organization_id;
    RAISE NOTICE 'Renamed tasks.org_id → organization_id';
  END IF;
END $$;

-- Assignments table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignments' AND column_name = 'org_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignments' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE assignments RENAME COLUMN org_id TO organization_id;
    RAISE NOTICE 'Renamed assignments.org_id → organization_id';
  END IF;
END $$;

-- Assignment requests table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignment_requests' AND column_name = 'org_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignment_requests' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE assignment_requests RENAME COLUMN org_id TO organization_id;
    RAISE NOTICE 'Renamed assignment_requests.org_id → organization_id';
  END IF;
END $$;

\echo '✅ Column names standardized'
\echo ''

-- ============================================================================
-- STEP 3: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

\echo 'Step 3: Creating indexes...'

CREATE INDEX IF NOT EXISTS idx_assignments_org ON assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_assignments_job_site ON assignments(job_site_id);
CREATE INDEX IF NOT EXISTS idx_workers_org ON workers(organization_id);
CREATE INDEX IF NOT EXISTS idx_workers_job_site ON workers(job_site_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_job_site ON tasks(job_site_id);
CREATE INDEX IF NOT EXISTS idx_assignment_requests_org ON assignment_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_assignment_requests_job_site ON assignment_requests(job_site_id);
CREATE INDEX IF NOT EXISTS idx_holidays_org ON holidays(organization_id);

\echo '✅ Indexes created'
\echo ''

-- ============================================================================
-- STEP 4: CREATE/UPDATE HELPER FUNCTIONS
-- ============================================================================

\echo 'Step 4: Creating RLS helper functions...'

-- Function to get user's organization_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT org_id FROM user_profiles WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT base_role = 'admin' FROM user_profiles WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get user's assigned job site IDs
CREATE OR REPLACE FUNCTION get_user_job_site_ids()
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT job_site_id
    FROM job_site_assignments
    WHERE user_id = auth.uid()
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user has access to a job site
CREATE OR REPLACE FUNCTION user_has_job_site_access(site_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Admins have access to all sites in their org
  IF is_user_admin() THEN
    RETURN EXISTS (
      SELECT 1 FROM job_sites
      WHERE id = site_id
      AND organization_id = get_user_org_id()
    );
  END IF;

  -- Non-admins need explicit assignment
  RETURN EXISTS (
    SELECT 1 FROM job_site_assignments
    WHERE user_id = auth.uid()
    AND job_site_id = site_id
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get user's role on a specific job site
CREATE OR REPLACE FUNCTION get_user_site_role(site_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM job_site_assignments
    WHERE user_id = auth.uid()
    AND job_site_id = site_id
    AND is_active = true
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

\echo '✅ Helper functions created'
\echo ''

-- ============================================================================
-- STEP 5: ENABLE RLS ON ALL TABLES
-- ============================================================================

\echo 'Step 5: Enabling RLS...'

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_site_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'task_history') THEN
    ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'task_drafts') THEN
    ALTER TABLE task_drafts ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'users') THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

\echo '✅ RLS enabled on all tables'
\echo ''

-- ============================================================================
-- STEP 6: DROP OLD/INSECURE POLICIES
-- ============================================================================

\echo 'Step 6: Removing old policies...'

-- Drop insecure "Allow all" policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON organizations;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON user_profiles;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON job_sites;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON job_site_assignments;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON workers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON tasks;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON assignments;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON assignment_requests;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON holidays;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON task_history;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON users;

-- Drop any overly broad ALL policies
DROP POLICY IF EXISTS "Users can manage org workers" ON workers;
DROP POLICY IF EXISTS "Users can manage org tasks" ON tasks;
DROP POLICY IF EXISTS "Users can manage org assignments" ON assignments;
DROP POLICY IF EXISTS "Users can manage org assignment_requests" ON assignment_requests;

\echo '✅ Old policies removed'
\echo ''

-- ============================================================================
-- STEP 7: CREATE ORGANIZATIONS POLICIES
-- ============================================================================

\echo 'Step 7: Creating organizations policies...'

DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;

CREATE POLICY "organizations_select_policy" ON organizations
  FOR SELECT
  USING (id = get_user_org_id());

CREATE POLICY "organizations_update_policy" ON organizations
  FOR UPDATE
  USING (id = get_user_org_id() AND is_user_admin());

\echo '✅ Organizations policies created'
\echo ''

-- ============================================================================
-- STEP 8: CREATE USER_PROFILES POLICIES
-- ============================================================================

\echo 'Step 8: Creating user_profiles policies...'

DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;

CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "user_profiles_insert_policy" ON user_profiles
  FOR INSERT
  WITH CHECK (org_id = get_user_org_id() AND is_user_admin());

CREATE POLICY "user_profiles_update_policy" ON user_profiles
  FOR UPDATE
  USING (
    org_id = get_user_org_id()
    AND (id = auth.uid() OR is_user_admin())
  );

CREATE POLICY "user_profiles_delete_policy" ON user_profiles
  FOR DELETE
  USING (org_id = get_user_org_id() AND is_user_admin());

\echo '✅ User_profiles policies created'
\echo ''

-- ============================================================================
-- STEP 9: CREATE JOB_SITES POLICIES
-- ============================================================================

\echo 'Step 9: Creating job_sites policies...'

DROP POLICY IF EXISTS "job_sites_select_policy" ON job_sites;
DROP POLICY IF EXISTS "job_sites_insert_policy" ON job_sites;
DROP POLICY IF EXISTS "job_sites_update_policy" ON job_sites;
DROP POLICY IF EXISTS "job_sites_delete_policy" ON job_sites;

CREATE POLICY "job_sites_select_policy" ON job_sites
  FOR SELECT
  USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR id = ANY(get_user_job_site_ids())
    )
  );

CREATE POLICY "job_sites_insert_policy" ON job_sites
  FOR INSERT
  WITH CHECK (organization_id = get_user_org_id() AND is_user_admin());

CREATE POLICY "job_sites_update_policy" ON job_sites
  FOR UPDATE
  USING (organization_id = get_user_org_id() AND is_user_admin());

CREATE POLICY "job_sites_delete_policy" ON job_sites
  FOR DELETE
  USING (organization_id = get_user_org_id() AND is_user_admin());

\echo '✅ Job_sites policies created'
\echo ''

-- ============================================================================
-- STEP 10: CREATE JOB_SITE_ASSIGNMENTS POLICIES
-- ============================================================================

\echo 'Step 10: Creating job_site_assignments policies...'

DROP POLICY IF EXISTS "job_site_assignments_select_policy" ON job_site_assignments;
DROP POLICY IF EXISTS "job_site_assignments_insert_policy" ON job_site_assignments;
DROP POLICY IF EXISTS "job_site_assignments_update_policy" ON job_site_assignments;
DROP POLICY IF EXISTS "job_site_assignments_delete_policy" ON job_site_assignments;

CREATE POLICY "job_site_assignments_select_policy" ON job_site_assignments
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_user_admin()
    OR (
      job_site_id = ANY(get_user_job_site_ids())
      AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
    )
  );

CREATE POLICY "job_site_assignments_insert_policy" ON job_site_assignments
  FOR INSERT
  WITH CHECK (
    is_user_admin()
    OR (
      job_site_id = ANY(get_user_job_site_ids())
      AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
    )
  );

CREATE POLICY "job_site_assignments_update_policy" ON job_site_assignments
  FOR UPDATE
  USING (
    is_user_admin()
    OR (
      job_site_id = ANY(get_user_job_site_ids())
      AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
    )
  );

CREATE POLICY "job_site_assignments_delete_policy" ON job_site_assignments
  FOR DELETE
  USING (
    is_user_admin()
    OR (
      job_site_id = ANY(get_user_job_site_ids())
      AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
    )
  );

\echo '✅ Job_site_assignments policies created'
\echo ''

-- ============================================================================
-- STEP 11: CREATE WORKERS POLICIES
-- ============================================================================

\echo 'Step 11: Creating workers policies...'

DROP POLICY IF EXISTS "workers_select_policy" ON workers;
DROP POLICY IF EXISTS "workers_insert_policy" ON workers;
DROP POLICY IF EXISTS "workers_update_policy" ON workers;
DROP POLICY IF EXISTS "workers_delete_policy" ON workers;

CREATE POLICY "workers_select_policy" ON workers
  FOR SELECT
  USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR job_site_id IS NULL
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

CREATE POLICY "workers_insert_policy" ON workers
  FOR INSERT
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR job_site_id IS NULL
      OR user_has_job_site_access(job_site_id)
    )
  );

CREATE POLICY "workers_update_policy" ON workers
  FOR UPDATE
  USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR user_has_job_site_access(job_site_id)
    )
  );

CREATE POLICY "workers_delete_policy" ON workers
  FOR DELETE
  USING (organization_id = get_user_org_id() AND is_user_admin());

\echo '✅ Workers policies created'
\echo ''

-- ============================================================================
-- STEP 12: CREATE TASKS POLICIES
-- ============================================================================

\echo 'Step 12: Creating tasks policies...'

DROP POLICY IF EXISTS "tasks_select_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON tasks;

CREATE POLICY "tasks_select_policy" ON tasks
  FOR SELECT
  USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR job_site_id IS NULL
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

CREATE POLICY "tasks_insert_policy" ON tasks
  FOR INSERT
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR job_site_id IS NULL
      OR user_has_job_site_access(job_site_id)
    )
  );

CREATE POLICY "tasks_update_policy" ON tasks
  FOR UPDATE
  USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR user_has_job_site_access(job_site_id)
    )
  );

CREATE POLICY "tasks_delete_policy" ON tasks
  FOR DELETE
  USING (organization_id = get_user_org_id() AND is_user_admin());

\echo '✅ Tasks policies created'
\echo ''

-- ============================================================================
-- STEP 13: CREATE ASSIGNMENTS POLICIES
-- ============================================================================

\echo 'Step 13: Creating assignments policies...'

DROP POLICY IF EXISTS "assignments_select_policy" ON assignments;
DROP POLICY IF EXISTS "assignments_insert_policy" ON assignments;
DROP POLICY IF EXISTS "assignments_update_policy" ON assignments;
DROP POLICY IF EXISTS "assignments_delete_policy" ON assignments;

CREATE POLICY "assignments_select_policy" ON assignments
  FOR SELECT
  USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR job_site_id IS NULL
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

CREATE POLICY "assignments_insert_policy" ON assignments
  FOR INSERT
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR job_site_id IS NULL
      OR user_has_job_site_access(job_site_id)
    )
  );

CREATE POLICY "assignments_update_policy" ON assignments
  FOR UPDATE
  USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR user_has_job_site_access(job_site_id)
    )
  );

CREATE POLICY "assignments_delete_policy" ON assignments
  FOR DELETE
  USING (organization_id = get_user_org_id() AND is_user_admin());

\echo '✅ Assignments policies created'
\echo ''

-- ============================================================================
-- STEP 14: CREATE ASSIGNMENT_REQUESTS POLICIES
-- ============================================================================

\echo 'Step 14: Creating assignment_requests policies...'

DROP POLICY IF EXISTS "assignment_requests_select_policy" ON assignment_requests;
DROP POLICY IF EXISTS "assignment_requests_insert_policy" ON assignment_requests;
DROP POLICY IF EXISTS "assignment_requests_update_policy" ON assignment_requests;
DROP POLICY IF EXISTS "assignment_requests_delete_policy" ON assignment_requests;

CREATE POLICY "assignment_requests_select_policy" ON assignment_requests
  FOR SELECT
  USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR job_site_id IS NULL
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

CREATE POLICY "assignment_requests_insert_policy" ON assignment_requests
  FOR INSERT
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR job_site_id IS NULL
      OR user_has_job_site_access(job_site_id)
    )
  );

CREATE POLICY "assignment_requests_update_policy" ON assignment_requests
  FOR UPDATE
  USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR user_has_job_site_access(job_site_id)
    )
  );

CREATE POLICY "assignment_requests_delete_policy" ON assignment_requests
  FOR DELETE
  USING (organization_id = get_user_org_id() AND is_user_admin());

\echo '✅ Assignment_requests policies created'
\echo ''

-- ============================================================================
-- STEP 15: CREATE HOLIDAYS POLICIES
-- ============================================================================

\echo 'Step 15: Creating holidays policies...'

DROP POLICY IF EXISTS "holidays_select_policy" ON holidays;
DROP POLICY IF EXISTS "holidays_insert_policy" ON holidays;
DROP POLICY IF EXISTS "holidays_update_policy" ON holidays;
DROP POLICY IF EXISTS "holidays_delete_policy" ON holidays;

CREATE POLICY "holidays_select_policy" ON holidays
  FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "holidays_insert_policy" ON holidays
  FOR INSERT
  WITH CHECK (organization_id = get_user_org_id() AND is_user_admin());

CREATE POLICY "holidays_update_policy" ON holidays
  FOR UPDATE
  USING (organization_id = get_user_org_id() AND is_user_admin());

CREATE POLICY "holidays_delete_policy" ON holidays
  FOR DELETE
  USING (organization_id = get_user_org_id() AND is_user_admin());

\echo '✅ Holidays policies created'
\echo ''

-- ============================================================================
-- STEP 16: CREATE OPTIONAL TABLE POLICIES
-- ============================================================================

\echo 'Step 16: Creating optional table policies...'

-- task_history (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'task_history') THEN
    DROP POLICY IF EXISTS "task_history_select_policy" ON task_history;
    DROP POLICY IF EXISTS "task_history_insert_policy" ON task_history;

    CREATE POLICY "task_history_select_policy" ON task_history
      FOR SELECT
      USING (organization_id = get_user_org_id());

    CREATE POLICY "task_history_insert_policy" ON task_history
      FOR INSERT
      WITH CHECK (organization_id = get_user_org_id());

    RAISE NOTICE '✅ task_history policies created';
  END IF;
END $$;

-- task_drafts (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'task_drafts') THEN
    DROP POLICY IF EXISTS "task_drafts_select_policy" ON task_drafts;
    DROP POLICY IF EXISTS "task_drafts_insert_policy" ON task_drafts;
    DROP POLICY IF EXISTS "task_drafts_update_policy" ON task_drafts;
    DROP POLICY IF EXISTS "task_drafts_delete_policy" ON task_drafts;

    CREATE POLICY "task_drafts_select_policy" ON task_drafts
      FOR SELECT
      USING (
        org_id = get_user_org_id()
        AND (is_user_admin() OR created_by = auth.uid())
      );

    CREATE POLICY "task_drafts_insert_policy" ON task_drafts
      FOR INSERT
      WITH CHECK (org_id = get_user_org_id());

    CREATE POLICY "task_drafts_update_policy" ON task_drafts
      FOR UPDATE
      USING (
        org_id = get_user_org_id()
        AND (is_user_admin() OR created_by = auth.uid())
      );

    CREATE POLICY "task_drafts_delete_policy" ON task_drafts
      FOR DELETE
      USING (
        org_id = get_user_org_id()
        AND (is_user_admin() OR created_by = auth.uid())
      );

    RAISE NOTICE '✅ task_drafts policies created';
  END IF;
END $$;

-- users table (if exists - legacy)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'users') THEN
    DROP POLICY IF EXISTS "users_select_policy" ON users;

    CREATE POLICY "users_select_policy" ON users
      FOR SELECT
      USING (org_id = get_user_org_id());

    RAISE NOTICE '✅ users policies created';
  END IF;
END $$;

\echo '✅ Optional table policies created'
\echo ''

-- ============================================================================
-- STEP 17: VERIFICATION
-- ============================================================================

\echo ''
\echo '============================================'
\echo 'VERIFICATION'
\echo '============================================'
\echo ''

\echo 'RLS Status:'
SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status,
  (SELECT COUNT(*)::text || ' policies'
   FROM pg_policies
   WHERE schemaname = 'public' AND pg_policies.tablename = pg_tables.tablename) as policy_count
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations', 'user_profiles', 'job_sites', 'job_site_assignments',
    'workers', 'tasks', 'assignments', 'assignment_requests', 'holidays'
  )
ORDER BY tablename;

\echo ''
\echo '============================================'
\echo 'FIX COMPLETE! ✅'
\echo '============================================'
\echo ''
\echo 'Next steps:'
\echo '1. Verify all tables show "ENABLED" above'
\echo '2. Verify policy counts (should be 4 policies per table)'
\echo '3. Test application with multiple organizations'
\echo '4. Run verify_rls_security.sql for detailed audit'
\echo ''

COMMIT;
