import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0'
import { createTransport } from 'npm:nodemailer@6.9.15';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const token = authHeader.replace('Bearer ', '')

    // Verify caller is authenticated
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify caller is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('base_role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.base_role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can resend invites' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { email } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'https://cruwork.app'

    // Generate a recovery link via the admin API — reliable, no rate limits,
    // no redirectTo allowlist dependency. SetPassword.tsx handles type=recovery.
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${siteUrl}/set-password`,
      },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('generateLink error:', linkError)
      return new Response(JSON.stringify({ error: linkError?.message ?? 'Failed to generate invite link' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const inviteLink = linkData.properties.action_link

    // Send via SMTP — same credentials used by notify-lead
    const smtpHost = Deno.env.get('SMTP_HOST')
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASSWORD')

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error('Missing SMTP env vars')
      return new Response(JSON.stringify({ error: 'Server misconfiguration: missing SMTP credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const transporter = createTransport({
      host: smtpHost,
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    })

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; margin: 0; padding: 0; background: #f9fafb; }
  .wrap { max-width: 480px; margin: 32px auto; background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
  .header { background: #14B8A6; padding: 24px 32px; }
  .header h1 { color: #fff; margin: 0; font-size: 18px; font-weight: 600; }
  .body { padding: 28px 32px; }
  .body p { font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 16px; }
  .btn { display: inline-block; margin: 8px 0 24px; padding: 12px 24px; background: #14B8A6; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; }
  .footer { padding: 16px 32px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; }
  .link { font-size: 12px; color: #9ca3af; word-break: break-all; }
</style></head>
<body>
<div class="wrap">
  <div class="header"><h1>Your Cru invite</h1></div>
  <div class="body">
    <p>You've been invited to join your team on <strong>Cru</strong> — construction crew management built for the field.</p>
    <p>Click the button below to set your password and get started:</p>
    <a href="${inviteLink}" class="btn">Set your password</a>
    <p>This link expires in 24 hours. If you didn't expect this email, you can ignore it.</p>
    <p class="link">${inviteLink}</p>
  </div>
  <div class="footer">Sent by Cru · cruwork.app</div>
</div>
</body></html>`

    const textBody = `You've been invited to join your team on Cru.\n\nSet your password here:\n${inviteLink}\n\nThis link expires in 24 hours.`

    await transporter.sendMail({
      from: `"Cru" <${smtpUser}>`,
      to: email,
      subject: 'Your Cru invite',
      text: textBody,
      html: htmlBody,
    })

    console.log(`Resent invite to ${email} by admin ${user.email}`)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('Error resending invite:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
