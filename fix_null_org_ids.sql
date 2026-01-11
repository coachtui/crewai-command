-- Fix NULL org_id on existing workers, tasks, and assignments
-- Run this in Supabase SQL Editor

-- First, check your user's org_id
SELECT id, email, org_id FROM users;

-- If your user has NULL org_id, run this first:
-- UPDATE users SET org_id = (SELECT id FROM organizations LIMIT 1) WHERE org_id IS NULL;

-- Now get your org_id to use below
SELECT id as your_org_id FROM organizations LIMIT 1;

-- REPLACE 'YOUR_ORG_ID' below with the actual org_id from above
-- Then run these UPDATE statements:

-- Update workers
UPDATE workers 
SET org_id = 'YOUR_ORG_ID'
WHERE org_id IS NULL;

-- Update tasks
UPDATE tasks 
SET org_id = 'YOUR_ORG_ID'
WHERE org_id IS NULL;

-- Update assignments
UPDATE assignments 
SET org_id = 'YOUR_ORG_ID'
WHERE org_id IS NULL;

-- Verify everything now has org_id
SELECT 'workers' as table_name, COUNT(*) as with_org, org_id
FROM workers 
GROUP BY org_id
UNION ALL
SELECT 'tasks', COUNT(*), org_id
FROM tasks 
GROUP BY org_id
UNION ALL
SELECT 'assignments', COUNT(*), org_id
FROM assignments 
GROUP BY org_id;

-- Should show counts with your org_id, no NULL
