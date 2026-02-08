# 403 Permission Error Fix

## What Happened

✅ **Good news**: The RLS policies are now working!
⚠️ **Issue**: The INSERT policy is blocking user creation

### Error You're Seeing
```
403 Forbidden
Error saving user: {code: '42501', message: 'new row violates row-level security policy for table "user_profiles"'}
```

## Quick Fix (Try in Order)

### ⚡ FASTEST: Temporary Workaround (Use this first!)

**File**: [`TEMP_ALLOW_ALL_INSERTS.sql`](TEMP_ALLOW_ALL_INSERTS.sql)

This temporarily allows all authenticated users to insert (⚠️ not production-safe, but unblocks you).

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy [`TEMP_ALLOW_ALL_INSERTS.sql`](TEMP_ALLOW_ALL_INSERTS.sql)
3. Click **Run**
4. **Refresh browser** and try creating a user
5. Should work immediately!

Then run the Emergency Fix below to add proper security back.

---

### 🔧 RECOMMENDED: Emergency Fix (Complete Solution)

**File**: [`EMERGENCY_FIX.sql`](EMERGENCY_FIX.sql)

This comprehensively fixes all RLS issues and shows diagnostic info.

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy [`EMERGENCY_FIX.sql`](EMERGENCY_FIX.sql)
3. Click **Run**
4. Read the output - it shows exactly what's happening
5. **Refresh browser** and try again

---

### 🛠️ Alternative: Simple RLS Fix

**File**: [`fix_rls_insert_simple.sql`](fix_rls_insert_simple.sql)

Similar to Emergency Fix but with different approach.

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy [`fix_rls_insert_simple.sql`](fix_rls_insert_simple.sql)
3. Click **Run**
4. **Refresh browser**

---

### 📧 Fallback: Grant Admin by Email

**File**: [`grant_admin_to_email.sql`](grant_admin_to_email.sql)

If none of the above work, manually set admin via email.

1. Open [`grant_admin_to_email.sql`](grant_admin_to_email.sql)
2. Replace `'your-email@example.com'` with your email (4 places)
3. Run in SQL Editor
4. **Log out and log back in**

## Why This Happened

The INSERT policy requires BOTH:
1. Helper functions (`get_user_org_id()`, `is_user_admin()`) - May not exist or return NULL
2. User to be an admin with `base_role = 'admin'`
3. Correct organization_id matching

One or more of these conditions is failing.

## After Fixing

Once you run the scripts:
1. ✅ Helper functions will be created/fixed
2. ✅ Your `base_role` will be set to `'admin'`
3. ✅ INSERT policies will be recreated correctly
4. ✅ You'll be able to create users without 403 errors

## My Recommendation

**Run these in order**:

1. **First**: [`TEMP_ALLOW_ALL_INSERTS.sql`](TEMP_ALLOW_ALL_INSERTS.sql) - Get unblocked immediately
2. **Then**: [`EMERGENCY_FIX.sql`](EMERGENCY_FIX.sql) - Add proper security back
3. **Refresh browser** after each step

This two-step approach ensures you can create users while maintaining security.

## Verification

After running the fix, verify in Supabase:
1. Go to **Table Editor** → **user_profiles**
2. Find your email
3. Check that `base_role` = `'admin'`
4. Try creating a user in your app - should work!

## Still Having Issues?

If you still get errors:

1. **Check browser console** - Copy the FULL error message
2. **Run this query in SQL Editor**:
   ```sql
   SELECT auth.uid(), get_user_org_id(), is_user_admin();
   ```
3. **Share the results** - This helps diagnose the issue
4. **Check if functions exist**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname IN ('get_user_org_id', 'is_user_admin');
   ```

## Related Files

- [`TEMP_ALLOW_ALL_INSERTS.sql`](TEMP_ALLOW_ALL_INSERTS.sql) - ⚡ Quick temporary fix
- [`EMERGENCY_FIX.sql`](EMERGENCY_FIX.sql) - 🔧 Complete fix with diagnostics
- [`fix_rls_insert_simple.sql`](fix_rls_insert_simple.sql) - 🛠️ Alternative approach
- [`grant_admin_to_email.sql`](grant_admin_to_email.sql) - 📧 Manual admin grant
- [`fix_user_creation.sql`](fix_user_creation.sql) - Original comprehensive fix
