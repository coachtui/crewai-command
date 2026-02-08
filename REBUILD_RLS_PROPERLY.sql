-- ============================================================================
-- REBUILD RLS PROPERLY - Production-Ready Security
-- This completely rebuilds RLS with proper security, not permissive hacks
-- ============================================================================

BEGIN;

\echo ''
\echo '==================================================================='
\echo 'REBUILDING RLS FROM SCRATCH - Proper Security'
\echo '==================================================================='
\echo ''

-- ============================================================================
-- STEP 1: DIAGNOSTIC - Understanding Current State
-- ============================================================================

\echo 'STEP 1: Understanding Current State'
\echo '-------------------------------------------------------------------'
\echo ''

\echo 'Your current user:'
SELECT
  auth.uid() as user_id,
  au.email
FROM auth.users au
WHERE au.id = auth.uid();

\echo ''
\echo 'Your profile in user_profiles:'
SELECT
  id,
  email,
  base_role,
  organization_id
FROM user_profiles
WHERE id = auth.uid();

\echo ''
\echo 'If no profile above, checking legacy users table:'
SELECT
  id,
  email,
  role,
  base_role,
  org_id
FROM users
WHERE id = auth.uid();

\echo ''
\echo 'All organizations:'
SELECT id, name, created_at FROM organizations ORDER BY created_at;

\echo ''
\echo 'Current policies on user_profiles:'
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_profiles' ORDER BY cmd, policyname;

\echo ''
\echo '-------------------------------------------------------------------'
\echo ''

-- ============================================================================
-- STEP 2: ENSURE USER HAS ORGANIZATION
-- ============================================================================

\echo 'STEP 2: Ensuring User Has Organization'
\echo '-------------------------------------------------------------------'
\echo ''

DO $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_email TEXT;
  v_name TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user. You must be logged in to run this script.';
  END IF;

  -- Get user details from auth
  SELECT email, COALESCE(raw_user_meta_data->>'full_name', email)
  INTO v_email, v_name
  FROM auth.users
  WHERE id = v_user_id;

  RAISE NOTICE 'Current user: % (%)', v_email, v_user_id;

  -- Get or create organization
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at ASC LIMIT 1;

  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name)
    VALUES ('Main Organization')
    RETURNING id INTO v_org_id;
    RAISE NOTICE 'Created organization: %', v_org_id;
  ELSE
    RAISE NOTICE 'Using existing organization: %', v_org_id;
  END IF;

  -- Ensure user exists in user_profiles with admin role
  INSERT INTO user_profiles (id, organization_id, email, name, base_role)
  VALUES (v_user_id, v_org_id, v_email, v_name, 'admin')
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = v_org_id,
    base_role = 'admin',
    email = EXCLUDED.email,
    name = EXCLUDED.name;

  RAISE NOTICE 'User profile created/updated with admin role';

  -- Also update legacy users table
  INSERT INTO users (id, org_id, email, name, role, base_role)
  VALUES (v_user_id, v_org_id, v_email, v_name, 'admin', 'admin')
  ON CONFLICT (id) DO UPDATE
  SET
    org_id = v_org_id,
    role = 'admin',
    base_role = 'admin',
    email = EXCLUDED.email,
    name = EXCLUDED.name;

  RAISE NOTICE 'Legacy users table updated';

END $$;

\echo ''
\echo '✅ User profile ensured with admin role'
\echo ''
\echo '-------------------------------------------------------------------'
\echo ''

-- ============================================================================
-- STEP 3: CREATE PROPER HELPER FUNCTIONS
-- ============================================================================

\echo 'STEP 3: Creating Proper Helper Functions'
\echo '-------------------------------------------------------------------'
\echo ''

-- Function to get user's organization_id (checks both tables)
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Try user_profiles first (modern schema)
  SELECT organization_id INTO v_org_id
  FROM public.user_profiles
  WHERE id = auth.uid();

  -- If not found, try legacy users table
  IF v_org_id IS NULL THEN
    SELECT org_id INTO v_org_id
    FROM public.users
    WHERE id = auth.uid();
  END IF;

  RETURN v_org_id;
