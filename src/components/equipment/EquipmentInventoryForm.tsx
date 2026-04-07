// ============================================================================
// Equipment Inventory Form
// Create or edit a company equipment_inventory item (Admin/Manager only)
// ============================================================================

import { useState, useEffect, type FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import type { EquipmentInventory, JobSite } from '../../types';
import type { CreateInventoryItemData } from '../../lib/api/equipmentRequests';

interface EquipmentInventoryFormProps {
  item: EquipmentInventory | null;
  jobSites: JobSite[];
  onSave: (data: CreateInventoryItemData) => Promise<void>;
  onCancel: () => void;
}

export function EquipmentInventoryForm({
  item,
  jobSites,
  onSave,
  onCancel,
}: EquipmentInventoryFormProps) {
  const [name, setName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [category, setCategory] = useState('');
  const [quantityTotal, setQuantityTotal] = useState(1);
  const [quantityAvailable, setQuantityAvailable] = useState(1);
  const [currentJobSiteId, setCurrentJobSiteId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setMake(item.make ?? '');
      setModel(item.model ?? '');
      setSerialNumber(item.serial_number ?? '');
      setCategory(item.category ?? '');
      setQuantityTotal(item.quantity_total);
      setQuantityAvailable(item.quantity_available);
      setCurrentJobSiteId(item.current_job_site_id ?? '');
      setNotes(item.notes ?? '');
    } else {
      setName('');
      setMake('');
      setModel('');
      setSerialNumber('');
      setCategory('');
      setQuantityTotal(1);
      setQuantityAvailable(1);
      setCurrentJobSiteId('');
      setNotes('');
    }
  }, [item]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        make: make.trim() || undefined,
        model: model.trim() || undefined,
        serial_number: serialNumber.trim() || undefined,
        category: category.trim() || undefined,
        quantity_total: quantityTotal,
        quantity_available: quantityAvailable,
        current_job_site_id: currentJobSiteId || undefined,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const nonSystemSites = jobSites.filter(s => !s.is_system_site);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Equipment Name *"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Excavator, Compactor, Generator 20kW"
        required
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Make"
          value={make}
          onChange={e => setMake(e.target.value)}
          placeholder="e.g. Caterpillar, Volvo"
        />
        <Input
          label="Model"
          value={model}
          onChange={e => setModel(e.target.value)}
          placeholder="e.g. 320, EC220"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Equipment #"
          value={serialNumber}
          onChange={e => setSerialNumber(e.target.value)}
          placeholder="Serial / unit #"
        />
        <Input
          label="Category"
          value={category}
          onChange={e => setCategory(e.target.value)}
          placeholder="e.g. Heavy Equipment"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            Total Qty *
          </label>
          <input
            type="number"
            min={1}
            value={quantityTotal}
            onChange={e => {
              const v = Math.max(1, parseInt(e.target.value) || 1);
              setQuantityTotal(v);
              setQuantityAvailable(prev => Math.min(prev, v));
            }}
            required
            className="w-full px-3 py-2.5 text-sm bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-text-primary min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            Available Qty *
          </label>
          <input
            type="number"
            min={0}
            max={quantityTotal}
            value={quantityAvailable}
            onChange={e => {
              const v = Math.max(0, Math.min(quantityTotal, parseInt(e.target.value) || 0));
              setQuantityAvailable(v);
            }}
            required
            className="w-full px-3 py-2.5 text-sm bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-text-primary min-h-[44px]"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Current Location
        </label>
        <select
          value={currentJobSiteId}
          onChange={e => setCurrentJobSiteId(e.target.value)}
          className="w-full px-3 py-2.5 text-sm bg-bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-text-primary min-h-[44px]"
        >
          <option value="">Yard / Unassigned</option>
          {nonSystemSites.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <Textarea
        label="Notes"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Condition notes, maintenance info..."
        rows={3}
      />

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving} className="flex-1 min-h-[44px]">
          {saving ? 'Saving...' : item ? 'Update Item' : 'Add to Inventory'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} className="min-h-[44px]">
          Cancel
        </Button>
      </div>
    </form>
  );
}
