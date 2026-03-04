import React from 'react';
import { cn } from '../../lib/utils';

export interface ListContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ListContainer({ children, className, ...props }: ListContainerProps) {
  return (
    <div
      className={cn(
        'bg-bg-secondary border border-gray-100 rounded-xl overflow-hidden shadow-sm-soft',
        className
      )}
      {...props}
    >
      <div className="divide-y divide-gray-100">
        {children}
      </div>
    </div>
  );
}
