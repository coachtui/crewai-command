-- Quick check: What policies exist right now?
-- Run this to see the current state

SELECT
  tablename,
  policyname,
  cmd as operation,
  permissive,
  roles
FROM pg_policies
WHERE tablename IN ('user_profiles', 'users')
ORDER BY tablename, cmd, policyname;

-- If you see NO results, that means there are NO policies at all
-- which would explain why everything is failing
