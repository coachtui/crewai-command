// ============================================================================
// CruWork: Founder Console — Company Detail
// Tabs: Overview | Onboarding | Users | Job Sites | Notes | Audit
// ============================================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Users, FolderOpen, Activity, StickyNote,
  ClipboardList, Plus, Check, RefreshCcw
} from 'lucide-react'
import { toast } from 'sonner'
import {
  founderCompanies,
  founderOnboarding,
  founderNotes,
  founderAudit,
  founderJobSites,
  founderUsers,
} from '../../lib/api/founder'
import type {
  FounderCompany,
  FounderOnboarding,
  FounderNote,
  FounderAuditEntry,
  FounderUserProfile,
  FounderJobSite,
} from '../../lib/api/founder'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtFull(d: string) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type OBStatus = 'PROSPECT' | 'ONBOARDING' | 'ACTIVE' | 'CHURNED'

function obBadge(status: OBStatus | string) {
  const map: Record<string, 'default' | 'info' | 'success' | 'error'> = {
    PROSPECT: 'default',
    ONBOARDING: 'info',
    ACTIVE: 'success',
    CHURNED: 'error',
  }
  return <Badge variant={map[status] ?? 'default'}>{status}</Badge>
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'onboarding', label: 'Onboarding', icon: ClipboardList },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'job-sites', label: 'Job Sites', icon: FolderOpen },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'audit', label: 'Audit', icon: Activity },
] as const

