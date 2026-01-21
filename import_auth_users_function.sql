-- ============================================================================
-- Import Existing Auth Users to User Profiles
-- ============================================================================
-- This function imports users from auth.users into user_profiles table
-- for users that don't already have a profile in the specified organization.
-- Run this in your Supabase SQL Editor.
-- ============================================================================

CREATE OR REPLACE FUNCTION import_auth_users_to_profiles(target_org_id UUID)
RETURNS JSON AS $$
DECLARE
  imported_count INT := 0;
  skipped_count INT := 0;
  auth_user RECORD;
BEGIN
  -- Loop through all auth users
  FOR auth_user IN
    SELECT
      au.id,
      au.email,
      au.raw_user_meta_data->>'full_name' as full_name,
      au.raw_user_meta_data->>'name' as meta_name,
      au.created_at
    FROM auth.users au
    WHERE au.email IS NOT NULL
  LOOP
    -- Check if user already has a profile
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth_user.id) THEN
      -- Insert new profile
      -- Note: Using org_id column (the migration ensures both org_id and organization_id exist)
      INSERT INTO user_profiles (
        id,
        org_id,
        email,
        name,
        base_role,
        created_at
      ) VALUES (
        auth_user.id,
        target_org_id,
        auth_user.email,
        COALESCE(
          auth_user.full_name,
          auth_user.meta_name,
          auth_user.email
        ),
        'worker', -- Default role
        auth_user.created_at
      );

      imported_count := imported_count + 1;
    ELSE
      skipped_count := skipped_count + 1;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'imported', imported_count,
    'skipped', skipped_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION import_auth_users_to_profiles(UUID) TO authenticated;

-- ============================================================================
-- Optional: Create trigger to auto-import new auth users
-- ============================================================================
-- This trigger will automatically create a user_profile when a new auth user is created

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Get the first organization (you may want to adjust this logic)
  SELECT id INTO default_org_id
  FROM organizations
  ORDER BY created_at
  LIMIT 1;

  -- If no organization exists, we can't create a profile
  IF default_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping user profile creation for %', NEW.email;
    RETURN NEW;
  END IF;

  -- Insert new profile
  INSERT INTO user_profiles (
    id,
    org_id,
    email,
    name,
    base_role,
    created_at
  ) VALUES (
    NEW.id,
    default_org_id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.email
    ),
    'worker', -- Default role
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to check which auth users are missing from user_profiles:
--
-- SELECT
--   au.id,
--   au.email,
--   au.created_at as auth_created,
--   up.id IS NOT NULL as has_profile,
--   up.name,
--   up.base_role
-- FROM auth.users au
-- LEFT JOIN user_profiles up ON up.id = au.id
-- ORDER BY au.created_at DESC;
