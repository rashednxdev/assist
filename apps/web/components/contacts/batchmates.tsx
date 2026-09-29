'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, Briefcase, CalendarRange, GraduationCap, Pencil, Search, Users, X } from 'lucide-react';
import { BATCH_WINDOW_MONTHS, type BatchDirectory, type BatchGroup, type BatchMembers, type ContactEmployee, type MyBatch } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { EmployeeCard } from '@/components/contacts/contact-bits';
import { Chip } from '@/components/contacts/employee-directory';
import { ServiceInfoForm } from '@/components/org/service-info-form';
import { formatDate } from '@/components/blood-bank/blood-bits';

function dateRange(g: BatchGroup): string {
  if (!g.from) return '';
  const from = formatDate(g.from);
  const to = g.to ? formatDate(g.to) : from;
  return from === to ? `Joined ${from}` : `Joined ${from} – ${to}`;
}

function groupSubtitle(g: BatchGroup): string {
  const people = `${g.count} ${g.count === 1 ? 'member' : 'members'}`;
  return g.kind === 'cadre' ? `BCS cadre batch · ${people}` : `${dateRange(g)} · ${people}`;
}

function MemberGrid({ members, emptyText }: { members: ContactEmployee[]; emptyText: string }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => [m.name, m.name_bn, m.designation?.name, m.designation?.short_name, m.office?.name, m.office?.short_name].some((s) => s?.toLowerCase().includes(q)));
  }, [members, query]);

  if (!members.length) return <p className="rounded-xl bg-slate-50 p-4 text-sm text-muted">{emptyText}</p>;
  return (
    <div className="space-y-3">
      {members.length > 9 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by name, designation or office" className="pl-9" />
        </div>
      )}
      {shown.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((m) => (
            <EmployeeCard key={m.id} e={m} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No one matches “{query}”.</p>
      )}
    </div>
  );
}

function MyBatchCard({ data, onEdit }: { data: MyBatch; onEdit: () => void }) {
  const g = data.group;
  const Icon = data.info.service_type === 'cadre' ? Award : Briefcase;
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-muted to-surface p-5 sm:flex-row sm:items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-dark">Your batch</p>
          <h2 className="text-xl font-bold">{g ? g.title : 'Not grouped yet'}</h2>
          {g && <p className="text-sm text-muted">{groupSubtitle(g)}</p>}
        </div>
        <Button variant="outline" onClick={onEdit}>
          <Pencil className="h-4 w-4" /> Edit service info
        </Button>
      </div>
      {g ? (
        <MemberGrid members={data.members} emptyText="No one else from your batch has joined yet." />
      ) : (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-muted">We could not place you in a batch. Check your service information.</p>
      )}
    </section>
  );
}

function GroupRow({ g, active, onClick }: { g: BatchGroup; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition',
        active ? 'border-primary bg-primary-muted' : 'border-border bg-surface hover:border-primary/40',
      )}
    >
      <CalendarRange className={cn('h-5 w-5 shrink-0', active ? 'text-primary' : 'text-muted')} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {g.title}
          {g.designation?.grade != null && <span className="ml-1 font-normal text-muted">· Grade {g.designation.grade}</span>}
          {g.is_mine && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">You</span>}
        </span>
        <span className="block text-xs text-muted">{dateRange(g)}</span>
      </span>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700">{g.count}</span>
    </button>
  );
}

