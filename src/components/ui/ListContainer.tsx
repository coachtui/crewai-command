import React from 'react';
import { cn } from '../../lib/utils';

export interface ListContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ListContainer({ children, className, ...props }: ListContainerProps) {
  return (
    <div
      className={cn(
        'bg-list-separator rounded-lg overflow-hidden',
        className
      )}
      {...props}
    >
      <div className="divide-y divide-list-separator">
        {children}
      </div>
    </div>
  );
}
