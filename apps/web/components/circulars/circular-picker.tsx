'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { CircularRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Input } from '@/components/ui/input';

export interface CircularTag {
  id: string;
  circular_no: string;
  title: string;
}

export function CircularPicker({
  value,
  onChange,
  max = 20,
  disabled,
}: {
  value: CircularTag[];
  onChange: (next: CircularTag[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<CircularTag[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = text.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      apiFetch<{ data: CircularRecord[] }>(`/circulars?q=${encodeURIComponent(term)}&limit=8&include_unpublished=true`)
        .then((r) => setResults(r.data.map((c) => ({ id: c.id, circular_no: c.circular_no, title: c.title }))))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [text]);

  const picked = new Set(value.map((c) => c.id));
  const full = value.length >= max;

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((c) => (
            <span
              key={c.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
            >
              <span className="truncate">
                {c.circular_no} · {c.title}
              </span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${c.circular_no}`}
                onClick={() => onChange(value.filter((v) => v.id !== c.id))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={text}
          disabled={disabled || full}
          onChange={(e) => setText(e.target.value)}
          placeholder={full ? `Up to ${max} circulars` : 'Search circulars by number, title or tag…'}
          className="pl-9"
        />
      </div>
      {text.trim().length >= 2 && (
        <div className="max-h-56 overflow-y-auto rounded-md border border-border">
          {loading ? (
            <p className="px-3 py-2 text-sm text-muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">No circulars match.</p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={disabled || full || picked.has(c.id)}
                onClick={() => {
                  onChange([...value, c]);
                  setText('');
                }}
                className="flex w-full items-start gap-2 border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50 disabled:opacity-50"
              >
                <span className="shrink-0 font-medium">{c.circular_no}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{c.title}</span>
                {picked.has(c.id) && <span className="text-xs text-primary">Tagged</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
