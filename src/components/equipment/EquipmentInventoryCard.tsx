// ============================================================================
// Equipment Inventory Card
// Displays a single equipment_inventory item with location and availability
// ============================================================================

import { Edit2, Trash2, Package, MapPin } from 'lucide-react';
import type { EquipmentInventory } from '../../types';

interface EquipmentInventoryCardProps {
  item: EquipmentInventory;
  canManage: boolean;
  onEdit: (item: EquipmentInventory) => void;
  onDelete: (id: string) => void;
}

export function EquipmentInventoryCard({
  item,
  canManage,
  onEdit,
  onDelete,
}: EquipmentInventoryCardProps) {
  const availabilityColor =
    item.quantity_available === 0
      ? 'text-error'
      : item.quantity_available < item.quantity_total
      ? 'text-warning'
      : 'text-success';

  const locationLabel = item.current_location?.name ?? 'Yard / Unassigned';

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-bg-secondary">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Package size={16} className="text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[14px] font-medium text-text-primary">{item.name}</span>
          {item.category && (
            <span className="text-[12px] text-text-tertiary">{item.category}</span>
          )}
        </div>
        {(item.make || item.model || item.serial_number) && (
          <div className="text-[12px] text-text-secondary mt-0.5 flex gap-2 flex-wrap">
            {item.make && <span>{item.make}</span>}
            {item.model && <span>{item.model}</span>}
            {item.serial_number && <span className="text-text-tertiary">#{item.serial_number}</span>}
          </div>
        )}
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className={`text-[12px] font-medium ${availabilityColor}`}>
            {item.quantity_available}/{item.quantity_total} available
          </span>
          <span className="flex items-center gap-1 text-[12px] text-text-secondary">
            <MapPin size={11} />
            {locationLabel}
          </span>
        </div>
      </div>

      {canManage && (
        <div className="flex gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="p-2 hover:bg-bg-hover rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            title="Edit"
          >
            <Edit2 size={15} className="text-text-secondary" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="p-2 hover:bg-bg-hover rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            title="Delete"
          >
            <Trash2 size={15} className="text-error" />
          </button>
        </div>
      )}
    </div>
  );
}
