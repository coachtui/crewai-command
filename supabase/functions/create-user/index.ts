import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      console.error('Missing Authorization header')
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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

    // Extract the JWT token from the Authorization header
    const token = authHeader.replace('Bearer ', '')

    // Verify the user using the service role client (more reliable)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError) {
      console.error('Auth error:', userError)
      return new Response(JSON.stringify({ error: 'Authentication failed: ' + userError.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!user) {
      console.error('No user found in token')
      return new Response(JSON.stringify({ error: 'Unauthorized - no user found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Authenticated user:', user.id, user.email)

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('base_role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile lookup error:', profileError)
      return new Response(JSON.stringify({ error: 'Could not fetch user profile: ' + profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!profile || profile.base_role !== 'admin') {
      console.error('User is not admin:', user.email, profile?.base_role)
      return new Response(JSON.stringify({ error: 'Only admins can create users. Your role: ' + (profile?.base_role || 'none') }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Admin verified:', user.email)

    // Get request body
    const { email, name, phone, base_role, organization_id } = await req.json()

    // Invite user by email (sends invitation email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: name
      }
    })

    if (authError) throw authError

    // Create user profile (using upsert in case trigger already created it)
    const { data: userProfile, error: upsertError } = await supabaseAdmin
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

    if (upsertError) throw upsertError

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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('Error creating user:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