type TabId = typeof TABS[number]['id']

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ company, onboarding, users, jobSites, onStartTracking, startingTracking }: {
  company: FounderCompany
  onboarding: FounderOnboarding | null
  users: FounderUserProfile[]
  jobSites: FounderJobSite[]
  onStartTracking: () => void
  startingTracking: boolean
}) {
  const realSites = jobSites.filter((s) => !s.is_system_site)

  return (
    <div className="space-y-6">
      {/* Company record */}
      <div className="bg-bg-secondary border border-border rounded-lg divide-y divide-border">
        {[
          ['Name', company.name],
          ['Slug', company.slug],
          ['Address', company.address || '—'],
          ['Phone', company.phone || '—'],
          ['Created', fmt(company.created_at)],
          ['Last Updated', company.updated_at ? fmt(company.updated_at) : '—'],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center px-5 py-3">
            <span className="w-32 text-[12px] font-medium text-text-secondary shrink-0">{k}</span>
            <span className="text-[13px] text-text-primary font-mono">{v}</span>
          </div>
        ))}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Users', value: users.length },
          { label: 'Job Sites', value: realSites.length },
          { label: 'Onboarding', value: onboarding?.status ?? 'Not tracked' },
        ].map((s) => (
          <div key={s.label} className="bg-bg-secondary border border-border rounded-lg px-4 py-3">
            <div className="text-[11px] text-text-secondary mb-1">{s.label}</div>
            <div className="text-[18px] font-bold text-text-primary">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Onboarding CTA if not tracked */}
      {!onboarding && (
        <div className="bg-warning/5 border border-warning/20 rounded-lg p-5 flex items-center justify-between">
          <div>
            <div className="text-[13px] font-semibold text-text-primary">Not tracked in onboarding</div>
            <div className="text-[12px] text-text-secondary mt-0.5">
              Start tracking to manage this company's onboarding state.
            </div>
          </div>
          <Button size="sm" onClick={onStartTracking} disabled={startingTracking}>
            {startingTracking ? 'Starting…' : 'Start Tracking'}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Onboarding Tab ──────────────────────────────────────────────────────────

const DEFAULT_CHECKLIST: Record<string, string> = {
  kickoff_call: 'Kickoff call completed',
  account_setup: 'Account setup done',
  first_admin_invited: 'First admin user invited',
  first_job_site_created: 'First job site created',
  first_task_created: 'First task created',
  first_worker_added: 'First worker added',
  training_completed: 'Training completed',
  went_live: 'Went live',
}

function OnboardingTab({ onboarding, companyId, onUpdated }: {
  onboarding: FounderOnboarding | null
  companyId: string
  onUpdated: (ob: FounderOnboarding) => void
}) {
  const [saving, setSaving] = useState(false)
  const [localStatus, setLocalStatus] = useState<OBStatus | ''>(
    (onboarding?.status as OBStatus) ?? ''
  )
  const [localStage, setLocalStage] = useState(onboarding?.stage ?? '')
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    onboarding?.checklist ?? {}
  )

  // Sync if onboarding prop changes (e.g. after start_tracking)
  useEffect(() => {
    setLocalStatus((onboarding?.status as OBStatus) ?? '')
    setLocalStage(onboarding?.stage ?? '')
    setChecklist(onboarding?.checklist ?? {})
  }, [onboarding])

  const save = async () => {
    if (!onboarding) return
    setSaving(true)
    try {
      const { onboarding: updated } = await founderOnboarding.update(companyId, {
        status: localStatus as OBStatus || undefined,
        stage: localStage || undefined,
        checklist,
      })
      onUpdated(updated)
      toast.success('Onboarding updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!onboarding) {
    return (
      <div className="text-center py-12 text-text-secondary text-[13px]">
        Not tracked yet. Click "Start Tracking" on the Overview tab.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status + Stage */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Status</label>
          <select
            value={localStatus}
            onChange={(e) => setLocalStatus(e.target.value as OBStatus)}
            className="w-full px-3 py-2 text-[13px] bg-bg-primary border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {(['PROSPECT', 'ONBOARDING', 'ACTIVE', 'CHURNED'] as OBStatus[]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Stage</label>
          <input
            type="text"
            value={localStage}
            onChange={(e) => setLocalStage(e.target.value)}
            placeholder="e.g. initial, configuration, go-live"
            className="w-full px-3 py-2 text-[13px] bg-bg-primary border border-border rounded-md text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Checklist */}
      <div>
        <div className="text-[12px] font-medium text-text-secondary mb-2">Checklist</div>
        <div className="bg-bg-secondary border border-border rounded-lg divide-y divide-border">
          {Object.entries(DEFAULT_CHECKLIST).map(([key, label]) => {
            const checked = checklist[key] ?? false
            return (
              <button
                key={key}
                onClick={() => setChecklist((prev) => ({ ...prev, [key]: !checked }))}
                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-bg-hover transition-colors text-left"
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                    checked
                      ? 'bg-success border-success'
                      : 'border-border bg-bg-primary'
                  }`}
                >
                  {checked && <Check size={10} className="text-white" />}
                </div>
                <span className={`text-[13px] ${checked ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Meta */}
      <div className="text-[11px] text-text-secondary">
        Last touched: {fmtFull(onboarding.last_touched_at)}
        {' · '}
        Created: {fmt(onboarding.created_at)}
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

// ─── Users Tab ───────────────────────────────────────────────────────────────

function InviteUserModal({ companyId, onInvited, isOpen, onClose }: {
  companyId: string
  isOpen: boolean
  onClose: () => void
  onInvited: (user: FounderUserProfile) => void
}) {
  const [form, setForm] = useState({ email: '', name: '', base_role: 'worker', phone: '' })
  const [saving, setSaving] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await founderUsers.invite(companyId, {
        email: form.email,
        name: form.name,
        base_role: form.base_role as 'admin' | 'superintendent' | 'engineer' | 'foreman' | 'worker',
        phone: form.phone || undefined,
      })
      setInviteLink(res.inviteLink)
      onInvited(res.user)
      toast.success(`Invited ${form.email}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setForm({ email: '', name: '', base_role: 'worker', phone: '' })
    setInviteLink(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Invite User" size="sm">
      {inviteLink ? (
        <div className="space-y-4">
          <p className="text-[13px] text-text-secondary">User invited. Share this link:</p>
          <div className="bg-bg-primary border border-border rounded-md p-3 text-[11px] font-mono text-text-primary break-all">
            {inviteLink}
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Copied!') }}
            >
              Copy Link
            </Button>
            <Button size="sm" onClick={handleClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {[
            { key: 'email', label: 'Email', type: 'email', required: true },
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'phone', label: 'Phone', type: 'text', required: false },
          ].map(({ key, label, type, required }) => (
            <div key={key}>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                {label} {required && <span className="text-error">*</span>}
              </label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={f(key as keyof typeof form)}
                required={required}
                className="w-full px-3 py-2 text-[13px] bg-bg-primary border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          ))}
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Role <span className="text-error">*</span>
            </label>
            <select
              value={form.base_role}
              onChange={f('base_role')}
              className="w-full px-3 py-2 text-[13px] bg-bg-primary border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {['manager', 'admin', 'superintendent', 'engineer', 'foreman', 'worker'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={handleClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Inviting…' : 'Send Invite'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

function UsersTab({ users, companyId, onUserAdded }: {
  users: FounderUserProfile[]
  companyId: string
  onUserAdded: (u: FounderUserProfile) => void
}) {
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [localUsers, setLocalUsers] = useState(users)

  useEffect(() => { setLocalUsers(users) }, [users])

  const handleInvited = (u: FounderUserProfile) => {
    setLocalUsers((prev) => [...prev, u])
    onUserAdded(u)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setIsInviteOpen(true)}>
          <Plus size={14} className="mr-1.5" /> Invite User
        </Button>
      </div>

      <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] px-4 py-2.5 border-b border-border bg-bg-subtle">
          {['Name / Email', 'Role', 'Phone', 'Joined'].map((h) => (
            <span key={h} className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {localUsers.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-text-secondary">No users yet</div>
        ) : (
          <div className="divide-y divide-border">
            {localUsers.map((u) => (
              <div key={u.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] px-4 py-3 items-center">
                <div>
                  <div className="text-[13px] font-medium text-text-primary">{u.name}</div>
                  <div className="text-[11px] text-text-secondary">{u.email}</div>
                </div>
                <Badge variant={u.base_role === 'manager' ? 'warning' : u.base_role === 'admin' ? 'info' : 'default'}>{u.base_role}</Badge>
                <div className="text-[12px] text-text-secondary">{u.phone ?? '—'}</div>
                <div className="text-[12px] text-text-secondary">{fmt(u.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <InviteUserModal
        companyId={companyId}
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onInvited={handleInvited}
      />
    </div>
  )
}

// ─── Job Sites Tab ────────────────────────────────────────────────────────────

function AddJobSiteModal({ companyId, onCreated, isOpen, onClose }: {
  companyId: string
  isOpen: boolean
  onClose: () => void
  onCreated: (s: FounderJobSite) => void
}) {
  const [form, setForm] = useState({ name: '', address: '', description: '', status: 'active' })
  const [saving, setSaving] = useState(false)

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { job_site } = await founderJobSites.create(companyId, form)
      toast.success(`Job site "${job_site.name}" created`)
      onCreated(job_site)
      setForm({ name: '', address: '', description: '', status: 'active' })
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Job Site" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Name <span className="text-error">*</span></label>
          <input type="text" value={form.name} onChange={f('name')} required
            className="w-full px-3 py-2 text-[13px] bg-bg-primary border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Address</label>
          <input type="text" value={form.address} onChange={f('address')}
            className="w-full px-3 py-2 text-[13px] bg-bg-primary border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Description</label>
          <textarea value={form.description} onChange={f('description')} rows={2}
            className="w-full px-3 py-2 text-[13px] bg-bg-primary border border-border rounded-md text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Status</label>
          <select value={form.status} onChange={f('status')}
            className="w-full px-3 py-2 text-[13px] bg-bg-primary border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50">
            {[['active', 'Active'], ['on_hold', 'On Hold'], ['completed', 'Completed']].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function JobSitesTab({ jobSites: initialSites, companyId }: {
  jobSites: FounderJobSite[]
  companyId: string
}) {
  const [sites, setSites] = useState(initialSites)
  const [isAddOpen, setIsAddOpen] = useState(false)

  useEffect(() => { setSites(initialSites) }, [initialSites])

  const siteBadge = (status: string) => {
    const map: Record<string, 'success' | 'warning' | 'default'> = { active: 'success', on_hold: 'warning', completed: 'default' }
    return <Badge variant={map[status] ?? 'default'}>{status.replace('_', ' ')}</Badge>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setIsAddOpen(true)}>
          <Plus size={14} className="mr-1.5" /> Add Job Site
        </Button>
      </div>

      <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] px-4 py-2.5 border-b border-border bg-bg-subtle">
          {['Name', 'Status', 'Dates', 'Type'].map((h) => (
            <span key={h} className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {sites.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-text-secondary">No job sites yet</div>
        ) : (
          <div className="divide-y divide-border">
            {sites.map((s) => (
              <div key={s.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] px-4 py-3 items-center">
                <div>
                  <div className="text-[13px] font-medium text-text-primary">{s.name}</div>
                  {s.address && <div className="text-[11px] text-text-secondary">{s.address}</div>}
                </div>
                <div>{siteBadge(s.status)}</div>
                <div className="text-[12px] text-text-secondary">
                  {s.start_date ? fmt(s.start_date) : '—'}
                  {s.end_date ? ` → ${fmt(s.end_date)}` : ''}
                </div>
                <div>
                  {s.is_system_site && <Badge variant="default">system</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddJobSiteModal
        companyId={companyId}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreated={(s) => setSites((prev) => [...prev, s])}
      />
    </div>
  )
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({ companyId }: { companyId: string }) {
  const [notes, setNotes] = useState<FounderNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    founderNotes.list(companyId).then(({ notes: n }) => { setNotes(n); setLoading(false) }).catch(() => setLoading(false))
  }, [companyId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.trim()) return
    setSaving(true)
    try {
      const { note } = await founderNotes.add(companyId, newNote.trim())
      setNotes((prev) => [note, ...prev])
      setNewNote('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <form onSubmit={submit} className="flex gap-3">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={2}
          placeholder="Add a note…"
          className="flex-1 px-3 py-2 text-[13px] bg-bg-secondary border border-border rounded-md text-text-primary placeholder-text-tertiary resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <Button type="submit" size="sm" disabled={saving || !newNote.trim()} className="self-end">
          {saving ? 'Saving…' : 'Add'}
        </Button>
      </form>

      {/* Notes list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-10 text-[13px] text-text-secondary">No notes yet</div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="bg-bg-secondary border border-border rounded-lg p-4">
              <p className="text-[13px] text-text-primary whitespace-pre-wrap">{n.note}</p>
              <div className="text-[11px] text-text-secondary mt-2">{fmtFull(n.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Audit Tab ────────────────────────────────────────────────────────────────

function AuditTab({ companyId }: { companyId: string }) {
  const [entries, setEntries] = useState<FounderAuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    founderAudit.list(companyId, { limit: 50 })
      .then(({ audit }) => { setEntries(audit); setLoading(false) })
      .catch(() => setLoading(false))
  }, [companyId])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCcw size={13} className="mr-1.5" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-10 text-[13px] text-text-secondary">No audit entries yet</div>
      ) : (
        <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1.5fr] px-4 py-2.5 border-b border-border bg-bg-subtle">
            {['Action', 'Entity', 'Entity ID', 'Timestamp'].map((h) => (
              <span key={h} className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-border">
            {entries.map((e) => (
              <div key={e.id} className="grid grid-cols-[1.5fr_1fr_1fr_1.5fr] px-4 py-3 items-center">
                <span className="text-[12px] font-mono font-medium text-text-primary bg-bg-subtle px-1.5 py-0.5 rounded w-fit">
                  {e.action}
                </span>
                <span className="text-[12px] text-text-secondary">{e.entity_type}</span>
                <span className="text-[11px] font-mono text-text-secondary">{e.entity_id.slice(0, 8)}…</span>
                <span className="text-[11px] text-text-secondary">{fmtFull(e.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [company, setCompany] = useState<FounderCompany | null>(null)
  const [onboarding, setOnboarding] = useState<FounderOnboarding | null>(null)
  const [users, setUsers] = useState<FounderUserProfile[]>([])
  const [jobSites, setJobSites] = useState<FounderJobSite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startingTracking, setStartingTracking] = useState(false)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    setError(null)
    try {
      const detail = await founderCompanies.get(companyId)
      setCompany(detail.company as FounderCompany)
      setOnboarding(detail.onboarding)
      setUsers(detail.users)
      setJobSites(detail.job_sites)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load company')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { load() }, [load])

  const handleStartTracking = async () => {
    if (!companyId) return
    setStartingTracking(true)
    try {
      const { onboarding: ob } = await founderOnboarding.startTracking(companyId)
      setOnboarding(ob)
      toast.success('Tracking started')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start tracking')
    } finally {
      setStartingTracking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="p-8">
        <div className="bg-error-bg border border-error/20 rounded-lg p-4 text-error text-[13px]">
          {error ?? 'Company not found'}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <Link
          to="/founder/companies"
          className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary hover:text-text-primary mb-3 transition-colors"
        >
          <ArrowLeft size={12} />
          Companies
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[24px] font-bold text-text-primary">{company.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[12px] text-text-secondary font-mono">{company.slug}</span>
              {onboarding ? (
                obBadge(onboarding.status)
              ) : (
                <Badge variant="default">Not tracked</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 border-b border-border -mb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all duration-150 ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pt-2">
        {activeTab === 'overview' && (
          <OverviewTab
            company={company}
            onboarding={onboarding}
            users={users}
            jobSites={jobSites}
            onStartTracking={handleStartTracking}
            startingTracking={startingTracking}
          />
        )}
        {activeTab === 'onboarding' && (
          <OnboardingTab
            onboarding={onboarding}
            companyId={company.id}
            onUpdated={setOnboarding}
          />
        )}
        {activeTab === 'users' && (
          <UsersTab
            users={users}
            companyId={company.id}
            onUserAdded={(u) => setUsers((prev) => [...prev, u])}
          />
        )}
        {activeTab === 'job-sites' && (
          <JobSitesTab jobSites={jobSites} companyId={company.id} />
        )}
        {activeTab === 'notes' && <NotesTab companyId={company.id} />}
        {activeTab === 'audit' && <AuditTab companyId={company.id} />}
      </div>
    </div>
  )
}
