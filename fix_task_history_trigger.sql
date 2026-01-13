-- Fix task history trigger - split into BEFORE and AFTER triggers
-- Run this in Supabase SQL Editor

-- 1. Drop the existing trigger
DROP TRIGGER IF EXISTS task_changes_trigger ON tasks;

-- 2. Create function for BEFORE UPDATE (to set modified_at)
CREATE OR REPLACE FUNCTION update_task_modified()
RETURNS TRIGGER AS $$
BEGIN
  -- Update modified_at on any update
  IF TG_OP = 'UPDATE' THEN
    NEW.modified_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create function for AFTER INSERT/UPDATE (to track history)
CREATE OR REPLACE FUNCTION track_task_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Track status changes in history AFTER the task exists
  IF TG_OP = 'INSERT' THEN
    INSERT INTO task_history (task_id, org_id, action, performed_by, previous_status, new_status)
    VALUES (NEW.id, NEW.org_id, 'created', NEW.created_by, NULL, NEW.status);
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO task_history (task_id, org_id, action, performed_by, previous_status, new_status)
    VALUES (NEW.id, NEW.org_id, 
      CASE 
        WHEN NEW.status = 'completed' THEN 'completed'
        WHEN OLD.status = 'completed' THEN 'reopened'
        ELSE 'modified'
      END,
      NEW.modified_by, OLD.status, NEW.status);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create BEFORE UPDATE trigger for modified_at
CREATE TRIGGER task_modified_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_modified();

-- 5. Create AFTER INSERT/UPDATE trigger for history tracking
CREATE TRIGGER task_history_trigger
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION track_task_history();

-- Verification
SELECT 'Triggers fixed - task history should now work correctly' as status;
