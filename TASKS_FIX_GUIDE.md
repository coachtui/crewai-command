# Fix Tasks Submission Error (400 Bad Request)

## Problem Summary

You're getting a **400 error** when trying to submit tasks because:

1. ❌ The `tasks` table is **missing required columns**
2. ❌ The Row Level Security (RLS) policies may **not allow INSERT operations**

The application expects these 16 columns in the tasks table:
- `name`, `location`, `start_date`, `end_date`
- `required_operators`, `required_laborers`, `required_carpenters`, `required_masons`
- `status`, `notes`
- `include_saturday`, `include_sunday`, `include_holidays`
- `attachments`
- `org_id`, `created_by`

## Quick Fix (2 Steps)

### Step 1: Diagnose the Issue

1. Go to your Supabase project: https://app.supabase.com/project/rgsulxuitaktxwmcozya
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"**
4. Copy and paste the contents of [`diagnose_tasks_issue.sql`](./diagnose_tasks_issue.sql)
5. Click **"Run"**

This will show you:
- ✅ What columns exist
- ❌ What columns are missing
- ✅ Whether INSERT policies exist

### Step 2: Apply the Fix

1. Still in the SQL Editor, create another **"New query"**
2. Copy and paste the contents of [`fix_tasks_table_complete.sql`](./fix_tasks_table_complete.sql)
3. Click **"Run"**

This will:
- ✅ Add all missing columns to the `tasks` table
- ✅ Create proper RLS policies to allow INSERT/UPDATE/DELETE
- ✅ Set up indexes for performance
- ✅ Add foreign key constraints

## After Running the Fix

1. **Refresh your application** (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
2. **Try creating a task again**
3. **Check the Network tab** in DevTools - the POST request should now return **201 Created** instead of **400 Bad Request**

## Verification

After running the fix, verify everything works:

```sql
-- Check that all columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY ordinal_position;

-- Check that INSERT policy exists
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'tasks' AND (cmd = 'INSERT' OR cmd = 'ALL');
```

You should see:
- ✅ All 16+ columns listed
- ✅ At least one policy with cmd = 'INSERT' or 'ALL'

## Understanding the Error

The **400 Bad Request** error happens when:

1. **Missing Columns**: Supabase rejects the INSERT because the table doesn't have columns like `required_carpenters`, `include_saturday`, etc.

2. **RLS Policy Blocking**: Even if columns exist, Row Level Security might block the INSERT if there's no policy allowing authenticated users to insert records.

3. **Wrong org_id**: The `org_id` being sent doesn't match your user's organization (less likely in your case).

## What the Fix Does

### Adds Missing Columns
```sql
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS required_carpenters INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS required_masons INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS include_saturday BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS include_sunday BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS include_holidays BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
```

### Creates INSERT Policy
```sql
CREATE POLICY "tasks_insert_policy" ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
      UNION
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    )
  );
```

This allows any authenticated user to insert tasks as long as the `org_id` matches their organization.

## Troubleshooting

### Still getting 400 errors?

1. **Check browser console** for the actual error message:
   ```javascript
   // Open DevTools Console and look for errors
   console.log('Check Network tab → Click failed request → Response tab')
   ```

2. **Verify your user profile has an org_id**:
   ```sql
   SELECT id, email, name, org_id
   FROM users
   WHERE id = auth.uid();
   ```

   If `org_id` is NULL, that's your problem! Run this:
   ```sql
   UPDATE users
   SET org_id = '550e8400-e29b-41d4-a716-446655440000'
   WHERE id = auth.uid();
   ```

3. **Check if the organization exists**:
   ```sql
   SELECT * FROM organizations
   WHERE id = '550e8400-e29b-41d4-a716-446655440000';
   ```

   If it doesn't exist, create it:
   ```sql
   INSERT INTO organizations (id, name)
   VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Your Company Name')
   ON CONFLICT (id) DO NOTHING;
   ```

### Task form shows but submit fails?

Check the actual data being sent in the Network tab:
1. Open DevTools → Network tab
2. Try submitting a task
3. Click on the failed `tasks` request
4. Check the **Payload** tab to see what data is being sent
5. Compare with the **Response** tab to see the error message

Common issues:
- ❌ `start_date` or `end_date` is in wrong format (should be `YYYY-MM-DD`)
- ❌ `required_operators` or `required_laborers` is not a number
- ❌ `org_id` is missing or doesn't match your organization

## Expected Success

After the fix, when you submit a task, you should see:

**Network tab:**
```
POST /rest/v1/tasks
Status: 201 Created
Response: [{ id: "uuid-here", name: "Your task", ... }]
```

**UI:**
- ✅ Task appears in the tasks list
- ✅ No error messages
- ✅ Success toast notification

## Summary

1. **Run** [`diagnose_tasks_issue.sql`](./diagnose_tasks_issue.sql) to identify the problem
2. **Run** [`fix_tasks_table_complete.sql`](./fix_tasks_table_complete.sql) to fix it
3. **Refresh** your app and try again
4. **Success!** Tasks should now submit without errors

---

**Need more help?** Check the browser console and Network tab for detailed error messages.
