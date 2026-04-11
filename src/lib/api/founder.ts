// ============================================================================
// CruWork: Founder Console — Client API Layer
// All requests go to the founder-api Edge Function which uses service role.
// NEVER put SUPABASE_SERVICE_ROLE_KEY in client code.
// ============================================================================

import { supabase } from '../supabase'

const FOUNDER_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/founder-api`

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FounderCompany {
  id: string
  name: string
  slug: string
  address?: string
  phone?: string
  created_at: string
  updated_at?: string
  // Enriched by edge function
  onboarding: FounderOnboarding | null
  job_sites_count: number
  users_count: number
}

export interface FounderOnboarding {
  company_id: string
  status: 'PROSPECT' | 'ONBOARDING' | 'ACTIVE' | 'CHURNED'
  stage?: string
  checklist: Record<string, boolean>
  last_touched_at: string
  created_at: string
  updated_at: string
}

export interface FounderNote {
  id: string
  company_id: string
  created_by_user_id: string
  note: string
  created_at: string
}

export interface FounderAuditEntry {
  id: string
  actor_user_id: string
  actor_type: string
  company_id?: string
  entity_type: string
  entity_id: string
  action: string
  before_json?: unknown
  after_json?: unknown
  metadata?: Record<string, unknown>
  created_at: string
}

export interface FounderUserProfile {
  id: string
  email: string
  name: string
  base_role: string
  phone?: string
  created_at: string
}

export interface FounderJobSite {
  id: string
  organization_id: string
  name: string
  address?: string
  description?: string
  status: string
  start_date?: string
  end_date?: string
  is_system_site?: boolean
  created_at: string
}

export interface CompanyDetail {
  company: FounderCompany
  onboarding: FounderOnboarding | null
  users: FounderUserProfile[]
  job_sites: FounderJobSite[]
}

export interface ListCompaniesResult {
  data: FounderCompany[]
  total: number
  page: number
  pageSize: number
}

// ─── Request helper ───────────────────────────────────────────────────────────

async function founderRequest<T = unknown>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch(FOUNDER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      // apikey header required by Supabase gateway
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, ...params }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}

// ─── Companies ────────────────────────────────────────────────────────────────

export const founderCompanies = {
  list(params: {
    page?: number
    pageSize?: number
    search?: string
    onboarding_status?: string
  } = {}): Promise<ListCompaniesResult> {
    return founderRequest('list_companies', params)
  },

  get(company_id: string): Promise<CompanyDetail> {
    return founderRequest('get_company', { company_id })
  },

  create(data: {
    name: string
    slug?: string
    address?: string
    phone?: string
  }): Promise<{ company: FounderCompany }> {
    return founderRequest('create_company', data)
  },

  update(
    company_id: string,
    data: { name?: string; address?: string; phone?: string; slug?: string }
  ): Promise<{ company: FounderCompany }> {
    return founderRequest('update_company', { company_id, ...data })
  },
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export const founderOnboarding = {
  startTracking(company_id: string): Promise<{ onboarding: FounderOnboarding }> {
    return founderRequest('start_tracking', { company_id })
  },

  update(
    company_id: string,
    patch: {
      status?: 'PROSPECT' | 'ONBOARDING' | 'ACTIVE' | 'CHURNED'
      stage?: string
      checklist?: Record<string, boolean>
    }
  ): Promise<{ onboarding: FounderOnboarding }> {
    return founderRequest('update_onboarding', { company_id, ...patch })
  },
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export const founderNotes = {
  list(company_id: string, limit?: number): Promise<{ notes: FounderNote[] }> {
    return founderRequest('list_notes', { company_id, limit })
  },

  add(company_id: string, note: string): Promise<{ note: FounderNote }> {
    return founderRequest('add_note', { company_id, note })
  },
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export const founderAudit = {
  list(
    company_id?: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ audit: FounderAuditEntry[]; total: number }> {
    return founderRequest('list_audit', { company_id, ...options })
  },
}

// ─── Job Sites ────────────────────────────────────────────────────────────────

export const founderJobSites = {
  create(
    company_id: string,
    data: {
      name: string
      address?: string
      description?: string
      status?: string
      start_date?: string
      end_date?: string
    }
  ): Promise<{ job_site: FounderJobSite }> {
    return founderRequest('create_job_site', { company_id, ...data })
  },
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const founderUsers = {
  invite(
    company_id: string,
    data: {
      email: string
      name: string
      base_role: 'admin' | 'superintendent' | 'engineer' | 'foreman' | 'worker'
      phone?: string
    }
  ): Promise<{ user: FounderUserProfile; inviteLink: string }> {
    return founderRequest('invite_user', { company_id, ...data })
  },
}

