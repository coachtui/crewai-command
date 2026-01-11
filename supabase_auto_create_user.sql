-- Automatically create user in users table when auth user signs up
-- This fixes the authentication issue for voice commands
-- Run this in Supabase SQL Editor

-- Create a function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Get the first organization, or create a default one
  SELECT id INTO default_org_id 
  FROM public.organizations 
  LIMIT 1;
  
  -- If no organization exists, create a default one
  IF default_org_id IS NULL THEN
    INSERT INTO public.organizations (name)
    VALUES ('Default Organization')
    RETURNING id INTO default_org_id;
  END IF;
  
  -- Insert the new user into the users table
  INSERT INTO public.users (id, org_id, email, name, role, created_at)
  VALUES (
    NEW.id,
    default_org_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), -- Use full_name from metadata or email
    'admin', -- Default role, you can change this
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Skip if user already exists
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Also add your existing auth user if not already in users table
INSERT INTO public.users (id, org_id, email, name, role)
SELECT 
  au.id,
  (SELECT id FROM public.organizations LIMIT 1), -- First org
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  'admin'
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Verify all auth users are now in users table
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created,
  u.id IS NOT NULL as in_users_table,
  u.role
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
ORDER BY au.created_at DESC;
