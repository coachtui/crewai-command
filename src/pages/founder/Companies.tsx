// ============================================================================
// CruWork: Founder Console — Companies List
// Shows ALL companies from Supabase with search, filter, pagination.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Building2, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { founderCompanies } from '../../lib/api/founder'
import type { FounderCompany } from '../../lib/api/founder'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type OnboardingStatus = 'PROSPECT' | 'ONBOARDING' | 'ACTIVE' | 'CHURNED'

function onboardingVariant(status: OnboardingStatus | null | undefined): 'default' | 'info' | 'success' | 'error' {
  if (!status) return 'default'
  const map: Record<OnboardingStatus, 'default' | 'info' | 'success' | 'error'> = {
    PROSPECT: 'default',
    ONBOARDING: 'info',
    ACTIVE: 'success',
    CHURNED: 'error',
  }
  return map[status]
}

const ONBOARDING_FILTERS = [
  { value: '', label: 'All' },
  { value: 'not_tracked', label: 'Not Tracked' },
  { value: 'PROSPECT', label: 'Prospect' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'CHURNED', label: 'Churned' },
]

const PAGE_SIZE = 20

// ─── Add Company Modal ────────────────────────────────────────────────────────

interface AddCompanyModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (company: FounderCompany) => void
}

function AddCompanyModal({ isOpen, onClose, onCreated }: AddCompanyModalProps) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const { company } = await founderCompanies.create({ name: name.trim(), address: address || undefined, phone: phone || undefined })
      toast.success(`Company "${company.name}" created`)
      onCreated(company as FounderCompany)
      setName('')
      setAddress('')
      setPhone('')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create company')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Company" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
            Company Name <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-[13px] bg-bg-primary border border-border rounded-md text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            placeholder="Acme Construction"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 text-[13px] bg-bg-primary border border-border rounded-md text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            placeholder="123 Main St, City, State"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Phone</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 text-[13px] bg-bg-primary border border-border rounded-md text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            placeholder="(555) 000-0000"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={loading || !name.trim()}>
            {loading ? 'Creating…' : 'Create Company'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Companies Page ───────────────────────────────────────────────────────────

export function FounderCompanies() {
  const [companies, setCompanies] = useState<FounderCompany[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [onboardingFilter, setOnboardingFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchCompanies = useCallback(async (p: number, s: string, ob: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await founderCompanies.list({
        page: p,
        pageSize: PAGE_SIZE,
        search: s || undefined,
        onboarding_status: ob || undefined,
      })
      setCompanies(res.data)
      setTotal(res.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCompanies(page, search, onboardingFilter)
  }, [page, search, onboardingFilter, fetchCompanies])

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 300)
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleCreated = (company: FounderCompany) => {
    // Prepend to list
    setCompanies((prev) => [{ ...company, onboarding: null, job_sites_count: 0, users_count: 0 }, ...prev])
    setTotal((t) => t + 1)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-text-primary">Companies</h1>
          <p className="text-[13px] text-text-secondary mt-1">
            {total > 0 ? `${total} total` : 'All tenants in Supabase'}
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} size="sm">
          <Plus size={14} className="mr-1.5" />
          Add Company
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name…"
            className="w-full pl-8 pr-8 py-2 text-[13px] bg-bg-secondary border border-border rounded-md text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
          {searchInput && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Onboarding filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {ONBOARDING_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setOnboardingFilter(f.value); setPage(1) }}
              className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition-all duration-150 ${
                onboardingFilter === f.value
                  ? 'bg-primary text-white'
                  : 'bg-bg-secondary border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-error-bg border border-error/20 rounded-lg p-4 text-error text-[13px]">
          {error}
          <button onClick={() => fetchCompanies(page, search, onboardingFilter)} className="ml-3 underline">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] px-4 py-2.5 border-b border-border bg-bg-subtle">
          {['Company', 'Users', 'Job Sites', 'Created', 'Onboarding'].map((h) => (
            <span key={h} className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <Building2 size={32} className="mb-3 opacity-30" />
            <p className="text-[13px]">
              {search || onboardingFilter ? 'No companies match your filters' : 'No companies yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {companies.map((company) => (
              <Link
                key={company.id}
                to={`/founder/companies/${company.id}`}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] px-4 py-3 hover:bg-bg-hover transition-colors items-center"
              >
                {/* Name */}
                <div>
                  <div className="text-[13px] font-medium text-text-primary">{company.name}</div>
                  <div className="text-[11px] text-text-secondary font-mono">{company.slug}</div>
                </div>

                {/* Users */}
                <div className="text-[13px] text-text-secondary">{company.users_count}</div>

                {/* Job Sites */}
                <div className="text-[13px] text-text-secondary">{company.job_sites_count}</div>

                {/* Created */}
                <div className="text-[12px] text-text-secondary">{formatDate(company.created_at)}</div>

                {/* Onboarding */}
                <div>
                  {company.onboarding ? (
                    <Badge variant={onboardingVariant(company.onboarding.status as OnboardingStatus)}>
                      {company.onboarding.status}
                    </Badge>
                  ) : (
                    <Badge variant="default">Not tracked</Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-secondary">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="text-[12px] text-text-secondary px-1">
              {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      <AddCompanyModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onCreated={handleCreated} />
    </div>
  )
}
