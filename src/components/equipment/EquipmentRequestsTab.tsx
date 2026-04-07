// ============================================================================
// Equipment Requests Tab
// Adaptive view:
//   Admin/Manager — all requests for the org, with approve/dispatch/receive actions
//   Supe/Foreman  — requests for their current site, plus "Request Equipment" button
//
// TODO: push notification or in-app alert when request status changes
// TODO: email notification to Admin when new request is submitted
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Plus, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { EquipmentRequestCard } from './EquipmentRequestCard';
import { EquipmentRequestForm } from './EquipmentRequestForm';
import { DispatchModal } from './DispatchModal';
import {
  fetchEquipmentRequests,
  createEquipmentRequest,
  transitionEquipmentRequest,
  fetchEquipmentInventory,
} from '../../lib/api/equipmentRequests';
import { useAuth, useIsAdmin } from '../../contexts';
import { useJobSite } from '../../contexts/JobSiteContext';
import type { EquipmentInventory, EquipmentRequest, EquipmentRequestStatus, JobSite } from '../../types';

type StatusFilter = 'all' | EquipmentRequestStatus;

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'All Statuses',
  pending: 'Pending',
  approved: 'Approved',
  dispatched: 'Dispatched',
  received: 'Received',
};

export function EquipmentRequestsTab() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const { currentJobSite, availableJobSites } = useJobSite();

  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [inventory, setInventory] = useState<EquipmentInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [siteFilter, setSiteFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Request form modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // Dispatch modal
  const [dispatchingRequest, setDispatchingRequest] = useState<EquipmentRequest | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.org_id) return;
    setLoading(true);
    try {
      const [reqs, inv] = await Promise.all([
        fetchEquipmentRequests(user.org_id),
        fetchEquipmentInventory(user.org_id),
      ]);
      setRequests(reqs);
      setInventory(inv);
    } catch (err) {
      console.error('[EquipmentRequestsTab] load error:', err);
      toast.error('Failed to load equipment requests');
    } finally {
      setLoading(false);
    }
  }, [user?.org_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Role-based filtering: RLS already restricts server-side, but also scope
  // the client-side list to the current site for non-admin users.
  const filteredRequests = requests.filter(r => {
    if (!isAdmin && currentJobSite) {
      const atCurrentSite =
        r.requesting_job_site_id === currentJobSite.id ||
        r.destination_job_site_id === currentJobSite.id;
      if (!atCurrentSite) return false;
    }
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (siteFilter && r.requesting_job_site_id !== siteFilter && r.destination_job_site_id !== siteFilter) return false;
    return true;
  });

  const handleSubmitRequest = async (formData: {
    equipment_inventory_id?: string;
    equipment_name: string;
    quantity_requested: number;
    date_needed: string;
    notes?: string;
  }) => {
    if (!user || !currentJobSite) return;
    try {
      await createEquipmentRequest({
        organization_id: user.org_id,
        equipment_inventory_id: formData.equipment_inventory_id,
        equipment_name: formData.equipment_name,
        quantity_requested: formData.quantity_requested,
        requesting_job_site_id: currentJobSite.id,
        destination_job_site_id: currentJobSite.id,
        date_needed: formData.date_needed,
        notes: formData.notes,
        requested_by: user.id,
      });
      toast.success('Request submitted');
      setIsRequestModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('[EquipmentRequestsTab] submit error:', err);
      toast.error('Failed to submit request');
    }
  };

  const handleApprove = async (request: EquipmentRequest) => {
    if (!user) return;
    try {
      await transitionEquipmentRequest(request, {
        transition: 'approve',
        approved_by: user.id,
      });
      toast.success('Request approved');
      await loadData();
    } catch (err) {
      console.error('[EquipmentRequestsTab] approve error:', err);
      toast.error('Failed to approve request');
    }
  };

  const handleDispatch = async (request: EquipmentRequest, dispatchNotes: string) => {
    if (!user) return;
    try {
      await transitionEquipmentRequest(request, {
        transition: 'dispatch',
        dispatched_by: user.id,
        dispatch_notes: dispatchNotes,
      });
      toast.success('Equipment dispatched');
      setDispatchingRequest(null);
      await loadData();
    } catch (err) {
      console.error('[EquipmentRequestsTab] dispatch error:', err);
      toast.error('Failed to dispatch equipment');
    }
  };

  const handleMarkReceived = async (request: EquipmentRequest) => {
    try {
      await transitionEquipmentRequest(request, { transition: 'receive' });
      toast.success('Marked as received');
      await loadData();
    } catch (err) {
      console.error('[EquipmentRequestsTab] receive error:', err);
      toast.error('Failed to mark as received');
    }
  };

  // Non-system sites for the admin site filter dropdown
  const filterableSites: JobSite[] = availableJobSites.filter(s => !s.is_system_site);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[14px] text-text-secondary">
          {isAdmin
            ? 'All equipment requests for your organization'
            : currentJobSite
            ? `Requests for ${currentJobSite.name}`
            : 'Select a job site to view requests'}
        </p>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] border transition-colors min-h-[36px] ${
                showFilters
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-bg-secondary border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              <Filter size={14} />
              Filters
            </button>
          )}
          {currentJobSite && (
            <Button
              onClick={() => setIsRequestModalOpen(true)}
              className="min-h-[36px]"
            >
              <Plus size={15} className="mr-1.5" />
              Request Equipment
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar (Admin only) */}
      {isAdmin && showFilters && (
        <div className="flex flex-col md:flex-row gap-3 p-3 bg-bg-hover rounded-lg border border-border">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="flex-1 px-3 py-2 text-sm bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-text-primary"
          >
            {(Object.keys(STATUS_FILTER_LABELS) as StatusFilter[]).map(s => (
              <option key={s} value={s}>{STATUS_FILTER_LABELS[s]}</option>
            ))}
          </select>
          <select
            value={siteFilter}
            onChange={e => setSiteFilter(e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-text-primary"
          >
            <option value="">All Job Sites</option>
            {filterableSites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Requests list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-text-secondary">
          Loading...
        </div>
      ) : !currentJobSite && !isAdmin ? (
        <div className="flex items-center justify-center py-12 text-text-secondary text-[14px]">
          Select a job site to view equipment requests.
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-text-secondary">
          <p className="text-[14px]">No requests found.</p>
          {currentJobSite && (
            <Button variant="secondary" onClick={() => setIsRequestModalOpen(true)}>
              <Plus size={15} className="mr-1.5" />
              Submit First Request
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRequests.map(r => (
            <EquipmentRequestCard
              key={r.id}
              request={r}
              onApprove={isAdmin ? handleApprove : undefined}
              onDispatch={isAdmin ? req => setDispatchingRequest(req) : undefined}
              onMarkReceived={isAdmin ? handleMarkReceived : undefined}
            />
          ))}
        </div>
      )}

      {/* Request Equipment modal */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        title="Request Equipment"
        size="md"
      >
        {currentJobSite && (
          <EquipmentRequestForm
            jobSite={currentJobSite}
            inventoryItems={inventory}
            onSave={handleSubmitRequest}
            onCancel={() => setIsRequestModalOpen(false)}
          />
        )}
      </Modal>

      {/* Dispatch modal */}
      <DispatchModal
        request={dispatchingRequest}
        onConfirm={handleDispatch}
        onClose={() => setDispatchingRequest(null)}
      />
    </div>
  );
}
