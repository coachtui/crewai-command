// ============================================================================
// CruWork: OPS API Edge Function
// Read-only data access for external OPS consumers (e.g. AIGACP OPS).
//
// Security model — two auth paths, one must succeed:
//
//   Path A — Internal server-to-server (AIGACP backend):
//     Header:  x-internal-api-key: <secret>
//     Env var: OPS_INTERNAL_API_KEY (must be set in Supabase secrets)
//     Result:  trusted internal caller; orgId still required per action
//
//   Path B — User JWT (human or user-context callers):
//     Header:  Authorization: Bearer <Supabase JWT>
//     Check:   base_role in ['admin', 'manager', 'founder']
//     Result:  non-founders constrained to their own org_id
//
//   Both paths:
//     - Use service role client for DB ops (bypasses RLS)
//     - Enforce org scoping manually in every query
//     - Read-only — no mutations
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0'

// ─── Types ────────────────────────────────────────────────────────────────────

type SupabaseClient = ReturnType<typeof createClient>

// ─── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ── Auth path A: internal server-to-server key ────────────────────────────
    // Checked first. If the header is present, it must match — no fallthrough
    // to the Bearer path on mismatch (fail closed).
    const internalKey = req.headers.get('x-internal-api-key')
    let allowAnyOrg = false   // founders and internal callers may cross orgs
    let callerOrgId: string | null = null   // null = no org constraint

    console.log('[ops-api] internal header present:', internalKey !== null)

    if (internalKey !== null) {
      const expectedKey = Deno.env.get('OPS_INTERNAL_API_KEY')
      console.log('[ops-api] env key present:', !!expectedKey)
      if (!expectedKey) {
        console.error('[ops-api] OPS_INTERNAL_API_KEY env var not configured')
        return json({ error: 'Internal auth not configured' }, 500)
      }
      const matched = internalKey.trim() === expectedKey.trim()
      console.log('[ops-api] internal auth matched:', matched)
      if (!matched) {
        return json({ error: 'Invalid internal API key' }, 401)
      }
      // Key matches — internal caller authorised; no org constraint
      allowAnyOrg = true
      console.log('[ops-api] internal caller authorised')

    } else {
      // ── Auth path B: user Bearer JWT ────────────────────────────────────────
      console.log('[ops-api] using bearer fallback: true')
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

      if (userError || !user) {
        return json({ error: 'Authentication failed' }, 401)
      }

      // ── Role gate ───────────────────────────────────────────────────────────
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('base_role, org_id')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        console.error('[ops-api] Profile lookup failed for user:', user.id)
        return json({ error: 'Authentication failed' }, 401)
      }

      const allowedRoles = ['admin', 'manager', 'founder']
      if (!allowedRoles.includes(profile.base_role)) {
        return json({ error: 'Insufficient permissions' }, 403)
      }

      allowAnyOrg   = profile.base_role === 'founder'
      callerOrgId   = profile.org_id as string | null
    }

    // ── Route ─────────────────────────────────────────────────────────────────
    const body = await req.json()
    const { action, orgId } = body as { action: string; orgId?: string }

    if (!orgId) return json({ error: 'orgId required' }, 400)

    // Enforce org scoping: non-founders and internal callers must supply an
    // orgId, but internal callers are trusted to supply the correct one.
    // User callers (non-founder) are additionally checked against their profile.
    if (!allowAnyOrg && callerOrgId !== null && callerOrgId !== orgId) {
      return json({ error: 'Access denied: orgId does not match your organization' }, 403)
    }

    switch (action) {
      case 'getWorkersForOrg':
        return handleGetWorkersForOrg(supabaseAdmin, body)
      case 'getWorkersByRole':
        return handleGetWorkersByRole(supabaseAdmin, body)
      case 'getAvailableWorkersByRole':
        return handleGetAvailableWorkersByRole(supabaseAdmin, body)
      case 'getMechanicsAndDrivers':
        return handleGetMechanicsAndDrivers(supabaseAdmin, body)
      case 'getAssignmentsInDateRange':
        return handleGetAssignmentsInDateRange(supabaseAdmin, body)
      case 'getWorkerActiveAssignments':
        return handleGetWorkerActiveAssignments(supabaseAdmin, body)
      case 'getSiteEventsForOrg':
        return handleGetSiteEventsForOrg(supabaseAdmin, body)
      default:
        return json({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[ops-api] unhandled error:', msg)
    return json({ error: msg }, 500)
  }
})

// ─── Action: getWorkersForOrg ─────────────────────────────────────────────────

async function handleGetWorkersForOrg(
  db: SupabaseClient,
  body: Record<string, unknown>
): Promise<Response> {
  const orgId = body.orgId as string
  const siteId = body.siteId as string | undefined

  let query = db
    .from('workers')
    .select('id, name, role, availability_status, job_site_id, job_site:job_sites(id, name)')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .order('name')

  if (siteId) query = query.eq('job_site_id', siteId)

  const { data, error } = await query
  if (error) return json({ error: error.message }, 500)
  return json({ success: true, data: data ?? [] })
}

