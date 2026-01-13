-- Add acknowledged field to assignments table
-- This allows tracking which assignment changes have been reviewed by admins

ALTER TABLE assignments 
ADD COLUMN acknowledged BOOLEAN DEFAULT FALSE;

-- Create index for filtering acknowledged/pending activities
CREATE INDEX idx_assignments_acknowledged ON assignments(acknowledged);

-- Update any existing assignments to be unacknowledged
UPDATE assignments SET acknowledged = FALSE WHERE acknowledged IS NULL;
