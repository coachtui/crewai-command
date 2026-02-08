-- ============================================================================
-- QUICK FIX: Grant Admin Access to Current User
-- Run this in Supabase SQL Editor while logged in as the user who needs admin
-- ============================================================================

-- Make sure you're logged in to Supabase dashboard, then run this:

-- Step 1: Check current user
SELECT auth.uid() as your_user_id, email FROM auth.users WHERE id = auth.uid();

-- Step 2: Grant admin to current user in user_profiles
UPDATE user_profiles
SET base_role = 'admin'
WHERE id = auth.uid();

-- Step 3: Also update legacy users table
UPDATE users
SET role = 'admin', base_role = 'admin'
WHERE id = auth.uid();

-- Step 4: Verify
SELECT
  id,
  email,
  base_role,
  'user_profiles' as table_name
FROM user_profiles
WHERE id = auth.uid()
UNION ALL
SELECT
  id,
  email,
  base_role,
  'users (legacy)' as table_name
FROM users
WHERE id = auth.uid();

-- If you see base_role = 'admin' for both rows, you're all set!
-- Refresh your browser and try creating a user again.
