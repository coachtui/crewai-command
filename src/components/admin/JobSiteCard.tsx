import { Edit2, Trash2, MapPin, Calendar } from 'lucide-react';
import { ListItem } from '../ui/ListItem';
import type { JobSite } from '../../types';

interface JobSiteCardProps {
  jobSite: JobSite;
  onEdit: (jobSite: JobSite) => void;
  onDelete: (jobSiteId: string) => void;
}

const getStatusColor = (status: JobSite['status']): 'blue' | 'green' | 'orange' | 'gray' => {
  switch (status) {
    case 'active':
      return 'blue';
    case 'on_hold':
      return 'orange';
    case 'completed':
      return 'green';
    default:
      return 'gray';
  }
};

export function JobSiteCard({ jobSite, onEdit, onDelete }: JobSiteCardProps) {
  const statusColor = getStatusColor(jobSite.status);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Build metadata array
  const metadata = [];
  if (jobSite.address) {
    metadata.push({
      icon: <MapPin size={14} />,
      text: jobSite.address,
    });
  }
  if (jobSite.start_date || jobSite.end_date) {
    metadata.push({
      icon: <Calendar size={14} />,
      text: `${formatDate(jobSite.start_date) || 'No start date'} - ${formatDate(jobSite.end_date) || 'Ongoing'}`,
    });
  }

  // Build right content
  const rightContent = (
    <div className="flex items-center justify-between gap-4">
      <div className="text-[13px] font-medium">
        <span className={
          jobSite.status === 'active' ? 'text-status-active' :
          jobSite.status === 'completed' ? 'text-status-complete' :
          'text-warning'
        }>
          {jobSite.status.replace('_', ' ').toUpperCase()}
        </span>
      </div>
      <div className="flex gap-1 opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(jobSite);
          }}
          className="p-1.5 hover:bg-bg-hover rounded transition-colors"
          title="Edit"
        >
          <Edit2 size={16} className="text-text-secondary" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(jobSite.id);
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
      title={jobSite.name}
      metadata={metadata}
      rightContent={rightContent}
    />
  );
}
