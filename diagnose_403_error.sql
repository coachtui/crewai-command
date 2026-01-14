-- ============================================================================
-- DIAGNOSE 403 ERROR FOR TASK CREATION
-- Run this in Supabase SQL Editor while logged in as the user getting the 403
-- ============================================================================

\echo '============================================'
\echo '403 Error Diagnosis for Task Creation'
\echo '============================================'
\echo ''

-- 1. Check current user's authentication
\echo '1. Current User Authentication:'
\echo '----------------------------------------'
SELECT
  auth.uid() as current_user_id,
  auth.email() as current_email;

\echo ''

-- 2. Check if user exists in users table and has org_id
\echo '2. User Record in users table:'
\echo '----------------------------------------'
SELECT
  id,
  email,
  name,
  org_id,
  CASE
    WHEN org_id IS NULL THEN '❌ NO ORG_ID - THIS IS THE PROBLEM!'
    ELSE '✅ Has org_id'
  END as org_status
FROM users
WHERE id = auth.uid();

\echo ''

-- 3. Check if user exists in user_profiles table
\echo '3. User Record in user_profiles table:'
\echo '----------------------------------------'
SELECT
  id,
  email,
  full_name,
  org_id,
  organization_id,
  CASE
    WHEN org_id IS NULL AND organization_id IS NULL THEN '❌ NO ORG - THIS IS THE PROBLEM!'
    WHEN org_id IS NOT NULL OR organization_id IS NOT NULL THEN '✅ Has org'
    ELSE '⚠️ Check needed'
  END as org_status
FROM user_profiles
WHERE id = auth.uid();

\echo ''

-- 4. Test what the RLS policy sees
\echo '4. What RLS Policy Sees (for INSERT):'
\echo '----------------------------------------'
SELECT
  'From users table:' as source,
  org_id
FROM users
WHERE id = auth.uid()
UNION
SELECT
  'From user_profiles table:' as source,
  org_id
FROM user_profiles
WHERE id = auth.uid();

\echo ''

-- 5. Check if organizations exist
\echo '5. Available Organizations:'
\echo '----------------------------------------'
SELECT
  id,
  name,
  created_at
FROM organizations
ORDER BY created_at DESC
LIMIT 5;

\echo ''

-- 6. Check current job site
\echo '6. Your Job Sites:'
\echo '----------------------------------------'
SELECT
  js.id,
  js.name,
  js.organization_id,
  CASE
    WHEN js.organization_id = (SELECT org_id FROM users WHERE id = auth.uid() LIMIT 1)
      THEN '✅ Matches your org'
    WHEN js.organization_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
      THEN '✅ Matches your org'
    ELSE '❌ Different org - PERMISSION DENIED!'
  END as permission_status
FROM job_sites js
WHERE js.organization_id IN (
  SELECT org_id FROM users WHERE id = auth.uid()
  UNION
  SELECT org_id FROM user_profiles WHERE id = auth.uid()
)
ORDER BY js.created_at DESC;

\echo ''

-- 7. Check if RLS is enabled and policies exist for tasks
\echo '7. Tasks Table RLS Configuration:'
\echo '----------------------------------------'
SELECT
  'RLS Enabled:' as setting,
  CASE WHEN rowsecurity THEN '✅ YES' ELSE '❌ NO' END as value
FROM pg_tables
WHERE tablename = 'tasks' AND schemaname = 'public'
UNION ALL
SELECT
  'INSERT Policy:' as setting,
  CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as value
FROM pg_policies
WHERE tablename = 'tasks'
  AND schemaname = 'public'
  AND cmd IN ('INSERT', 'ALL');

\echo ''

-- 8. List all INSERT policies for tasks
\echo '8. Tasks INSERT Policies:'
\echo '----------------------------------------'
SELECT
  policyname,
  permissive,
  substring(qual::text, 1, 100) as with_check_clause
FROM pg_policies
WHERE tablename = 'tasks'
  AND schemaname = 'public'
  AND cmd IN ('INSERT', 'ALL');

\echo ''
\echo '============================================'
\echo 'DIAGNOSIS COMPLETE'
\echo '============================================'
\echo ''
\echo 'Common Issues & Fixes:'
\echo '  1. If user has NO org_id:'
\echo '     → Run fix_user_org_id.sql'
\echo ''
\echo '  2. If NO INSERT policy exists:'
\echo '     → Run fix_tasks_table_complete.sql'
\echo ''
\echo '  3. If job_site org doesnt match user org:'
\echo '     → User needs access to the job site'
\echo '============================================'
