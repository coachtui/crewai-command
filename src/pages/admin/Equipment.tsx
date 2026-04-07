// ============================================================================
// Equipment Management Page
// Tab 1 — Equipment: site-scoped equipment list (existing functionality)
// Tab 2 — Requests: equipment request/dispatch workflow
// Tab 3 — Inventory: company-level equipment catalog with quantity tracking
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, ArrowRightLeft, Truck, ClipboardList, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSubscription } from '../../lib/hooks/useRealtime';
import { useAuth, useJobSite, useCanManageSite } from '../../contexts';
import { Button } from '../../components/ui/Button';
import { EquipmentCard } from '../../components/equipment/EquipmentCard';
import { EquipmentForm } from '../../components/equipment/EquipmentForm';
import { EquipmentRequestsTab } from '../../components/equipment/EquipmentRequestsTab';
import { EquipmentInventoryTab } from '../../components/equipment/EquipmentInventoryTab';
import { Modal } from '../../components/ui/Modal';
import { ListContainer } from '../../components/ui/ListContainer';
import type { Equipment as EquipmentType } from '../../types';
import { toast } from 'sonner';

type TypeFilter = 'all' | 'heavy_equipment' | 'small_equipment' | 'tools' | 'vehicles' | 'other';
type StatusFilter = 'all' | 'available' | 'in_use' | 'maintenance' | 'retired';
type TabId = 'equipment' | 'requests' | 'inventory';

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: 'All Types',
  heavy_equipment: 'Heavy Equipment',
  small_equipment: 'Small Equipment',
  tools: 'Tools',
  vehicles: 'Vehicles',
  other: 'Other',
};

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'equipment', label: 'Equipment', icon: Truck },
  { id: 'requests', label: 'Requests', icon: ClipboardList },
  { id: 'inventory', label: 'Inventory', icon: Package },
];

