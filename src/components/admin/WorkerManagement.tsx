import { useState, useEffect, useCallback } from 'react';
import { Search, MapPin } from 'lucide-react';
import { useAuth, useJobSite } from '../../contexts';
import { useRealtimeSubscription } from '../../lib/hooks/useRealtime';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { WorkerSiteManager } from '../workers/WorkerSiteManager';
import { fetchAllWorkers, fetchOrgWorkerSiteAssignments, moveWorker } from '../../lib/api/workers';
import { fetchJobSites } from '../../lib/api/jobSites';
import type { Worker, JobSite, WorkerSiteAssignment } from '../../types';
import { toast } from 'sonner';

export function WorkerManagement() {
  const { user } = useAuth();
  const { availableJobSites } = useJobSite();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  // Map of workerId -> active additional site assignments
  const [siteAssignments, setSiteAssignments] = useState<Map<string, WorkerSiteAssignment[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');

  // Manage Sites modal
  const [managingWorker, setManagingWorker] = useState<Worker | null>(null);
  const [newPrimarySiteId, setNewPrimarySiteId] = useState('');
  const [savingPrimary, setSavingPrimary] = useState(false);

  useEffect(() => {
    if (user?.org_id) loadData();
  }, [user?.org_id]);

  useRealtimeSubscription('workers', useCallback(() => loadWorkers(), []));
  useRealtimeSubscription('worker_site_assignments', useCallback(() => loadAssignments(), []));

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadWorkers(), loadJobSites(), loadAssignments()]);
    setLoading(false);
  };

  const loadWorkers = async () => {
    if (!user?.org_id) return;
    try {
      const data = await fetchAllWorkers(user.org_id);
      setWorkers(data);
    } catch {
      toast.error('Failed to load workers');
    }
  };

  const loadJobSites = async () => {
    if (!user?.org_id) return;
    try {
      const data = await fetchJobSites(user.org_id);
      setJobSites(data);
    } catch {
      console.error('Failed to load job sites');
    }
  };

  const loadAssignments = async () => {
    try {
      const data = await fetchOrgWorkerSiteAssignments();
      const map = new Map<string, WorkerSiteAssignment[]>();
      data.forEach(a => {
        const list = map.get(a.worker_id) || [];
        list.push(a);
        map.set(a.worker_id, list);
      });
      setSiteAssignments(map);
    } catch {
      console.error('Failed to load site assignments');
    }
  };

  const handleSavePrimarySite = async () => {
    if (!managingWorker || !newPrimarySiteId || newPrimarySiteId === managingWorker.job_site_id) return;
    setSavingPrimary(true);
    try {
      await moveWorker(managingWorker.id, newPrimarySiteId);
      toast.success(`${managingWorker.name} moved to ${jobSites.find(s => s.id === newPrimarySiteId)?.name}`);
      await loadWorkers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to move worker');
    } finally {
      setSavingPrimary(false);
    }
  };

  const openManageSites = (worker: Worker) => {
    setManagingWorker(worker);
    setNewPrimarySiteId(worker.job_site_id || '');
  };

  const unassignedSiteId = jobSites.find(s => s.is_system_site && s.name === 'Unassigned')?.id;
  const nonSystemSites = jobSites.filter(s => !s.is_system_site);

  // A worker matches a site filter if their primary OR any additional assignment matches
  const workerMatchesSite = (worker: Worker, filter: string) => {
    if (filter === 'all') return true;
    if (filter === 'unassigned') return worker.job_site_id === unassignedSiteId;
    if (worker.job_site_id === filter) return true;
    return (siteAssignments.get(worker.id) || []).some(a => a.job_site_id === filter);
  };

  const filteredWorkers = workers.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || w.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus && workerMatchesSite(w, siteFilter);
  });

  if (loading) return <div className="text-center py-12">Loading workers...</div>;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
          <input
            type="text"
            placeholder="Search workers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-text-primary"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="px-3 py-2 bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-text-primary text-sm"
          >
            <option value="all">All Sites</option>
            <option value="unassigned">Unassigned</option>
            {nonSystemSites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-text-primary text-sm"
          >
            <option value="all">All Roles</option>
            <option value="operator">Operator</option>
            <option value="laborer">Laborer</option>
            <option value="carpenter">Carpenter</option>
            <option value="mason">Mason</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-text-primary text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Worker count */}
      <p className="text-[13px] text-text-secondary mb-3">
        {filteredWorkers.length} {filteredWorkers.length === 1 ? 'worker' : 'workers'}
      </p>

      {filteredWorkers.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">No workers match your filters.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-[12px] font-medium text-text-secondary uppercase tracking-wide">Name</th>
                <th className="text-left py-3 px-4 text-[12px] font-medium text-text-secondary uppercase tracking-wide">Role</th>
                <th className="text-left py-3 px-4 text-[12px] font-medium text-text-secondary uppercase tracking-wide">Sites</th>
                <th className="text-left py-3 px-4 text-[12px] font-medium text-text-secondary uppercase tracking-wide">Status</th>
                <th className="text-left py-3 px-4 text-[12px] font-medium text-text-secondary uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.map((worker) => {
                const primarySite = jobSites.find(s => s.id === worker.job_site_id);
                const additionalAssignments = siteAssignments.get(worker.id) || [];
                const isUnassigned = worker.job_site_id === unassignedSiteId;

                return (
                  <tr key={worker.id} className="border-b border-border hover:bg-bg-hover transition-colors">
                    <td className="py-3 px-4 font-medium text-text-primary">{worker.name}</td>
                    <td className="py-3 px-4">
                      <Badge variant="default" className="capitalize">{worker.role}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {/* Primary site */}
                        {primarySite && !isUnassigned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                            <MapPin size={10} />
                            {primarySite.name}
                          </span>
                        ) : (
                          <span className="text-[12px] text-text-tertiary italic">Unassigned</span>
                        )}
                        {/* Additional sites */}
                        {additionalAssignments.map(a => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-bg-hover text-text-secondary border border-border"
                            title={a.start_date ? `${a.start_date}${a.end_date ? ' – ' + a.end_date : ''}` : undefined}
                          >
                            <MapPin size={10} />
                            {a.job_site?.name || 'Unknown'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={worker.status === 'active' ? 'success' : 'default'}>
                        {worker.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openManageSites(worker)}
                        className="flex items-center gap-1"
                      >
                        <MapPin size={14} />
                        Manage Sites
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Manage Sites Modal */}
      <Modal
        isOpen={!!managingWorker}
        onClose={() => setManagingWorker(null)}
        title={`Manage Sites — ${managingWorker?.name}`}
        size="md"
      >
        {managingWorker && (
          <div className="space-y-6">
            {/* Primary site */}
            <div>
              <label className="block text-[13px] font-semibold text-text-primary mb-1">
                Primary Site
              </label>
              <p className="text-[12px] text-text-secondary mb-3">
                The worker's home job site. Changing this moves them permanently.
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={newPrimarySiteId}
                    onChange={(e) => setNewPrimarySiteId(e.target.value)}
                    options={[
                      ...jobSites.filter(s => s.is_system_site).map(s => ({ value: s.id, label: s.name })),
                      ...nonSystemSites.map(s => ({ value: s.id, label: s.name })),
                    ]}
                  />
                </div>
                <Button
                  onClick={handleSavePrimarySite}
                  disabled={savingPrimary || newPrimarySiteId === managingWorker.job_site_id}
                  variant="primary"
                >
                  {savingPrimary ? 'Saving…' : 'Move'}
                </Button>
              </div>
            </div>

            {/* Additional assignments */}
            <div className="border-t border-border pt-5">
              <label className="block text-[13px] font-semibold text-text-primary mb-1">
                Additional Sites This Week
              </label>
              <p className="text-[12px] text-text-secondary mb-3">
                Assign this worker to additional job sites for a date range. They'll appear on each site's worker list.
              </p>
              <WorkerSiteManager
                workerId={managingWorker.id}
                primarySiteId={newPrimarySiteId || managingWorker.job_site_id}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
