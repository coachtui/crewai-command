// ============================================================================
// Equipment Inventory Tab
// Displays the company equipment_inventory catalog with location and qty info.
// Add/Edit/Delete restricted to Admin/Manager via both UI guards and RLS.
//
// TODO: attach equipment to specific crew or task
// TODO: QR code or equipment tag scan to mark received
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { EquipmentInventoryCard } from './EquipmentInventoryCard';
import { InventoryItemHistory } from './MovementHistory';
import { EquipmentInventoryForm } from './EquipmentInventoryForm';
import {
  fetchEquipmentInventory,
  createEquipmentInventoryItem,
  updateEquipmentInventoryItem,
  deleteEquipmentInventoryItem,
} from '../../lib/api/equipmentRequests';
import { useAuth, useIsAdmin } from '../../contexts';
import { useJobSite } from '../../contexts/JobSiteContext';
import type { EquipmentInventory } from '../../types';
import type { CreateInventoryItemData } from '../../lib/api/equipmentRequests';

export function EquipmentInventoryTab() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const { availableJobSites } = useJobSite();

  const [items, setItems] = useState<EquipmentInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentInventory | null>(null);

  const loadInventory = useCallback(async () => {
    if (!user?.org_id) return;
    setLoading(true);
    try {
      const data = await fetchEquipmentInventory(user.org_id);
      setItems(data);
    } catch (err) {
      console.error('[EquipmentInventoryTab] load error:', err);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [user?.org_id]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const handleSave = async (data: CreateInventoryItemData) => {
    if (!user?.org_id) return;
    try {
      if (editingItem) {
        await updateEquipmentInventoryItem(editingItem.id, data);
        toast.success('Inventory item updated');
      } else {
        await createEquipmentInventoryItem(user.org_id, data);
        toast.success('Equipment added to inventory');
      }
      setIsFormOpen(false);
      setEditingItem(null);
      await loadInventory();
    } catch (err) {
      console.error('[EquipmentInventoryTab] save error:', err);
      toast.error('Failed to save inventory item');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this inventory item? This cannot be undone.')) return;
    try {
      await deleteEquipmentInventoryItem(id);
      toast.success('Item removed from inventory');
      await loadInventory();
    } catch (err) {
      console.error('[EquipmentInventoryTab] delete error:', err);
      toast.error('Failed to delete item');
    }
  };

  const openEdit = (item: EquipmentInventory) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.category ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[14px] text-text-secondary">
          Company-wide equipment catalog with location and availability tracking.
        </p>
        {isAdmin && (
          <Button
            onClick={() => { setEditingItem(null); setIsFormOpen(true); }}
            className="min-h-[36px]"
          >
            <Plus size={15} className="mr-1.5" />
            Add Equipment
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          placeholder="Search inventory..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-text-primary placeholder-text-tertiary"
        />
      </div>

      {/* Inventory list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-text-secondary">
          Loading...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-text-secondary">
          <p className="text-[14px]">
            {items.length === 0 ? 'No equipment in inventory yet.' : 'No items match your search.'}
          </p>
          {isAdmin && items.length === 0 && (
            <Button onClick={() => { setEditingItem(null); setIsFormOpen(true); }}>
              <Plus size={15} className="mr-1.5" />
              Add First Item
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden divide-y divide-border">
          {filteredItems.map(item => (
            <div key={item.id}>
              <EquipmentInventoryCard
                item={item}
                canManage={isAdmin}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
              <div className="px-4 pb-2">
                <InventoryItemHistory inventoryItemId={item.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingItem(null); }}
        title={editingItem ? 'Edit Inventory Item' : 'Add to Inventory'}
        size="md"
      >
        <EquipmentInventoryForm
          item={editingItem}
          jobSites={availableJobSites}
          onSave={handleSave}
          onCancel={() => { setIsFormOpen(false); setEditingItem(null); }}
        />
      </Modal>
    </div>
  );
}