export function Equipment() {
  const { user } = useAuth();
  const { currentJobSite, availableJobSites } = useJobSite();
  const canManage = useCanManageSite();
  const [activeTab, setActiveTab] = useState<TabId>('equipment');

  const [equipment, setEquipment] = useState<EquipmentType[]>([]);
  const [unassignedEquipment, setUnassignedEquipment] = useState<EquipmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentType | null>(null);
  const [showUnassigned, setShowUnassigned] = useState(false);

  // Move modal
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [movingEquipment, setMovingEquipment] = useState<EquipmentType | null>(null);
  const [moveToSiteId, setMoveToSiteId] = useState('');

  const unassignedSite = availableJobSites.find(site => site.is_system_site && site.name === 'Unassigned');

  useEffect(() => {
    if (user?.org_id) {
      fetchEquipment();
      fetchUnassignedEquipment();
    }
  }, [currentJobSite?.id, user?.org_id]);

  useRealtimeSubscription('equipment', useCallback(() => {
    fetchEquipment();
    fetchUnassignedEquipment();
  }, []));

  const fetchEquipment = async () => {
    if (!user?.org_id) {
      setEquipment([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('equipment')
        .select('*')
        .eq('organization_id', user.org_id);

      if (currentJobSite) {
        query = query.eq('job_site_id', currentJobSite.id);
      } else {
        query = query.is('job_site_id', null).limit(0);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;
      setEquipment(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      toast.error('Failed to load equipment');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnassignedEquipment = async () => {
    if (!user?.org_id || !unassignedSite) return;
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('organization_id', user.org_id)
        .eq('job_site_id', unassignedSite.id)
        .order('name');
      if (error) throw error;
      setUnassignedEquipment(data || []);
    } catch (error) {
      console.error('Error fetching unassigned equipment:', error);
    }
  };

  const handleSaveEquipment = async (formData: Partial<EquipmentType>) => {
    if (!user?.org_id) return;

    try {
      if (editingEquipment) {
        const { error } = await supabase
          .from('equipment')
          .update(formData)
          .eq('id', editingEquipment.id);
        if (error) throw error;
        toast.success('Equipment updated');
      } else {
        const { error } = await supabase
          .from('equipment')
          .insert({ ...formData, organization_id: user.org_id, created_by: user.id });
        if (error) throw error;
        toast.success('Equipment added');
      }
      setIsModalOpen(false);
      setEditingEquipment(null);
      fetchEquipment();
      fetchUnassignedEquipment();
    } catch (error) {
      console.error('Error saving equipment:', error);
      toast.error('Failed to save equipment');
    }
  };

  const handleDelete = async (equipmentId: string) => {
    if (!confirm('Are you sure you want to delete this equipment?')) return;
    try {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', equipmentId);
      if (error) throw error;
      toast.success('Equipment deleted');
      fetchEquipment();
      fetchUnassignedEquipment();
    } catch (error) {
      console.error('Error deleting equipment:', error);
      toast.error('Failed to delete equipment');
    }
  };

  const handleMoveEquipment = async () => {
    if (!movingEquipment || !moveToSiteId) return;
    try {
      const { error } = await supabase
        .from('equipment')
        .update({ job_site_id: moveToSiteId })
        .eq('id', movingEquipment.id);
      if (error) throw error;
      const targetSite = availableJobSites.find(s => s.id === moveToSiteId);
      toast.success(`${movingEquipment.name} moved to ${targetSite?.name || 'new site'}`);
      setIsMoveModalOpen(false);
      setMovingEquipment(null);
      setMoveToSiteId('');
      fetchEquipment();
      fetchUnassignedEquipment();
    } catch (error) {
      console.error('Error moving equipment:', error);
      toast.error('Failed to move equipment');
    }
  };

  const openEdit = (eq: EquipmentType) => {
    setEditingEquipment(eq);
    setIsModalOpen(true);
  };

  const openMove = (eq: EquipmentType) => {
    setMovingEquipment(eq);
    setMoveToSiteId(currentJobSite?.id || '');
    setIsMoveModalOpen(true);
  };

  const filtered = equipment.filter(eq => {
    const matchesSearch = eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (eq.model && eq.model.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'all' || eq.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || eq.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const groupedByType = (['heavy_equipment', 'small_equipment', 'tools', 'vehicles', 'other'] as const)
    .map(type => ({
      type,
      label: TYPE_LABELS[type],
      items: filtered.filter(eq => eq.type === type),
    }))
    .filter(g => g.items.length > 0);

  const movableSites = availableJobSites.filter(s => s.id !== movingEquipment?.job_site_id);

  return (
    <div className="p-6 md:p-8">
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary mb-1">Equipment & Tools</h1>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Equipment (existing functionality) */}
      {activeTab === 'equipment' && (
        <>
          <div className="mb-6 flex items-start justify-between gap-4">
            <p className="text-[14px] text-text-secondary">
              {currentJobSite ? `Equipment at ${currentJobSite.name}` : 'Select a job site to view equipment'}
            </p>
            {canManage && (
              <Button onClick={() => { setEditingEquipment(null); setIsModalOpen(true); }}>
                <Plus size={16} className="mr-2" />
                Add Equipment
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search equipment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-text-primary placeholder-text-tertiary"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="px-3 py-2 text-sm bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-text-primary"
            >
              {(Object.keys(TYPE_LABELS) as TypeFilter[]).map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 text-sm bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-text-primary"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="in_use">In Use</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-text-secondary">Loading...</div>
          ) : !currentJobSite ? (
            <div className="flex items-center justify-center py-16 text-text-secondary">
              Select a job site to view equipment.
            </div>
          ) : filtered.length === 0 && equipment.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-secondary">
              <p className="text-[15px]">No equipment at this site yet.</p>
              {canManage && (
                <Button onClick={() => { setEditingEquipment(null); setIsModalOpen(true); }}>
                  <Plus size={16} className="mr-2" />
                  Add First Equipment
                </Button>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-text-secondary">
              No equipment matches your filters.
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByType.map(({ type, label, items }) => (
                <div key={type}>
                  <h3 className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary mb-2 px-1">
                    {label} ({items.length})
                  </h3>
                  <ListContainer>
                    {items.map(eq => (
                      <div key={eq.id} className="relative group">
                        <EquipmentCard
                          equipment={eq}
                          onEdit={openEdit}
                          onDelete={handleDelete}
                        />
                        {canManage && (
                          <button
                            onClick={() => openMove(eq)}
                            className="absolute right-24 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-bg-hover rounded"
                            title="Move to another site"
                          >
                            <ArrowRightLeft size={15} className="text-text-secondary" />
                          </button>
                        )}
                      </div>
                    ))}
                  </ListContainer>
                </div>
              ))}
            </div>
          )}

          {/* Unassigned equipment section */}
          {unassignedEquipment.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowUnassigned(!showUnassigned)}
                className="flex items-center gap-2 text-[13px] text-text-secondary hover:text-text-primary transition-colors mb-2"
              >
                <span className={`transition-transform ${showUnassigned ? 'rotate-90' : ''}`}>▶</span>
                Unassigned Equipment ({unassignedEquipment.length})
              </button>
              {showUnassigned && (
                <ListContainer>
                  {unassignedEquipment.map(eq => (
                    <div key={eq.id} className="relative group">
                      <EquipmentCard
                        equipment={eq}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                      />
                      {canManage && (
                        <button
                          onClick={() => openMove(eq)}
                          className="absolute right-24 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-bg-hover rounded"
                          title="Move to a site"
                        >
                          <ArrowRightLeft size={15} className="text-text-secondary" />
                        </button>
                      )}
                    </div>
                  ))}
                </ListContainer>
              )}
            </div>
          )}

          {/* Add/Edit Modal */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setEditingEquipment(null); }}
            title={editingEquipment ? 'Edit Equipment' : 'Add Equipment'}
            size="md"
          >
            <EquipmentForm
              equipment={editingEquipment}
              onSave={handleSaveEquipment}
              onCancel={() => { setIsModalOpen(false); setEditingEquipment(null); }}
            />
          </Modal>

          {/* Move Modal */}
          <Modal
            isOpen={isMoveModalOpen}
            onClose={() => { setIsMoveModalOpen(false); setMovingEquipment(null); }}
            title={`Move: ${movingEquipment?.name}`}
            size="sm"
          >
            <div className="space-y-4">
              <p className="text-[14px] text-text-secondary">
                Select the job site to move this equipment to.
              </p>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Destination Site</label>
                <select
                  value={moveToSiteId}
                  onChange={(e) => setMoveToSiteId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-text-primary"
                >
                  <option value="">Select a site...</option>
                  {movableSites.map(site => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleMoveEquipment}
                  disabled={!moveToSiteId}
                  className="flex-1"
                >
                  Move Equipment
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => { setIsMoveModalOpen(false); setMovingEquipment(null); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Modal>
        </>
      )}

      {/* Tab: Requests */}
      {activeTab === 'requests' && <EquipmentRequestsTab />}

      {/* Tab: Inventory */}
      {activeTab === 'inventory' && <EquipmentInventoryTab />}
    </div>
  );
}
