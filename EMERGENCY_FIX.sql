-- ============================================================================
-- EMERGENCY FIX: Temporarily Allow All Inserts for Admins
-- This is a diagnostic-friendly approach that shows what's happening
-- ============================================================================

\echo '============================================'
\echo 'EMERGENCY FIX - Step by Step'
\echo '============================================'
\echo ''

-- Step 1: Check if helper functions exist
\echo 'Step 1: Checking if helper functions exist...'
SELECT
  proname as function_name,
  '✅ EXISTS' as status
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname IN ('get_user_org_id', 'is_user_admin')
ORDER BY proname;

\echo ''

-- Step 2: Create helper functions (will replace if exist)
\echo 'Step 2: Creating/replacing helper functions...'

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
DECLARE
  result UUID;
BEGIN
  SELECT COALESCE(
    (SELECT organization_id FROM user_profiles WHERE id = auth.uid()),
    (SELECT org_id FROM users WHERE id = auth.uid())
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT COALESCE(
    (SELECT base_role = 'admin' FROM user_profiles WHERE id = auth.uid()),
    (SELECT role = 'admin' OR base_role = 'admin' FROM users WHERE id = auth.uid()),
    false
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

\echo '✅ Functions created'
\echo ''

-- Step 3: Test functions with current user
\echo 'Step 3: Testing functions with your current user...'
SELECT
  auth.uid() as your_user_id,
  get_user_org_id() as your_org_id,
  is_user_admin() as are_you_admin;

\echo ''

-- Step 4: Check current user status
\echo 'Step 4: Your current user status...'
SELECT
  up.id,
  up.email,
  up.base_role,
  up.organization_id
FROM user_profiles up
WHERE up.id = auth.uid();

\echo ''

-- Step 5: Make current user admin if not already
\echo 'Step 5: Granting admin access to current user...'
UPDATE user_profiles
SET base_role = 'admin'
WHERE id = auth.uid();

\echo 'Rows updated:'
SELECT COUNT(*) as updated_rows
FROM user_profiles
WHERE id = auth.uid() AND base_role = 'admin';

\echo ''

-- Step 6: Remove ALL INSERT policies
\echo 'Step 6: Removing all existing INSERT policies...'
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'user_profiles'
    AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', r.policyname);
    RAISE NOTICE 'Dropped policy: %', r.policyname;
  END LOOP;
END $$;

\echo '✅ Old INSERT policies removed'
\echo ''

-- Step 7: Create ONE simple INSERT policy
\echo 'Step 7: Creating simple INSERT policy...'

-- This policy allows:
-- 1. Admins to insert users in their org
-- 2. Service role (Supabase) to insert anyone
-- 3. Users to insert their own profile
CREATE POLICY "user_profiles_allow_insert"
  ON user_profiles
  FOR INSERT
  WITH CHECK (
    -- Check 1: Is the current user an admin in the same org?
    (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND base_role = 'admin'
        AND organization_id = user_profiles.organization_id
      )
    )
    OR
    -- Check 2: Is this the user's own profile?
    (id = auth.uid())
    OR
    -- Check 3: Is this a service role call?
    (auth.role() = 'service_role')
  );

\echo '✅ New INSERT policy created'
\echo ''

-- Step 8: Final verification
\echo '============================================'
\echo 'FINAL VERIFICATION'
\echo '============================================'
\echo ''

\echo 'Your user info:'
SELECT
  up.id,
  up.email,
  up.base_role,
  up.organization_id,
  o.name as org_name,
  CASE
    WHEN up.base_role = 'admin' THEN '✅ YOU ARE ADMIN'
    ELSE '❌ NOT ADMIN'
  END as status
FROM user_profiles up
LEFT JOIN organizations o ON o.id = up.organization_id
WHERE up.id = auth.uid();

\echo ''
\echo 'Helper function results:'
SELECT
  get_user_org_id() as your_org_id,
  is_user_admin() as you_are_admin;

\echo ''
\echo 'INSERT policy on user_profiles:'
SELECT
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'user_profiles'
AND cmd = 'INSERT'
ORDER BY policyname;

\echo ''
\echo '============================================'
\echo '✅ EMERGENCY FIX COMPLETE'
\echo '============================================'
\echo ''
\echo 'Next steps:'
\echo '  1. REFRESH YOUR BROWSER (clear cache if needed)'
\echo '  2. Try creating a user'
\echo '  3. If still failing, share the EXACT error from browser console'
\echo ''
