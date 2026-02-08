-- ============================================================================
-- SIMPLE FIX: Assign current user to Nan Inc. organization
-- ============================================================================

-- Update users table
UPDATE users
SET org_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE id = auth.uid();

-- Update user_profiles table
UPDATE user_profiles
SET org_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE id = auth.uid();

-- Verify it worked
SELECT
  'User ID:' as field,
  auth.uid()::text as value
UNION ALL
SELECT
  'Org ID (from users):' as field,
  COALESCE((SELECT org_id::text FROM users WHERE id = auth.uid()), 'NULL') as value
UNION ALL
SELECT
  'Org ID (from user_profiles):' as field,
  COALESCE((SELECT org_id::text FROM user_profiles WHERE id = auth.uid()), 'NULL') as value
UNION ALL
SELECT
  'get_user_org_id():' as field,
  COALESCE(get_user_org_id()::text, 'NULL') as value
UNION ALL
SELECT
  'Can create tasks?' as field,
  CASE
    WHEN get_user_org_id() IS NOT NULL THEN '✅ YES'
    ELSE '❌ NO'
  END as value;
