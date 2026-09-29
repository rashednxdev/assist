'use client';

import Link from 'next/link';
import { useIbasAreas } from '@/lib/use-ibas-areas';
import { cn } from '@/lib/utils';

/**
 * Checkbox list of iBAS++ Workspace areas. Hidden areas only appear when already selected, so an
 * existing tag can be seen and removed.
 */
export function AreaCheckboxes({
  value,
  onChange,
  className,
  layout = 'stack',
  showManageLink = true,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
  layout?: 'stack' | 'wrap';
  showManageLink?: boolean;
}) {
  const { areas, loading, error } = useIbasAreas();
  const shown = areas.filter((a) => a.is_active || value.includes(a.code));
  const unknown = value.filter((code) => !loading && !areas.some((a) => a.code === code));
  const toggle = (code: string) =>
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);

  return (
    <div className={cn(layout === 'wrap' ? 'flex flex-wrap items-center gap-x-5 gap-y-2' : 'space-y-2', className)}>
      {loading && <p className="text-xs text-muted">Loading areas…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {shown.map((a) => (
        <label key={a.code} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.includes(a.code)} onChange={() => toggle(a.code)} />
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} aria-hidden />
          <span className={cn(!a.is_active && 'text-muted line-through')}>{a.name_en}</span>
          {!a.is_active && <span className="text-xs text-muted">(hidden)</span>}
        </label>
      ))}
      {unknown.map((code) => (
        <label key={code} className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked onChange={() => toggle(code)} />
          {code} <span className="text-xs">(no longer exists — untick to remove)</span>
        </label>
      ))}
      {!loading && shown.length === 0 && <p className="text-xs text-muted">No areas yet.</p>}
      {showManageLink && (
        <Link href="/admin/ibas-areas" className="inline-block text-xs text-primary hover:underline">
          Add or edit areas
        </Link>
      )}
    </div>
  );
}
