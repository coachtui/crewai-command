import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, ChevronDown, Settings, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSubscription } from '../../lib/hooks/useRealtime';
import { useAuth, useJobSite, useCanManageSite } from '../../contexts';
import { Button } from '../../components/ui/Button';
import { WorkerCard } from '../../components/workers/WorkerCard';
import { WorkerForm } from '../../components/workers/WorkerForm';
import { CrewManagementPanel } from '../../components/crews/CrewManagementPanel';
import { Modal } from '../../components/ui/Modal';
import { ListContainer } from '../../components/ui/ListContainer';
import type { Worker, Crew } from '../../types';
import { toast } from 'sonner';

export function Workers() {
  const { user } = useAuth();
  const { currentJobSite, availableJobSites } = useJobSite();
  const canManage = useCanManageSite();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [unassignedWorkers, setUnassignedWorkers] = useState<Worker[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  // workerId → crewId at current site
  const [workerCrewMap, setWorkerCrewMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [collapsedCrews, setCollapsedCrews] = useState<Set<string>>(new Set());
  const [isCrewPanelOpen, setIsCrewPanelOpen] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printRoles, setPrintRoles] = useState<Set<string>>(new Set(['operator', 'laborer', 'carpenter', 'mason']));

  // Get the "Unassigned" system job site
  const unassignedSite = availableJobSites.find(site => site.is_system_site && site.name === 'Unassigned');

  useEffect(() => {
    fetchWorkers();
    fetchUnassignedWorkers();
    fetchCrews();
  }, [currentJobSite?.id, user?.org_id, unassignedSite?.id]);

  // Real-time subscriptions
  useRealtimeSubscription('workers', useCallback(() => {
    fetchWorkers();
    fetchUnassignedWorkers();
  }, []));

  useRealtimeSubscription('worker_site_assignments', useCallback(() => {
    fetchWorkers();
  }, []));

  useRealtimeSubscription('worker_crew_assignments', useCallback(() => {
    fetchWorkers();
  }, []));

  const fetchWorkers = async () => {
    if (!currentJobSite) {
      setWorkers([]);
      setLoading(false);
      return;
    }

    try {
      // Mirror DailyHours: get fresh auth user + org_id from DB
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setLoading(false); return; }

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', authUser.id)
        .single();

      if (!userData) { setLoading(false); return; }

      const { data: workersData, error: workersError } = await supabase
        .from('workers')
        .select('*, crew:crews(id, name, color)')
        .eq('organization_id', userData.org_id)
        .eq('job_site_id', currentJobSite.id)
        .order('name');

      if (workersError) throw workersError;

      let allWorkers = [...(workersData || [])];

      // Same pattern as DailyHours: fetch temp-assigned workers
      const today = new Date().toISOString().split('T')[0];
      const { data: tempAssignments, error: tempErr } = await supabase
        .from('worker_site_assignments')
        .select('worker_id')
        .eq('job_site_id', currentJobSite.id)
        .eq('is_active', true)
        .or(`and(start_date.is.null,end_date.is.null),and(start_date.lte.${today},end_date.is.null),and(start_date.is.null,end_date.gte.${today}),and(start_date.lte.${today},end_date.gte.${today})`);

      if (tempErr) console.error('worker_site_assignments fetch error:', tempErr);

      if (tempAssignments?.length) {
        const primaryIds = new Set(allWorkers.map(w => w.id));
        const extraIds = tempAssignments.map(a => a.worker_id).filter(id => !primaryIds.has(id));
        if (extraIds.length) {
          const { data: extraWorkers, error: extraErr } = await supabase
            .from('workers')
            .select('*, crew:crews(id, name, color)')
            .in('id', extraIds)
            .eq('organization_id', userData.org_id)
            .order('name');
          if (extraErr) console.error('extra workers fetch error:', extraErr);
          if (extraWorkers?.length) {
            allWorkers = [...allWorkers, ...extraWorkers];
          }
        }
      }

      // Fetch per-site crew assignments
      const workerIds = allWorkers.map(w => w.id);
      const { data: crewAssignments } = workerIds.length
        ? await supabase
            .from('worker_crew_assignments')
            .select('worker_id, crew_id')
            .eq('job_site_id', currentJobSite.id)
            .in('worker_id', workerIds)
        : { data: [] };

      const crewMap = new Map<string, string>();
      (crewAssignments || []).forEach(a => crewMap.set(a.worker_id, a.crew_id));

      setWorkers(allWorkers);
      setWorkerCrewMap(crewMap);
    } catch (error) {
      toast.error('Failed to load workers');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnassignedWorkers = async () => {
    if (!user?.org_id || !unassignedSite) {
      setUnassignedWorkers([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('organization_id', user.org_id)
        .eq('job_site_id', unassignedSite.id)
        .order('name');

      if (error) throw error;
      setUnassignedWorkers(data || []);
    } catch (error) {
      console.error('Failed to load unassigned workers:', error);
    }
  };

  const fetchCrews = async () => {
    if (!user?.org_id || !currentJobSite) {
      setCrews([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('crews')
        .select('*')
        .eq('job_site_id', currentJobSite.id)
        .order('name');

      if (error) throw error;
      setCrews(data || []);
      setCollapsedCrews(new Set([...(data || []).map(c => c.id), '__no_crew__']));
    } catch (error) {
      console.error('Failed to load crews:', error);
    }
  };

  const handleSaveWorker = async (workerData: Partial<Worker>) => {
    if (!user?.org_id) {
      toast.error('Unable to determine organization');
      return;
    }

    try {
      if (editingWorker) {
        const { error } = await supabase
          .from('workers')
          .update(workerData)
          .eq('id', editingWorker.id);
        if (error) throw error;
        toast.success('Worker updated successfully');
      } else {
        const { error } = await supabase
          .from('workers')
          .insert([{
            ...workerData,
            organization_id: user.org_id,
          }]);
        if (error) throw error;
        toast.success('Worker created successfully');
      }

      fetchWorkers();
      fetchUnassignedWorkers();
      setIsModalOpen(false);
      setEditingWorker(null);
    } catch (error) {
      toast.error('Failed to save worker');
      console.error(error);
    }
  };

  const handleEditWorker = (worker: Worker) => {
    setEditingWorker(worker);
    setIsModalOpen(true);
  };

  const handleDeleteWorker = async (workerId: string) => {
    if (!confirm('Are you sure you want to delete this worker?')) return;

    try {
      const { error } = await supabase
        .from('workers')
        .delete()
        .eq('id', workerId);
      if (error) throw error;
      toast.success('Worker deleted successfully');
      fetchWorkers();
      fetchUnassignedWorkers();
    } catch (error) {
      toast.error('Failed to delete worker');
      console.error(error);
    }
  };

  const toggleCrew = (crewId: string) => {
    setCollapsedCrews(prev => {
      const next = new Set(prev);
      if (next.has(crewId)) next.delete(crewId);
      else next.add(crewId);
      return next;
    });
  };

  // Apply search + role filter
  const filteredWorkers = workers.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || w.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredUnassignedWorkers = unassignedWorkers.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || w.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Group filteredWorkers by crew
  const workersByCrew = new Map<string, Worker[]>();
  const noCrewWorkers: Worker[] = [];

  filteredWorkers.forEach(worker => {
    const siteCrewId = workerCrewMap.get(worker.id);
    if (siteCrewId) {
      const list = workersByCrew.get(siteCrewId) || [];
      list.push(worker);
      workersByCrew.set(siteCrewId, list);
    } else {
      noCrewWorkers.push(worker);
    }
  });

  // Crews that have workers (after filter) — preserve crew order
  const crewsWithWorkers = crews.filter(c => workersByCrew.has(c.id));
  const hasAnyWorkers = filteredWorkers.length > 0;

  const WORKER_ROLES = ['operator', 'laborer', 'carpenter', 'mason', 'mechanic', 'driver'] as const;
  const ROLE_LABELS: Record<string, string> = {
    operator: 'Operators',
    laborer: 'Laborers',
    carpenter: 'Carpenters',
    mason: 'Masons',
    mechanic: 'Mechanics',
    driver: 'Drivers',
  };

  const handlePrint = () => {
    const selectedRoles = printRoles.size > 0 ? [...printRoles] : WORKER_ROLES;
    const workersToPrint = workers
      .filter(w => selectedRoles.includes(w.role))
      .sort((a, b) => a.name.localeCompare(b.name));

    const siteName = currentJobSite?.name || 'Job Site';
    const allSelected = selectedRoles.length === WORKER_ROLES.length;
    const roleLabel = allSelected
      ? 'All Roles'
      : selectedRoles.map(r => ROLE_LABELS[r] || r).join(', ');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Workers – ${siteName}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 28px; }
    ol { padding-left: 24px; margin: 0; }
    li { padding: 7px 0; border-bottom: 1px solid #e5e5e5; font-size: 15px; display: flex; align-items: center; gap: 10px; }
    li:last-child { border-bottom: none; }
    .role { color: #888; font-size: 12px; text-transform: capitalize; background: #f3f4f6; border-radius: 4px; padding: 2px 6px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>${siteName}</h1>
  <p class="meta">${roleLabel} &middot; ${workersToPrint.length} worker${workersToPrint.length !== 1 ? 's' : ''} &middot; ${new Date().toLocaleDateString()}</p>
  <ol>
    ${workersToPrint.map(w => `<li><span>${w.name}</span><span class="role">${w.role}</span></li>`).join('\n    ')}
  </ol>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
    setShowPrintModal(false);
  };

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight mb-1">Workers</h1>
        <p className="text-[14px] text-text-secondary">Manage your construction crew</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative sm:flex-1 sm:min-w-[300px] w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none z-10" size={16} />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 bg-bg-secondary border border-gray-200 rounded-xl text-[14px] text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="w-full sm:w-44 h-10 px-3 bg-bg-secondary border border-gray-200 rounded-xl text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all"
        >
          <option value="all">All Roles</option>
          <option value="operator">Operators</option>
          <option value="laborer">Laborers</option>
          <option value="carpenter">Carpenters</option>
          <option value="mason">Masons</option>
        </select>

        {currentJobSite && (
          <Button
            variant="secondary"
            onClick={() => setShowPrintModal(true)}
            className="w-full sm:w-auto h-10 whitespace-nowrap"
          >
            <Printer size={16} className="mr-2" />
            Print List
          </Button>
        )}

        {canManage && currentJobSite && (
          <Button
            variant="secondary"
            onClick={() => setIsCrewPanelOpen(true)}
            className="w-full sm:w-auto h-10 whitespace-nowrap"
          >
            <Settings size={16} className="mr-2" />
            Manage Crews
          </Button>
        )}

        <Button
          onClick={() => {
            setEditingWorker(null);
            setIsModalOpen(true);
          }}
          className="w-full sm:w-auto h-10 whitespace-nowrap"
        >
          <Plus size={20} className="mr-2" />
          Add Worker
        </Button>
      </div>

      {/* Workers grouped by crew */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-text-secondary">Loading workers...</p>
        </div>
      ) : !hasAnyWorkers ? (
        <div className="text-center py-12">
          <p className="text-text-secondary">No workers found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Named crew sections */}
          {crewsWithWorkers.map(crew => {
            const crewWorkers = workersByCrew.get(crew.id) || [];
            const isCollapsed = collapsedCrews.has(crew.id);

            return (
              <div key={crew.id}>
                <button
                  onClick={() => toggleCrew(crew.id)}
                  className="flex items-center justify-between w-full px-4 py-3 bg-bg-secondary border border-gray-100 rounded-xl hover:bg-bg-hover transition-colors shadow-sm-soft"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: crew.color || '#6366f1' }}
                    />
                    <h2 className="text-[15px] font-semibold text-text-primary">{crew.name}</h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-bg-primary text-text-secondary border border-border">
                      {crewWorkers.length}
                    </span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-text-secondary transition-transform duration-150 ${isCollapsed ? '' : 'rotate-180'}`}
                  />
                </button>

                {!isCollapsed && (
                  <ListContainer className="mt-3">
                    {crewWorkers.map(worker => (
                      <WorkerCard
                        key={worker.id}
                        worker={worker}
                        crew={crew}
                        onEdit={handleEditWorker}
                        onDelete={handleDeleteWorker}
                      />
                    ))}
                  </ListContainer>
                )}
              </div>
            );
          })}

          {/* No Crew section */}
          {noCrewWorkers.length > 0 && (
            <div>
              <button
                onClick={() => toggleCrew('__no_crew__')}
                className="flex items-center justify-between w-full px-4 py-3 bg-bg-secondary border border-gray-100 rounded-xl hover:bg-bg-hover transition-colors shadow-sm-soft"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full flex-shrink-0 bg-gray-400" />
                  <h2 className="text-[15px] font-semibold text-text-primary">No Crew</h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-bg-primary text-text-secondary border border-border">
                    {noCrewWorkers.length}
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-text-secondary transition-transform duration-150 ${collapsedCrews.has('__no_crew__') ? '' : 'rotate-180'}`}
                />
              </button>

              {!collapsedCrews.has('__no_crew__') && (
                <ListContainer className="mt-3">
                  {noCrewWorkers.map(worker => (
                    <WorkerCard
                      key={worker.id}
                      worker={worker}
                      onEdit={handleEditWorker}
                      onDelete={handleDeleteWorker}
                    />
                  ))}
                </ListContainer>
              )}
            </div>
          )}
        </div>
      )}

      {/* Unassigned (system site) Workers Section */}
      {filteredUnassignedWorkers.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowUnassigned(!showUnassigned)}
            className="flex items-center justify-between w-full px-4 py-3 bg-bg-secondary border border-gray-100 rounded-xl hover:bg-bg-hover transition-colors shadow-sm-soft"
          >
            <div className="flex items-center gap-2.5">
              <h2 className="text-[15px] font-semibold text-text-primary">Unassigned Workers</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-warning/10 text-warning border border-warning/20">
                {filteredUnassignedWorkers.length}
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`text-text-secondary transition-transform duration-150 ${showUnassigned ? 'rotate-180' : ''}`}
            />
          </button>

          {showUnassigned && (
            <ListContainer className="mt-4">
              {filteredUnassignedWorkers.map((worker) => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                  onEdit={handleEditWorker}
                  onDelete={handleDeleteWorker}
                />
              ))}
            </ListContainer>
          )}
        </div>
      )}

      {/* Print List Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPrintModal(false)}>
          <div className="bg-bg-primary rounded-2xl p-6 w-80 shadow-xl border border-border" onClick={e => e.stopPropagation()}>
            <h3 className="text-[16px] font-semibold text-text-primary mb-1">Print Worker List</h3>
            <p className="text-[13px] text-text-secondary mb-4">Select roles to include:</p>
            <div className="space-y-2 mb-5">
              {WORKER_ROLES.map(role => (
                <label key={role} className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printRoles.has(role)}
                    onChange={(e) => {
                      setPrintRoles(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(role);
                        else next.delete(role);
                        return next;
                      });
                    }}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-[14px] text-text-primary">{ROLE_LABELS[role]}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowPrintModal(false)} className="flex-1 h-9">
                Cancel
              </Button>
              <Button onClick={handlePrint} disabled={printRoles.size === 0} className="flex-1 h-9">
                <Printer size={14} className="mr-1.5" />
                Print
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Worker Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingWorker(null);
        }}
        title={editingWorker ? 'Edit Worker' : 'Add New Worker'}
      >
        <WorkerForm
          worker={editingWorker}
          onSave={handleSaveWorker}
          onAssignmentChange={fetchWorkers}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingWorker(null);
          }}
        />
      </Modal>

      {/* Crew Management Panel */}
      <CrewManagementPanel
        isOpen={isCrewPanelOpen}
        onClose={() => setIsCrewPanelOpen(false)}
        onUpdate={() => {
          fetchWorkers();
          fetchCrews();
        }}
      />
    </div>
  );
}
