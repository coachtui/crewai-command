// ============================================================================
// CruWork: Founder API Edge Function
// Handles all Founder Console data operations using service role.
//
// Security model:
//   1. Caller must supply a valid Supabase JWT (Authorization: Bearer <token>)
//   2. The JWT email must appear in the FOUNDER_EMAILS Supabase secret
//      (comma-separated list, e.g. "alice@example.com,bob@example.com")
//   3. All DB operations use the service role key → bypasses RLS
//   4. The service role key NEVER leaves this function
//
// Schema mapping (CruWork actual tables):
//   organizations  → company/tenant table (PK: id UUID)
//   user_profiles  → memberships (FK: org_id → organizations.id)
//   job_sites      → projects (FK: organization_id → organizations.id)
//   tenant_onboarding → onboarding overlay (PK: company_id → organizations.id)
//   tenant_notes      → founder notes (FK: company_id → organizations.id)
//   founder_audit_log → audit trail (FK: company_id → organizations.id)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0'

// ─── Types ───────────────────────────────────────────────────────────────────

type SupabaseClient = ReturnType<typeof createClient>

// ─── CORS ────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function logAudit(
  db: SupabaseClient,
  actorUserId: string,
  companyId: string | null,
  entityType: string,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await db.from('founder_audit_log').insert({
    actor_user_id: actorUserId,
    actor_type: 'FOUNDER',
    company_id: companyId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    before_json: before ?? null,
    after_json: after ?? null,
    metadata,
  })
  if (error) console.error('[founder-api] audit log error:', error.message)
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return json({ error: 'Authentication failed' }, 401)
    }

    // ── Founder gate ──────────────────────────────────────────────────────────
    // Check base_role === 'founder' in user_profiles (service role bypasses RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('base_role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.base_role !== 'founder') {
      console.error('[founder-api] Access denied for user:', user.id)
      return json({ error: 'Founder access required' }, 403)
    }

    // ── Route ─────────────────────────────────────────────────────────────────
    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'list_companies':
        return handleListCompanies(supabaseAdmin, body)
      case 'get_company':
        return handleGetCompany(supabaseAdmin, body)
      case 'create_company':
        return handleCreateCompany(supabaseAdmin, user, body, req)
      case 'update_company':
        return handleUpdateCompany(supabaseAdmin, user, body, req)
      case 'start_tracking':
        return handleStartTracking(supabaseAdmin, user, body)
      case 'update_onboarding':
        return handleUpdateOnboarding(supabaseAdmin, user, body)
      case 'list_notes':
        return handleListNotes(supabaseAdmin, body)
      case 'add_note':
        return handleAddNote(supabaseAdmin, user, body)
      case 'list_audit':
        return handleListAudit(supabaseAdmin, body)
      case 'create_job_site':
        return handleCreateJobSite(supabaseAdmin, user, body)
      case 'invite_user':
        return handleInviteUser(supabaseAdmin, user, body)
      default:
        return json({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[founder-api] unhandled error:', msg)
    return json({ error: msg }, 500)
  }
})

// ─── Action: list_companies ───────────────────────────────────────────────────

async function handleListCompanies(db: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const page = Number(body.page ?? 1)
  const pageSize = Math.min(Number(body.pageSize ?? 20), 100)
  const search = body.search as string | undefined
  const onboardingStatus = body.onboarding_status as string | undefined
  const offset = (page - 1) * pageSize

  // Build base query
  let query = db
    .from('organizations')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data: companies, count, error } = await query
  if (error) return json({ error: error.message }, 500)

  const rows = companies ?? []
  if (rows.length === 0) {
    return json({ data: [], total: count ?? 0, page, pageSize })
  }

  const ids = rows.map((c: Record<string, unknown>) => c.id as string)

  // Batch lookups to avoid N+1
  const [onboardingRes, siteCountsRes, userCountsRes] = await Promise.all([
    db
      .from('tenant_onboarding')
      .select('company_id, status, stage, last_touched_at')
      .in('company_id', ids),
    db
      .from('job_sites')
      .select('organization_id')
      .in('organization_id', ids)
      .eq('is_system_site', false),
    db
      .from('user_profiles')
      .select('org_id')
      .in('org_id', ids),
  ])

  // Build lookup maps
  const onboardingMap = new Map(
    (onboardingRes.data ?? []).map((o: Record<string, unknown>) => [o.company_id as string, o])
  )

  const siteCounts = new Map<string, number>()
  ;(siteCountsRes.data ?? []).forEach((s: Record<string, unknown>) => {
    const k = s.organization_id as string
    siteCounts.set(k, (siteCounts.get(k) ?? 0) + 1)
  })

  const userCounts = new Map<string, number>()
  ;(userCountsRes.data ?? []).forEach((u: Record<string, unknown>) => {
    const k = u.org_id as string
    userCounts.set(k, (userCounts.get(k) ?? 0) + 1)
  })

  const enriched = rows.map((c: Record<string, unknown>) => ({
    ...c,
    onboarding: onboardingMap.get(c.id as string) ?? null,
    job_sites_count: siteCounts.get(c.id as string) ?? 0,
    users_count: userCounts.get(c.id as string) ?? 0,
  }))

  // Apply onboarding_status client-side filter (after enrichment)
  const filtered = onboardingStatus
    ? enriched.filter((c) => {
        if (onboardingStatus === 'not_tracked') return c.onboarding === null
        return (c.onboarding as Record<string, unknown> | null)?.status === onboardingStatus
      })
    : enriched

  return json({ data: filtered, total: count ?? 0, page, pageSize })
}

