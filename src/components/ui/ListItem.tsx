import React from 'react';
import { cn } from '../../lib/utils';

export interface MetadataItem {
  icon?: React.ReactNode;
  text: string;
}

export interface ListItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  statusColor: 'blue' | 'green' | 'gray' | 'orange' | 'red';
  title: string;
  metadata?: MetadataItem[];
  rightContent?: React.ReactNode;
}

const statusColorMap = {
  blue: 'border-status-active',
  green: 'border-status-complete',
  gray: 'border-status-draft',
  orange: 'border-warning',
  red: 'border-error',
};

export function ListItem({
  statusColor,
  title,
  metadata = [],
  rightContent,
  className,
  ...props
}: ListItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-6 px-6 py-5 bg-white border-l-4 hover:bg-list-hover transition-colors duration-200 cursor-pointer',
        statusColorMap[statusColor],
        className
      )}
      {...props}
    >
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-semibold text-text-primary mb-1.5 truncate">
          {title}
        </h3>
        {metadata.length > 0 && (
          <div className="flex items-center gap-5 text-[13px] text-text-secondary flex-wrap">
            {metadata.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right content */}
      {rightContent && (
        <div className="min-w-[200px] flex-shrink-0">
          {rightContent}
        </div>
      )}
    </div>
  );
}
