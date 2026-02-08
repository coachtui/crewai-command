-- ============================================================================
-- CREATE YOUR USER PROFILE AND MAKE YOU ADMIN
-- ============================================================================

BEGIN;

-- First, let's see who you are
SELECT
  'Your auth user info:' as note,
  id,
  email,
  created_at
FROM auth.users
WHERE id = auth.uid();

-- Get or create default organization
DO $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_email TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  -- Get email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  -- Get first org or create one
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at ASC LIMIT 1;

  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name) VALUES ('Default Organization') RETURNING id INTO v_org_id;
    RAISE NOTICE 'Created organization: %', v_org_id;
  END IF;

  -- Create user_profile (or update if exists)
  INSERT INTO user_profiles (id, organization_id, email, name, base_role, created_at, updated_at)
  VALUES (
    v_user_id,
    v_org_id,
    v_email,
    v_email, -- Use email as name for now
    'admin', -- Make them admin
    NOW(),
    NOW()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    base_role = 'admin',
    organization_id = EXCLUDED.organization_id,
    email = EXCLUDED.email,
    updated_at = NOW();

  -- Also create in legacy users table
  INSERT INTO users (id, org_id, email, name, role, base_role, created_at, updated_at)
  VALUES (
    v_user_id,
    v_org_id,
    v_email,
    v_email,
    'admin',
    'admin',
    NOW(),
    NOW()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    role = 'admin',
    base_role = 'admin',
    org_id = EXCLUDED.org_id,
    updated_at = NOW();

  RAISE NOTICE 'User profile created/updated for: %', v_email;
END $$;

-- Verify it worked
SELECT
  '✅ YOUR NEW PROFILE:' as note,
  id,
  email,
  base_role,
  organization_id
FROM user_profiles
WHERE id = auth.uid();

COMMIT;

SELECT '🎉 You are now an admin! Try creating a user in your app.' as success;
