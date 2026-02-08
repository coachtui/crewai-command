-- ============================================================================
-- DIAGNOSE APP vs DATABASE MISMATCH
-- This checks if there's a mismatch between what the app expects and what DB has
-- ============================================================================

\echo ''
\echo '==================================================================='
\echo 'DIAGNOSING APP vs DATABASE MISMATCH'
\echo '==================================================================='
\echo ''

-- Check 1: Your current session
\echo '1. YOUR CURRENT SESSION:'
\echo '-------------------------------------------------------------------'
SELECT
  auth.uid() as logged_in_as,
  auth.role() as auth_role;

\echo ''

-- Check 2: Your user profile
\echo '2. YOUR USER PROFILE:'
\echo '-------------------------------------------------------------------'
SELECT
  up.id,
  up.email,
  up.base_role,
  up.organization_id,
  o.name as org_name
FROM user_profiles up
LEFT JOIN organizations o ON o.id = up.organization_id
WHERE up.id = auth.uid();

\echo ''
\echo '(If no rows, you have no profile!)'
\echo ''

-- Check 3: Test helper functions
\echo '3. HELPER FUNCTIONS TEST:'
\echo '-------------------------------------------------------------------'
SELECT
  get_user_org_id() as returns_org_id,
  is_user_admin() as returns_is_admin;

\echo ''

-- Check 4: Can you SELECT from user_profiles?
\echo '4. CAN YOU SELECT FROM USER_PROFILES?'
\echo '-------------------------------------------------------------------'
SELECT COUNT(*) as total_profiles_you_can_see
FROM user_profiles;

\echo ''

-- Check 5: Test if INSERT would work (dry run)
\echo '5. TESTING INSERT POLICY (DRY RUN):'
\echo '-------------------------------------------------------------------'
\echo 'This tests the policy logic without actually inserting...'
\echo ''

-- Show what the policy would check
WITH policy_test AS (
  SELECT
    auth.uid() as current_user_id,
    get_user_org_id() as user_org_id,
    is_user_admin() as user_is_admin,
    -- Test if policy would allow insert for a hypothetical new user
    CASE
      WHEN is_user_admin() = TRUE AND get_user_org_id() IS NOT NULL
      THEN '✅ POLICY WOULD ALLOW INSERT'
      WHEN is_user_admin() = FALSE
      THEN '❌ POLICY BLOCKS: You are not admin'
      WHEN get_user_org_id() IS NULL
      THEN '❌ POLICY BLOCKS: Your org_id is NULL'
      ELSE '❌ POLICY BLOCKS: Unknown reason'
    END as policy_result
)
SELECT * FROM policy_test;

\echo ''

-- Check 6: Current policies
\echo '6. CURRENT INSERT POLICIES:'
\echo '-------------------------------------------------------------------'
SELECT
  policyname,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'user_profiles'
  AND cmd = 'INSERT';

\echo ''

-- Check 7: Schema check - what columns exist?
\echo '7. USER_PROFILES TABLE SCHEMA:'
\echo '-------------------------------------------------------------------'
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND table_schema = 'public'
ORDER BY ordinal_position;

\echo ''

-- Check 8: Test UPDATE too
\echo '8. TESTING UPDATE POLICY:'
\echo '-------------------------------------------------------------------'
WITH update_test AS (
  SELECT
    auth.uid() as current_user_id,
    COUNT(*) as profiles_in_org,
    CASE
      WHEN is_user_admin() = TRUE
      THEN '✅ CAN UPDATE: You are admin'
      ELSE '⚠️  CAN ONLY UPDATE: Your own profile'
    END as update_permission
  FROM user_profiles
  WHERE organization_id = get_user_org_id()
)
SELECT * FROM update_test;

\echo ''

-- Check 9: List all auth users vs profiles
\echo '9. AUTH USERS vs PROFILES:'
\echo '-------------------------------------------------------------------'
SELECT
  au.id,
  au.email as auth_email,
  up.email as profile_email,
  up.base_role,
  up.organization_id,
  CASE
    WHEN up.id IS NULL THEN '❌ NO PROFILE'
    WHEN up.organization_id IS NULL THEN '⚠️  NO ORG'
    ELSE '✅ OK'
  END as status
FROM auth.users au
LEFT JOIN user_profiles up ON up.id = au.id
ORDER BY au.created_at DESC
LIMIT 10;

\echo ''

-- Check 10: The KEY test - can you insert with explicit values?
\echo '10. KEY DIAGNOSTIC - What happens if you try to INSERT?'
\echo '-------------------------------------------------------------------'
\echo 'We will NOT actually insert, just show what would happen...'
\echo ''

DO $$
BEGIN
  -- This is a dry run to test the policy
  IF NOT is_user_admin() THEN
    RAISE NOTICE '❌ PROBLEM FOUND: is_user_admin() returns FALSE';
    RAISE NOTICE 'Your base_role in user_profiles is probably not "admin"';
  ELSIF get_user_org_id() IS NULL THEN
    RAISE NOTICE '❌ PROBLEM FOUND: get_user_org_id() returns NULL';
    RAISE NOTICE 'Your organization_id in user_profiles is probably NULL';
  ELSE
    RAISE NOTICE '✅ Functions return correct values!';
    RAISE NOTICE 'If you still get 403, the problem is likely:';
    RAISE NOTICE '  1. Browser cache (need hard refresh)';
    RAISE NOTICE '  2. App sending wrong organization_id';
    RAISE NOTICE '  3. Policy WITH CHECK condition failing';
  END IF;
END $$;

\echo ''
\echo '==================================================================='
\echo 'DIAGNOSIS COMPLETE'
\echo '==================================================================='
\echo ''
\echo 'Look for ❌ or ⚠️  symbols above to find the problem!'
\echo ''
