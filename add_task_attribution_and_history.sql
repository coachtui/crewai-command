-- Add task attribution and history tracking
-- Run this in Supabase SQL Editor

-- 1. Add attribution columns to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS modified_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ;

-- 2. Create task_history table for completion tracking
CREATE TABLE IF NOT EXISTS task_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  action TEXT CHECK (action IN ('created', 'modified', 'completed', 'reopened')) NOT NULL,
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  previous_status TEXT,
  new_status TEXT,
  changes JSONB
);

-- 3. Create holidays table for Hawaii GCA holidays
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  year INT NOT NULL,
  state_county BOOLEAN DEFAULT false,
  federal BOOLEAN DEFAULT false,
  gcla BOOLEAN DEFAULT false,
  four_basic_trades BOOLEAN DEFAULT false,
  pay_rates JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, name)
);

-- 4. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_history_task ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_date ON task_history(performed_at);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year);

-- 5. Enable Row Level Security
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
CREATE POLICY "Allow all for authenticated users" ON task_history
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON holidays
  FOR ALL USING (auth.role() = 'authenticated');

-- 7. Insert 2026 Hawaii GCA Holidays
INSERT INTO holidays (name, date, year, state_county, federal, gcla, four_basic_trades, pay_rates, notes) VALUES
(
  'New Year''s Day',
  '2026-01-01',
  2026,
  true, true, true, true,
  '{"carpenters": "1.5x", "laborers": "1.5x", "masons": "1.5x", "operators": "2x"}'::jsonb,
  'Thursday, January 1'
),
(
  'Martin Luther King Jr. Day',
  '2026-01-19',
  2026,
  true, true, true, true,
  '{"carpenters": "1.5x", "laborers": "1.5x", "masons": "1.5x", "operators": "2x"}'::jsonb,
  'Monday, January 19'
),
(
  'President''s Day',
  '2026-02-16',
  2026,
  true, true, true, true,
  '{"carpenters": "1.5x", "laborers": "1.5x", "masons": "1.5x", "operators": "2x"}'::jsonb,
  'Monday, February 16'
),
(
  'Prince Jonah Kuhio Day',
  '2026-03-26',
  2026,
  true, false, false, false,
  '{"carpenters": "straight", "laborers": "straight", "masons": "straight", "operators": "straight", "state_county": "1.5x"}'::jsonb,
  'Thursday, March 26 - State holiday. 1.5x on State & County Government projects'
),
(
  'Good Friday',
  '2026-04-03',
  2026,
  true, false, false, false,
  '{"carpenters": "straight", "laborers": "straight", "masons": "straight", "operators": "straight", "state_county": "1.5x"}'::jsonb,
  'Friday, April 3 - State holiday. 1.5x on State & County Government projects'
),
(
  'Memorial Day',
  '2026-05-25',
  2026,
  true, true, true, true,
  '{"carpenters": "1.5x", "laborers": "1.5x", "masons": "1.5x", "operators": "2x"}'::jsonb,
  'Monday, May 25'
),
(
  'King Kamehameha I Day',
  '2026-06-11',
  2026,
  true, false, true, true,
  '{"carpenters": "1.5x", "laborers": "1.5x", "masons": "1.5x", "operators": "2x"}'::jsonb,
  'Thursday, June 11'
),
(
  'Juneteenth',
  '2026-06-19',
  2026,
  false, true, false, false,
  '{"carpenters": "straight", "laborers": "straight", "masons": "straight", "operators": "straight", "federal": "1.5x"}'::jsonb,
  'Friday, June 19 - Federal holiday. 1.5x on Federal projects only'
),
(
  'Independence Day',
  '2026-07-04',
  2026,
  true, true, true, true,
  '{"carpenters": "1.5x", "laborers": "1.5x", "masons": "1.5x", "operators": "2x"}'::jsonb,
  'Saturday, July 4 (Observed Friday, July 3)'
),
(
  'Statehood Day',
  '2026-08-21',
  2026,
  true, false, false, false,
  '{"carpenters": "straight", "laborers": "straight", "masons": "straight", "operators": "straight", "state_county": "1.5x"}'::jsonb,
  'Friday, August 21 - State holiday. 1.5x on State & County Government projects'
),
(
  'Labor Day',
  '2026-09-07',
  2026,
  true, true, true, true,
  '{"carpenters": "3x", "laborers": "3x", "masons": "3x", "operators": "2x"}'::jsonb,
  'Monday, September 7 - SPECIAL: 3x for Carpenters, Laborers, Masons'
),
(
  'Columbus Day',
  '2026-10-12',
  2026,
  false, true, false, false,
  '{"carpenters": "straight", "laborers": "straight", "masons": "straight", "operators": "straight", "federal": "1.5x"}'::jsonb,
  'Monday, October 12 (Discoverer''s Day) - Federal holiday. 1.5x on Federal projects only'
),
(
  'General Election Day',
  '2026-11-03',
  2026,
  true, false, false, false,
  '{"carpenters": "straight", "laborers": "straight", "masons": "straight", "operators": "straight", "state_county": "1.5x"}'::jsonb,
  'Tuesday, November 3 - State holiday. 1.5x on State & County Government projects'
),
(
  'Veterans'' Day',
  '2026-11-11',
  2026,
  true, true, true, true,
  '{"carpenters": "1.5x", "laborers": "1.5x", "masons": "1.5x", "operators": "2x"}'::jsonb,
  'Wednesday, November 11'
),
(
  'Thanksgiving Day',
  '2026-11-26',
  2026,
  true, true, true, true,
  '{"carpenters": "1.5x", "laborers": "1.5x", "masons": "1.5x", "operators": "2x"}'::jsonb,
  'Thursday, November 26'
),
(
  'Christmas Day',
  '2026-12-25',
  2026,
  true, true, true, true,
  '{"carpenters": "1.5x", "laborers": "1.5x", "masons": "1.5x", "operators": "2x"}'::jsonb,
  'Friday, December 25'
);

-- 8. Create function to automatically track task modifications
CREATE OR REPLACE FUNCTION track_task_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Update modified_at and modified_by on any update
  IF TG_OP = 'UPDATE' THEN
    NEW.modified_at = NOW();
    -- modified_by should be set by the application
  END IF;
  
  -- Track status changes in history
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

-- 9. Create trigger for task changes
DROP TRIGGER IF EXISTS task_changes_trigger ON tasks;
CREATE TRIGGER task_changes_trigger
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION track_task_changes();

-- Verification queries
SELECT 'Tasks table updated' as status;
SELECT COUNT(*) as holiday_count FROM holidays WHERE year = 2026;
