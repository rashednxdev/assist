'use client';

import { useEffect, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import {
  COMMUNITY_LINK_KIND_LABELS,
  COMMUNITY_MAX_LINKS,
  type CommunityLinkKind,
  type CommunityLinkRecord,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { LINK_KIND_ORDER, LINK_KIND_STYLE } from '@/lib/community';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

/** Tag a workflow, checklist, template, guide or circular on a discussion or answer. */
export function LinkPicker({
  value,
  onChange,
  onClose,
}: {
  value: CommunityLinkRecord[];
  onChange: (links: CommunityLinkRecord[]) => void;
  onClose?: () => void;
}) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<CommunityLinkKind | ''>('');
  const [options, setOptions] = useState<CommunityLinkRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q });
      if (kind) params.set('kind', kind);
      apiFetch<{ data: CommunityLinkRecord[] }>(`/community/link-options?${params.toString()}`)
        .then((r) => alive && setOptions(r.data))
        .catch(() => alive && setOptions([]))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, kind]);

  const has = (o: CommunityLinkRecord) => value.some((v) => v.type === o.type && v.id === o.id);
  const full = value.length >= COMMUNITY_MAX_LINKS;
  const toggle = (o: CommunityLinkRecord) => {
    if (has(o)) onChange(value.filter((v) => !(v.type === o.type && v.id === o.id)));
    else if (!full) onChange([...value, o]);
  };

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            autoFocus
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search workflows, checklists, templates, circulars…"
          />
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-slate-100" aria-label="Close picker">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(['', ...LINK_KIND_ORDER] as const).map((k) => (
          <button
            key={k || 'all'}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
              kind === k ? 'border-primary bg-primary text-white' : 'border-border text-muted hover:bg-slate-100',
            )}
          >
            {k ? COMMUNITY_LINK_KIND_LABELS[k] : 'All'}
          </button>
        ))}
      </div>
      <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
        {loading && options.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted">Searching…</p>
        ) : options.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted">Nothing found. Try another word.</p>
        ) : (
          options.map((o) => {
            const on = has(o);
            const style = LINK_KIND_STYLE[o.kind];
            const Icon = style.icon;
            return (
              <button
                key={`${o.type}:${o.id}`}
                type="button"
                disabled={!on && full}
                onClick={() => toggle(o)}
                className={cn(
                  'flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50 disabled:opacity-50',
                  on && 'bg-primary/5',
                )}
              >
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border', style.className)}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{o.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {COMMUNITY_LINK_KIND_LABELS[o.kind]}
                    {o.subtitle ? ` · ${o.subtitle}` : ''}
                  </span>
                </span>
                {on && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })
        )}
      </div>
      <p className="text-xs text-muted">
        {value.length}/{COMMUNITY_MAX_LINKS} tagged · Readers can open the tagged item straight from the post.
      </p>
    </div>
  );
}
