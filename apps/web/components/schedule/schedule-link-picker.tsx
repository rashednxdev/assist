'use client';

import { useEffect, useState } from 'react';
import { Link2, Search, X } from 'lucide-react';
import type { ScheduleLinkRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const MAX_LINKS = 10;

/** Admin picker: tag guided processes and toolkit items (checklist, template, guide) on a schedule. */
export function ScheduleLinkPicker({
  value,
  onChange,
}: {
  value: ScheduleLinkRecord[];
  onChange: (links: ScheduleLinkRecord[]) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ScheduleLinkRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      apiFetch<{ data: ScheduleLinkRecord[] }>(`/schedule/admin/link-options?q=${encodeURIComponent(q)}`)
        .then((r) => alive && setOptions(r.data))
        .catch(() => alive && setOptions([]))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, open]);

  const has = (o: ScheduleLinkRecord) => value.some((v) => v.type === o.type && v.id === o.id);
  const toggle = (o: ScheduleLinkRecord) =>
    onChange(has(o) ? value.filter((v) => !(v.type === o.type && v.id === o.id)) : [...value, o].slice(0, MAX_LINKS));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((l) => (
            <span key={`${l.type}:${l.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-slate-50 py-1 pl-2.5 pr-1 text-xs">
              <Link2 className="h-3 w-3 text-muted" />
              <span className="font-medium">{l.title}</span>
              <span className="text-muted">· {l.subtitle}</span>
              {!l.is_published && <span className="text-amber-700">(draft)</span>}
              <button type="button" className="rounded-full p-0.5 hover:bg-slate-200" onClick={() => toggle(l)} aria-label={`Remove ${l.title}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {value.length < MAX_LINKS && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            placeholder="Search processes, checklists, templates, guides…"
          />
        </div>
      )}
      {open && (
        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
          {loading && options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">Searching…</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">Nothing found.</p>
          ) : (
            options.map((o) => {
              const on = has(o);
              return (
                <button
                  key={`${o.type}:${o.id}`}
                  type="button"
                  onClick={() => toggle(o)}
                  className={cn('flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50', on && 'bg-primary/5')}
                >
                  <input type="checkbox" readOnly checked={on} className="pointer-events-none" />
                  <span className="min-w-0 flex-1 truncate">{o.title}</span>
                  {!o.is_published && <Badge variant="warning">Draft</Badge>}
                  <Badge variant="secondary">{o.subtitle}</Badge>
                </button>
              );
            })
          )}
          <div className="flex justify-end border-t border-border px-2 py-1">
            <button type="button" className="text-xs text-muted hover:underline" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted">Users see these on the schedule and can open the steps, checklist or template directly.</p>
    </div>
  );
}
