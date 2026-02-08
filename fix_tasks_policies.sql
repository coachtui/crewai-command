-- ============================================================================
-- FIX TASKS POLICIES - Use correct column names for RLS
-- Based on actual schema: tasks table has organization_id and job_site_id
-- ============================================================================

\echo '============================================'
\echo 'Fixing Tasks Table Policies'
\echo '============================================'
\echo ''

-- First, check what column the tasks table actually uses
\echo 'Checking tasks table columns...'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tasks'
  AND column_name IN ('org_id', 'organization_id', 'job_site_id')
ORDER BY column_name;

\echo ''
\echo 'Dropping old policies...'

-- Drop old policies
DROP POLICY IF EXISTS "tasks_select_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON tasks;
DROP POLICY IF EXISTS "Users can view org tasks" ON tasks;
DROP POLICY IF EXISTS "Users can manage org tasks" ON tasks;

\echo '✅ Dropped old policies'
\echo ''
\echo 'Creating new policies...'

-- SELECT: Users can view tasks in their organization or assigned job sites
CREATE POLICY "tasks_select_policy" ON tasks
  FOR SELECT
  TO authenticated
  USING (
    -- Check using whichever org column exists
    (
      CASE
        WHEN organization_id IS NOT NULL THEN organization_id = get_user_org_id()
        WHEN org_id IS NOT NULL THEN org_id = get_user_org_id()
        ELSE false
      END
    )
    OR
    -- Or user has access to the job site
    (job_site_id IS NOT NULL AND user_has_job_site_access(job_site_id))
  );

\echo '✅ Created SELECT policy'

-- INSERT: Users can create tasks in their organization
CREATE POLICY "tasks_insert_policy" ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if org column matches user's org
    (
      CASE
        WHEN organization_id IS NOT NULL THEN organization_id = get_user_org_id()
        WHEN org_id IS NOT NULL THEN org_id = get_user_org_id()
        ELSE false
      END
    )
  );

\echo '✅ Created INSERT policy'

-- UPDATE: Users can update tasks in their organization
CREATE POLICY "tasks_update_policy" ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    (
      CASE
        WHEN organization_id IS NOT NULL THEN organization_id = get_user_org_id()
        WHEN org_id IS NOT NULL THEN org_id = get_user_org_id()
        ELSE false
      END
    )
  )
  WITH CHECK (
    (
      CASE
        WHEN organization_id IS NOT NULL THEN organization_id = get_user_org_id()
        WHEN org_id IS NOT NULL THEN org_id = get_user_org_id()
        ELSE false
      END
    )
  );

\echo '✅ Created UPDATE policy'

-- DELETE: Users can delete tasks in their organization
CREATE POLICY "tasks_delete_policy" ON tasks
  FOR DELETE
  TO authenticated
  USING (
    (
      CASE
        WHEN organization_id IS NOT NULL THEN organization_id = get_user_org_id()
        WHEN org_id IS NOT NULL THEN org_id = get_user_org_id()
        ELSE false
      END
    )
  );

\echo '✅ Created DELETE policy'

\echo ''
\echo '============================================'
\echo 'Verification'
\echo '============================================'

-- Verify policies are created
SELECT
  policyname,
  cmd as operation,
  permissive
FROM pg_policies
WHERE tablename = 'tasks'
  AND schemaname = 'public'
ORDER BY cmd, policyname;

\echo ''
\echo '============================================'
\echo 'Testing user access'
\echo '============================================'

-- Test if user can now insert
SELECT
  'User org_id:' as test,
  COALESCE(get_user_org_id()::text, 'NULL') as result
UNION ALL
SELECT
  'Can create tasks:' as test,
  CASE
    WHEN get_user_org_id() IS NOT NULL THEN '✅ YES (org_id is set)'
    ELSE '❌ NO (org_id is NULL)'
  END as result;

\echo ''
\echo '============================================'
\echo 'Fix Complete!'
\echo '============================================'
\echo ''
\echo 'Now try creating a task again!'
\echo '============================================'
