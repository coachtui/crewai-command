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

    // Create user profile (using upsert in case trigger already created it)
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: authData.user.id,
        email,
        name,
        phone,
        base_role,
        organization_id
      }, {
        onConflict: 'id'
      })
      .select()
      .single()

    if (profileError) throw profileError

    // Also create in legacy users table for backward compatibility
    await supabaseAdmin
      .from('users')
      .upsert({
        id: authData.user.id,
        org_id: organization_id,
        email,
        name,
        role: base_role,
        base_role,
        phone
      }, {
        onConflict: 'id'
      })

    return new Response(JSON.stringify({ success: true, user: userProfile }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error creating user:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
