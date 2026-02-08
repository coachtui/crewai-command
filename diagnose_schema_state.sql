-- ============================================================================
-- SCHEMA STATE DIAGNOSTIC
-- Run this first to see what needs to be fixed
-- ============================================================================

\echo ''
\echo '============================================'
\echo 'Database Schema State Diagnostic'
\echo '============================================'
\echo ''

-- Check which columns exist
\echo '1. Column Existence Check:'
\echo '----------------------------------------'
SELECT
  table_name,
  column_name,
  '✅ EXISTS' as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('assignments', 'workers', 'tasks', 'assignment_requests', 'job_sites', 'user_profiles', 'organizations')
  AND column_name IN ('job_site_id', 'organization_id', 'org_id', 'base_role')
ORDER BY table_name, column_name;

\echo ''
\echo '2. Helper Functions Check:'
\echo '----------------------------------------'
SELECT
  proname as function_name,
  '✅ EXISTS' as status
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname IN (
    'get_user_org_id',
    'is_user_admin',
    'get_user_job_site_ids',
    'user_has_job_site_access',
    'get_user_site_role'
  )
ORDER BY proname;

\echo ''
\echo '3. RLS Status:'
\echo '----------------------------------------'
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
\echo '4. Recommendation:'
\echo '----------------------------------------'
\echo 'Based on results above:'
\echo '  - If job_site_id columns are MISSING → Run: fix_schema_and_rls_complete.sql'
\echo '  - If job_site_id columns exist but RLS disabled → Run original fix_rls_critical.sql'
\echo '  - If helper functions missing → Run: fix_schema_and_rls_complete.sql'
\echo ''
