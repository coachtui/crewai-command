-- ============================================================================
-- FIX USER ORG_ID - Set organization for current user
-- Run this AFTER running diagnose_403_error.sql to identify the issue
-- ============================================================================

-- Option 1: If you have existing organizations, assign user to one
-- Replace 'YOUR_ORG_ID_HERE' with an actual organization ID from the diagnosis

-- First, check what organizations exist
SELECT id, name FROM organizations ORDER BY created_at DESC LIMIT 10;

-- Then update your user (uncomment and replace the ID):
-- UPDATE users
-- SET org_id = 'YOUR_ORG_ID_HERE'
-- WHERE id = auth.uid();

-- UPDATE user_profiles
-- SET org_id = 'YOUR_ORG_ID_HERE',
--     organization_id = 'YOUR_ORG_ID_HERE'
-- WHERE id = auth.uid();

\echo ''
\echo '============================================'
\echo 'Option 2: Create a new organization and assign it'
\echo '============================================'
\echo ''

-- Create a new organization and assign it to current user
DO $$
DECLARE
  new_org_id UUID;
  user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM users WHERE id = auth.uid();

  -- Check if user already has an organization
  IF EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND org_id IS NOT NULL) THEN
    RAISE NOTICE '✅ User already has an organization assigned';
    RETURN;
  END IF;

  -- Create new organization
  INSERT INTO organizations (name)
  VALUES ('My Company') -- Change this to your company name
  RETURNING id INTO new_org_id;

  -- Assign to user in users table
  UPDATE users
  SET org_id = new_org_id
  WHERE id = auth.uid();

  -- Assign to user in user_profiles table (if exists)
  UPDATE user_profiles
  SET org_id = new_org_id,
      organization_id = new_org_id
  WHERE id = auth.uid();

  RAISE NOTICE '✅ Created organization with ID: %', new_org_id;
  RAISE NOTICE '✅ Assigned user % to organization', user_email;
END $$;

\echo ''
\echo '============================================'
\echo 'Option 3: Quick fix - Assign to first available org'
\echo '============================================'
\echo ''

-- Quick fix: assign user to the first organization that exists
DO $$
DECLARE
  first_org_id UUID;
BEGIN
  -- Get first organization
  SELECT id INTO first_org_id FROM organizations ORDER BY created_at LIMIT 1;

  IF first_org_id IS NULL THEN
    RAISE EXCEPTION 'No organizations found. Run Option 2 first.';
  END IF;

  -- Assign to user in users table
  UPDATE users
  SET org_id = first_org_id
  WHERE id = auth.uid();

  -- Assign to user in user_profiles table (only org_id, no organization_id column)
  UPDATE user_profiles
  SET org_id = first_org_id
  WHERE id = auth.uid();

  RAISE NOTICE '✅ Assigned user to organization: %', first_org_id;
END $$;

\echo ''
\echo '============================================'
\echo 'Verification'
\echo '============================================'

-- Verify the fix
SELECT
  'User ID:' as field,
  id::text as value
FROM users WHERE id = auth.uid()
UNION ALL
SELECT
  'Email:' as field,
  email as value
FROM users WHERE id = auth.uid()
UNION ALL
SELECT
  'Org ID:' as field,
  COALESCE(org_id::text, '❌ NULL') as value
FROM users WHERE id = auth.uid()
UNION ALL
SELECT
  'Organization Name:' as field,
  COALESCE(o.name, '❌ NOT FOUND') as value
FROM users u
LEFT JOIN organizations o ON o.id = u.org_id
WHERE u.id = auth.uid();

\echo ''
\echo '✅ If Org ID is set, try creating a task again!'
\echo '============================================'
