// ============================================================================
// Equipment Request Form
// Used by Supe/Foreman to submit a new equipment request from their job site
// ============================================================================

import { useState, type FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import type { EquipmentInventory, JobSite } from '../../types';

interface EquipmentRequestFormProps {
  jobSite: JobSite;
  inventoryItems: EquipmentInventory[];
  onSave: (data: {
    equipment_inventory_id?: string;
    equipment_name: string;
    quantity_requested: number;
    date_needed: string;
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export function EquipmentRequestForm({
  jobSite,
  inventoryItems,
  onSave,
  onCancel,
}: EquipmentRequestFormProps) {
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [customName, setCustomName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [dateNeeded, setDateNeeded] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isCustom = selectedInventoryId === '__custom__' || inventoryItems.length === 0;
  const selectedItem = inventoryItems.find(i => i.id === selectedInventoryId);
  const equipmentName = isCustom ? customName : (selectedItem?.name ?? '');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!equipmentName.trim() || !dateNeeded) return;

    setSaving(true);
    try {
      await onSave({
        equipment_inventory_id: isCustom ? undefined : selectedInventoryId || undefined,
        equipment_name: equipmentName.trim(),
        quantity_requested: quantity,
        date_needed: dateNeeded,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Destination (read-only) */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Destination Site
        </label>
        <div className="px-3 py-2.5 bg-bg-hover border border-border rounded-lg text-sm text-text-secondary">
          {jobSite.name}
        </div>
      </div>

      {/* Equipment name — dropdown from inventory if items exist, else text */}
      {inventoryItems.length > 0 ? (
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            Equipment *
          </label>
          <select
            value={selectedInventoryId}
            onChange={e => setSelectedInventoryId(e.target.value)}
            required={!isCustom}
            className="w-full px-3 py-2.5 text-sm bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-text-primary min-h-[44px]"
          >
            <option value="">Select equipment...</option>
            {inventoryItems.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.category ? ` — ${item.category}` : ''}
                {` (${item.quantity_available} available)`}
              </option>
            ))}
            <option value="__custom__">Other (type manually)</option>
          </select>
        </div>
      ) : null}

      {isCustom && (
        <Input
          label="Equipment Name *"
          value={customName}
          onChange={e => setCustomName(e.target.value)}
          placeholder="e.g. Excavator, Compactor, Generator 20kW"
          required
        />
      )}

      {/* Quantity */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Quantity *
        </label>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          required
          className="w-full px-3 py-2.5 text-sm bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-text-primary min-h-[44px]"
        />
      </div>

      {/* Date needed */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Date Needed *
        </label>
        <input
          type="date"
          value={dateNeeded}
          onChange={e => setDateNeeded(e.target.value)}
          required
          className="w-full px-3 py-2.5 text-sm bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-text-primary min-h-[44px]"
        />
      </div>

      {/* Notes */}
      <Textarea
        label="Notes"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Any special instructions or context..."
        rows={3}
      />

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-2">
        <Button
          type="submit"
          disabled={saving || (!equipmentName.trim() && !isCustom && !selectedInventoryId)}
          className="w-full min-h-[48px] text-base"
        >
          {saving ? 'Submitting...' : 'Submit Request'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="w-full min-h-[44px]"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