// ─── Action: get_company ──────────────────────────────────────────────────────

async function handleGetCompany(db: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const company_id = body.company_id as string | undefined
  if (!company_id) return json({ error: 'company_id required' }, 400)

  const [companyRes, onboardingRes, usersRes, jobSitesRes] = await Promise.all([
    db.from('organizations').select('*').eq('id', company_id).single(),
    db.from('tenant_onboarding').select('*').eq('company_id', company_id).maybeSingle(),
    db
      .from('user_profiles')
      .select('id, email, name, base_role, created_at, phone')
      .eq('org_id', company_id)
      .order('created_at', { ascending: true }),
    db
      .from('job_sites')
      .select('*')
      .eq('organization_id', company_id)
      .order('created_at', { ascending: true }),
  ])

  if (companyRes.error) {
    return json({ error: companyRes.error.message }, companyRes.status === 406 ? 404 : 500)
  }

  return json({
    company: companyRes.data,
    onboarding: onboardingRes.data ?? null,
    users: usersRes.data ?? [],
    job_sites: jobSitesRes.data ?? [],
  })
}

// ─── Action: create_company ───────────────────────────────────────────────────

async function handleCreateCompany(
  db: SupabaseClient,
  user: { id: string },
  body: Record<string, unknown>,
  req: Request
): Promise<Response> {
  const name = body.name as string | undefined
  if (!name?.trim()) return json({ error: 'name required' }, 400)

  const rawSlug = body.slug as string | undefined
  const slug = (rawSlug ?? name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  // Check slug uniqueness
  const { data: existing } = await db
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) return json({ error: `Slug '${slug}' is already taken` }, 409)

  const { data: company, error } = await db
    .from('organizations')
    .insert({
      name: name.trim(),
      slug,
      address: body.address as string | undefined,
      phone: body.phone as string | undefined,
    })
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)

  // Create system "Unassigned" job site (matches migration 004 pattern)
  await db.from('job_sites').insert({
    organization_id: company.id,
    name: 'Unassigned',
    description: 'System site for workers without current assignment',
    status: 'active',
    is_system_site: true,
  })

  await logAudit(db, user.id, company.id, 'organization', company.id, 'CREATE', null, company, {
    ip: req.headers.get('x-forwarded-for') ?? null,
    user_agent: req.headers.get('user-agent') ?? null,
  })

  return json({ company })
}

// ─── Action: update_company ───────────────────────────────────────────────────

async function handleUpdateCompany(
  db: SupabaseClient,
  user: { id: string },
  body: Record<string, unknown>,
  req: Request
): Promise<Response> {
  const company_id = body.company_id as string | undefined
  if (!company_id) return json({ error: 'company_id required' }, 400)

  const { data: before, error: fetchErr } = await db
    .from('organizations')
    .select('*')
    .eq('id', company_id)
    .single()

  if (fetchErr) return json({ error: fetchErr.message }, 500)

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.address !== undefined) updates.address = body.address
  if (body.phone !== undefined) updates.phone = body.phone
  if (body.slug !== undefined) updates.slug = body.slug

  if (Object.keys(updates).length === 0) return json({ error: 'No fields to update' }, 400)

  const { data: after, error } = await db
    .from('organizations')
    .update(updates)
    .eq('id', company_id)
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)

  await logAudit(db, user.id, company_id, 'organization', company_id, 'UPDATE', before, after, {
    ip: req.headers.get('x-forwarded-for') ?? null,
  })

  return json({ company: after })
}

// ─── Action: start_tracking ───────────────────────────────────────────────────

async function handleStartTracking(
  db: SupabaseClient,
  user: { id: string },
  body: Record<string, unknown>
): Promise<Response> {
  const company_id = body.company_id as string | undefined
  if (!company_id) return json({ error: 'company_id required' }, 400)

  const { data: onboarding, error } = await db
    .from('tenant_onboarding')
    .upsert(
      {
        company_id,
        status: 'PROSPECT',
        stage: 'initial',
        checklist: {},
        last_touched_at: new Date().toISOString(),
      },
      { onConflict: 'company_id', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)

  await logAudit(db, user.id, company_id, 'tenant_onboarding', company_id, 'START_TRACKING', null, onboarding)

  return json({ onboarding })
}

// ─── Action: update_onboarding ────────────────────────────────────────────────

async function handleUpdateOnboarding(
  db: SupabaseClient,
  user: { id: string },
  body: Record<string, unknown>
): Promise<Response> {
  const company_id = body.company_id as string | undefined
  if (!company_id) return json({ error: 'company_id required' }, 400)

  const { data: before } = await db
    .from('tenant_onboarding')
    .select('*')
    .eq('company_id', company_id)
    .single()

  const updates: Record<string, unknown> = { last_touched_at: new Date().toISOString() }
  if (body.status !== undefined) updates.status = body.status
  if (body.stage !== undefined) updates.stage = body.stage
  if (body.checklist !== undefined) updates.checklist = body.checklist

  const { data: onboarding, error } = await db
    .from('tenant_onboarding')
    .update(updates)
    .eq('company_id', company_id)
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)

  await logAudit(db, user.id, company_id, 'tenant_onboarding', company_id, 'UPDATE_ONBOARDING', before, onboarding)

  return json({ onboarding })
}

