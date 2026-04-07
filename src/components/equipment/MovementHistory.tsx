// ============================================================================
// Movement History
// Inline timeline of equipment movements for a single inventory item
// ============================================================================

import { useState, useEffect } from 'react';
import { MoveRight, History } from 'lucide-react';
import { fetchMovementLog } from '../../lib/api/equipmentRequests';
import type { EquipmentMovementLog } from '../../types';

interface MovementHistoryProps {
  inventoryItemId: string;
}

export function MovementHistory({ inventoryItemId }: MovementHistoryProps) {
  const [log, setLog] = useState<EquipmentMovementLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMovementLog(inventoryItemId)
      .then(setLog)
      .catch(err => console.error('[MovementHistory]', err))
      .finally(() => setLoading(false));
  }, [inventoryItemId]);

  if (loading) {
    return <p className="text-[12px] text-text-tertiary px-1">Loading history...</p>;
  }

  if (log.length === 0) {
    return <p className="text-[12px] text-text-tertiary px-1">No movement history yet.</p>;
  }

  return (
    <div className="space-y-2">
      {log.map(entry => (
        <div key={entry.id} className="flex items-start gap-2 text-[12px]">
          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MoveRight size={10} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap text-text-primary">
              <span>{entry.from_job_site?.name ?? 'Yard'}</span>
              <MoveRight size={11} className="text-text-tertiary" />
              <span className="font-medium">{entry.to_job_site?.name ?? '—'}</span>
            </div>
            <div className="text-text-tertiary mt-0.5 flex gap-2 flex-wrap">
              <span>
                {new Date(entry.moved_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              {entry.moved_by_profile && <span>by {entry.moved_by_profile.name}</span>}
              {entry.notes && <span className="italic">"{entry.notes}"</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Expandable wrapper used in the inventory list
interface InventoryItemHistoryProps {
  inventoryItemId: string;
}

export function InventoryItemHistory({ inventoryItemId }: InventoryItemHistoryProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[12px] text-text-secondary hover:text-text-primary transition-colors py-1"
      >
        <History size={13} />
        {open ? 'Hide history' : 'Movement history'}
      </button>
      {open && (
        <div className="mt-2 pl-1 border-l-2 border-border ml-1.5">
          <MovementHistory inventoryItemId={inventoryItemId} />
        </div>
      )}
    </div>
  );
}
