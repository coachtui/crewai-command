// ============================================================================
// notify-lead — Supabase Edge Function
// Sends an SMTP notification email when a new lead request is submitted.
// Credentials are injected via Supabase secrets (never hardcoded).
// ============================================================================

import { createTransport } from 'npm:nodemailer@6.9.15';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, email, company, job_sites, workers, notes } = await req.json();

    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASSWORD');
    const notifyTo  = Deno.env.get('NOTIFY_EMAIL') ?? 'cru@aigaai.com';

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error('Missing SMTP env vars');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transporter = createTransport({
      host: smtpHost,
      port: 465,
      secure: true, // implicit SSL
      auth: { user: smtpUser, pass: smtpPass },
    });

    const jobSitesLabel = job_sites ? String(job_sites) : '—';
    const workersLabel  = workers   ? String(workers)   : '—';
    const notesLabel    = notes     ? String(notes)      : '—';

    const textBody = [
      `New access request received on cruwork.app`,
      ``,
      `Name:       ${name}`,
      `Email:      ${email}`,
      `Company:    ${company}`,
      `Job sites:  ${jobSitesLabel}`,
      `Crew size:  ${workersLabel}`,
      `Notes:      ${notesLabel}`,
    ].join('\n');

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; margin: 0; padding: 0; background: #f9fafb; }
  .wrap { max-width: 520px; margin: 32px auto; background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
  .header { background: #14B8A6; padding: 24px 32px; }
  .header h1 { color: #fff; margin: 0; font-size: 18px; font-weight: 600; }
  .body { padding: 28px 32px; }
  .label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 2px; }
  .value { font-size: 15px; color: #111827; margin-bottom: 18px; }
  .notes { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; font-size: 14px; color: #374151; margin-bottom: 8px; }
  .footer { padding: 16px 32px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; }
</style></head>
<body>
<div class="wrap">
  <div class="header"><h1>New access request — Cru</h1></div>
  <div class="body">
    <div class="label">Name</div><div class="value">${name}</div>
    <div class="label">Email</div><div class="value"><a href="mailto:${email}" style="color:#14B8A6">${email}</a></div>
    <div class="label">Company</div><div class="value">${company}</div>
    <div class="label">Active job sites</div><div class="value">${jobSitesLabel}</div>
    <div class="label">Crew size</div><div class="value">${workersLabel}</div>
    <div class="label">Notes</div><div class="notes">${notesLabel}</div>
  </div>
  <div class="footer">Sent from cruwork.app · lead_requests table</div>
</div>
</body></html>`;

    await transporter.sendMail({
      from: `"Cru" <${smtpUser}>`,
      to: notifyTo,
      subject: `New access request: ${name} — ${company}`,
      text: textBody,
      html: htmlBody,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-lead error:', err);
    return new Response(JSON.stringify({ error: 'Failed to send notification' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
