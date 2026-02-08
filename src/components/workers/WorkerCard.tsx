import { Edit2, Trash2, Phone, Wrench, HardHat, Hammer } from 'lucide-react';
import { ListItem } from '../ui/ListItem';
import type { Worker } from '../../types';
import { formatPhone } from '../../lib/utils';

interface WorkerCardProps {
  worker: Worker;
  onEdit: (worker: Worker) => void;
  onDelete: (workerId: string) => void;
}

const getRoleConfig = (role: Worker['role']) => {
  switch (role) {
    case 'operator':
      return {
        bgColor: 'bg-info/20',
        iconColor: 'text-info',
        badgeVariant: 'info' as const,
        icon: Wrench,
      };
    case 'carpenter':
      return {
        bgColor: 'bg-success/20',
        iconColor: 'text-success',
        badgeVariant: 'success' as const,
        icon: Hammer,
      };
    case 'mason':
      return {
        bgColor: 'bg-purple-500/20',
        iconColor: 'text-purple-400',
        badgeVariant: 'default' as const,
        icon: HardHat,
      };
    case 'laborer':
    default:
      return {
        bgColor: 'bg-warning/20',
        iconColor: 'text-warning',
        badgeVariant: 'default' as const,
        icon: HardHat,
      };
  }
};

export function WorkerCard({ worker, onEdit, onDelete }: WorkerCardProps) {
  const roleConfig = getRoleConfig(worker.role);
  const RoleIcon = roleConfig.icon;

  // Determine status color
  const statusColor: 'green' | 'gray' = worker.status === 'active' ? 'green' : 'gray';

  // Build metadata array
  const metadata = [];
  metadata.push({
    icon: <RoleIcon size={14} className={roleConfig.iconColor} />,
    text: worker.role.charAt(0).toUpperCase() + worker.role.slice(1),
  });
  if (worker.phone) {
    metadata.push({
      icon: <Phone size={14} />,
      text: formatPhone(worker.phone),
    });
  }

  // Build right content
  const rightContent = (
    <div className="flex items-center justify-between gap-4">
      <div className="text-[13px] text-text-secondary">
        {worker.status === 'active' ? 'Available' : 'Inactive'}
      </div>
      <div className="flex gap-1 opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(worker);
          }}
          className="p-1.5 hover:bg-bg-hover rounded transition-colors"
          title="Edit"
        >
          <Edit2 size={16} className="text-text-secondary" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(worker.id);
          }}
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
      statusColor={statusColor}
      title={worker.name}
      metadata={metadata}
      rightContent={rightContent}
    />
  );
}
