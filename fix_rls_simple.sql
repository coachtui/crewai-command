-- Fix RLS policies for users table
-- Copy and paste this ENTIRE file into Supabase SQL Editor and run

-- Step 1: Drop existing problematic policies
DROP POLICY IF EXISTS "Users can read own record" ON users;
DROP POLICY IF EXISTS "Users can read org members" ON users;

-- Step 2: Create helper function
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT org_id FROM public.users WHERE id = auth.uid()
$$;

-- Step 3: Create simple policy for reading own record
CREATE POLICY "Users can read own record"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Step 4: Create policy for reading org members
CREATE POLICY "Users can read org members"
  ON users
  FOR SELECT
  TO authenticated
  USING (org_id = public.get_user_org_id());
