-- ============================================================================
-- FIX RLS HELPER FUNCTIONS
-- Recreate broken RLS functions that are causing 403 errors
-- ============================================================================

\echo '============================================'
\echo 'Fixing RLS Helper Functions'
\echo '============================================'
\echo ''

-- Don't drop functions - just replace them (they're being used by policies)

-- Function 1: Get current user's organization ID
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT org_id FROM users WHERE id = auth.uid() LIMIT 1),
    (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
  );
$$;

\echo '✅ Created get_user_org_id() function'

-- Function 2: Check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM users WHERE id = auth.uid() LIMIT 1),
    (SELECT role = 'admin' FROM user_profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

\echo '✅ Created is_user_admin() function'

-- Function 3: Check if user has access to a job site
-- IMPORTANT: Keep parameter name as 'site_id' to match existing function signature
CREATE OR REPLACE FUNCTION user_has_job_site_access(site_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    -- Check if user is assigned to this job site
    SELECT 1
    FROM job_site_assignments jsa
    WHERE jsa.job_site_id = site_id
      AND jsa.user_id = auth.uid()
      AND jsa.is_active = true
  )
  OR EXISTS (
    -- Or if user's org owns this job site
    SELECT 1
    FROM job_sites js
    WHERE js.id = site_id
      AND js.organization_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
        UNION
        SELECT org_id FROM user_profiles WHERE id = auth.uid()
      )
  )
  OR is_user_admin(); -- Admins have access to all job sites
$$;

\echo '✅ Created user_has_job_site_access() function'

\echo ''
\echo '============================================'
\echo 'Verifying Functions'
\echo '============================================'

-- Test the functions
SELECT
  'get_user_org_id():' as test,
  COALESCE(get_user_org_id()::text, 'NULL') as result
UNION ALL
SELECT
  'is_user_admin():' as test,
  is_user_admin()::text as result
UNION ALL
SELECT
  'user_has_job_site_access(test):' as test,
  'Function created (pass a UUID to test)' as result;

\echo ''
\echo '============================================'
\echo 'Fix Complete!'
\echo '============================================'
\echo ''
\echo 'Now try creating a task again.'
\echo 'If you still get errors, run diagnose_403_error.sql'
\echo '============================================'
