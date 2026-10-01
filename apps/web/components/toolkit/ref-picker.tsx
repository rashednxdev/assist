'use client';

import { useEffect, useState } from 'react';
import { Archive, BookOpen, Link2, Scale, Search, X } from 'lucide-react';
import type { CircularRecord, ContentLinkTargetType, PolicyBookItem } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface EditorRef {
  target_type: ContentLinkTargetType;
  target_id: string;
  title: string;
  missing?: boolean;
}

interface Hit {
  id: string;
  title: string;
  subtitle?: string;
}

const ICON = { book_topic: Scale, book: BookOpen, circular: Archive } as const;
const TYPE_LABEL: Record<ContentLinkTargetType, string> = { book_topic: 'Rule', book: 'Book', circular: 'Circular' };

let booksCache: Promise<PolicyBookItem[]> | null = null;
function loadBooks() {
  booksCache ??= apiFetch<{ data: PolicyBookItem[] }>('/policy/admin/books')
    .then((r) => r.data)
    .catch(() => {
      booksCache = null;
      return [];
    });
  return booksCache;
}

/** Chips for linked rules/books/circulars plus an inline search to add more. */
export function RefPicker({
  value,
  onChange,
  max,
  compact = false,
  types = ['book_topic', 'book', 'circular'],
}: {
  value: EditorRef[];
  onChange: (refs: EditorRef[]) => void;
  max: number;
  compact?: boolean;
  types?: ContentLinkTargetType[];
}) {
  const [open, setOpen] = useState(!compact);
  const [type, setType] = useState<ContentLinkTargetType>(types[0] ?? 'book_topic');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHits([]);
    const term = q.trim();
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      setBusy(true);
      const req: Promise<Hit[]> =
        type === 'book_topic'
          ? apiFetch<{ data: Hit[] }>(`/ibas/admin/topic-search?q=${encodeURIComponent(term)}`).then((r) => r.data)
          : type === 'book'
            ? loadBooks().then((books) =>
                books
                  .filter((b) => [b.name, b.name_bn, b.short_name].some((x) => x?.toLowerCase().includes(term.toLowerCase())))
                  .slice(0, 12)
                  .map((b) => ({ id: b.id, title: b.name, subtitle: b.book_type_name })),
              )
            : apiFetch<{ data: CircularRecord[] }>(`/circulars?include_unpublished=true&limit=12&q=${encodeURIComponent(term)}`).then((r) =>
                r.data.map((c) => ({ id: c.id, title: c.title, subtitle: c.circular_no })),
              );
      req
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [q, type]);

  const has = (id: string) => value.some((r) => r.target_type === type && r.target_id === id);
  const full = value.length >= max;

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((r) => {
            const Icon = ICON[r.target_type];
            return (
              <span
                key={`${r.target_type}:${r.target_id}`}
                className={cn(
                  'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                  r.missing ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-foreground',
                )}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{r.title}</span>
                <button
                  type="button"
                  aria-label="Remove link"
                  onClick={() => onChange(value.filter((x) => !(x.target_type === r.target_type && x.target_id === r.target_id)))}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      {compact && !open ? (
        <button type="button" onClick={() => setOpen(true)} disabled={full} className="inline-flex items-center gap-1 text-xs font-medium text-primary disabled:text-muted">
          <Link2 className="h-3 w-3" /> {full ? `Max ${max} links` : types.length === 1 ? `Link a ${TYPE_LABEL[types[0]!].toLowerCase()}` : 'Link a rule / circular'}
        </button>
      ) : (
        <div className="space-y-1.5 rounded-md border border-dashed border-border p-2">
          <div className="flex gap-2">
            {types.length > 1 && (
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ContentLinkTargetType)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                {types.map((t) => (
                  <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                ))}
              </select>
            )}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                disabled={full}
                placeholder={full ? `Maximum ${max} links` : `Search ${TYPE_LABEL[type].toLowerCase()}s…`}
                className="h-8 pl-7 text-xs"
              />
            </div>
            {compact && (
              <Button type="button" size="sm" variant="ghost" onClick={() => { setOpen(false); setQ(''); }}>
                Done
              </Button>
            )}
          </div>
          {busy && <p className="text-xs text-muted">Searching…</p>}
          {hits.length > 0 && (
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  disabled={has(h.id) || full}
                  onClick={() => {
                    onChange([...value, { target_type: type, target_id: h.id, title: h.title }]);
                    setQ('');
                  }}
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="font-medium">{h.title}</span>
                  {h.subtitle && <span className="ml-1 text-muted">· {h.subtitle}</span>}
                  {has(h.id) && <span className="ml-1 text-emerald-700">(linked)</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
