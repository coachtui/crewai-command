# Action Plan: Fix User Creation Issues

## Summary

You have **two separate issues**:
1. ❌ RLS policies blocking user operations
2. ❌ App trying to create profiles without creating auth users first

## 🎯 STEP 1: Fix RLS (Do This Now)

### Run This Script
**File**: [`REBUILD_RLS_PROPERLY.sql`](REBUILD_RLS_PROPERLY.sql)

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy the entire script
3. Click **Run**
4. Read the output - it will tell you if everything worked

### What This Does
- ✅ Rebuilds all RLS policies from scratch (secure, not permissive)
- ✅ Makes you an admin
- ✅ Creates helper functions
- ✅ Adds auto-create trigger (profiles auto-created when auth users are created)
- ✅ Tests everything

### After Running
**Hard refresh your browser**: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)

---

## 🔍 STEP 2: Test and Diagnose

### Test A: Create User in Supabase Dashboard

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Click **Add user**
3. Enter email and temporary password
4. Click **Create user**
5. Check **Table Editor** → **user_profiles** - should auto-create profile ✅

**If this works**: RLS is fixed! The trigger auto-creates profiles.

**If this fails**: Run [`DIAGNOSE_APP_vs_DB.sql`](DIAGNOSE_APP_vs_DB.sql) and share output.

### Test B: Create User in Your App

1. Try creating a user via your app's user management interface
2. Check browser console for errors

**Expected**: This will likely STILL fail because of the app design issue (see below).

---

## 🛠️ STEP 3: Fix App (If Needed)

### The App Issue

Your [src/lib/api/users.ts](src/lib/api/users.ts) `inviteUser()` function tries to insert into `user_profiles` without:
1. First creating the Supabase Auth user
2. Providing an `id` field

The insert at line 62-68 looks like:
```typescript
.insert([{
  email: userData.email,
  name: userData.name,
  // ... other fields
  // ❌ Missing: id field!
}])
```

But `user_profiles.id` is a foreign key to `auth.users(id)`, so you need an existing auth user first.

### Fix Options

#### Option A: Create Auth User First (Recommended)

Update `inviteUser()` to create the auth user first:

```typescript
export async function inviteUser(userData: InviteUserData): Promise<UserProfile> {
  // Step 1: Create auth user (requires service_role key on backend)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: userData.email,
    email_confirm: true, // Or false if you want to send confirmation email
    user_metadata: {
      full_name: userData.name,
      phone: userData.phone
    }
  });

  if (authError) throw authError;

  // Step 2: Update the auto-created profile with role and assignments
  const { data: userProfile, error: profileError } = await supabase
    .from('user_profiles')
    .update({
      base_role: userData.base_role,
      phone: userData.phone,
      name: userData.name
    })
    .eq('id', authData.user.id)
    .select()
    .single();

  if (profileError) throw profileError;

  // Step 3: Create job site assignments (same as before)
  if (userData.job_site_assignments && userData.job_site_assignments.length > 0) {
    const assignments = userData.job_site_assignments.map(assignment => ({
      user_id: authData.user.id,
      job_site_id: assignment.job_site_id,
      role: assignment.role,
      start_date: assignment.start_date || new Date().toISOString().split('T')[0],
      is_active: true,
      assigned_by: authData.user.id
    }));

    const { error: assignmentError } = await supabase
      .from('job_site_assignments')
      .insert(assignments);

    if (assignmentError) throw assignmentError;
  }

  return userProfile;
}
```

**Note**: `supabase.auth.admin.createUser()` requires your service_role key. This should only be called from backend/server code, not directly from the browser for security reasons.

#### Option B: Use Email Invitations

Use Supabase's built-in invitation system:

```typescript
export async function inviteUser(userData: InviteUserData): Promise<void> {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(
    userData.email,
    {
      data: {
        full_name: userData.name,
        phone: userData.phone,
        organization_id: userData.organization_id,
        base_role: userData.base_role
      },
      redirectTo: `${window.location.origin}/accept-invite`
    }
  );

  if (error) throw error;

  // The user will receive an email and create their account
  // The trigger will auto-create their profile
  // Then you can assign job sites separately
}
```

#### Option C: Keep Current Code (Workaround)

If you can't change the app code right now, users can:
1. Create users in Supabase Dashboard (Authentication → Add user)
2. The trigger will auto-create their profile
3. Then use the app to assign roles/job sites (UPDATE operations)

---

## 📊 What Should Work After Step 1

After running `REBUILD_RLS_PROPERLY.sql` and refreshing your browser:

| Action | Will Work? | Why |
|--------|-----------|-----|
| View users in app | ✅ YES | RLS SELECT policy allows |
| Update users in app | ✅ YES | RLS UPDATE policy allows |
| Delete users in app (as admin) | ✅ YES | RLS DELETE policy allows |
| Create users in Supabase Dashboard | ✅ YES | Trigger auto-creates profile |
| Create users via app's `inviteUser()` | ❌ NO | App design issue (no auth user creation) |

---

## 🆘 Still Having Issues?

### If Step 1 Fails
Run [`DIAGNOSE_APP_vs_DB.sql`](DIAGNOSE_APP_vs_DB.sql) and share the output.

### If You See This Error After Step 1
```
Error: new row violates row-level security policy
```

This means:
1. Either you didn't refresh browser (cache issue)
2. Or one of the helper functions is returning NULL/FALSE

Run this query and share result:
```sql
SELECT get_user_org_id(), is_user_admin();
```

---

## Summary: What To Do

1. ✅ Run [`REBUILD_RLS_PROPERLY.sql`](REBUILD_RLS_PROPERLY.sql) **now**
2. ✅ Hard refresh browser
3. ✅ Test creating user in Supabase Dashboard
4. ✅ If app still fails, choose a fix option from Step 3

**Start with Step 1 - that fixes the RLS issues you asked about!** 🚀
