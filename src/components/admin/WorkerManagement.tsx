import { useState, useEffect, useCallback } from 'react';
import { Search, MoveHorizontal } from 'lucide-react';
import { useAuth } from '../../contexts';
import { useRealtimeSubscription } from '../../lib/hooks/useRealtime';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { MoveWorkerForm } from './MoveWorkerForm';
import { fetchAllWorkers, moveWorker } from '../../lib/api/workers';
import { fetchJobSites } from '../../lib/api/jobSites';
import type { Worker, JobSite } from '../../types';
import { toast } from 'sonner';

export function WorkerManagement() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [movingWorker, setMovingWorker] = useState<Worker | null>(null);

  useEffect(() => {
    if (user?.org_id) {
      loadData();
    }
  }, [user?.org_id]);

  // Enable real-time subscriptions for workers
  useRealtimeSubscription('workers', useCallback(() => loadWorkers(), []));

  const loadData = async () => {
    await Promise.all([loadWorkers(), loadJobSites()]);
  };

  const loadWorkers = async () => {
    if (!user?.org_id) {
      setWorkers([]);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchAllWorkers(user.org_id);
      setWorkers(data);
    } catch (error) {
      console.error('Error fetching workers:', error);
      toast.error('Failed to load workers');
    } finally {
      setLoading(false);
    }
  };

  const loadJobSites = async () => {
    if (!user?.org_id) return;

    try {
      const data = await fetchJobSites(user.org_id);
      setJobSites(data);
    } catch (error) {
      console.error('Error fetching job sites:', error);
    }
  };

  const handleMoveWorker = async (targetSiteId: string, _notes?: string) => {
    if (!movingWorker) return;

    try {
      await moveWorker(movingWorker.id, targetSiteId);
      toast.success(`${movingWorker.name} moved successfully`);
      loadWorkers();
      setIsModalOpen(false);
      setMovingWorker(null);
    } catch (error: any) {
      console.error('Error moving worker:', error);
      toast.error(error.message || 'Failed to move worker');
    }
  };

  const handleOpenMoveModal = (worker: Worker) => {
    setMovingWorker(worker);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setMovingWorker(null);
  };

  const filteredWorkers = workers.filter((worker) => {
    const matchesSearch = worker.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSite = siteFilter === 'all' || worker.job_site_id === siteFilter;
    const matchesRole = roleFilter === 'all' || worker.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || worker.status === statusFilter;
    return matchesSearch && matchesSite && matchesRole && matchesStatus;
  });

  if (loading) {
    return <div className="text-center py-12">Loading workers...</div>;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={20} />
            <input
              type="text"
              placeholder="Search workers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Sites</option>
            {jobSites.map(site => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
            className="px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {filteredWorkers.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          No workers match your search criteria
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Name</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Role</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Current Site</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Skills</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.map((worker) => {
                const site = jobSites.find(s => s.id === worker.job_site_id);
                return (
                  <tr key={worker.id} className="border-b border-border-primary hover:bg-bg-hover transition-colors">
                    <td className="py-3 px-4 text-text-primary font-medium">{worker.name}</td>
                    <td className="py-3 px-4">
                      <Badge variant="default" className="capitalize">{worker.role}</Badge>
                    </td>
                    <td className="py-3 px-4 text-text-primary">{site?.name || 'Unknown'}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {worker.skills && worker.skills.length > 0 ? (
                          worker.skills.slice(0, 2).map((skill, index) => (
                            <Badge key={index} variant="default" className="text-xs">{skill}</Badge>
                          ))
                        ) : (
                          <span className="text-text-secondary text-sm">No skills</span>
                        )}
                        {worker.skills && worker.skills.length > 2 && (
                          <Badge variant="default" className="text-xs">+{worker.skills.length - 2}</Badge>
                        )}
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
                        onClick={() => handleOpenMoveModal(worker)}
                        className="flex items-center gap-1"
                      >
                        <MoveHorizontal size={14} />
                        Move
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Move Worker to Another Job Site"
        size="md"
      >
        {movingWorker && (
          <MoveWorkerForm
            worker={movingWorker}
            availableJobSites={jobSites}
            onSave={handleMoveWorker}
            onCancel={handleCloseModal}
          />
        )}
      </Modal>
    </div>
  );
}
