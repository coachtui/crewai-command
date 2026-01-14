# Database Setup Instructions

## 🚨 Issue Found

Your app is stuck on loading because the Supabase database is **missing required tables and columns**.

**Error from logs:**
```
GET /rest/v1/users?select=role,base_role&id=eq.2db0aaa7-1414-4562-ad43-b67a456eb797
Status: 400
Error: PostgREST; error=42703 (undefined_column)
```

**Translation:** The `users` table doesn't exist or is missing the `role`/`base_role` columns.

---

## ✅ Solution: Setup Database Schema

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project: https://app.supabase.com/project/rgsulxuitaktxwmcozya
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"**

### Step 2: Run the Schema Setup

Copy the entire contents of [`supabase-schema.sql`](./supabase-schema.sql) and paste it into the SQL editor, then click **"Run"**.

This will create:
- ✅ `organizations` table
- ✅ `user_profiles` table (modern schema)
- ✅ `users` table (legacy schema with `role` and `base_role` columns)
- ✅ `job_sites` table
- ✅ `job_site_assignments` table
- ✅ `tasks` table
- ✅ `daily_hours` table
- ✅ `activities` table
- ✅ Row Level Security (RLS) policies
- ✅ Performance indexes
- ✅ Timestamp triggers

### Step 3: Create Your User Profile

Your authenticated user ID is: `2db0aaa7-1414-4562-ad43-b67a456eb797`

Run this SQL to create your user profile:

```sql
-- First, create an organization
INSERT INTO organizations (id, name)
VALUES (gen_random_uuid(), 'My Construction Company')
RETURNING id;

-- Copy the returned UUID, then run this (replace <org-id> with the UUID from above):
INSERT INTO users (id, org_id, email, name, role, base_role)
VALUES (
  '2db0aaa7-1414-4562-ad43-b67a456eb797',  -- Your user ID from auth
  '<org-id>',  -- Organization UUID from step above
  'your-email@example.com',  -- Your email
  'Your Name',  -- Your name
  'admin',  -- Legacy role
  'admin'  -- Base role
);

-- Also create in user_profiles for modern schema support:
INSERT INTO user_profiles (id, organization_id, email, name, base_role)
VALUES (
  '2db0aaa7-1414-4562-ad43-b67a456eb797',
  '<org-id>',  -- Same org UUID
  'your-email@example.com',
  'Your Name',
  'admin'
);
```

**Alternatively, use this one-liner (easier):**

```sql
-- Create organization and user in one transaction
WITH new_org AS (
  INSERT INTO organizations (name) VALUES ('My Construction Company') RETURNING id
)
INSERT INTO users (id, org_id, email, name, role, base_role)
SELECT
  '2db0aaa7-1414-4562-ad43-b67a456eb797',
  new_org.id,
  'your-email@example.com',
  'Your Name',
  'admin',
  'admin'
FROM new_org
RETURNING *;

-- Then create user_profiles entry
INSERT INTO user_profiles (id, organization_id, email, name, base_role)
SELECT
  '2db0aaa7-1414-4562-ad43-b67a456eb797',
  org_id,
  email,
  name,
  base_role
FROM users
WHERE id = '2db0aaa7-1414-4562-ad43-b67a456eb797';
```

### Step 4: Verify Tables Exist

Run this query to confirm all tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:
- ✅ activities
- ✅ daily_hours
- ✅ job_site_assignments
- ✅ job_sites
- ✅ organizations
- ✅ tasks
- ✅ user_profiles
- ✅ users

### Step 5: Verify Your User Profile

```sql
SELECT * FROM users WHERE id = '2db0aaa7-1414-4562-ad43-b67a456eb797';
SELECT * FROM user_profiles WHERE id = '2db0aaa7-1414-4562-ad43-b67a456eb797';
```

You should see your user profile with:
- ✅ `role` = 'admin'
- ✅ `base_role` = 'admin'
- ✅ `org_id` or `organization_id` set to your organization UUID

---

## 🧪 Test the Fix

After setting up the database:

1. **Hard refresh** your production site (Ctrl+Shift+R)
2. **Open DevTools Console**
3. Look for diagnostic logs:

