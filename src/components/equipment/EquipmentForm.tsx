// ============================================================================
// Equipment Form Component
// ============================================================================

import { useState, useEffect, type FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import type { Equipment, EquipmentType, EquipmentStatus } from '../../types';
import { useJobSite } from '../../contexts/JobSiteContext';

interface EquipmentFormProps {
  equipment: Equipment | null;
  onSave: (data: Partial<Equipment>) => void;
  onCancel: () => void;
}

export function EquipmentForm({ equipment, onSave, onCancel }: EquipmentFormProps) {
  const { availableJobSites } = useJobSite();

  const unassignedSite = availableJobSites.find(site => site.is_system_site && site.name === 'Unassigned');

  const [formData, setFormData] = useState<{
    name: string;
    type: EquipmentType;
    model: string;
    serial_number: string;
    status: EquipmentStatus;
    notes: string;
    job_site_id: string;
  }>({
    name: '',
    type: 'other',
    model: '',
    serial_number: '',
    status: 'available',
    notes: '',
    job_site_id: unassignedSite?.id || '',
  });

  useEffect(() => {
    if (equipment) {
      setFormData({
        name: equipment.name,
        type: equipment.type,
        model: equipment.model || '',
        serial_number: equipment.serial_number || '',
        status: equipment.status,
        notes: equipment.notes || '',
        job_site_id: equipment.job_site_id || '',
      });
    } else if (unassignedSite && !formData.job_site_id) {
      setFormData(prev => ({ ...prev, job_site_id: unassignedSite.id }));
    }
  }, [equipment, unassignedSite]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      type: formData.type,
      model: formData.model || undefined,
      serial_number: formData.serial_number || undefined,
      status: formData.status,
      notes: formData.notes || undefined,
      job_site_id: formData.job_site_id || undefined,
    });
  };

  const nonSystemSites = availableJobSites.filter(site => !site.is_system_site);
  const systemSites = availableJobSites.filter(site => site.is_system_site);
  const siteOptions = [
    ...systemSites.map(s => ({ value: s.id, label: s.name })),
    ...nonSystemSites.map(s => ({ value: s.id, label: s.name })),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name *"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="e.g. CAT 320 Excavator, Air Compressor, Skid Steer..."
        required
      />

      <Select
        label="Type *"
        value={formData.type}
        onChange={(e) => setFormData({ ...formData, type: e.target.value as EquipmentType })}
        options={[
          { value: 'heavy_equipment', label: 'Heavy Equipment' },
          { value: 'small_equipment', label: 'Small Equipment' },
          { value: 'tools', label: 'Tools' },
          { value: 'vehicles', label: 'Vehicles' },
          { value: 'other', label: 'Other' },
        ]}
      />

      <Input
        label="Model / Make"
        value={formData.model}
        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
        placeholder="e.g. CAT 320, Milwaukee M18, Ford F-350"
      />

      <Input
        label="Serial / ID Number"
        value={formData.serial_number}
        onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
        placeholder="Serial number or internal ID"
      />

      <Select
        label="Status *"
        value={formData.status}
        onChange={(e) => setFormData({ ...formData, status: e.target.value as EquipmentStatus })}
        options={[
          { value: 'available', label: 'Available' },
          { value: 'in_use', label: 'In Use' },
          { value: 'maintenance', label: 'Maintenance' },
          { value: 'retired', label: 'Retired' },
        ]}
      />

      <Select
        label="Job Site"
        value={formData.job_site_id}
        onChange={(e) => setFormData({ ...formData, job_site_id: e.target.value })}
        options={siteOptions}
      />

      <Textarea
        label="Notes"
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        placeholder="Maintenance history, special instructions, condition notes..."
      />

      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1">
          {equipment ? 'Update Equipment' : 'Add Equipment'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
