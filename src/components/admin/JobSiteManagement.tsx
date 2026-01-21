import { useState, useEffect, useCallback } from 'react';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../../contexts';
import { useRealtimeSubscription } from '../../lib/hooks/useRealtime';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { JobSiteCard } from './JobSiteCard';
import { JobSiteForm } from './JobSiteForm';
import { fetchJobSites, createJobSite, updateJobSite, deleteJobSite } from '../../lib/api/jobSites';
import type { JobSite } from '../../types';
import { toast } from 'sonner';

export function JobSiteManagement() {
  const { user } = useAuth();
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJobSite, setEditingJobSite] = useState<JobSite | null>(null);

  useEffect(() => {
    if (user?.org_id) {
      loadJobSites();
    }
  }, [user?.org_id]);

  // Enable real-time subscriptions for job sites
  useRealtimeSubscription('job_sites', useCallback(() => loadJobSites(), []));

  const loadJobSites = async () => {
    if (!user?.org_id) {
      setJobSites([]);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchJobSites(user.org_id);
      setJobSites(data);
    } catch (error) {
      console.error('Error fetching job sites:', error);
      toast.error('Failed to load job sites');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveJobSite = async (jobSiteData: Partial<JobSite>) => {
    if (!user?.org_id) return;

    try {
      if (editingJobSite) {
        await updateJobSite(editingJobSite.id, jobSiteData);
        toast.success('Job site updated successfully');
      } else {
        await createJobSite({
          ...jobSiteData,
          organization_id: user.org_id,
          created_by: user.id,
          status: jobSiteData.status || 'active',
          name: jobSiteData.name || '',
        });
        toast.success('Job site created successfully');
      }
      loadJobSites();
      setIsModalOpen(false);
      setEditingJobSite(null);
    } catch (error: any) {
      console.error('Error saving job site:', error);
      toast.error(error.message || 'Failed to save job site');
    }
  };

  const handleDeleteJobSite = async (jobSiteId: string) => {
    if (!confirm('Are you sure you want to delete this job site?')) return;

    try {
      await deleteJobSite(jobSiteId);
      toast.success('Job site deleted successfully');
      loadJobSites();
    } catch (error: any) {
      console.error('Error deleting job site:', error);
      toast.error(error.message || 'Failed to delete job site');
    }
  };

  const handleEdit = (jobSite: JobSite) => {
    setEditingJobSite(jobSite);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingJobSite(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingJobSite(null);
  };

  const filteredJobSites = jobSites.filter((site) => {
    const matchesSearch = site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (site.address && site.address.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || site.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="text-center py-12">Loading job sites...</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={20} />
          <input
            type="text"
            placeholder="Search job sites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
        </select>

        <Button onClick={handleAddNew} className="flex items-center gap-2">
          <Plus size={20} />
          Add Job Site
        </Button>
      </div>

      {filteredJobSites.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          {searchQuery || statusFilter !== 'all'
            ? 'No job sites match your search criteria'
            : 'No job sites yet. Click "Add Job Site" to get started.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobSites.map((jobSite) => (
            <JobSiteCard
              key={jobSite.id}
              jobSite={jobSite}
              onEdit={handleEdit}
              onDelete={handleDeleteJobSite}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingJobSite ? 'Edit Job Site' : 'Add New Job Site'}
        size="md"
      >
        <JobSiteForm
          jobSite={editingJobSite}
          onSave={handleSaveJobSite}
          onCancel={handleCloseModal}
        />
      </Modal>
    </div>
  );
}
