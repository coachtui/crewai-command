-- ============================================================================
-- DIAGNOSE TASKS TABLE ISSUE
-- Run this first to identify what's missing
-- ============================================================================

-- Check 1: Does the tasks table exist?
SELECT
  CASE
    WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'tasks')
    THEN '✅ Tasks table exists'
    ELSE '❌ Tasks table DOES NOT exist - run SUPABASE_SETUP.md first'
  END AS table_check;

-- Check 2: What columns currently exist in tasks table?
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE
    WHEN column_name IN (
      'name', 'location', 'start_date', 'end_date',
      'required_operators', 'required_laborers',
      'required_carpenters', 'required_masons',
      'status', 'notes', 'include_saturday', 'include_sunday',
      'include_holidays', 'attachments', 'org_id', 'created_by'
    ) THEN '✅'
    ELSE '⚠️'
  END AS required_column
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY ordinal_position;

-- Check 3: What columns are MISSING?
WITH required_columns AS (
  SELECT unnest(ARRAY[
    'name', 'location', 'start_date', 'end_date',
    'required_operators', 'required_laborers',
    'required_carpenters', 'required_masons',
    'status', 'notes', 'include_saturday', 'include_sunday',
    'include_holidays', 'attachments', 'org_id', 'created_by'
  ]) AS column_name
),
existing_columns AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'tasks'
)
SELECT
  '❌ MISSING: ' || rc.column_name AS missing_columns
FROM required_columns rc
WHERE rc.column_name NOT IN (SELECT column_name FROM existing_columns);

-- Check 4: What RLS policies exist on tasks?
SELECT
  policyname,
  cmd AS operation,
  CASE
    WHEN cmd = 'SELECT' THEN '✅'
    WHEN cmd = 'INSERT' THEN '✅ CRITICAL'
    WHEN cmd = 'UPDATE' THEN '✅'
    WHEN cmd = 'DELETE' THEN '✅'
    WHEN cmd = 'ALL' THEN '✅ ALL OPERATIONS'
    ELSE '⚠️'
  END AS importance,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'tasks'
ORDER BY cmd;

-- Check 5: Is there an INSERT policy?
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'tasks'
      AND (cmd = 'INSERT' OR cmd = 'ALL')
    )
    THEN '✅ INSERT policy exists'
    ELSE '❌ NO INSERT POLICY - This is likely why you get 400 error!'
  END AS insert_policy_check;

-- Check 6: Is RLS enabled?
SELECT
  tablename,
  CASE
    WHEN rowsecurity THEN '✅ RLS is enabled'
    ELSE '⚠️ RLS is disabled (this is actually okay for testing)'
  END AS rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.tablename = 'tasks' AND t.schemaname = 'public';

-- Check 7: Test if current user can insert (requires being authenticated)
-- Note: This will only work if you run it while authenticated
SELECT
  auth.uid() AS current_user_id,
  CASE
    WHEN auth.uid() IS NULL THEN '❌ Not authenticated - cannot test INSERT permission'
    ELSE '✅ Authenticated'
  END AS auth_status;

-- Check 8: Get user's org_id to verify it matches
SELECT
  u.id AS user_id,
  u.org_id,
  u.name,
  u.base_role,
  '✅ This is the org_id you should use when creating tasks' AS note
FROM users u
WHERE u.id = auth.uid()
UNION ALL
SELECT
  up.id AS user_id,
  up.org_id,
  up.name,
  up.base_role,
  '✅ This is the org_id you should use when creating tasks' AS note
FROM user_profiles up
WHERE up.id = auth.uid();

-- ============================================================================
-- SUMMARY
-- ============================================================================
DO $$
DECLARE
  missing_cols INTEGER;
  has_insert_policy BOOLEAN;
BEGIN
  -- Count missing columns
  SELECT COUNT(*) INTO missing_cols
  FROM (
    SELECT unnest(ARRAY[
      'name', 'location', 'start_date', 'end_date',
      'required_operators', 'required_laborers',
      'required_carpenters', 'required_masons',
      'status', 'notes', 'include_saturday', 'include_sunday',
      'include_holidays', 'attachments', 'org_id', 'created_by'
    ]) AS column_name
  ) required
  WHERE column_name NOT IN (
    SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks'
  );

  -- Check for INSERT policy
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tasks'
    AND (cmd = 'INSERT' OR cmd = 'ALL')
  ) INTO has_insert_policy;

  RAISE NOTICE '============================================';
  RAISE NOTICE 'DIAGNOSIS COMPLETE';
  RAISE NOTICE '============================================';

  IF missing_cols > 0 THEN
    RAISE NOTICE '❌ PROBLEM: Missing % columns in tasks table', missing_cols;
    RAISE NOTICE '   → Run fix_tasks_table_complete.sql to add missing columns';
  ELSE
    RAISE NOTICE '✅ All required columns exist';
  END IF;

  IF NOT has_insert_policy THEN
    RAISE NOTICE '❌ PROBLEM: No INSERT policy on tasks table';
    RAISE NOTICE '   → Run fix_tasks_table_complete.sql to add RLS policies';
  ELSE
    RAISE NOTICE '✅ INSERT policy exists';
  END IF;

  IF missing_cols = 0 AND has_insert_policy THEN
    RAISE NOTICE '✅ Tasks table looks good! Check browser console for other errors.';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT STEP: Run fix_tasks_table_complete.sql to fix these issues';
  END IF;

  RAISE NOTICE '============================================';
END $$;