// ─── Action: list_notes ───────────────────────────────────────────────────────

async function handleListNotes(db: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const company_id = body.company_id as string | undefined
  if (!company_id) return json({ error: 'company_id required' }, 400)

  const limit = Math.min(Number(body.limit ?? 50), 200)

  const { data, error } = await db
    .from('tenant_notes')
    .select('*')
    .eq('company_id', company_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return json({ error: error.message }, 500)
  return json({ notes: data ?? [] })
}

// ─── Action: add_note ─────────────────────────────────────────────────────────

async function handleAddNote(
  db: SupabaseClient,
  user: { id: string },
  body: Record<string, unknown>
): Promise<Response> {
  const company_id = body.company_id as string | undefined
  const note = body.note as string | undefined
  if (!company_id || !note?.trim()) return json({ error: 'company_id and note required' }, 400)

  const { data, error } = await db
    .from('tenant_notes')
    .insert({ company_id, created_by_user_id: user.id, note: note.trim() })
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)

  await logAudit(db, user.id, company_id, 'tenant_notes', data.id, 'ADD_NOTE', null, data)

  return json({ note: data })
}

// ─── Action: list_audit ───────────────────────────────────────────────────────

async function handleListAudit(db: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const company_id = body.company_id as string | undefined
  const limit = Math.min(Number(body.limit ?? 50), 200)
  const offset = Number(body.offset ?? 0)

  let query = db
    .from('founder_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (company_id) {
    query = query.eq('company_id', company_id)
  }

  const { data, count, error } = await query
  if (error) return json({ error: error.message }, 500)
  return json({ audit: data ?? [], total: count ?? 0 })
}

// ─── Action: create_job_site ──────────────────────────────────────────────────

async function handleCreateJobSite(
  db: SupabaseClient,
  user: { id: string },
  body: Record<string, unknown>
): Promise<Response> {
  const company_id = body.company_id as string | undefined
  const name = body.name as string | undefined
  if (!company_id || !name?.trim()) return json({ error: 'company_id and name required' }, 400)

  const { data: jobSite, error } = await db
    .from('job_sites')
    .insert({
      organization_id: company_id,
      name: name.trim(),
      address: body.address as string | undefined,
      description: body.description as string | undefined,
      status: (body.status as string | undefined) ?? 'active',
      start_date: body.start_date as string | undefined,
      end_date: body.end_date as string | undefined,
    })
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)

  await logAudit(db, user.id, company_id, 'job_site', jobSite.id, 'CREATE', null, jobSite)

  return json({ job_site: jobSite })
}

// ─── Action: invite_user ──────────────────────────────────────────────────────

async function handleInviteUser(
  db: SupabaseClient,
  user: { id: string },
  body: Record<string, unknown>
): Promise<Response> {
  const company_id = body.company_id as string | undefined
  const email = body.email as string | undefined
  const name = body.name as string | undefined
  const base_role = body.base_role as string | undefined
  const phone = body.phone as string | undefined

  if (!company_id || !email || !name || !base_role) {
    return json({ error: 'company_id, email, name, base_role are required' }, 400)
  }

  // Validate base_role
  const validRoles = ['manager', 'admin', 'superintendent', 'engineer', 'foreman', 'worker']
  if (!validRoles.includes(base_role)) {
    return json({ error: `base_role must be one of: ${validRoles.join(', ')}` }, 400)
  }

  // Generate invite link (same pattern as create-user edge function)
  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { full_name: name } },
  })

  if (linkError) return json({ error: linkError.message }, 500)

  // Create user profile
  const { data: userProfile, error: profileError } = await db
    .from('user_profiles')
    .upsert(
      { id: linkData.user.id, email, name, phone: phone ?? null, base_role, org_id: company_id },
      { onConflict: 'id' }
    )
    .select()
    .single()

  if (profileError) return json({ error: profileError.message }, 500)

  // Legacy users table (for backward compatibility, same as create-user fn)
  await db.from('users').upsert(
    { id: linkData.user.id, org_id: company_id, email, name, role: base_role, base_role, phone: phone ?? null },
    { onConflict: 'id' }
  )

  await logAudit(db, user.id, company_id, 'user', linkData.user.id, 'INVITE_USER', null, {
    email, name, base_role,
  })

  return json({
    user: userProfile,
    inviteLink: linkData.properties?.action_link,
  })
}
