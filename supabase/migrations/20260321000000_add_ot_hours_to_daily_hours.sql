-- Add overtime hours column to daily_hours table
ALTER TABLE daily_hours
  ADD COLUMN IF NOT EXISTS ot_hours numeric(5,2) NOT NULL DEFAULT 0;
