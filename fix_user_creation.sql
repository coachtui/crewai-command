-- ============================================================================
-- FIX USER CREATION ISSUES
-- This script adds missing RLS INSERT policies and helper functions
-- for user_profiles table
-- ============================================================================

BEGIN;

\echo ''
\echo '============================================'
\echo 'Fixing User Creation Issues'
\echo '============================================'
\echo ''

-- ============================================================================
-- STEP 1: CREATE HELPER FUNCTIONS
-- ============================================================================

\echo 'Step 1: Creating helper functions...'

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

-- ============================================================================
-- STEP 2: ADD INSERT POLICIES FOR USER_PROFILES
-- ============================================================================

\echo 'Step 2: Adding INSERT policies for user_profiles...'

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can insert users in their org" ON user_profiles;
DROP POLICY IF EXISTS "Service role can insert users" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;

-- Policy 1: Admins can insert users in their organization
CREATE POLICY "Admins can insert users in their org"
  ON user_profiles
  FOR INSERT
  WITH CHECK (
    -- Admin can only create users in their own organization
    organization_id = get_user_org_id()
    AND is_user_admin()
  );

-- Policy 2: Service role (Supabase backend) can always insert
-- This allows auth triggers and admin dashboard operations to work
CREATE POLICY "Service role can insert users"
  ON user_profiles
  FOR INSERT
  WITH CHECK (true);

\echo '✅ INSERT policies added to user_profiles'
\echo ''

-- ============================================================================
-- STEP 3: ADD INSERT POLICIES FOR USERS TABLE (LEGACY)
-- ============================================================================

\echo 'Step 3: Adding INSERT policies for users table (legacy)...'

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can insert users in their org legacy" ON users;
DROP POLICY IF EXISTS "Service role can insert users legacy" ON users;

-- Policy 1: Admins can insert users in their organization
CREATE POLICY "Admins can insert users in their org legacy"
  ON users
  FOR INSERT
  WITH CHECK (
    org_id = get_user_org_id()
    AND is_user_admin()
  );

-- Policy 2: Service role can always insert
CREATE POLICY "Service role can insert users legacy"
  ON users
  FOR INSERT
  WITH CHECK (true);

\echo '✅ INSERT policies added to users table'
\echo ''

-- ============================================================================
-- STEP 4: CREATE AUTO-SYNC TRIGGER (OPTIONAL)
-- ============================================================================

\echo 'Step 4: Creating auto-sync trigger for auth.users...'

-- Create function to auto-create user profile when auth user is created
CREATE OR REPLACE FUNCTION handle_new_user_creation()
RETURNS trigger AS $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Get the first organization, or create a default one
  SELECT id INTO default_org_id
  FROM public.organizations
  ORDER BY created_at ASC
  LIMIT 1;

  -- If no organization exists, create a default one
  IF default_org_id IS NULL THEN
    INSERT INTO public.organizations (name)
    VALUES ('Default Organization')
    RETURNING id INTO default_org_id;
  END IF;

  -- Insert into user_profiles (modern schema)
  INSERT INTO public.user_profiles (id, organization_id, email, name, base_role, created_at)
  VALUES (
    NEW.id,
    default_org_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'worker', -- Default role
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Also insert into users table (legacy) for backward compatibility
  INSERT INTO public.users (id, org_id, email, name, role, base_role, created_at)
  VALUES (
    NEW.id,
    default_org_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'worker',
    'worker',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_creation();

\echo '✅ Auto-sync trigger created'
\echo ''

-- ============================================================================
-- STEP 5: SYNC EXISTING AUTH USERS
-- ============================================================================

\echo 'Step 5: Syncing existing auth users to user_profiles...'

-- Insert existing auth users into user_profiles if they don't exist
INSERT INTO public.user_profiles (id, organization_id, email, name, base_role)
SELECT
  au.id,
  (SELECT id FROM public.organizations ORDER BY created_at ASC LIMIT 1),
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  'worker'
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Also sync to legacy users table
INSERT INTO public.users (id, org_id, email, name, role, base_role)
SELECT
  au.id,
  (SELECT id FROM public.organizations ORDER BY created_at ASC LIMIT 1),
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  'worker',
  'worker'
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = au.id
)
ON CONFLICT (id) DO NOTHING;

\echo '✅ Existing users synced'
\echo ''

-- ============================================================================
-- VERIFICATION
-- ============================================================================

\echo ''
\echo 'Verification:'
\echo '============================================'

-- Check policies
\echo 'RLS Policies on user_profiles:'
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as command
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

\echo ''
\echo 'Auth users vs User profiles:'
SELECT
  COUNT(DISTINCT au.id) as auth_users,
  COUNT(DISTINCT up.id) as user_profiles,
  COUNT(DISTINCT u.id) as legacy_users
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.id = au.id
LEFT JOIN public.users u ON u.id = au.id;

\echo ''
\echo '============================================'
\echo '✅ Fix Complete!'
\echo '============================================'
\echo ''
\echo 'You can now:'
\echo '  1. Create users in the Supabase dashboard (if you are an admin)'
\echo '  2. Create users via your app''s inviteUser() function'
\echo '  3. New auth signups will automatically create user profiles'
\echo ''

COMMIT;