END;
$$;

\echo '✅ get_user_org_id() function created'

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check user_profiles first (modern schema)
  SELECT base_role = 'admin' INTO v_is_admin
  FROM public.user_profiles
  WHERE id = auth.uid();

  -- If not found or not admin, check legacy users table
  IF v_is_admin IS NULL OR v_is_admin = FALSE THEN
    SELECT (role = 'admin' OR base_role = 'admin') INTO v_is_admin
    FROM public.users
    WHERE id = auth.uid();
  END IF;

  RETURN COALESCE(v_is_admin, FALSE);
END;
$$;

\echo '✅ is_user_admin() function created'

\echo ''
\echo 'Testing helper functions:'
SELECT
  get_user_org_id() as my_org_id,
  is_user_admin() as am_i_admin;

\echo ''
\echo '-------------------------------------------------------------------'
\echo ''

-- ============================================================================
-- STEP 4: REMOVE ALL EXISTING POLICIES
-- ============================================================================

\echo 'STEP 4: Removing All Existing Policies'
\echo '-------------------------------------------------------------------'
\echo ''

-- Drop all policies on user_profiles
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'user_profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', r.policyname);
    RAISE NOTICE 'Dropped policy: %', r.policyname;
  END LOOP;
END $$;

\echo '✅ All user_profiles policies removed'

-- Drop all policies on users
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
    RAISE NOTICE 'Dropped policy: %', r.policyname;
  END LOOP;
END $$;

\echo '✅ All users table policies removed'
\echo ''
\echo '-------------------------------------------------------------------'
\echo ''

-- ============================================================================
-- STEP 5: CREATE SECURE RLS POLICIES
-- ============================================================================

\echo 'STEP 5: Creating Secure RLS Policies'
\echo '-------------------------------------------------------------------'
\echo ''

-- ========================================
-- USER_PROFILES TABLE POLICIES
-- ========================================

-- SELECT: Users can view profiles in their organization
CREATE POLICY "user_profiles_select"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
  );

\echo '✅ SELECT policy: Users can view profiles in their org'

-- INSERT: Only admins can create users, and only in their own organization
CREATE POLICY "user_profiles_insert"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_admin()
    AND organization_id = get_user_org_id()
  );

\echo '✅ INSERT policy: Only admins can create users in their org'

-- UPDATE: Users can update their own profile, or admins can update any profile in their org
CREATE POLICY "user_profiles_update"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR (is_user_admin() AND organization_id = get_user_org_id())
  )
  WITH CHECK (
    id = auth.uid()
    OR (is_user_admin() AND organization_id = get_user_org_id())
  );

\echo '✅ UPDATE policy: Users can update own profile, admins can update any in org'

-- DELETE: Only admins can delete users in their organization
CREATE POLICY "user_profiles_delete"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    is_user_admin()
    AND organization_id = get_user_org_id()
    AND id != auth.uid() -- Can't delete yourself
  );

\echo '✅ DELETE policy: Only admins can delete users (except themselves)'

\echo ''

-- ========================================
-- LEGACY USERS TABLE POLICIES (same logic)
-- ========================================

CREATE POLICY "users_select"
  ON users FOR SELECT TO authenticated
  USING (org_id = get_user_org_id());

CREATE POLICY "users_insert"
  ON users FOR INSERT TO authenticated
  WITH CHECK (is_user_admin() AND org_id = get_user_org_id());

CREATE POLICY "users_update"
  ON users FOR UPDATE TO authenticated
  USING (id = auth.uid() OR (is_user_admin() AND org_id = get_user_org_id()))
  WITH CHECK (id = auth.uid() OR (is_user_admin() AND org_id = get_user_org_id()));

CREATE POLICY "users_delete"
  ON users FOR DELETE TO authenticated
  USING (is_user_admin() AND org_id = get_user_org_id() AND id != auth.uid());

