'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronsUpDown, Loader2, Search, X } from 'lucide-react';
import type { OfficeOption } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export function officeLabel(o: Pick<OfficeOption, 'name' | 'short_name'>): string {
  return o.short_name && o.short_name !== o.name ? `${o.name} (${o.short_name})` : o.name;
}

/** Searchable office combobox; matches office names, short names, codes and parent offices. */
export function OfficePicker({
  value,
  onChange,
  placeholder = 'Search your office…',
  excludeId,
  allowClear,
  id,
  disabled,
}: {
  value: OfficeOption | null;
  onChange: (o: OfficeOption | null) => void;
  placeholder?: string;
  /** Hide this office (e.g. when choosing a parent for itself). */
  excludeId?: string;
  allowClear?: boolean;
  id?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<OfficeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      apiFetch<{ data: OfficeOption[] }>(`/org/offices/options?limit=40&q=${encodeURIComponent(q)}`)
        .then((r) => {
          if (!alive) return;
          setOptions(r.data.filter((o) => o.id !== excludeId));
          setActive(0);
        })
        .catch(() => alive && setOptions([]))
        .finally(() => alive && setLoading(false));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, open, excludeId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function pick(o: OfficeOption) {
    onChange(o);
    setOpen(false);
    setQ('');
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = options[active];
      if (o) pick(o);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((v) => !v);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Building2 className="h-4 w-4 shrink-0 text-muted" />
        {value ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{officeLabel(value)}</span>
            {value.parent_path && <span className="block truncate text-xs text-muted">{value.parent_path}</span>}
          </span>
        ) : (
          <span className="flex-1 text-muted-foreground">{placeholder}</span>
        )}
        {allowClear && value ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                onChange(null);
              }
            }}
            className="rounded p-0.5 text-muted hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </span>
        ) : (
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="relative border-b border-border">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
              placeholder="Type office name, short name or code…"
              className="h-10 w-full bg-transparent pl-9 pr-9 text-sm outline-none"
            />
            {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />}
          </div>
          <ul className="max-h-72 overflow-y-auto py-1" role="listbox">
            {!loading && options.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted">No office found. Ask an admin to add it.</li>
            )}
            {options.map((o, i) => (
              <li key={o.id} role="option" aria-selected={value?.id === o.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  className={cn('flex w-full items-start gap-2 px-3 py-2 text-left text-sm', i === active && 'bg-slate-50')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {officeLabel(o)}
                      {o.type_short && <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-600">{o.type_short}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {[o.parent_path || 'Top-level office', o.office_code].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {value?.id === o.id && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
