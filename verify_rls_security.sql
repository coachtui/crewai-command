-- ============================================================================
-- RLS SECURITY VERIFICATION SCRIPT
-- Run this against your Supabase database to verify RLS configuration
-- ============================================================================

\echo '============================================'
\echo 'RLS Security Verification Report'
\echo 'Date: ' `date`
\echo '============================================'
\echo ''

-- 1. Check which tables have RLS enabled
\echo '1. Tables with RLS Status:'
\echo '----------------------------------------'
SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

\echo ''
\echo '----------------------------------------'
\echo ''

-- 2. List all RLS policies by table
\echo '2. RLS Policies by Table:'
\echo '----------------------------------------'
SELECT
  tablename,
  policyname,
  cmd as operation,
  CASE
    WHEN permissive = 'PERMISSIVE' THEN '✅ PERMISSIVE'
    ELSE '⚠️ RESTRICTIVE'
  END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

\echo ''
\echo '----------------------------------------'
\echo ''

-- 3. Find tables with RLS enabled but NO policies (SECURITY GAP!)
\echo '3. Tables with RLS but NO Policies (CRITICAL!):'
\echo '----------------------------------------'
SELECT
  t.tablename,
  '❌ NO POLICIES FOUND' as status
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND t.tablename NOT IN (
    SELECT DISTINCT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  )
  AND t.tablename NOT LIKE 'pg_%'
ORDER BY t.tablename;

\echo ''
\echo '----------------------------------------'
\echo ''

-- 4. Verify organization_id/org_id columns exist
\echo '4. Tables with Organization Columns:'
\echo '----------------------------------------'
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name LIKE '%org%' OR column_name LIKE '%organization%')
  AND table_name NOT LIKE 'pg_%'
ORDER BY table_name, column_name;

\echo ''
\echo '----------------------------------------'
\echo ''

-- 5. Check if RLS helper functions exist
\echo '5. RLS Helper Functions:'
\echo '----------------------------------------'
SELECT
  proname as function_name,
  CASE
    WHEN prosecdef THEN '✅ SECURITY DEFINER'
    ELSE '⚠️ INVOKER RIGHTS'
  END as security_mode,
  pg_get_function_result(oid) as return_type
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND (
    proname LIKE '%user%'
    OR proname LIKE '%org%'
    OR proname LIKE '%job_site%'
  )
ORDER BY proname;

\echo ''
\echo '----------------------------------------'
\echo ''

-- 6. Count policies per table (should have at least SELECT, INSERT, UPDATE, DELETE)
\echo '6. Policy Count by Table (Should have 4+):'
\echo '----------------------------------------'
SELECT
  tablename,
  COUNT(*) as policy_count,
  CASE
    WHEN COUNT(*) >= 4 THEN '✅ COMPLETE'
    WHEN COUNT(*) >= 2 THEN '⚠️ PARTIAL'
    ELSE '❌ INCOMPLETE'
  END as completeness
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY policy_count ASC, tablename;

\echo ''
\echo '----------------------------------------'
\echo ''

-- 7. Verify specific critical tables have RLS
\echo '7. Critical Tables RLS Status:'
\echo '----------------------------------------'
WITH critical_tables AS (
  SELECT unnest(ARRAY[
    'organizations',
    'user_profiles',
    'users',
    'job_sites',
    'job_site_assignments',
    'workers',
    'tasks',
    'assignments',
    'assignment_requests',
    'daily_hours',
    'task_history',
    'task_drafts',
    'holidays',
    'activities'
  ]) AS table_name
)
SELECT
  ct.table_name,
  COALESCE(
    (SELECT CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END
     FROM pg_tables
     WHERE schemaname = 'public' AND tablename = ct.table_name),
    '❌ TABLE NOT FOUND'
  ) as rls_status,
  COALESCE(
    (SELECT COUNT(*)::text || ' policies'
     FROM pg_policies
     WHERE schemaname = 'public' AND tablename = ct.table_name),
    '0 policies'
  ) as policy_count
FROM critical_tables ct
ORDER BY ct.table_name;

\echo ''
\echo '============================================'
\echo 'End of RLS Verification Report'
\echo '============================================'
