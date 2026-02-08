import React from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-[13px] font-medium text-text-primary mb-2">
            {label}
          </label>
        )}
        <textarea
          className={cn(
            'w-full bg-bg-secondary border border-border rounded-md px-3 py-2 text-[14px] text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150 ease-smooth min-h-[100px] resize-y',
            error && 'border-error focus:ring-error',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-2 text-[13px] text-error">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
