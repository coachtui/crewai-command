-- Create task_drafts table for saving incomplete/work-in-progress tasks
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS task_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  start_date DATE,
  end_date DATE,
  required_operators INTEGER DEFAULT 0,
  required_laborers INTEGER DEFAULT 0,
  required_carpenters INTEGER DEFAULT 0,
  required_masons INTEGER DEFAULT 0,
  notes TEXT,
  attachments TEXT[], -- Array of file URLs
  include_saturday BOOLEAN DEFAULT false,
  include_sunday BOOLEAN DEFAULT false,
  include_holidays BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  modified_by UUID REFERENCES users(id),
  modified_at TIMESTAMPTZ
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_drafts_org ON task_drafts(org_id);
CREATE INDEX IF NOT EXISTS idx_task_drafts_created_by ON task_drafts(created_by);
CREATE INDEX IF NOT EXISTS idx_task_drafts_created_at ON task_drafts(created_at);

-- Enable Row Level Security
ALTER TABLE task_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only see drafts from their organization
CREATE POLICY "Users can view drafts from their org" ON task_drafts
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert drafts in their org" ON task_drafts
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own drafts" ON task_drafts
  FOR UPDATE USING (
    created_by = auth.uid() OR
    org_id IN (
      SELECT org_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'foreman')
    )
  );

CREATE POLICY "Users can delete their own drafts" ON task_drafts
  FOR DELETE USING (
    created_by = auth.uid() OR
    org_id IN (
      SELECT org_id FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Verification
SELECT 'Task drafts table created successfully' as status;
SELECT COUNT(*) as draft_count FROM task_drafts;
