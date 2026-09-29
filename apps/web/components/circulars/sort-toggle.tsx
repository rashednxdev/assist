'use client';

import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CircularSort = 'newest' | 'oldest';

/** "Newest first / Oldest first" switch for circular lists (by issue date). */
export function SortToggle({
  value,
  onChange,
  className,
}: {
  value: CircularSort;
  onChange: (next: CircularSort) => void;
  className?: string;
}) {
  const options: Array<{ id: CircularSort; label: string; icon: typeof ArrowDownWideNarrow }> = [
    { id: 'newest', label: 'Newest first', icon: ArrowDownWideNarrow },
    { id: 'oldest', label: 'Oldest first', icon: ArrowUpNarrowWide },
  ];
  return (
    <div className={cn('inline-flex rounded-md border border-border p-0.5', className)} role="group" aria-label="Sort by date">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
            value === o.id ? 'bg-primary text-white' : 'text-muted hover:bg-slate-100 hover:text-foreground',
          )}
        >
          <o.icon className="h-3.5 w-3.5" />
          {o.label}
        </button>
      ))}
    </div>
  );
}
