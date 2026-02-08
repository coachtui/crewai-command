# User Creation Fix Guide

## The Problem

You're experiencing 500 Internal Server Errors when trying to create or view users in both your app and the Supabase dashboard. This is happening because:

1. **Missing INSERT Policies**: The `user_profiles` table has Row Level Security (RLS) enabled, but there are **no INSERT policies** defined. This means nobody (not even admins) can create new user profiles.

2. **Missing Helper Functions**: The RLS policies need helper functions like `get_user_org_id()` and `is_user_admin()`, but these don't exist in your current schema.

3. **No Auto-Sync**: When users sign up via Supabase Auth, they're added to `auth.users` but not automatically synced to your `user_profiles` table.

## The Solution

I've created a comprehensive fix script: [`fix_user_creation.sql`](fix_user_creation.sql)

### What This Fix Does

1. **Creates Helper Functions**
   - `get_user_org_id()` - Gets the current user's organization ID
   - `is_user_admin()` - Checks if the current user is an admin

2. **Adds INSERT Policies**
   - Allows admins to create users in their organization
   - Allows Supabase service role to create users (for dashboard and auth triggers)
   - Adds policies to both `user_profiles` (modern) and `users` (legacy) tables

3. **Creates Auto-Sync Trigger**
   - Automatically creates user profiles when new auth users sign up
   - Syncs to both `user_profiles` and `users` tables for backward compatibility

4. **Syncs Existing Users**
   - Ensures all existing `auth.users` have corresponding records in `user_profiles`

## How to Apply the Fix

### Option 1: Via Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to: **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the contents of [`fix_user_creation.sql`](fix_user_creation.sql)
5. Paste into the SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Check the output for ✅ success messages

### Option 2: Via Supabase CLI

```bash
# Make sure you're in the project directory
cd /Users/tui/Desktop/DevProjects/crewai

# Run the fix script
supabase db execute --file fix_user_creation.sql
```

## After Applying the Fix

Once applied, you'll be able to:

✅ Create users in the Supabase dashboard (if you're an admin)
✅ Create users via your app's `inviteUser()` function
✅ Have new auth signups automatically create user profiles
✅ View all users without 500 errors

## Verification

After running the script, verify it worked:

1. **Check in Supabase Dashboard**
   - Go to: Authentication > Users
   - You should see all users listed without errors

2. **Check in Your App**
   - Try creating a new user via the user management interface
   - Should work without 500 errors

3. **Check User Profiles**
   - Go to: Table Editor > user_profiles
   - Should see all auth users with corresponding profiles

## Current User Management Code

Your app uses the modern schema:
- **Table**: `user_profiles`
- **Org Column**: `organization_id`
- **Role Column**: `base_role`
- **API File**: [src/lib/api/users.ts](src/lib/api/users.ts)

The legacy `users` table (with `org_id` and `role`) is kept for backward compatibility but not actively used by your frontend code.

## Need Help?

If you still experience issues after applying the fix:

1. Check the SQL output for any error messages
2. Verify you're logged in as an admin user in Supabase
3. Check browser console for detailed error messages
4. Share any error messages you see

## Related Files

- [fix_user_creation.sql](fix_user_creation.sql) - The fix script
- [src/lib/api/users.ts](src/lib/api/users.ts) - User API functions
- [supabase-schema.sql](supabase-schema.sql) - Current schema
- [fix_schema_and_rls_complete.sql](fix_schema_and_rls_complete.sql) - More comprehensive schema fix
