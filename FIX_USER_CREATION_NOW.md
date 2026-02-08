# Fix User Creation - Action Plan

## Current Error

```
403 Forbidden
Error saving user: new row violates row-level security policy for table "user_profiles"
```

## Quick Fix (2 Steps)

### Step 1: Unblock Yourself (30 seconds)

Run **[`TEMP_ALLOW_ALL_INSERTS.sql`](TEMP_ALLOW_ALL_INSERTS.sql)** to temporarily allow user creation:

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `TEMP_ALLOW_ALL_INSERTS.sql`
3. Click **Run**
4. **Refresh your browser**
5. Try creating a user - should work now!

⚠️ **Note**: This is a temporary fix with reduced security. Move to Step 2 ASAP.

---

### Step 2: Add Proper Security Back (1 minute)

Run **[`EMERGENCY_FIX.sql`](EMERGENCY_FIX.sql)** to restore proper RLS security:

1. In Supabase SQL Editor (same place)
2. Copy and paste the contents of `EMERGENCY_FIX.sql`
3. Click **Run**
4. Read the output - it shows diagnostic info
5. **Refresh your browser again**
6. User creation should still work, now with proper security!

---

## What These Scripts Do

### TEMP_ALLOW_ALL_INSERTS.sql
- Temporarily allows any authenticated user to insert into `user_profiles`
- Makes you an admin
- Gets you unblocked immediately
- ⚠️ Not production-safe (but fine for now)

### EMERGENCY_FIX.sql
- Creates/fixes helper functions (`get_user_org_id`, `is_user_admin`)
- Removes conflicting policies
- Creates proper INSERT policy (only admins in same org can create users)
- Verifies everything is working
- Shows diagnostic output

---

## Alternative: One-Step Fix

If you want to skip the temporary fix and do it all at once, just run:

**[`EMERGENCY_FIX.sql`](EMERGENCY_FIX.sql)** directly

This should fix everything in one go, but if it doesn't work, fall back to the 2-step approach above.

---

## What Happens After Fix

✅ You can create users in your app
✅ You can view users in Supabase dashboard
✅ Only admins in your org can create users (secure)
✅ Your account is marked as admin
✅ All RLS policies work correctly

---

## Need Help?

If still broken after both steps:

1. **Check browser console** - Copy the full error
2. **Run this diagnostic query**:
   ```sql
   SELECT
     auth.uid() as my_user_id,
     get_user_org_id() as my_org,
     is_user_admin() as am_i_admin;
   ```
3. **Share results** with me

---

## Files Reference

| File | Purpose | When to Use |
|------|---------|-------------|
| [`TEMP_ALLOW_ALL_INSERTS.sql`](TEMP_ALLOW_ALL_INSERTS.sql) | Quick unblock | Use FIRST if in a hurry |
| [`EMERGENCY_FIX.sql`](EMERGENCY_FIX.sql) | Complete fix | Use SECOND or use alone |
| [`fix_rls_insert_simple.sql`](fix_rls_insert_simple.sql) | Alternative fix | If EMERGENCY_FIX fails |
| [`grant_admin_to_email.sql`](grant_admin_to_email.sql) | Manual admin grant | Last resort |
| [`USER_403_FIX.md`](USER_403_FIX.md) | Detailed explanation | Reference guide |

---

**Start with Step 1 above and you'll be unblocked in under a minute!** 🚀
