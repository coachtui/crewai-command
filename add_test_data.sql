-- Add test data for voice commands
-- Run this in Supabase SQL Editor after setting up your user

-- Get your org_id (you'll see this in the results)
SELECT id as org_id, name FROM organizations;

-- Replace YOUR_ORG_ID below with the actual org_id from above

-- Add test workers
INSERT INTO workers (org_id, name, role, status) VALUES
  ('YOUR_ORG_ID', 'Jose Martinez', 'operator', 'active'),
  ('YOUR_ORG_ID', 'Panama Silva', 'laborer', 'active'),
  ('YOUR_ORG_ID', 'Carlos Rodriguez', 'operator', 'active'),
  ('YOUR_ORG_ID', 'Miguel Santos', 'laborer', 'active')
ON CONFLICT DO NOTHING;

-- Add test tasks
INSERT INTO tasks (org_id, name, location, status, start_date, required_operators, required_laborers) VALUES
  ('YOUR_ORG_ID', 'Concrete Pour', 'HCC Building A', 'active', CURRENT_DATE, 2, 3),
  ('YOUR_ORG_ID', 'Steel Framing', 'HCC Building B', 'active', CURRENT_DATE, 1, 2),
  ('YOUR_ORG_ID', 'Electrical Work', 'Downtown Site', 'planned', CURRENT_DATE + 1, 1, 1)
ON CONFLICT DO NOTHING;

-- Verify data was added
SELECT 'Workers:' as table_name, COUNT(*) as count FROM workers WHERE org_id = 'YOUR_ORG_ID'
UNION ALL
SELECT 'Tasks:', COUNT(*) FROM tasks WHERE org_id = 'YOUR_ORG_ID';

-- Get worker and task IDs for assignments (you'll need these)
SELECT id, name, role FROM workers WHERE org_id = 'YOUR_ORG_ID';
SELECT id, name, location FROM tasks WHERE org_id = 'YOUR_ORG_ID';

-- Add test assignments (replace WORKER_ID and TASK_ID with actual IDs from above)
INSERT INTO assignments (org_id, worker_id, task_id, assigned_date, status) VALUES
  ('YOUR_ORG_ID', 'JOSE_WORKER_ID', 'CONCRETE_TASK_ID', CURRENT_DATE, 'assigned'),
  ('YOUR_ORG_ID', 'PANAMA_WORKER_ID', 'STEEL_TASK_ID', CURRENT_DATE, 'assigned')
ON CONFLICT DO NOTHING;
