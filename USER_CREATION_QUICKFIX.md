# Quick Fix for User Creation Issue

## The Problem

Your app is trying to INSERT into `user_profiles` without an `id`, but `user_profiles.id` must reference an auth user's ID. Creating auth users from the frontend isn't possible without exposing sensitive keys.

## ✅ IMMEDIATE FIX (2 steps)

### Step 1: Install the Auto-Create Trigger

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Copy and paste from fix_user_creation.sql
```

Or just run the entire [`fix_user_creation.sql`](fix_user_creation.sql) file.

This creates a trigger that automatically creates `user_profiles` when auth users are created.

### Step 2: Create a Supabase Edge Function

Create a new Edge Function to handle user creation with the admin API:

```bash
# In your terminal
supabase functions new create-user
```

Then add this code to `supabase/functions/create-user/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')!

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Create regular client to check if caller is admin
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } }
      }
    )

    // Verify caller is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('base_role')
      .eq('id', user.id)
      .single()

    if (profile?.base_role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can create users' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get request body
    const { email, name, phone, base_role, organization_id } = await req.json()

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: name
      }
    })

    if (authError) throw authError

    // Create user profile (trigger will also create one, but we do it explicitly for control)
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: authData.user.id,
        email,
        name,
        phone,
        base_role,
        organization_id
      })
      .select()
      .single()

    if (profileError) throw profileError

    return new Response(JSON.stringify({ success: true, user: userProfile }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

### Step 3: Update Frontend Code

Update the `inviteUser` function to call the edge function:

```typescript
export async function inviteUser(userData: InviteUserData): Promise<UserProfile> {
  // Call the edge function
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: {
      email: userData.email,
      name: userData.name,
      phone: userData.phone,
      base_role: userData.base_role,
      organization_id: userData.organization_id
    }
  })

  if (error) throw error
  if (!data.success) throw new Error(data.error || 'Failed to create user')

  const userProfile = data.user as UserProfile

  // Create job site assignments if provided
  if (userData.job_site_assignments && userData.job_site_assignments.length > 0) {
    const assignments = userData.job_site_assignments.map(assignment => ({
      user_id: userProfile.id,
      job_site_id: assignment.job_site_id,
      role: assignment.role,
      start_date: assignment.start_date || new Date().toISOString().split('T')[0],
      is_active: true,
      assigned_by: userProfile.id
    }))

    const { error: assignmentError } = await supabase
      .from('job_site_assignments')
      .insert(assignments)

    if (assignmentError) throw assignmentError
  }

  // Fetch complete profile with assignments
  const { data: completeProfile, error: fetchError } = await supabase
    .from('user_profiles')
    .select(`
      *,
      job_site_assignments:job_site_assignments(
        id,
        job_site_id,
        role,
        is_active,
        start_date,
        end_date,
        job_site:job_sites(id, name)
      )
    `)
    .eq('id', userProfile.id)
    .single()

  if (fetchError) throw fetchError
  return completeProfile
}
```

## 🎯 Deploy

```bash
supabase functions deploy create-user
```

## Alternative: Manual User Creation (Temporary)

If you don't want to set up edge functions right now:

1. Create auth users manually in Supabase Dashboard → Authentication → Users → "Invite User"
2. The trigger will auto-create user_profiles
3. Then use your app to assign roles/job sites

---

## What We Fixed

✅ RLS policies (403 → fixed with FIX_ALL_USER_ISSUES.sql)
✅ Identified the root cause (trying to create profiles without auth users)
⚠️ **Need to implement**: Edge function or manual user creation workflow
