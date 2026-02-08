-- ============================================================================
-- DIAGNOSE AND FIX USER PERMISSIONS
-- Run this to check your current user status and grant admin rights
-- ============================================================================

\echo ''
\echo '============================================'
\echo 'User Permissions Diagnostic'
\echo '============================================'
\echo ''

-- ============================================================================
-- STEP 1: CHECK CURRENT USER
-- ============================================================================

\echo 'Step 1: Checking current authenticated user...'
\echo ''

SELECT
  id as user_id,
  email,
  created_at,
  raw_user_meta_data->>'full_name' as full_name
FROM auth.users
WHERE id = auth.uid();

\echo ''

-- ============================================================================
-- STEP 2: CHECK USER PROFILE STATUS
-- ============================================================================

\echo 'Step 2: Checking user_profiles table...'
\echo ''

-- Check if current user exists in user_profiles
SELECT
  up.id,
  up.email,
  up.name,
  up.base_role,
  up.organization_id,
  o.name as organization_name
FROM user_profiles up
LEFT JOIN organizations o ON o.id = up.organization_id
WHERE up.id = auth.uid();

\echo ''

-- If no results, user is NOT in user_profiles table
-- Check legacy users table too
\echo 'Checking legacy users table...'
\echo ''

SELECT
  u.id,
  u.email,
  u.name,
  u.role,
  u.base_role,
  u.org_id,
  o.name as organization_name
FROM users u
LEFT JOIN organizations o ON o.id = u.org_id
WHERE u.id = auth.uid();

\echo ''

-- ============================================================================
-- STEP 3: CHECK ALL USERS AND ORGANIZATIONS
-- ============================================================================

\echo 'Step 3: All organizations in database...'
\echo ''

SELECT
  id,
  name,
  created_at
FROM organizations
ORDER BY created_at;

\echo ''
\echo 'All auth users and their profiles...'
\echo ''

SELECT
  au.id,
  au.email,
  CASE
    WHEN up.id IS NOT NULL THEN '✅ Yes'
    ELSE '❌ No'
  END as has_profile,
  up.base_role as profile_role,
  up.organization_id
FROM auth.users au
LEFT JOIN user_profiles up ON up.id = au.id
ORDER BY au.created_at;

\echo ''

-- ============================================================================
-- STEP 4: FIX - GRANT ADMIN ACCESS TO CURRENT USER
-- ============================================================================

\echo '============================================'
\echo 'APPLYING FIX: Granting admin access...'
\echo '============================================'
\echo ''

-- First, ensure we have an organization
DO $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found. Make sure you are logged in.';
  END IF;

  -- Get or create an organization
  SELECT id INTO v_org_id
  FROM organizations
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name)
    VALUES ('Default Organization')
    RETURNING id INTO v_org_id;
    RAISE NOTICE 'Created new organization with ID: %', v_org_id;
  ELSE
    RAISE NOTICE 'Using existing organization with ID: %', v_org_id;
  END IF;

  -- Insert/update in user_profiles
  INSERT INTO user_profiles (id, organization_id, email, name, base_role)
  SELECT
    au.id,
    v_org_id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    'admin'
  FROM auth.users au
  WHERE au.id = v_user_id
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    base_role = 'admin';

  RAISE NOTICE '✅ Updated user_profiles for user: %', v_user_id;

  -- Insert/update in legacy users table
  INSERT INTO users (id, org_id, email, name, role, base_role)
  SELECT
    au.id,
    v_org_id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    'admin',
    'admin'
  FROM auth.users au
  WHERE au.id = v_user_id
  ON CONFLICT (id) DO UPDATE
  SET
    org_id = EXCLUDED.org_id,
    role = 'admin',
    base_role = 'admin';

  RAISE NOTICE '✅ Updated users table for user: %', v_user_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error: %', SQLERRM;
END $$;

\echo ''

-- ============================================================================
-- STEP 5: VERIFY FIX
-- ============================================================================

\echo '============================================'
\echo 'Verification: Checking updated permissions'
\echo '============================================'
\echo ''

SELECT
  up.id,
  up.email,
  up.name,
  up.base_role,
  up.organization_id,
  o.name as organization_name,
  CASE
    WHEN up.base_role = 'admin' THEN '✅ ADMIN'
    ELSE '⚠️  NOT ADMIN'
  END as status
FROM user_profiles up
LEFT JOIN organizations o ON o.id = up.organization_id
WHERE up.id = auth.uid();

\echo ''
\echo '============================================'
\echo 'Done! You should now have admin access.'
\echo '============================================'
\echo ''
\echo 'Next steps:'
\echo '  1. Refresh your browser'
\echo '  2. Try creating a user again'
\echo '  3. If still having issues, check browser console for errors'
\echo ''
