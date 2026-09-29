'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutList, Loader2, Rows3, Search } from 'lucide-react';
import type { ContactDesignationCount, ContactEmployee, OfficeOption } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { OfficePicker } from '@/components/org/office-picker';
import { EmployeeCard } from '@/components/contacts/contact-bits';

const PAGE = 60;

type Mode = 'all' | 'designation';

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Employee list with designation filter and grouping.
 * With `officeId` the list is scoped to that office (optionally with its sub-offices);
 * without it every employee is listed and an office filter is offered.
 */
export function EmployeeDirectory({ officeId, initialQuery = '', defaultIncludeSub = true }: { officeId?: string; initialQuery?: string; defaultIncludeSub?: boolean }) {
  const [query, setQuery] = useState(initialQuery);
  const q = useDebounced(query.trim());
  const [designationId, setDesignationId] = useState('');
  const [office, setOffice] = useState<OfficeOption | null>(null);
  const [includeSub, setIncludeSub] = useState(defaultIncludeSub);
  const [mode, setMode] = useState<Mode>('all');

  const [counts, setCounts] = useState<ContactDesignationCount[]>([]);
  const [items, setItems] = useState<ContactEmployee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  const scopeOffice = officeId ?? office?.id ?? '';

  const params = useCallback(
    (extra: Record<string, string>) => {
      const p = new URLSearchParams(extra);
      if (q) p.set('q', q);
      if (scopeOffice) {
        p.set('office_id', scopeOffice);
        p.set('include_sub', String(includeSub));
      }
      return p.toString();
    },
    [q, scopeOffice, includeSub],
  );

  useEffect(() => {
    let live = true;
    apiFetch<{ data: ContactDesignationCount[] }>(`/contacts/designations?${params({})}`)
      .then((r) => live && setCounts(r.data))
      .catch(() => live && setCounts([]));
    return () => {
      live = false;
    };
  }, [params]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    const extra: Record<string, string> = { page: '1', limit: String(mode === 'designation' ? 200 : PAGE) };
    if (designationId) extra.designation_id = designationId;
    apiFetch<{ data: ContactEmployee[]; meta: { total: number } }>(`/contacts/employees?${params(extra)}`)
      .then((r) => {
        if (!live) return;
        setItems(r.data);
        setTotal(r.meta.total);
        setPage(1);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not load employees'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [params, designationId, mode]);

  async function loadMore() {
    setMore(true);
    try {
      const limit = mode === 'designation' ? 200 : PAGE;
      const extra: Record<string, string> = { page: String(page + 1), limit: String(limit) };
      if (designationId) extra.designation_id = designationId;
      const r = await apiFetch<{ data: ContactEmployee[]; meta: { total: number } }>(`/contacts/employees?${params(extra)}`);
      setItems((cur) => [...cur, ...r.data]);
      setTotal(r.meta.total);
      setPage(page + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more');
    } finally {
      setMore(false);
    }
  }

  const allCount = useMemo(() => counts.reduce((s, c) => s + c.count, 0), [counts]);

  const groups = useMemo(() => {
    if (mode !== 'designation') return [];
    const out: Array<{ key: string; title: string; grade: number | null; people: ContactEmployee[] }> = [];
    const index = new Map<string, number>();
    for (const e of items) {
      const key = e.designation?.id ?? 'none';
      let i = index.get(key);
      if (i === undefined) {
        i = out.length;
        index.set(key, i);
        out.push({ key, title: e.designation?.name ?? 'No designation', grade: e.designation?.grade ?? null, people: [] });
      }
      out[i]!.people.push(e);
    }
    return out;
  }, [items, mode]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, designation, office, email or number" className="pl-9" />
        </div>
        {!officeId && (
          <div className="lg:w-72">
            <OfficePicker value={office} onChange={setOffice} placeholder="Filter by office" />
          </div>
        )}
        {scopeOffice && (
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-border" checked={includeSub} onChange={(e) => setIncludeSub(e.target.checked)} />
            Include sub-office staff
          </label>
        )}
        <div className="inline-flex shrink-0 rounded-lg border border-border p-0.5">
          {(
            [
              ['all', 'All', LayoutList],
              ['designation', 'By designation', Rows3],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition', mode === m ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-foreground')}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {counts.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip active={!designationId} onClick={() => setDesignationId('')} label="All designations" count={allCount} />
          {counts.map((c) => (
            <Chip key={c.id} active={designationId === c.id} onClick={() => setDesignationId(designationId === c.id ? '' : c.id)} label={c.short_name || c.name} title={c.name} count={c.count} />
          ))}
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No employees found" description={q || designationId ? 'Try another search or designation.' : 'Nobody has added this office to their profile yet.'} />
      ) : (
        <>
          <p className="text-sm text-muted">
            Showing {items.length} of {total} {total === 1 ? 'person' : 'people'}
          </p>
          {mode === 'all' ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((e) => (
                <EmployeeCard key={e.id} e={e} showOffice={!officeId || includeSub} />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <section key={g.key} className="space-y-3">
                  <h3 className="flex items-center gap-2 border-b border-border pb-2 text-sm font-semibold">
                    {g.title}
                    {g.grade && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Grade {g.grade}</span>}
                    <span className="ml-auto rounded-full bg-primary-muted px-2 py-0.5 text-xs text-primary-dark">{g.people.length}</span>
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {g.people.map((e) => (
                      <EmployeeCard key={e.id} e={e} showOffice={!officeId || includeSub} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
          {items.length < total && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={more}>
                {more && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more ({total - items.length} left)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Chip({ active, onClick, label, count, title }: { active: boolean; onClick: () => void; label: string; count?: number; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition',
        active ? 'border-primary bg-primary text-white shadow-sm' : 'border-border bg-surface text-foreground hover:border-primary/40 hover:text-primary-dark',
      )}
    >
      {label}
      {count !== undefined && <span className={cn('rounded-full px-1.5 text-[10px]', active ? 'bg-white/25' : 'bg-slate-100 text-slate-600')}>{count}</span>}
    </button>
  );
}
