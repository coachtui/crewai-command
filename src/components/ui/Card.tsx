import React from 'react';
import { cn } from '../../lib/utils';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-bg-secondary border border-border rounded-lg p-4 md:p-6 shadow-subtle transition-all duration-150 ease-smooth hover:shadow-sm-soft',
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

export { Card };
