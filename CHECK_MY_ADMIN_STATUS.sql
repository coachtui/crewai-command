-- Check if you are an admin
SELECT
  id,
  email,
  base_role,
  organization_id,
  CASE
    WHEN base_role = 'admin' THEN '✅ YOU ARE AN ADMIN'
    ELSE '❌ YOU ARE NOT AN ADMIN (role: ' || COALESCE(base_role, 'none') || ')'
  END as status
FROM user_profiles
WHERE id = auth.uid();

-- If the above returns no rows, check if you exist in the users table
SELECT
  'Checking legacy users table...' as note;

SELECT
  id,
  email,
  base_role,
  org_id
FROM users
WHERE id = auth.uid();

-- If still no rows, you're not logged in or don't have a profile
-- Create yourself as admin if needed:
/*
UPDATE user_profiles
SET base_role = 'admin'
WHERE email = 'YOUR_EMAIL@gmail.com';

UPDATE users
SET base_role = 'admin', role = 'admin'
WHERE email = 'YOUR_EMAIL@gmail.com';
*/
