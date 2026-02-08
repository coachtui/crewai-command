-- ============================================================================
-- QUICK DIAGNOSTIC - Run this to see what's wrong
-- Copy the output and share it with me
-- ============================================================================

\echo ''
\echo '=== DIAGNOSTIC REPORT ==='
\echo ''

-- 1. Your current user ID
\echo '1. Your current user ID:'
SELECT auth.uid() as your_user_id;

\echo ''

-- 2. Check if you exist in user_profiles
\echo '2. Your record in user_profiles:'
SELECT
  id,
  email,
  base_role,
  organization_id
FROM user_profiles
WHERE id = auth.uid();

\echo ''
\echo '(If no rows above, you are NOT in user_profiles table)'
\echo ''

-- 3. Check if helper functions exist
\echo '3. Helper functions status:'
SELECT
  proname as function_name,
  '✅ EXISTS' as status
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname IN ('get_user_org_id', 'is_user_admin');

\echo ''
\echo '(Should see 2 functions above)'
\echo ''

-- 4. Test helper functions
\echo '4. Testing helper functions:'
SELECT
  get_user_org_id() as your_org_id,
  is_user_admin() as are_you_admin;

\echo ''

-- 5. Check INSERT policies
\echo '5. Current INSERT policies on user_profiles:'
SELECT
  policyname,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'user_profiles'
  AND cmd = 'INSERT';

\echo ''
\echo '(Should see at least one policy above)'
\echo ''

-- 6. All organizations
\echo '6. Organizations in database:'
SELECT id, name FROM organizations;

\echo ''
\echo '=== END DIAGNOSTIC ==='
\echo ''
\echo 'Share this output so I can see what is wrong!'
