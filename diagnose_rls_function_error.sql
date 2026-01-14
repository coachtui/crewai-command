-- ============================================================================
-- DIAGNOSE RLS FUNCTION ERROR - Check user_has_job_site_access function
-- ============================================================================

\echo '============================================'
\echo 'Checking RLS Helper Functions'
\echo '============================================'
\echo ''

-- 1. Check if the function exists and get its definition
\echo '1. user_has_job_site_access Function Definition:'
\echo '----------------------------------------'
SELECT
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'user_has_job_site_access'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

\echo ''

-- 2. Check assignments table structure
\echo '2. Assignments Table Structure:'
\echo '----------------------------------------'
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'assignments'
ORDER BY ordinal_position;

\echo ''

-- 3. Check job_site_assignments table structure (if exists)
\echo '3. Job Site Assignments Table Structure:'
\echo '----------------------------------------'
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'job_site_assignments'
ORDER BY ordinal_position;

\echo ''

-- 4. List all RLS helper functions
\echo '4. All RLS Helper Functions:'
\echo '----------------------------------------'
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND (
    proname LIKE '%user%'
    OR proname LIKE '%job_site%'
    OR proname LIKE '%org%'
    OR proname LIKE '%access%'
  )
ORDER BY proname;

\echo ''
\echo '============================================'
\echo 'DIAGNOSIS COMPLETE'
\echo '============================================'
