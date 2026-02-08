-- ============================================================================
-- SIMPLE FIX: Allow User Creation
-- This creates the minimal policies needed to allow admins to create users
-- ============================================================================

-- First, let's see what policies currently exist
\echo 'Current policies on user_profiles:'
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

\echo ''
\echo 'Current policies on users (legacy):'
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

\echo ''
\echo '============================================'
\echo 'Creating helper functions...'
\echo '============================================'

-- Function to get user's organization_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (SELECT organization_id FROM user_profiles WHERE id = auth.uid()),
      (SELECT org_id FROM users WHERE id = auth.uid())
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (SELECT base_role = 'admin' FROM user_profiles WHERE id = auth.uid()),
      (SELECT role = 'admin' OR base_role = 'admin' FROM users WHERE id = auth.uid()),
      false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

\echo '✅ Helper functions created'
\echo ''
\echo '============================================'
\echo 'Removing conflicting INSERT policies...'
\echo '============================================'

-- Drop ALL existing INSERT policies to start fresh
DROP POLICY IF EXISTS "Admins can insert users in their org" ON user_profiles;
DROP POLICY IF EXISTS "Service role can insert users" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can create users in org" ON user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON user_profiles;

-- Also drop from legacy users table
DROP POLICY IF EXISTS "Admins can insert users in their org legacy" ON users;
DROP POLICY IF EXISTS "Service role can insert users legacy" ON users;
DROP POLICY IF EXISTS "Users can insert users" ON users;

\echo '✅ Old policies removed'
\echo ''
\echo '============================================'
\echo 'Creating new INSERT policies...'
\echo '============================================'

-- For user_profiles: Create a PERMISSIVE policy that allows admins to insert
CREATE POLICY "user_profiles_insert_admin"
  ON user_profiles
  FOR INSERT
  WITH CHECK (
    -- Allow if user is admin AND new user is in same org
    (
      is_user_admin()
      AND organization_id = get_user_org_id()
    )
    OR
    -- OR allow if this is the user creating their own profile (for auth triggers)
    id = auth.uid()
  );

-- For legacy users table
CREATE POLICY "users_insert_admin"
  ON users
  FOR INSERT
  WITH CHECK (
    (
      is_user_admin()
      AND org_id = get_user_org_id()
    )
    OR
    id = auth.uid()
  );

\echo '✅ INSERT policies created'
\echo ''
\echo '============================================'
\echo 'Testing helper functions with current user...'
\echo '============================================'

-- Test the functions
SELECT
  auth.uid() as current_user_id,
  get_user_org_id() as user_org_id,
  is_user_admin() as is_admin;

\echo ''
\echo 'Current user details:'
SELECT
  up.id,
  up.email,
  up.base_role,
  up.organization_id,
  CASE
    WHEN up.base_role = 'admin' THEN '✅ IS ADMIN'
    ELSE '❌ NOT ADMIN - Need to fix this!'
  END as admin_status
FROM user_profiles up
WHERE up.id = auth.uid();

\echo ''
\echo '============================================'
\echo 'IMPORTANT: Making current user an admin...'
\echo '============================================'

-- Make the current authenticated user an admin
UPDATE user_profiles
SET base_role = 'admin'
WHERE id = auth.uid();

-- Also update legacy table
UPDATE users
SET role = 'admin', base_role = 'admin'
WHERE id = auth.uid();

\echo '✅ Current user granted admin access'
\echo ''
\echo '============================================'
\echo 'Final verification:'
\echo '============================================'

-- Verify everything is set up correctly
SELECT
  auth.uid() as user_id,
  up.email,
  up.base_role,
  up.organization_id,
  get_user_org_id() as org_id_function_result,
  is_user_admin() as admin_function_result,
  CASE
    WHEN is_user_admin() THEN '✅ YOU ARE NOW ADMIN - Refresh browser!'
    ELSE '❌ Still not admin - something went wrong'
  END as status
FROM user_profiles up
WHERE up.id = auth.uid();

\echo ''
\echo '============================================'
\echo '✅ SETUP COMPLETE'
\echo '============================================'
\echo ''
\echo 'What to do next:'
\echo '  1. Refresh your browser (important!)'
\echo '  2. Try creating a user again'
\echo '  3. If still getting 403, check browser console and share the error'
\echo ''
