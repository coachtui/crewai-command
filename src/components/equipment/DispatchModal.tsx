// ============================================================================
// Dispatch Modal
// Entered by Admin/Manager when dispatching an approved equipment request.
// Captures optional dispatch_notes before confirming dispatch.
// ============================================================================

import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import type { EquipmentRequest } from '../../types';

interface DispatchModalProps {
  request: EquipmentRequest | null;
  onConfirm: (request: EquipmentRequest, dispatchNotes: string) => Promise<void>;
  onClose: () => void;
}

export function DispatchModal({ request, onConfirm, onClose }: DispatchModalProps) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!request) return null;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(request, notes.trim());
      setNotes('');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setNotes('');
    onClose();
  };

  return (
    <Modal
      isOpen={!!request}
      onClose={handleClose}
      title="Dispatch Equipment"
      size="sm"
    >
      <div className="space-y-4">
        <div className="text-[14px] text-text-secondary space-y-1">
          <p>
            <span className="font-medium text-text-primary">{request.equipment_name}</span>
            {' '}× {request.quantity_requested}
          </p>
          {request.destination_job_site && (
            <p>Sending to: <span className="text-text-primary">{request.destination_job_site.name}</span></p>
          )}
        </div>

        <Textarea
          label="Dispatch Notes (optional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Driver name, truck #, ETA, special instructions..."
          rows={3}
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
