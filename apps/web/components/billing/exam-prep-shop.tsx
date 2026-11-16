'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCircle2, Layers, Loader2, ShoppingCart, Sparkles, X } from 'lucide-react';
import {
  computeCartCharge,
  formatBdt,
  MAX_SUBJECTS_PER_ENROLLMENT,
  roundTaka,
  subjectBundleQuote,
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
import { PackageCopy } from '@/components/billing/package-copy';

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

function packageSubjectIds(p: AccessPackageRecord): string[] {
  if (p.exam_subject_ids && p.exam_subject_ids.length > 0) return p.exam_subject_ids;
  return p.exam_subject_id ? [p.exam_subject_id] : [];
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
      .filter((p) => packageSubjectIds(p).length === 0 && (p.exam_part_id ? p.exam_part_id === group.id : group.isPrimary))
      .sort(byDuration);
  }, [packages, group]);

  const subjects = useMemo<SubjectRow[]>(() => {
    if (!group) return [];
    const rows = new Map<string, SubjectRow>();
    for (const p of packages) {
      const ids = packageSubjectIds(p);
      if (ids.length !== 1) continue;
      if (p.exam_part_id ? p.exam_part_id !== group.id : !group.isPrimary) continue;
      const subjectId = ids[0]!;
      const row = rows.get(subjectId) ?? { id: subjectId, name: p.exam_subject_names?.[0] || p.exam_subject_name || 'Subject', packages: [] };
      row.packages.push(p);
      rows.set(subjectId, row);
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
  const quote = useMemo(
    () =>
      subjectBundleQuote(
        chosen.map((p) => ({
          id: p.id,
          partId: p.exam_part_id || (packageSubjectIds(p).length === 1 ? 'part' : ''),
          price: p.price,
          subjects: packageSubjectIds(p).length,
        })),
        catalog.settings,
      ),
    [chosen, catalog.settings],
  );
  const subtotal = quote.payable;
  const charge = computeCartCharge(
    chosen.map((p) => quote.priceById[p.id] ?? p.price),
    catalog.settings,
  );
  const total = roundTaka(subtotal + charge);
  const paused = !catalog.settings.gateway_enabled && subtotal > 0;

  const combos = useMemo(() => {
    if (!group) return [];
    return packages
      .filter((p) => packageSubjectIds(p).length > 1 && (p.exam_part_id ? p.exam_part_id === group.id : group.isPrimary))
      .sort(byDuration);
  }, [packages, group]);

  function alreadyOwned(p: AccessPackageRecord): boolean {
    if (!group) return false;
    const ids = packageSubjectIds(p);
    if (partUntil(group.id)) return ids.length === 0 || ids.some((id) => subjectUntil(group.id, id));
    if (ids.length === 0) return subjects.some((s) => subjectUntil(group.id, s.id));
    return ids.some((id) => subjectUntil(group.id, id));
  }

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

  function partOf(pkg: AccessPackageRecord): string {
    return pkg.exam_part_id || (packageSubjectIds(pkg).length === 1 ? 'part' : '');
  }

  function selectedInPart(partId: string, current: Record<string, string>, exceptKey?: string): number {
    return Object.entries(current).filter(([key, id]) => {
      if (key === exceptKey) return false;
      const pkg = byId.get(id);
      return !!pkg && packageSubjectIds(pkg).length === 1 && partOf(pkg) === partId;
    }).length;
  }

  function toggleSubject(subjectId: string, pkg: AccessPackageRecord) {
    const key = subjectKey(subjectId);
    if (picked[key] === pkg.id) {
      setError('');
      setPicked((cur) => {
        const next = { ...cur };
        delete next[key];
        return next;
      });
      return;
    }
    if (picked[key] == null && selectedInPart(partOf(pkg), picked) >= MAX_SUBJECTS_PER_ENROLLMENT) {
      setError('You can enroll up to 4 subjects of one part at a time. Enroll the rest later.');
      return;
    }
    setError('');
    setPicked((cur) => ({ ...cur, [key]: pkg.id }));
  }

  function pickAllSubjects() {
    if (!group) return;
    const sample = subjects.find((s) => s.packages[0] && !subjectUntil(group.id, s.id))?.packages[0];
    if (!sample) return;
    const partId = partOf(sample);
    setError('');
    setPicked((cur) => {
      const next = { ...cur };
      let n = selectedInPart(partId, next);
      for (const s of subjects) {
        if (n >= MAX_SUBJECTS_PER_ENROLLMENT) break;
        if (subjectUntil(group.id, s.id)) continue;
        const key = subjectKey(s.id);
        if (!next[key] && s.packages[0]) {
          next[key] = s.packages[0].id;
          n += 1;
        }
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
                    <PackageCopy description={p.description} features={p.features} />
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{p.price === 0 ? 'Free' : formatBdt(p.price)}</span>
                      {p.compare_at_price ? (
                        <span className="text-sm text-muted line-through">{formatBdt(p.compare_at_price)}</span>
                      ) : null}
                      <span className="text-sm text-muted">/ {durationLabel(p.duration_days)}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    <Button
                      className="mt-auto w-full"
                      variant={on ? 'outline' : 'default'}
                      disabled={!catalog.can_request || alreadyOwned(p)}
                      onClick={() => toggleBundle(p)}
                    >
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

      {combos.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Subject packages</h2>
            <p className="text-sm text-muted">
              A package can include more than one subject. If you already have any of those subjects, it cannot be selected again.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {combos.map((p) => {
              const on = picked[p.id] === p.id;
              const owned = alreadyOwned(p);
              return (
                <Card key={p.id} className={cn('flex flex-col', on && 'ring-2 ring-primary', owned && 'opacity-60')}>
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    <p className="text-sm text-muted">{(p.exam_subject_names ?? []).filter(Boolean).join(', ')}</p>
                    <PackageCopy description={p.description} features={p.features} />
                    <p className="text-2xl font-bold">{p.price === 0 ? 'Free' : formatBdt(p.price)}</p>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      variant={on ? 'outline' : 'default'}
                      disabled={!catalog.can_request || owned}
                      onClick={() =>
                        setPicked((cur) => {
                          const next = { ...cur };
                          if (next[p.id] === p.id) delete next[p.id];
                          else next[p.id] = p.id;
                          return next;
                        })
                      }
                    >
                      {owned ? 'Already included' : on ? 'Remove from basket' : 'Add to basket'}
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
                Tick the subjects you need. One subject stays at full price. Together, 2 subjects of this part are{' '}
                {catalog.settings.subject_discount_2}% less, 3 are {catalog.settings.subject_discount_3}% less, and 4 are{' '}
                {catalog.settings.subject_discount_4}% less. A subject you already have cannot be selected again.
              </p>
            </div>
            {!bundlePicked && subjects.length > 1 && pickedInGroup < Math.min(MAX_SUBJECTS_PER_ENROLLMENT, subjects.length) && (
              <Button variant="outline" size="sm" onClick={pickAllSubjects}>
                Select up to {MAX_SUBJECTS_PER_ENROLLMENT}
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
                      <PackageCopy
                        description={s.packages.find((p) => p.description?.trim())?.description}
                        features={[...new Set(s.packages.flatMap((p) => p.features))]}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {s.packages.map((p) => {
                        const on = sel === p.id;
                        const atCap = !sel && selectedInPart(partOf(p), picked) >= MAX_SUBJECTS_PER_ENROLLMENT;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={!!bundlePicked || !catalog.can_request || !!until || atCap}
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
                {quote.saving > 0 ? (
                  <>
                    <span className="line-through">{formatBdt(quote.full)}</span> {formatBdt(subtotal)} ({formatBdt(quote.saving)} less)
                  </>
                ) : (
                  formatBdt(subtotal)
                )}
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
                {total === 0 ? 'Get it free' : `Continue · ${formatBdt(total)}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
