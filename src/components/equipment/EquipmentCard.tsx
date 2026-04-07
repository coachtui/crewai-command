// ============================================================================
// Equipment Card Component
// ============================================================================

import { Edit2, Trash2, Truck, Wrench, HardHat, Car, Package } from 'lucide-react';
import { ListItem } from '../ui/ListItem';
import { Badge } from '../ui/Badge';
import type { Equipment } from '../../types';

interface EquipmentCardProps {
  equipment: Equipment;
  onEdit: (equipment: Equipment) => void;
  onDelete: (equipmentId: string) => void;
  showSite?: boolean;
}

const getTypeConfig = (type: Equipment['type']) => {
  switch (type) {
    case 'heavy_equipment':
      return { icon: Truck, label: 'Heavy Equipment', iconColor: 'text-info' };
    case 'small_equipment':
      return { icon: HardHat, label: 'Small Equipment', iconColor: 'text-warning' };
    case 'tools':
      return { icon: Wrench, label: 'Tools', iconColor: 'text-success' };
    case 'vehicles':
      return { icon: Car, label: 'Vehicles', iconColor: 'text-purple-400' };
    case 'other':
    default:
      return { icon: Package, label: 'Other', iconColor: 'text-text-secondary' };
  }
};

const getStatusVariant = (status: Equipment['status']) => {
  switch (status) {
    case 'available': return 'success' as const;
    case 'in_use': return 'info' as const;
    case 'maintenance': return 'warning' as const;
    case 'retired': return 'default' as const;
  }
};

const getStatusLabel = (status: Equipment['status']) => {
  switch (status) {
    case 'available': return 'Available';
    case 'in_use': return 'In Use';
    case 'maintenance': return 'Maintenance';
    case 'retired': return 'Retired';
  }
};

const getStatusColor = (status: Equipment['status']): 'green' | 'blue' | 'orange' | 'gray' => {
  switch (status) {
    case 'available': return 'green';
    case 'in_use': return 'blue';
    case 'maintenance': return 'orange';
    case 'retired': return 'gray';
  }
};

export function EquipmentCard({ equipment, onEdit, onDelete, showSite }: EquipmentCardProps) {
  const typeConfig = getTypeConfig(equipment.type);
  const TypeIcon = typeConfig.icon;

  const metadata = [
    {
      icon: <TypeIcon size={14} className={typeConfig.iconColor} />,
      text: typeConfig.label,
    },
  ];

  if (equipment.model) {
    metadata.push({ icon: <></>, text: equipment.model });
  }

  if (showSite && equipment.job_site?.name) {
    metadata.push({ icon: <></>, text: equipment.job_site.name });
  }

  const rightContent = (
    <div className="flex items-center gap-3">
      <Badge variant={getStatusVariant(equipment.status)}>
        {getStatusLabel(equipment.status)}
      </Badge>
      <div className="flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(equipment); }}
          className="p-1.5 hover:bg-bg-hover rounded transition-colors"
          title="Edit"
        >
          <Edit2 size={16} className="text-text-secondary" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(equipment.id); }}
          className="p-1.5 hover:bg-bg-hover rounded transition-colors"
          title="Delete"
        >
          <Trash2 size={16} className="text-error" />
        </button>
      </div>
    </div>
  );

  return (
    <ListItem
      statusColor={getStatusColor(equipment.status)}
      title={equipment.name}
      metadata={metadata}
      rightContent={rightContent}
    />
  );
}
