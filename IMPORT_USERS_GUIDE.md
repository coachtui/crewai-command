# Import Existing Users - Implementation Guide

## Problem
The Dashboard Users tab was not showing existing users because users in Supabase Auth (`auth.users` table) didn't have corresponding entries in the `user_profiles` table.

## Solution
Added functionality to import existing auth users into the user_profiles table with a single click.

## Changes Made

### 1. Database Function (`import_auth_users_function.sql`)
Created a new SQL function that:
- Scans all users in `auth.users` table
- Creates `user_profiles` entries for users who don't have one
- Assigns them to the specified organization
- Sets default role as 'worker'
- Also includes a trigger to auto-import future auth users

### 2. API Function (`src/lib/api/users.ts`)
Added `importExistingAuthUsers()` function that:
- Calls the database RPC function
- Returns count of imported and skipped users
- Handles errors gracefully

### 3. UI Component (`src/components/admin/UserManagement.tsx`)
Added:
- "Import Existing" button next to "Invite User" button
- Loading state while importing
- Success/error toast notifications
- Automatic refresh of user list after import

## Installation Steps

### Step 1: Run the SQL Function
1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the content from `import_auth_users_function.sql`
4. Click "Run" to create the function and trigger

### Step 2: Test the Import
1. Navigate to Dashboard → Users tab
2. Click the "Import Existing" button
3. The system will import all auth users that don't have profiles
4. You'll see a success message with the count of imported users

## How It Works

### Database Structure
```
auth.users (Supabase Auth)
    ↓
user_profiles (Application users)
    ↓
job_site_assignments (User-to-site mappings)
```

### Import Process
1. Fetch all users from `auth.users`
2. For each user:
   - Check if they have a `user_profiles` entry
   - If not, create one with:
     - Same ID as auth user
     - Organization ID from current user
     - Email from auth user
     - Name from metadata or email
     - Default role: 'worker'
3. Return count of imported/skipped users

### Auto-Import Trigger
The SQL script also creates a trigger that automatically creates user_profiles for new auth users going forward.

## Field Mapping

| Auth Field | Profile Field | Default Value |
|------------|---------------|---------------|
| `id` | `id` | Same |
| `email` | `email` | Same |
| `raw_user_meta_data->>'full_name'` | `name` | Falls back to email |
| N/A | `base_role` | 'worker' |
| Current org | `org_id` / `organization_id` | Current user's org |
| `created_at` | `created_at` | Same |

## Notes

- **Default Role**: Imported users get 'worker' role by default. Admins can change this after import.
- **Organization**: All imported users are assigned to the current user's organization.
- **Idempotent**: Safe to run multiple times - only imports users that don't have profiles.
- **Real-time Updates**: The user list refreshes automatically after import.

## Verification

To check which auth users are missing profiles, run this query in Supabase SQL Editor:

```sql
SELECT
  au.id,
  au.email,
  au.created_at as auth_created,
  up.id IS NOT NULL as has_profile,
  up.name,
  up.base_role
FROM auth.users au
LEFT JOIN user_profiles up ON up.id = au.id
ORDER BY au.created_at DESC;
```

## Troubleshooting

### "Failed to import users"
- Make sure the SQL function was created successfully
- Check that your organization has an ID
- Verify you have admin permissions

### Users still not showing
- Refresh the page
- Check that the organization_id matches in both tables
- Verify RLS policies allow viewing user_profiles

### Future auth users not auto-importing
- Verify the trigger was created: `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;`
- Check trigger function exists: `SELECT * FROM pg_proc WHERE proname = 'handle_new_auth_user';`
