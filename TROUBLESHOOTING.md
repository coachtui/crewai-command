# Troubleshooting: Workers Not Loading

## Quick Checks

### 1. Check Browser Console for Errors

1. Open your browser (Chrome/Firefox/Safari)
2. Press `F12` or `Cmd+Option+I` (Mac) to open Developer Tools
3. Click on the **Console** tab
4. Look for red error messages
5. Common errors and fixes:

**Error: "Failed to load workers"**
- Database schema not created yet
- RLS policies blocking access
- Wrong API key

**Error: "Invalid API key"**
- Check your `.env.local` file
- Make sure anon key is complete (should be ~200+ characters)
- Restart dev server after changing `.env.local`

**Error: "relation 'workers' does not exist"**
- Database tables not created
- Run the SQL schema from `SUPABASE_SETUP.md`

### 2. Verify Supabase API Key

Your current anon key in `.env.local` appears short. A valid Supabase anon key should:
- Start with `eyJ`
- Be 200-300 characters long
- Look like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (much longer)

**To get the correct key:**
1. Go to your Supabase project dashboard
2. Click **Settings** → **API**
3. Find "Project API keys" section
4. Copy the **anon** **public** key (the long one)
5. Replace in `.env.local`:
```env
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnc3VseHVpdGFrdHh3bWNvenl

hIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzM4NjYyMzAsImV4cCI6MTk4OTQ0MjIzMH0.YOUR_SIGNATURE_HERE
```
(This is just an example - use YOUR actual key)

6. **Restart dev server** (Ctrl+C, then `npm run dev`)

### 3. Verify Database Tables Exist

1. Go to Supabase dashboard
2. Click **Table Editor** in left sidebar
3. You should see these tables:
   - ✅ organizations
   - ✅ users
   - ✅ workers
   - ✅ tasks
   - ✅ assignments
   - ✅ assignment_requests

**If tables are missing:**
- Go to **SQL Editor**
- Run the full schema from `SUPABASE_SETUP.md` Step 4

### 4. Check if Test Data Exists

1. In Supabase dashboard → **Table Editor**
2. Click on `workers` table
3. You should see 6 workers listed

**If no data:**
- Run the test data SQL from `SUPABASE_SETUP.md` Step 5

### 5. Test Supabase Connection

Open browser console and run:
```javascript
// Test if Supabase is connecting
fetch('https://rgsulxuitaktxwmcozya.supabase.co/rest/v1/workers', {
  headers: {
    'apikey': 'YOUR_ANON_KEY_HERE',
    'Authorization': 'Bearer YOUR_ANON_KEY_HERE'
  }
}).then(r => r.json()).then(console.log)
```

Should return: Array of workers OR error message showing the problem

### 6. Check RLS Policies

If tables exist but still no data showing:

1. Go to Supabase → **Authentication** → **Policies**
2. Click on `workers` table
3. Verify policy exists: "Allow all for authenticated users"

**If policy is missing**, run in SQL Editor:
```sql
CREATE POLICY "Allow all for authenticated users" ON workers
  FOR ALL USING (auth.role() = 'authenticated');
```

### 7. Temporarily Disable RLS (For Testing Only)

To test if RLS is the issue:

```sql
ALTER TABLE workers DISABLE ROW LEVEL SECURITY;
```

If workers load after this, the issue is with RLS policies. Re-enable and fix policies:
```sql
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
```

## Common Solutions

### Solution 1: Complete Fresh Setup

```sql
-- 1. Delete all tables (if they exist)
DROP TABLE IF EXISTS assignment_requests CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS workers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- 2. Run complete schema from SUPABASE_SETUP.md Step 4
-- 3. Run test data from SUPABASE_SETUP.md Step 5
```

### Solution 2: Fix Anon Key

1. Get correct anon key from Supabase dashboard
2. Update `.env.local`
3. **Must restart dev server!** (Ctrl+C, then `npm run dev`)

### Solution 3: Simplify RLS Policies

For development, use simple "allow all" policies:

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON workers;

-- Create simple policy that allows everything
CREATE POLICY "Allow all" ON workers FOR ALL USING (true);
```

## Still Not Working?

### Check These:

1. **Network Tab**
   - Open Dev Tools → Network tab
   - Refresh page
   - Look for requests to `supabase.co`
   - Check if they're returning 401 (auth error) or 404 (not found)

2. **Supabase Project Status**
   - Make sure your project isn't paused
   - Check dashboard for any warnings

3. **Environment Variables**
   - Make sure `.env.local` is in root directory
   - Variables must start with `VITE_`
   - No quotes needed around values
   - Dev server must be restarted after changes

## Quick Test Commands

Run in browser console on your app page:

```javascript
// Test 1: Check if env vars are loaded
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Key length:', import.meta.env.VITE_SUPABASE_ANON_KEY?.length);

// Test 2: Try to fetch workers manually
fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/workers`, {
  headers: {
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
  }
})
.then(r => r.json())
.then(data => console.log('Workers:', data))
.catch(err => console.error('Error:', err));
```

## Expected Output

When working correctly, you should see:
- URL: `https://rgsulxuitaktxwmcozya.supabase.co`
- Key length: ~250-300 characters
- Workers: Array with 6 worker objects

## Need More Help?

Share the error messages from:
1. Browser console (F12 → Console tab)
2. Network tab (any failing requests)
3. Supabase dashboard (any error notifications)
