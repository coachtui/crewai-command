-- Add authenticated user to users table
-- Run this in Supabase SQL Editor

-- First, let's see your auth user details
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Next, check if you have any organizations
SELECT id as org_id, name 
FROM organizations
ORDER BY created_at DESC;

-- Now insert your auth user into the users table
-- Replace these values with your actual data:
-- - YOUR_AUTH_USER_ID: from the first query above
-- - YOUR_ORG_ID: from the second query (or create one if empty)
-- - YOUR_EMAIL: your email address
-- - YOUR_NAME: your name
-- - YOUR_ROLE: 'admin' or 'foreman'

-- If you don't have an organization yet, create one first:
INSERT INTO organizations (name)
VALUES ('Your Company Name')
RETURNING id;

-- Then insert your user (replace the values in quotes):
INSERT INTO users (id, org_id, email, name, role)
VALUES (
  'YOUR_AUTH_USER_ID',  -- Get this from the first query
  'YOUR_ORG_ID',        -- Get this from organizations table
  'YOUR_EMAIL',         -- Your email
  'YOUR_NAME',          -- Your name (e.g., 'John Smith')
  'admin'               -- Role: 'admin' or 'foreman'
)
ON CONFLICT (id) DO UPDATE
SET 
  org_id = EXCLUDED.org_id,
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role;

-- Verify the user was added
SELECT * FROM users WHERE email = 'YOUR_EMAIL';

-- EXAMPLE (Don't run this, customize it with your values):
-- INSERT INTO users (id, org_id, email, name, role)
-- VALUES (
--   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
--   'org123-456-789',
--   'admin@company.com',
--   'Admin User',
--   'admin'
-- );
