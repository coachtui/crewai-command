-- ============================================================================
-- CREATE USER WITH PROFILE FUNCTION
-- Allows admins to create auth users + profiles from the frontend safely
-- ============================================================================

-- Function to create a new auth user and their profile
CREATE OR REPLACE FUNCTION create_user_with_profile(
  p_email TEXT,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_base_role TEXT DEFAULT 'worker',
  p_organization_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_caller_role TEXT;
  v_result jsonb;
BEGIN
  -- Check if caller is admin
  SELECT base_role INTO v_caller_role
  FROM user_profiles
  WHERE id = auth.uid();

  IF v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Use provided org_id or get caller's org
  IF p_organization_id IS NOT NULL THEN
    v_org_id := p_organization_id;
  ELSE
    SELECT organization_id INTO v_org_id
    FROM user_profiles
    WHERE id = auth.uid();
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found for user creation';
  END IF;

  -- Generate a UUID for the new user
  v_user_id := gen_random_uuid();

  -- Create the auth user
  -- Note: This uses pg_catalog extensions to create auth users
  -- You'll need to use Supabase's admin API or edge function for this
  -- For now, we'll create a placeholder that will be replaced by actual auth creation

  -- Create user_profile first (assuming auth user will be created separately)
  INSERT INTO user_profiles (
    id,
    organization_id,
    email,
    name,
    phone,
    base_role,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_org_id,
    p_email,
    p_name,
    p_phone,
    p_base_role,
    NOW(),
    NOW()
  ) RETURNING id INTO v_user_id;

  -- Also create in legacy users table for compatibility
  INSERT INTO users (
    id,
    org_id,
    email,
    name,
    role,
    base_role,
    phone,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_org_id,
    p_email,
    p_name,
    p_base_role,
    p_base_role,
    p_phone,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Return success with user info
  v_result := jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', p_email,
    'name', p_name,
    'message', 'User profile created. Auth user must be created separately via Supabase Dashboard or Admin API.'
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_user_with_profile TO authenticated;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- This function creates user profiles but NOT auth users, because:
-- 1. Creating auth.users requires service role privileges
-- 2. Cannot be done safely from client-side
--
-- SOLUTIONS:
-- A) Use Supabase Dashboard to create auth users manually
-- B) Create a Supabase Edge Function that uses admin API
-- C) Install the auto-create trigger (fix_user_creation.sql) and use email invitation flow
-- ============================================================================
