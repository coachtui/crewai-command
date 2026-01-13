-- Automatically fix NULL org_id on existing workers, tasks, assignments, and daily_hours
-- This script will automatically detect your org_id and update all NULL values
-- Run this in Supabase SQL Editor

DO $$
DECLARE
  target_org_id UUID;
BEGIN
  -- Get the first organization's ID (assuming single-org setup)
  SELECT id INTO target_org_id FROM organizations LIMIT 1;
  
  IF target_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found! Please create an organization first.';
  END IF;
  
  -- Update workers with NULL org_id
  UPDATE workers 
  SET org_id = target_org_id
  WHERE org_id IS NULL;
  
  RAISE NOTICE 'Updated % workers with org_id', (SELECT COUNT(*) FROM workers WHERE org_id = target_org_id);
  
  -- Update tasks with NULL org_id
  UPDATE tasks 
  SET org_id = target_org_id
  WHERE org_id IS NULL;
  
  RAISE NOTICE 'Updated % tasks with org_id', (SELECT COUNT(*) FROM tasks WHERE org_id = target_org_id);
  
  -- Update assignments with NULL org_id
  UPDATE assignments 
  SET org_id = target_org_id
  WHERE org_id IS NULL;
  
  RAISE NOTICE 'Updated % assignments with org_id', (SELECT COUNT(*) FROM assignments WHERE org_id = target_org_id);
  
  -- Update daily_hours with NULL org_id (if any exist)
  UPDATE daily_hours 
  SET org_id = target_org_id
  WHERE org_id IS NULL;
  
  RAISE NOTICE 'Updated % daily_hours with org_id', (SELECT COUNT(*) FROM daily_hours WHERE org_id = target_org_id);
  
  -- Update users with NULL org_id
  UPDATE users 
  SET org_id = target_org_id
  WHERE org_id IS NULL;
  
  RAISE NOTICE 'Updated % users with org_id', (SELECT COUNT(*) FROM users WHERE org_id = target_org_id);
  
  RAISE NOTICE 'Organization ID used: %', target_org_id;
  RAISE NOTICE 'All NULL org_ids have been fixed!';
END $$;

-- Verify everything now has org_id
SELECT 'Summary of Records by Table:' as message;

SELECT 
  'workers' as table_name, 
  COUNT(*) as total_records,
  COUNT(CASE WHEN org_id IS NULL THEN 1 END) as null_org_ids,
  COUNT(CASE WHEN org_id IS NOT NULL THEN 1 END) as with_org_id
FROM workers 
UNION ALL
SELECT 
  'tasks', 
  COUNT(*),
  COUNT(CASE WHEN org_id IS NULL THEN 1 END),
  COUNT(CASE WHEN org_id IS NOT NULL THEN 1 END)
FROM tasks 
UNION ALL
SELECT 
  'assignments', 
  COUNT(*),
  COUNT(CASE WHEN org_id IS NULL THEN 1 END),
  COUNT(CASE WHEN org_id IS NOT NULL THEN 1 END)
FROM assignments
UNION ALL
SELECT 
  'daily_hours', 
  COUNT(*),
  COUNT(CASE WHEN org_id IS NULL THEN 1 END),
  COUNT(CASE WHEN org_id IS NOT NULL THEN 1 END)
FROM daily_hours
UNION ALL
SELECT 
  'users', 
  COUNT(*),
  COUNT(CASE WHEN org_id IS NULL THEN 1 END),
  COUNT(CASE WHEN org_id IS NOT NULL THEN 1 END)
FROM users;

-- All null_org_ids should be 0