**✅ Expected success output:**
```
[DIAGNOSTIC] HTML loaded (0ms)
[DIAGNOSTIC] main.tsx loaded (150ms)
[DIAGNOSTIC] Supabase config check (172ms) - configured: true
[DIAGNOSTIC] [Auth] Checking for existing session (171ms)
[DIAGNOSTIC] [Auth] Session check complete (has session: true) (250ms)
[DIAGNOSTIC] [Auth] Fetching user profile (251ms)
[DIAGNOSTIC] [Auth] User authenticated successfully (320ms)
[DIAGNOSTIC] [Auth] AuthProvider initialization complete (325ms)
```

4. **Verify no errors in Network tab:**
   - Open DevTools → Network tab
   - Filter by "users" or "user_profiles"
   - All requests should return **200 OK** (not 400)

5. **Check the app loads:**
   - Should see the Workers page (or appropriate page for your role)
   - No more infinite "Loading..." spinner
   - Can navigate between pages

---

## 🔍 Troubleshooting

### Still getting 400 errors?

**Check which table/columns are failing:**
1. Open DevTools → Network tab
2. Find the failing request (status 400)
3. Click on it → Response tab
4. Look for the error message

**Common issues:**
- Missing `role` column in `users` table → Re-run schema setup
- Missing `base_role` column → Re-run schema setup
- User profile doesn't exist → Run Step 3 again
- RLS policies blocking access → Check Supabase auth logs

### App still stuck on "Loading..."?

**Check console for diagnostic logs:**
```javascript
// Run in browser console
console.table(window.__APP_DIAGNOSTICS__.checkpoints);
console.table(window.__APP_DIAGNOSTICS__.errors);
```

Look for where the checkpoints stop. The last checkpoint before it gets stuck tells you what failed.

### No session found?

If diagnostic logs show "No session found", you need to log in again:
1. Clear browser cache and cookies
2. Go to `/login`
3. Sign in with your credentials
4. After successful login, you should be redirected to `/workers`

---

## 📝 Role Hierarchy

The app supports these roles (in order of permissions):

1. **admin** - Full access to everything
2. **superintendent** - Manage job sites and workers
3. **engineer** - Engineering tasks and oversight
4. **foreman** - Day-to-day site management
5. **worker** - Basic access, log hours, view tasks

Set the appropriate `base_role` when creating user profiles.

---

## 🔐 Row Level Security (RLS)

The schema includes RLS policies that ensure:
- Users only see data from their organization
- Users can only modify their own records
- Admins have broader access within their organization
- All data is properly isolated by organization

---

## 🎯 Next Steps After Database Setup

Once your database is set up and the app loads:

1. **Create a Job Site:**
   - Navigate to Job Sites (once implemented)
   - Or manually insert via SQL:
   ```sql
   INSERT INTO job_sites (organization_id, name, location, status)
   VALUES (
     '<your-org-id>',
     'Main Construction Site',
     '123 Main St, City, State',
     'active'
   );
   ```

2. **Assign Users to Job Sites:**
   ```sql
   INSERT INTO job_site_assignments (user_id, job_site_id, role, is_active)
   VALUES (
     '2db0aaa7-1414-4562-ad43-b67a456eb797',
     '<job-site-id>',
     'superintendent',
     true
   );
   ```

3. **Invite Team Members:**
   - Users sign up via Supabase Auth
   - After signup, create their profile in `users` or `user_profiles` table
   - Assign them to job sites via `job_site_assignments`

---

## 📊 Expected Timeline

- ⚡ **2 minutes** - Run schema setup SQL
- ⚡ **1 minute** - Create your user profile
- ⚡ **1 minute** - Verify and test
- ✅ **Total: ~4 minutes to resolution**

---

## ✅ Success Checklist

After completing all steps:

- [ ] All 8 tables created in Supabase
- [ ] Your user profile exists in `users` table
- [ ] Your user profile exists in `user_profiles` table
- [ ] Organization record exists
- [ ] No 400 errors in Network tab
- [ ] Diagnostic logs show successful auth initialization
- [ ] App loads and shows the Workers page
- [ ] Can navigate between pages without errors

---

**Questions?** Check the diagnostic logs in the browser console. They'll tell you exactly where the app is getting stuck.
