'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const inputClassName =
  'peer flex h-11 w-full rounded-lg border border-border bg-surface px-3 pb-2 pt-4 text-sm shadow-sm transition-colors placeholder:text-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50';

const labelClassName =
  'pointer-events-none absolute left-3 z-10 bg-surface px-1 text-muted transition-all duration-150 peer-focus:text-primary peer-focus:font-medium peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:-translate-y-1/2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-medium peer-[:not(:placeholder-shown)]:text-foreground peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm';

const selectClassName =
  'ibas-select h-11 w-full pb-1.5 pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50';

function selectLabelClassName(floated: boolean) {
  return cn(
    'pointer-events-none absolute left-3 z-10 bg-surface px-1 transition-all duration-150',
    floated
      ? 'top-0 -translate-y-1/2 text-xs font-medium text-foreground'
      : 'top-1/2 -translate-y-1/2 text-sm text-muted group-focus-within:top-0 group-focus-within:-translate-y-1/2 group-focus-within:text-xs group-focus-within:font-medium group-focus-within:text-primary',
  );
}

export const OutlinedInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'> & { label: string }
>(({ label, id, required, className, ...props }, ref) => {
  const autoId = React.useId();
  const inputId = id ?? autoId;

  return (
    <div className={cn('relative', className)}>
      <input ref={ref} id={inputId} placeholder=" " className={inputClassName} required={required} {...props} />
      <label htmlFor={inputId} className={labelClassName}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
    </div>
  );
});
OutlinedInput.displayName = 'OutlinedInput';

export function OutlinedSelect({
  label,
  id,
  required,
  className,
  value,
  children,
  ...props
}: React.ComponentProps<'select'> & { label: string }) {
  const autoId = React.useId();
  const selectId = id ?? autoId;
  const floated = value !== '' && value !== undefined;

  return (
    <div className={cn('group relative', className)}>
      <select
        id={selectId}
        value={value}
        required={required}
        className={selectClassName}
        {...props}
      >
        {!required && <option value="">—</option>}
        {required && !floated && <option value="" hidden />}
        {children}
      </select>
      <label htmlFor={selectId} className={selectLabelClassName(floated)}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
    </div>
  );
}
