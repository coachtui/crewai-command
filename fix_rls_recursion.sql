-- Fix infinite recursion in users table RLS policies
-- Run this in Supabase SQL Editor

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can read own record" ON users;
DROP POLICY IF EXISTS "Users can read org members" ON users;

-- Create a simple policy that doesn't cause recursion
-- Users can read their own record directly using auth.uid()
CREATE POLICY "Users can read own record"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- For reading other users in the same org, we use a different approach
-- First, let's create a function that gets the user's org_id without causing recursion
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT org_id FROM public.users WHERE id = auth.uid()
$$;

-- Now create the policy using the function
CREATE POLICY "Users can read org members"
  ON users
  FOR SELECT
  TO authenticated
  USING (org_id = public.get_user_org_id());

-- Verify policies
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
