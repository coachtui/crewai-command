# Full Diagnosis: Why User Creation Fails

## The Real Problem

Looking at your code in [src/lib/api/users.ts](src/lib/api/users.ts), the `inviteUser()` function tries to insert into `user_profiles` like this:

```typescript
const { data: userProfile, error: userError } = await supabase
  .from('user_profiles')
  .insert([{
    email: userData.email,
    name: userData.name,
    phone: userData.phone,
    base_role: userData.base_role,
    organization_id: userData.organization_id
  }])  // ❌ No 'id' field!
```

**The issue**: `user_profiles.id` is a foreign key to `auth.users(id)`. You can't create a profile without first creating the actual Supabase Auth user!

## There Are Actually TWO Problems

### Problem 1: App Design Issue
Your app tries to create user profiles without creating the actual auth user first.

### Problem 2: RLS Policies
Even if Problem 1 was fixed, the RLS policies might still be blocking you.

## Solutions

### Option A: Fix RLS Only (What You Asked For)

Run **[`REBUILD_RLS_PROPERLY.sql`](REBUILD_RLS_PROPERLY.sql)** to rebuild RLS from scratch with proper security.

This will:
- ✅ Fix RLS policies
- ✅ Make you an admin
- ✅ Ensure helper functions work

But your app will STILL fail because it's not creating auth users.

### Option B: Fix RLS + App (Complete Solution)

1. **First**: Run [`REBUILD_RLS_PROPERLY.sql`](REBUILD_RLS_PROPERLY.sql) to fix RLS
2. **Then**: Fix your app's `inviteUser()` function to create auth users first

The app fix requires one of these approaches:

#### Approach 1: Use Admin API (Requires Service Role Key)
```typescript
// Create auth user first
const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
  email: userData.email,
  email_confirm: true,
  user_metadata: {
    full_name: userData.name
  }
});

if (authError) throw authError;

// THEN create the profile with the auth user's ID
const { data: userProfile, error: userError } = await supabase
  .from('user_profiles')
  .insert([{
    id: authUser.user.id,  // ← Use the auth user's ID!
    email: userData.email,
    name: userData.name,
    phone: userData.phone,
    base_role: userData.base_role,
    organization_id: userData.organization_id
  }])
```

#### Approach 2: Use Email Invitations
```typescript
// Send invitation email (user creates account via email link)
const { data, error } = await supabase.auth.admin.inviteUserByEmail(
  userData.email,
  {
    data: {
      full_name: userData.name,
      phone: userData.phone,
      organization_id: userData.organization_id,
      base_role: userData.base_role
    }
  }
);
```

Then use a database trigger to auto-create the profile when the auth user signs up.

#### Approach 3: Auto-Create Profiles (Simplest)
Keep your current app code, but add a database trigger that automatically creates profiles when auth users are created. This is already in [`REBUILD_RLS_PROPERLY.sql`](REBUILD_RLS_PROPERLY.sql)!

## My Recommendation

### Step 1: Fix RLS Now
Run [`REBUILD_RLS_PROPERLY.sql`](REBUILD_RLS_PROPERLY.sql) to fix RLS properly with secure policies.

### Step 2: Diagnose the Exact Issue
Run [`DIAGNOSE_APP_vs_DB.sql`](DIAGNOSE_APP_vs_DB.sql) to see exactly what's wrong.

Share the output with me and I'll tell you:
- Is RLS the problem?
- Is the app logic the problem?
- Or both?

### Step 3: Fix App (If Needed)
Once RLS is fixed, if you still get errors, we'll know it's the app design and I can help fix the `inviteUser()` function.

## Quick Commands

### 1. Fix RLS (Do This First)
```bash
# Copy REBUILD_RLS_PROPERLY.sql
# Paste in Supabase SQL Editor
# Click Run
# Hard refresh browser (Cmd+Shift+R)
```

### 2. Diagnose Issue
```bash
# Copy DIAGNOSE_APP_vs_DB.sql
# Paste in Supabase SQL Editor
# Click Run
# Share output with me
```

## What Each Script Does

| Script | Purpose |
|--------|---------|
| [`REBUILD_RLS_PROPERLY.sql`](REBUILD_RLS_PROPERLY.sql) | ⭐ Rebuild RLS from scratch with proper security |
| [`DIAGNOSE_APP_vs_DB.sql`](DIAGNOSE_APP_vs_DB.sql) | 🔍 See exactly what's failing |
| [`CHECK_POLICIES.sql`](CHECK_POLICIES.sql) | 📋 Quick policy check |

## Next Steps

1. Run `REBUILD_RLS_PROPERLY.sql`
2. Hard refresh browser
3. Try creating a user
4. If still fails, run `DIAGNOSE_APP_vs_DB.sql` and share the output

This will tell us whether the problem is RLS (fixed by script) or app logic (needs code change).
