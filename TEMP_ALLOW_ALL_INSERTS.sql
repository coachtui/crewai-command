-- ============================================================================
-- TEMPORARY FIX: Allow ALL authenticated users to insert
-- ⚠️  WARNING: This is NOT secure for production!
-- Use this temporarily to unblock yourself, then run EMERGENCY_FIX.sql
-- ============================================================================

\echo '⚠️  TEMPORARY FIX - Allowing all authenticated users to insert'
\echo ''

-- Drop all INSERT policies
DROP POLICY IF EXISTS "user_profiles_insert_admin" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_allow_insert" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert users in their org" ON user_profiles;
DROP POLICY IF EXISTS "Service role can insert users" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;

-- Create a permissive policy that allows any authenticated user to insert
CREATE POLICY "temp_allow_all_inserts"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

\echo '✅ Temporary policy created'
\echo ''
\echo '⚠️  WARNING: Any authenticated user can now insert into user_profiles'
\echo ''
\echo 'What to do:'
\echo '  1. Refresh browser and try creating a user'
\echo '  2. Once it works, run EMERGENCY_FIX.sql to add proper security'
\echo ''

-- Also make current user an admin for when we re-enable security
UPDATE user_profiles
SET base_role = 'admin'
WHERE id = auth.uid();

\echo ''
\echo 'Current user granted admin role for when security is re-enabled'
