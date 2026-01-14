-- ============================================================================
-- CHECK ACTUAL SCHEMA - Find out what columns really exist
-- ============================================================================

\echo '============================================'
\echo 'Checking Actual Table Schemas'
\echo '============================================'
\echo ''

-- 1. Check if job_site_assignments table exists
\echo '1. Does job_site_assignments table exist?'
\echo '----------------------------------------'
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'job_site_assignments'
    )
    THEN '✅ YES - Table exists'
    ELSE '❌ NO - Table does NOT exist'
  END as table_status;

\echo ''

-- 2. If it exists, show its columns
\echo '2. job_site_assignments table columns:'
\echo '----------------------------------------'
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'job_site_assignments'
ORDER BY ordinal_position;

\echo ''

-- 3. Check assignments table columns
\echo '3. assignments table columns:'
\echo '----------------------------------------'
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'assignments'
ORDER BY ordinal_position;

\echo ''

-- 4. Check job_sites table columns
\echo '4. job_sites table columns:'
\echo '----------------------------------------'
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'job_sites'
ORDER BY ordinal_position;

\echo ''

-- 5. List all tables in public schema
\echo '5. All tables in public schema:'
\echo '----------------------------------------'
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

\echo ''
\echo '============================================'
\echo 'DONE - Now we know what actually exists'
\echo '============================================'
