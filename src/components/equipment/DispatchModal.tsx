// ============================================================================
// Dispatch Modal
// Admin/Manager confirms dispatch. Captures dispatch notes plus make, model,
// and equipment # so the equipment record is created/updated with full details.
// Fields are pre-filled from the linked inventory item when available.
// ============================================================================

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import type { EquipmentRequest } from '../../types';

export interface DispatchConfirmData {
  dispatchNotes: string;
  make: string;
  model: string;
  serialNumber: string;
}

interface DispatchModalProps {
  request: EquipmentRequest | null;
  onConfirm: (request: EquipmentRequest, data: DispatchConfirmData) => Promise<void>;
  onClose: () => void;
}

export function DispatchModal({ request, onConfirm, onClose }: DispatchModalProps) {
  const [notes, setNotes] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-fill from inventory when modal opens
  useEffect(() => {
    if (request) {
      const inv = request.equipment_inventory;
      setNotes('');
      setMake(inv?.make ?? '');
      setModel(inv?.model ?? '');
      setSerialNumber(inv?.serial_number ?? '');
    }
  }, [request?.id]);

  if (!request) return null;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(request, {
        dispatchNotes: notes.trim(),
        make: make.trim(),
        model: model.trim(),
        serialNumber: serialNumber.trim(),
      });
      setNotes('');
      setMake('');
      setModel('');
      setSerialNumber('');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setNotes('');
    setMake('');
    setModel('');
    setSerialNumber('');
    onClose();
  };

  return (
    <Modal
      isOpen={!!request}
      onClose={handleClose}
      title="Dispatch Equipment"
      size="md"
    >
      <div className="space-y-4">
        {/* Summary */}
        <div className="text-[14px] text-text-secondary space-y-0.5">
          <p>
            <span className="font-semibold text-text-primary text-[15px]">
              {request.equipment_name}
            </span>
            {' '}× {request.quantity_requested}
          </p>
          {request.destination_job_site && (
            <p>
              Sending to:{' '}
              <span className="text-text-primary font-medium">
                {request.destination_job_site.name}
              </span>
            </p>
          )}
        </div>

        {/* Equipment identity fields */}
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-tertiary mb-2">
            Equipment Details
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Make"
              value={make}
              onChange={e => setMake(e.target.value)}
              placeholder="e.g. Caterpillar"
            />
            <Input
              label="Model"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="e.g. 320"
            />
          </div>
          <div className="mt-3">
            <Input
              label="Equipment #"
              value={serialNumber}
              onChange={e => setSerialNumber(e.target.value)}
              placeholder="Serial number or unit ID"
            />
          </div>
        </div>

        <Textarea
          label="Dispatch Notes (optional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Driver name, truck #, ETA, special instructions..."
          rows={2}
        />

        <div className="flex flex-col gap-3 pt-1">
          <Button
            onClick={handleConfirm}
            disabled={saving}
            className="w-full min-h-[48px] text-base bg-orange-500 hover:bg-orange-600"
          >
            {saving ? 'Dispatching...' : 'Confirm Dispatch'}
          </Button>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={saving}
            className="w-full min-h-[44px]"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
