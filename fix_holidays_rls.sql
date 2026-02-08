-- Fix holidays table RLS policies
-- Holidays should be readable by all authenticated users

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON holidays;

-- Create proper RLS policies for holidays table
-- Everyone can read holidays (they're public data)
CREATE POLICY "Allow read access to all authenticated users" ON holidays
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can insert/update/delete holidays
CREATE POLICY "Allow insert for service role only" ON holidays
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow update for service role only" ON holidays
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Allow delete for service role only" ON holidays
  FOR DELETE
  USING (auth.role() = 'service_role');

-- Verify the policies
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'holidays';