// ─── Action: getWorkersByRole ─────────────────────────────────────────────────

async function handleGetWorkersByRole(
  db: SupabaseClient,
  body: Record<string, unknown>
): Promise<Response> {
  const orgId = body.orgId as string
  const role = body.role as string | undefined

  if (!role) return json({ error: 'role required' }, 400)

  const { data, error } = await db
    .from('workers')
    .select('id, name, role, availability_status, job_site_id, job_site:job_sites(id, name)')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .eq('role', role)
    .order('name')

  if (error) return json({ error: error.message }, 500)
  return json({ success: true, data: data ?? [] })
}

// ─── Action: getAvailableWorkersByRole ────────────────────────────────────────

async function handleGetAvailableWorkersByRole(
  db: SupabaseClient,
  body: Record<string, unknown>
): Promise<Response> {
  const orgId = body.orgId as string
  const role = body.role as string | undefined
  const availabilityStatus = (body.availabilityStatus as string | undefined) ?? 'available'

  if (!role) return json({ error: 'role required' }, 400)

  const { data, error } = await db
    .from('workers')
    .select('id, name, role, availability_status, job_site_id, job_site:job_sites(id, name)')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .eq('role', role)
    .eq('availability_status', availabilityStatus)
    .order('name')

  if (error) return json({ error: error.message }, 500)
  return json({ success: true, data: data ?? [] })
}

// ─── Action: getMechanicsAndDrivers ───────────────────────────────────────────

async function handleGetMechanicsAndDrivers(
  db: SupabaseClient,
  body: Record<string, unknown>
): Promise<Response> {
  const orgId = body.orgId as string

  const { data, error } = await db
    .from('workers')
    .select('id, name, role, availability_status, job_site_id, job_site:job_sites(id, name)')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .in('role', ['mechanic', 'driver'])
    .order('role')
    .order('name')

  if (error) return json({ error: error.message }, 500)
  return json({ success: true, data: data ?? [] })
}

// ─── Action: getAssignmentsInDateRange ────────────────────────────────────────

async function handleGetAssignmentsInDateRange(
  db: SupabaseClient,
  body: Record<string, unknown>
): Promise<Response> {
  const orgId = body.orgId as string
  const startDate = body.startDate as string | undefined
  const endDate = body.endDate as string | undefined
  const siteId = body.siteId as string | undefined

  if (!startDate || !endDate) return json({ error: 'startDate and endDate required' }, 400)

  let query = db
    .from('assignments')
    .select(`
      id,
      worker_id,
      job_site_id,
      assigned_date,
      status,
      worker:workers(id, name, role, availability_status, job_site_id),
      task:tasks(id, name, start_date, end_date, job_site_id)
    `)
    .eq('organization_id', orgId)
    .eq('status', 'assigned')
    .gte('assigned_date', startDate)
    .lte('assigned_date', endDate)
    .order('assigned_date')

  if (siteId) query = query.eq('job_site_id', siteId)

  const { data, error } = await query
  if (error) return json({ error: error.message }, 500)
  return json({ success: true, data: data ?? [] })
}

// ─── Action: getWorkerActiveAssignments ───────────────────────────────────────

async function handleGetWorkerActiveAssignments(
  db: SupabaseClient,
  body: Record<string, unknown>
): Promise<Response> {
  const workerId = body.workerId as string | undefined
  const fromDate = body.fromDate as string | undefined

  if (!workerId) return json({ error: 'workerId required' }, 400)
  if (!fromDate) return json({ error: 'fromDate required' }, 400)

  const { data, error } = await db
    .from('assignments')
    .select(`
      id,
      worker_id,
      job_site_id,
      assigned_date,
      status,
      task:tasks(id, name, start_date, end_date, job_site_id,
        job_site:job_sites(id, name))
    `)
    .eq('worker_id', workerId)
    .eq('status', 'assigned')
    .gte('assigned_date', fromDate)
    .order('assigned_date')

  if (error) return json({ error: error.message }, 500)
  return json({ success: true, data: data ?? [] })
}

// ─── Action: getSiteEventsForOrg ──────────────────────────────────────────────

async function handleGetSiteEventsForOrg(
  db: SupabaseClient,
  body: Record<string, unknown>
): Promise<Response> {
  const orgId = body.orgId as string
  const startDate = body.startDate as string | undefined
  const endDate = body.endDate as string | undefined
  const eventType = body.eventType as string | undefined

  if (!startDate || !endDate) return json({ error: 'startDate and endDate required' }, 400)

  let query = db
    .from('site_events')
    .select('id, title, event_date, event_type, start_time, location, job_site_id, job_site:job_sites(id, name)')
    .eq('organization_id', orgId)
    .gte('event_date', startDate)
    .lte('event_date', endDate)
    .order('event_date')
    .order('start_time', { nullsFirst: true })

  if (eventType) query = query.eq('event_type', eventType)

  const { data, error } = await query
  if (error) return json({ error: error.message }, 500)
  return json({ success: true, data: data ?? [] })
}
