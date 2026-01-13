-- Create daily_hours table for tracking worker hours, days off, and transfers
CREATE TABLE IF NOT EXISTS daily_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('worked', 'off', 'transferred')),
  hours_worked DECIMAL(5,2) DEFAULT 8.0, -- Default 8 hours
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL, -- Task they worked on
  transferred_to_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL, -- Task they were transferred to
  notes TEXT,
  logged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(worker_id, log_date, org_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_hours_org_date ON daily_hours(org_id, log_date);
CREATE INDEX IF NOT EXISTS idx_daily_hours_worker ON daily_hours(worker_id);
CREATE INDEX IF NOT EXISTS idx_daily_hours_date ON daily_hours(log_date);

-- Enable RLS
ALTER TABLE daily_hours ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view daily hours in their organization" ON daily_hours
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert daily hours in their organization" ON daily_hours
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update daily hours in their organization" ON daily_hours
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete daily hours in their organization" ON daily_hours
  FOR DELETE USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_daily_hours_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_hours_updated_at
  BEFORE UPDATE ON daily_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_hours_updated_at();
