-- ============================================================================
-- FIX ASSIGNMENTS POLICIES - Use correct column names
-- Based on actual schema: assignments table has organization_id, NOT org_id
-- ============================================================================

\echo '============================================'
\echo 'Fixing Assignments Table Policies'
\echo '============================================'
\echo ''

-- Drop and recreate policies for assignments table with correct column names
DROP POLICY IF EXISTS "assignments_update" ON assignments;
DROP POLICY IF EXISTS "assignments_update_policy" ON assignments;
DROP POLICY IF EXISTS "assignments_insert_policy" ON assignments;
DROP POLICY IF EXISTS "assignments_delete_policy" ON assignments;
DROP POLICY IF EXISTS "assignments_select_policy" ON assignments;

\echo '✅ Dropped old policies'

-- SELECT: Users can view assignments in their organization
CREATE POLICY "assignments_select_policy" ON assignments
  FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    OR user_has_job_site_access(job_site_id)
  );

\echo '✅ Created SELECT policy'

-- INSERT: Users can create assignments in their organization
CREATE POLICY "assignments_insert_policy" ON assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR user_has_job_site_access(job_site_id)
    )
  );

\echo '✅ Created INSERT policy'

-- UPDATE: Users can update assignments in their organization
CREATE POLICY "assignments_update_policy" ON assignments
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR user_has_job_site_access(job_site_id)
    )
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR user_has_job_site_access(job_site_id)
    )
  );

\echo '✅ Created UPDATE policy'

-- DELETE: Only admins can delete assignments
CREATE POLICY "assignments_delete_policy" ON assignments
  FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND is_user_admin()
  );

\echo '✅ Created DELETE policy'

\echo ''
\echo '============================================'
\echo 'Verification'
\echo '============================================'

-- Verify policies are created
SELECT
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename = 'assignments'
  AND schemaname = 'public'
ORDER BY cmd, policyname;

\echo ''
\echo '============================================'
\echo 'Fix Complete!'
\echo '============================================'
\echo ''
\echo 'Now try creating a task again!'
\echo '============================================'
