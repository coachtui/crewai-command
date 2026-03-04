// ============================================================================
// CruWork: Founder Console — Overview Page
// Aggregate stats across all tenants.
// ============================================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Users, FolderOpen, Activity } from 'lucide-react'
import { founderCompanies, founderAudit } from '../../lib/api/founder'
import type { FounderAuditEntry } from '../../lib/api/founder'
import { Badge } from '../../components/ui/Badge'

interface Stats {
  total: number
  active: number
  onboarding: number
  prospect: number
  churned: number
  not_tracked: number
}

function StatCard({
  label,
  value,
  icon: Icon,
  sublabel,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  sublabel?: string
}) {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">{label}</span>
        <Icon size={16} className="text-text-tertiary" />
      </div>
      <div className="text-[28px] font-bold text-text-primary leading-none">{value}</div>
      {sublabel && <div className="text-[12px] text-text-secondary mt-1">{sublabel}</div>}
    </div>
  )
}

function onboardingBadge(status: string | null | undefined) {
  if (!status) return <Badge variant="default">Not tracked</Badge>
  const map: Record<string, 'default' | 'info' | 'success' | 'error'> = {
    PROSPECT: 'default',
    ONBOARDING: 'info',
    ACTIVE: 'success',
    CHURNED: 'error',
  }
  return <Badge variant={map[status] ?? 'default'}>{status}</Badge>
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function FounderOverview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentCompanies, setRecentCompanies] = useState<
    { id: string; name: string; created_at: string; onboarding: { status: string } | null }[]
  >([])
  const [recentAudit, setRecentAudit] = useState<FounderAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [companiesRes, auditRes] = await Promise.all([
          founderCompanies.list({ page: 1, pageSize: 100 }),
          founderAudit.list(undefined, { limit: 10 }),
        ])

        const all = companiesRes.data
        const s: Stats = {
          total: companiesRes.total,
          active: all.filter((c) => c.onboarding?.status === 'ACTIVE').length,
          onboarding: all.filter((c) => c.onboarding?.status === 'ONBOARDING').length,
          prospect: all.filter((c) => c.onboarding?.status === 'PROSPECT').length,
          churned: all.filter((c) => c.onboarding?.status === 'CHURNED').length,
          not_tracked: all.filter((c) => !c.onboarding).length,
        }
        setStats(s)
        setRecentCompanies(
          [...all]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5)
        )
        setRecentAudit(auditRes.audit)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-error-bg border border-error/20 rounded-lg p-4 text-error text-[13px]">{error}</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[24px] font-bold text-text-primary">Overview</h1>
        <p className="text-[13px] text-text-secondary mt-1">All tenants in CruWork</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Companies" value={stats.total} icon={Building2} />
          <StatCard label="Active" value={stats.active} icon={Activity} sublabel="onboarding: ACTIVE" />
          <StatCard
            label="In Progress"
            value={stats.onboarding + stats.prospect}
            icon={FolderOpen}
            sublabel="ONBOARDING + PROSPECT"
          />
          <StatCard
            label="Not Tracked"
            value={stats.not_tracked}
            icon={Users}
            sublabel="need Start Tracking"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Companies */}
        <div className="bg-bg-secondary border border-border rounded-lg">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <span className="text-[13px] font-semibold text-text-primary">Recent Companies</span>
            <Link
              to="/founder/companies"
              className="text-[12px] text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentCompanies.length === 0 && (
              <p className="px-5 py-4 text-[13px] text-text-secondary">No companies yet</p>
            )}
            {recentCompanies.map((c) => (
              <Link
                key={c.id}
                to={`/founder/companies/${c.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-bg-hover transition-colors"
              >
                <div>
                  <div className="text-[13px] font-medium text-text-primary">{c.name}</div>
                  <div className="text-[11px] text-text-secondary">{formatDate(c.created_at)}</div>
                </div>
                {onboardingBadge(c.onboarding?.status)}
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Audit */}
        <div className="bg-bg-secondary border border-border rounded-lg">
          <div className="px-5 py-3.5 border-b border-border">
            <span className="text-[13px] font-semibold text-text-primary">Recent Activity</span>
          </div>
          <div className="divide-y divide-border">
            {recentAudit.length === 0 && (
              <p className="px-5 py-4 text-[13px] text-text-secondary">No activity yet</p>
            )}
            {recentAudit.map((e) => (
              <div key={e.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-mono font-medium text-text-primary bg-bg-subtle px-1.5 py-0.5 rounded">
                    {e.action}
                  </span>
                  <span className="text-[11px] text-text-secondary">{formatDate(e.created_at)}</span>
                </div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  {e.entity_type} · {e.entity_id.slice(0, 8)}…
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