\echo '✅ Legacy users table policies created'

\echo ''
\echo '-------------------------------------------------------------------'
\echo ''

-- ============================================================================
-- STEP 6: VERIFICATION
-- ============================================================================

\echo 'STEP 6: Final Verification'
\echo '==================================================================='
\echo ''

\echo 'Your profile status:'
SELECT
  up.id,
  up.email,
  up.base_role,
  up.organization_id,
  o.name as org_name,
  CASE
    WHEN up.base_role = 'admin' THEN '✅ ADMIN'
    ELSE '❌ NOT ADMIN'
  END as status
FROM user_profiles up
LEFT JOIN organizations o ON o.id = up.organization_id
WHERE up.id = auth.uid();

\echo ''
\echo 'Helper functions working?'
SELECT
  get_user_org_id() as your_org_id,
  is_user_admin() as you_are_admin,
  CASE
    WHEN get_user_org_id() IS NOT NULL AND is_user_admin() = TRUE
    THEN '✅ FUNCTIONS WORKING - You can create users!'
    WHEN get_user_org_id() IS NULL
    THEN '❌ ERROR: org_id is NULL'
    WHEN is_user_admin() = FALSE
    THEN '❌ ERROR: You are not admin'
    ELSE '❌ ERROR: Something is wrong'
  END as diagnosis;

\echo ''
\echo 'RLS policies created:'
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('user_profiles', 'users')
ORDER BY tablename, cmd, policyname;

\echo ''
\echo '==================================================================='
\echo '✅ RLS REBUILD COMPLETE'
\echo '==================================================================='
\echo ''
\echo 'Security Model:'
\echo '  • SELECT: Users see profiles in their organization only'
\echo '  • INSERT: Only admins can create users (in their org)'
\echo '  • UPDATE: Users can update own profile, admins can update any'
\echo '  • DELETE: Only admins can delete (except themselves)'
\echo ''
\echo 'Next steps:'
\echo '  1. REFRESH YOUR BROWSER (Cmd+Shift+R or Ctrl+Shift+R)'
\echo '  2. If you see "you_are_admin = TRUE" above, you can create users'
\echo '  3. Try creating a user now'
\echo ''
\echo 'If it STILL fails after browser refresh:'
\echo '  1. Copy the EXACT error from browser console'
\echo '  2. Run: SELECT get_user_org_id(), is_user_admin();'
\echo '  3. Share both with me'
\echo ''

-- ============================================================================
-- STEP 7: ADD AUTO-CREATE TRIGGER (for Supabase Dashboard user creation)
-- ============================================================================

\echo '-------------------------------------------------------------------'
\echo 'STEP 7: Adding Auto-Create Trigger'
\echo '-------------------------------------------------------------------'
\echo ''

-- Function to auto-create profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Get the first organization
  SELECT id INTO default_org_id
  FROM public.organizations
  ORDER BY created_at ASC
  LIMIT 1;

  -- Create one if none exists
  IF default_org_id IS NULL THEN
    INSERT INTO public.organizations (name)
    VALUES ('Default Organization')
    RETURNING id INTO default_org_id;
  END IF;

  -- Create user profile automatically
  INSERT INTO public.user_profiles (id, organization_id, email, name, base_role)
  VALUES (
    NEW.id,
    default_org_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'worker' -- Default role for new users
  )
  ON CONFLICT (id) DO NOTHING;

  -- Also create in legacy users table
  INSERT INTO public.users (id, org_id, email, name, role, base_role)
  VALUES (
    NEW.id,
    default_org_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'worker',
    'worker'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

\echo '✅ Auto-create function created'

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

\echo '✅ Auto-create trigger installed'
\echo ''
\echo 'IMPORTANT: When you create users in Supabase Dashboard,'
\echo 'their profile will now be automatically created!'
\echo ''

COMMIT;

\echo ''
\echo 'Transaction committed successfully!'
\echo ''
