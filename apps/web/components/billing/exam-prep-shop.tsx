'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCircle2, Layers, Loader2, ShoppingCart, Sparkles, X } from 'lucide-react';
import {
  computeCartCharge,
  formatBdt,
  roundTaka,
  type AccessPackageRecord,
  type BillingCatalog,
  type CartRecord,
  type ExamPrepPartOption,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { accessDate, durationLabel } from '@/lib/billing-format';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';

interface Group {
  id: string;
  label: string;
  isPrimary: boolean;
  subjectOrder: string[];
}

interface SubjectRow {
  id: string;
  name: string;
  packages: AccessPackageRecord[];
}

const LEGACY_GROUP = 'legacy';

function bundleKey(groupId: string): string {
  return `bundle|${groupId}`;
}

function subjectKey(subjectId: string): string {
  return `subject|${subjectId}`;
}

function byDuration(a: AccessPackageRecord, b: AccessPackageRecord): number {
  return a.duration_days - b.duration_days || a.price - b.price;
}

function later(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function buildGroups(parts: ExamPrepPartOption[], packages: AccessPackageRecord[]): Group[] {
  if (parts.length > 0) {
    return parts.map((p) => ({ id: p.id, label: p.label, isPrimary: p.is_primary, subjectOrder: p.subjects.map((s) => s.id) }));
  }
  const groups = new Map<string, Group>();
  for (const p of packages) {
    const id = p.exam_part_id ?? LEGACY_GROUP;
    if (!groups.has(id)) {
      groups.set(id, { id, label: p.exam_part_name ?? 'All subjects', isPrimary: !p.exam_part_id, subjectOrder: [] });
    }
  }
  return [...groups.values()];
}

export function ExamPrepShop({ catalog }: { catalog: BillingCatalog }) {
  const router = useRouter();
  const [parts, setParts] = useState<ExamPrepPartOption[] | null>(null);
  const [active, setActive] = useState('');
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const packages = useMemo(() => catalog.packages.filter((p) => p.kind === 'exam_prep'), [catalog]);

  useEffect(() => {
    apiFetch<{ data: { parts: ExamPrepPartOption[]; selected_part_id: string | null } }>('/exam-prep/parts')
      .then((r) => {
        setParts(r.data.parts);
        if (r.data.selected_part_id) setActive(r.data.selected_part_id);
      })
      .catch(() => setParts([]));
  }, []);

  const groups = useMemo(() => {
    const all = buildGroups(parts ?? [], packages);
    return all.filter((g) =>
      packages.some((p) => (p.scope === 'legacy' || !p.exam_part_id ? g.isPrimary : p.exam_part_id === g.id)),
    );
  }, [parts, packages]);

  const group = groups.find((g) => g.id === active) ?? groups[0];

  const bundles = useMemo(() => {
    if (!group) return [];
    return packages
      .filter((p) => !p.exam_subject_id && (p.exam_part_id ? p.exam_part_id === group.id : group.isPrimary))
      .sort(byDuration);
  }, [packages, group]);

  const subjects = useMemo<SubjectRow[]>(() => {
    if (!group) return [];
    const rows = new Map<string, SubjectRow>();
    for (const p of packages) {
      if (!p.exam_subject_id) continue;
      if (p.exam_part_id ? p.exam_part_id !== group.id : !group.isPrimary) continue;
      const row = rows.get(p.exam_subject_id) ?? { id: p.exam_subject_id, name: p.exam_subject_name ?? 'Subject', packages: [] };
      row.packages.push(p);
      rows.set(p.exam_subject_id, row);
    }
    const rank = (id: string) => {
      const i = group.subjectOrder.indexOf(id);
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...rows.values()]
      .map((r) => ({ ...r, packages: r.packages.sort(byDuration) }))
      .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
  }, [packages, group]);

  const access = catalog.access.exam_prep_access;
  const partUntil = (groupId: string) =>
    access.filter((a) => a.exam_part_id === groupId && !a.exam_subject_id).reduce<string | undefined>((m, a) => later(m, a.until), undefined);
  const subjectUntil = (groupId: string, subjectId: string) =>
    later(
      partUntil(groupId),
      access.filter((a) => a.exam_subject_id === subjectId).reduce<string | undefined>((m, a) => later(m, a.until), undefined),
    );

  const byId = useMemo(() => new Map(packages.map((p) => [p.id, p])), [packages]);
  const chosen = useMemo(
    () => [...new Set(Object.values(picked))].map((id) => byId.get(id)).filter((p): p is AccessPackageRecord => !!p),
    [picked, byId],
  );
  const subtotal = roundTaka(chosen.reduce((s, p) => s + p.price, 0));
  const charge = computeCartCharge(
    chosen.map((p) => p.price),
    catalog.settings,
  );
  const total = roundTaka(subtotal + charge);
  const paused = !catalog.settings.gateway_enabled && subtotal > 0;

  const bundlePicked = group ? picked[bundleKey(group.id)] : undefined;

  function toggleBundle(pkg: AccessPackageRecord) {
    if (!group) return;
    setError('');
    setPicked((cur) => {
      const next = { ...cur };
      const key = bundleKey(group.id);
      if (next[key] === pkg.id) {
        delete next[key];
        return next;
      }
      next[key] = pkg.id;
      for (const s of subjects) delete next[subjectKey(s.id)];
      return next;
    });
  }

  function toggleSubject(subjectId: string, pkg: AccessPackageRecord) {
    setError('');
    setPicked((cur) => {
      const next = { ...cur };
      const key = subjectKey(subjectId);
      if (next[key] === pkg.id) delete next[key];
      else next[key] = pkg.id;
      return next;
    });
  }

  function pickAllSubjects() {
    setError('');
    setPicked((cur) => {
      const next = { ...cur };
      for (const s of subjects) {
        if (!next[subjectKey(s.id)]) next[subjectKey(s.id)] = s.packages[0]!.id;
      }
      return next;
    });
  }

  async function checkout() {
    if (chosen.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const r = await apiFetch<{ data: CartRecord }>('/billing/carts', {
        method: 'POST',
        body: JSON.stringify({ package_ids: chosen.map((p) => p.id) }),
      });
      router.push(`/checkout/cart/${r.data.cart_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the payment');
      setBusy(false);
    }
  }

  function bundleSaving(pkg: AccessPackageRecord): number {
    if (subjects.length < 2) return 0;
    let sum = 0;
    for (const s of subjects) {
      const same = s.packages.find((p) => p.duration_days === pkg.duration_days);
      if (!same) return 0;
      sum += same.price;
    }
    return roundTaka(sum - pkg.price);
  }

  if (!group) return null;

  const ownedSubjects = subjects.filter((s) => subjectUntil(group.id, s.id)).length;
  const groupUntil = partUntil(group.id);
  const pickedInGroup = subjects.filter((s) => picked[subjectKey(s.id)]).length;

  return (
    <div className="space-y-6 pb-28">
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => {
            const count =
              (picked[bundleKey(g.id)] ? 1 : 0) +
              Object.keys(picked).filter((k) => {
                if (!k.startsWith('subject|')) return false;
                const p = byId.get(picked[k]!);
                return p ? (p.exam_part_id ? p.exam_part_id === g.id : g.isPrimary) : false;
              }).length;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setActive(g.id)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors',
                  g.id === group.id ? 'border-primary bg-primary text-white' : 'border-border bg-surface hover:bg-slate-50',
                )}
              >
                <Layers className="h-4 w-4" />
                {g.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-xs',
                      g.id === group.id ? 'bg-white/25 text-white' : 'bg-primary-muted text-primary-dark',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {groupUntil ? (
        <Alert variant="success">
          <CheckCircle2 className="mr-1 inline h-4 w-4" />
          You have every subject of <strong>{group.label}</strong> until <strong>{accessDate(groupUntil)}</strong>. Buying again
          extends it.
        </Alert>
      ) : ownedSubjects > 0 ? (
        <Alert variant="success">
          <CheckCircle2 className="mr-1 inline h-4 w-4" />
          You own {ownedSubjects} of {subjects.length} subject{subjects.length === 1 ? '' : 's'} in {group.label}.
        </Alert>
      ) : null}

      {bundles.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Whole {group.label}</h2>
            <p className="text-sm text-muted">One package that opens every subject of {group.label}.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bundles.map((p) => {
              const on = bundlePicked === p.id;
              const save = bundleSaving(p);
              return (
                <Card key={p.id} className={cn('flex flex-col', on ? 'ring-2 ring-primary' : p.is_featured && 'ring-1 ring-primary/40')}>
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.is_featured && (
                        <Badge>
                          <Sparkles className="mr-1 h-3 w-3" />
                          Popular
                        </Badge>
                      )}
                      {save > 0 && <Badge variant="success">Save {formatBdt(save)}</Badge>}
                      {p.scope === 'legacy' && <Badge variant="secondary">All subjects</Badge>}
                    </div>
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{p.price === 0 ? 'Free' : formatBdt(p.price)}</span>
                      {p.compare_at_price ? (
                        <span className="text-sm text-muted line-through">{formatBdt(p.compare_at_price)}</span>
                      ) : null}
                      <span className="text-sm text-muted">/ {durationLabel(p.duration_days)}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    {p.description && <p className="whitespace-pre-line text-sm text-muted">{p.description}</p>}
                    {p.features.length > 0 && (
                      <ul className="space-y-1.5 text-sm">
                        {p.features.map((f) => (
                          <li key={f} className="flex gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button className="mt-auto w-full" variant={on ? 'outline' : 'default'} onClick={() => toggleBundle(p)}>
                      {on ? (
                        <>
                          <X className="h-4 w-4" />
                          Remove from basket
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-4 w-4" />
                          {groupUntil ? 'Extend' : 'Add to basket'}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {subjects.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{bundles.length > 0 ? 'Or pick subjects' : `Subjects of ${group.label}`}</h2>
              <p className="text-sm text-muted">
                Tick the subjects you need — you only see questions, papers and reviews of the subjects you own.
              </p>
            </div>
            {!bundlePicked && subjects.length > 1 && pickedInGroup < subjects.length && (
              <Button variant="outline" size="sm" onClick={pickAllSubjects}>
                Select all subjects
              </Button>
            )}
          </div>
          {bundlePicked && (
            <Alert variant="info">Every subject is included in the whole-part package in your basket.</Alert>
          )}
          <Card>
            <ul className="divide-y divide-border">
              {subjects.map((s) => {
                const until = subjectUntil(group.id, s.id);
                const sel = picked[subjectKey(s.id)];
                return (
                  <li
                    key={s.id}
                    className={cn('flex flex-col gap-3 p-4 sm:flex-row sm:items-center', bundlePicked && 'opacity-50')}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {sel && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        {s.name}
                        {until && <Badge variant="success">Active until {accessDate(until)}</Badge>}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {s.packages.map((p) => {
                        const on = sel === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={!!bundlePicked}
                            onClick={() => toggleSubject(s.id, p)}
                            aria-pressed={on}
                            className={cn(
                              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed',
                              on
                                ? 'border-primary bg-primary text-white'
                                : 'border-border bg-surface hover:border-primary hover:bg-primary-muted/40',
                            )}
                          >
                            {on && <Check className="h-3.5 w-3.5" />}
                            <span className="font-semibold">{p.price === 0 ? 'Free' : formatBdt(p.price)}</span>
                            <span className={on ? 'text-white/80' : 'text-muted'}>/ {durationLabel(p.duration_days)}</span>
                            {p.compare_at_price ? (
                              <span className={cn('text-xs line-through', on ? 'text-white/70' : 'text-muted')}>
                                {formatBdt(p.compare_at_price)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}

      <p className="text-xs text-muted">
        Access starts today, or when your current access to the same subject or part ends. Live classes are sold separately in
        the Live class tab; Question of the Day stays free.
      </p>

      {chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">
                {chosen.length} package{chosen.length === 1 ? '' : 's'} in basket
              </p>
              <p className="truncate text-muted">
                {formatBdt(subtotal)}
                {charge > 0 ? ` + ${catalog.settings.charge_label} ${formatBdt(charge)}` : ''} ·{' '}
                {chosen.map((p) => p.exam_subject_name ?? p.exam_part_name ?? p.name).join(', ')}
              </p>
              {error && <p className="text-destructive">{error}</p>}
              {paused && <p className="text-destructive">Online payments are paused right now.</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setPicked({})}>
                Clear
              </Button>
              <Button
                className="bg-[#e2136e] text-white hover:bg-[#c10f5d]"
                disabled={busy || paused}
                onClick={checkout}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {total === 0 ? 'Get it free' : `Pay ${formatBdt(total)} with bKash`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
