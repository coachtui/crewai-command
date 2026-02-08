-- ============================================================================
-- GRANT ADMIN BY EMAIL
-- Use this if you can't run queries as the authenticated user
-- Replace 'your-email@example.com' with your actual email
-- ============================================================================

-- First, verify the email exists
SELECT id, email, created_at
FROM auth.users
WHERE email = 'your-email@example.com';  -- ⬅️ REPLACE WITH YOUR EMAIL

-- Grant admin in user_profiles
UPDATE user_profiles
SET base_role = 'admin'
WHERE email = 'your-email@example.com';  -- ⬅️ REPLACE WITH YOUR EMAIL

-- Grant admin in legacy users table
UPDATE users
SET role = 'admin', base_role = 'admin'
WHERE email = 'your-email@example.com';  -- ⬅️ REPLACE WITH YOUR EMAIL

-- Verify the change
SELECT
  up.email,
  up.base_role as user_profiles_role,
  u.base_role as users_legacy_role,
  CASE
    WHEN up.base_role = 'admin' THEN '✅ SUCCESS'
    ELSE '❌ NOT SET'
  END as status
FROM user_profiles up
LEFT JOIN users u ON u.id = up.id
WHERE up.email = 'your-email@example.com';  -- ⬅️ REPLACE WITH YOUR EMAIL

-- After running this:
-- 1. Log out of your app
-- 2. Log back in
-- 3. Try creating a user again
