import React from 'react';
import { cn } from '../../lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-[13px] font-medium text-text-primary mb-2">
            {label}
          </label>
        )}
        <select
          className={cn(
            'w-full bg-bg-secondary border border-border rounded-md px-3 py-2 text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150 ease-smooth',
            error && 'border-error focus:ring-error',
            className
          )}
          ref={ref}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-2 text-[13px] text-error">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