function BrowseBatches() {
  const [dir, setDir] = useState<BatchDirectory | null>(null);
  const [kind, setKind] = useState<'cadre' | 'non_cadre'>('cadre');
  const [postFilter, setPostFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<BatchMembers | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: BatchDirectory }>('/contacts/batches')
      .then((r) => {
        setDir(r.data);
        if (!r.data.cadre.length && r.data.non_cadre.length) setKind('non_cadre');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load batches'));
  }, []);

  useEffect(() => {
    if (!selected) return setMembers(null);
    setMembers(null);
    setError('');
    apiFetch<{ data: BatchMembers }>(`/contacts/batches/${encodeURIComponent(selected)}/members`)
      .then((r) => setMembers(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load members'));
  }, [selected]);

  const posts = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of dir?.non_cadre ?? []) if (g.designation) m.set(g.designation.id, g.title);
    return [...m.entries()];
  }, [dir]);

  if (!dir) return error ? <Alert variant="error">{error}</Alert> : <Skeleton className="h-40 rounded-2xl" />;

  const cohorts = postFilter ? dir.non_cadre.filter((g) => g.designation?.id === postFilter) : dir.non_cadre;
  const toggle = (key: string) => setSelected((cur) => (cur === key ? null : key));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-2">
        <div>
          <h2 className="text-lg font-semibold">Browse batches</h2>
          <p className="text-xs text-muted">Non-cadre batches are people who joined the same post within {BATCH_WINDOW_MONTHS} months of the batch’s first joiner.</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          {(
            [
              ['cadre', 'BCS batches', dir.cadre.length],
              ['non_cadre', 'By joining post', dir.non_cadre.length],
            ] as const
          ).map(([k, label, n]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setSelected(null);
              }}
              className={cn('rounded-lg px-3 py-1.5 transition', kind === k ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground')}
            >
              {label} <span className="tabular-nums text-muted">({n})</span>
            </button>
          ))}
        </div>
      </div>

      {kind === 'cadre' &&
        (dir.cadre.length ? (
          <div className="flex flex-wrap gap-2">
            {dir.cadre.map((g) => (
              <Chip key={g.key} active={selected === g.key} onClick={() => toggle(g.key)} label={g.is_mine ? `${g.title} · You` : g.title} count={g.count} title={dateRange(g) || g.title} />
            ))}
          </div>
        ) : (
          <EmptyState title="No BCS batches yet" description="Batches appear as cadre officers add their BCS batch." />
        ))}

      {kind === 'non_cadre' &&
        (dir.non_cadre.length ? (
          <div className="space-y-3">
            {posts.length > 1 && (
              <select className="ibas-select max-w-xs" value={postFilter} onChange={(e) => setPostFilter(e.target.value)} aria-label="Filter by joining post">
                <option value="">All posts</option>
                {posts.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {cohorts.map((g) => (
                <GroupRow key={g.key} g={g} active={selected === g.key} onClick={() => toggle(g.key)} />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title="No non-cadre batches yet" description="Batches appear as members add their joining post and date." />
        ))}

      {selected && (
        <div className="space-y-3 rounded-2xl border border-border bg-slate-50/60 p-4">
          {members ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Users className="h-4 w-4 text-primary" /> {members.group.title}
                  </h3>
                  <p className="text-xs text-muted">{groupSubtitle(members.group)}</p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-1 text-muted hover:bg-slate-200" aria-label="Close batch">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <MemberGrid members={members.members} emptyText="No members to show." />
            </>
          ) : error ? (
            <Alert variant="error">{error}</Alert>
          ) : (
            <Skeleton className="h-32 rounded-xl" />
          )}
        </div>
      )}
    </section>
  );
}

export function Batchmates() {
  const [data, setData] = useState<MyBatch | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  const load = useCallback(() => {
    apiFetch<{ data: MyBatch }>('/contacts/batchmates')
      .then((r) => setData(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your batch'));
  }, []);
  useEffect(load, [load]);

  const saved = () => {
    setEditing(false);
    setVersion((v) => v + 1);
    load();
  };

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return <Skeleton className="h-48 rounded-2xl" />;

  const needsInfo = !data.info.complete;

  return (
    <div className="space-y-10">
      {needsInfo || editing ? (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{needsInfo ? 'Find your batchmates' : 'Edit service information'}</h2>
              <p className="text-sm text-muted">Tell us how you joined the service. Cadre officers are grouped by BCS batch; others by the post they joined and when.</p>
            </div>
            {editing && !needsInfo && (
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg p-1 text-muted hover:bg-slate-100" aria-label="Cancel">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <ServiceInfoForm submitLabel={needsInfo ? 'Show my batch' : 'Save'} onSaved={saved} />
        </section>
      ) : (
        <MyBatchCard data={data} onEdit={() => setEditing(true)} />
      )}
      <BrowseBatches key={version} />
    </div>
  );
}
