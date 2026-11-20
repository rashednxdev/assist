'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { toBanglaDigits } from '@/lib/bangla-format';
import { cn } from '@/lib/utils';
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

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

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
      groups.set(id, { id, label: p.exam_part_name ?? 'সকল বিষয়', isPrimary: !p.exam_part_id, subjectOrder: [] });
    }
  }
  return [...groups.values()];
}

export function ExamPrepShop({
  catalog,
  focusSubjectId,
}: {
  catalog: BillingCatalog;
  focusSubjectId?: string;
}) {
  const router = useRouter();
  const [parts, setParts] = useState<ExamPrepPartOption[] | null>(null);
  const [active, setActive] = useState('');
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const didAutoFocus = useRef(false);

  const packages = useMemo(() => catalog.packages.filter((p) => p.kind === 'exam_prep'), [catalog]);

  useEffect(() => {
    apiFetch<{ data: { parts: ExamPrepPartOption[]; selected_part_id: string | null } }>('/exam-prep/parts')
      .then((r) => {
        setParts(r.data.parts);
        if (focusSubjectId) {
          const hit = r.data.parts.find((p) => p.subjects.some((s) => s.id === focusSubjectId));
          if (hit) {
            setActive(hit.id);
            return;
          }
        }
        if (r.data.selected_part_id) setActive(r.data.selected_part_id);
      })
      .catch(() => setParts([]));
  }, [focusSubjectId]);

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
      const row = rows.get(subjectId) ?? { id: subjectId, name: p.exam_subject_names?.[0] || p.exam_subject_name || 'বিষয়', packages: [] };
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

  // Pre-select the requested subject's first package if navigated from Subject Summary
  useEffect(() => {
    if (!focusSubjectId || didAutoFocus.current || !group || !catalog.can_request) return;
    const row = subjects.find((s) => s.id === focusSubjectId);
    if (row && row.packages[0] && !subjectUntil(group.id, row.id)) {
      didAutoFocus.current = true;
      setPicked((cur) => ({ ...cur, [subjectKey(row.id)]: row.packages[0]!.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSubjectId, group, subjects, catalog.can_request]);

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
      setError('একবারে একটি পার্টের সর্বোচ্চ ৪টি বিষয়ে এনরোল করা যাবে। বাকিগুলো পরে নেওয়া যাবে।');
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
      setError(e instanceof Error ? e.message : 'চেকআউট শুরু করা যায়নি');
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
      {groups.length > 1 ? (
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
                  'flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-colors',
                  g.id === group.id
                    ? 'border-[#1566b8] bg-[#1566b8] text-white'
                    : 'border-[#d7e4ee] bg-white text-[#0a2f5b] hover:border-[#1566b8]',
                )}
              >
                <Layers className="h-4 w-4" />
                {g.label}
                {count > 0 ? (
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[11px]',
                      g.id === group.id ? 'bg-white/25 text-white' : 'bg-[#eaf3fc] text-[#1566b8]',
                    )}
                  >
                    {bn(count)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {groupUntil ? (
        <Alert variant="success">
          <CheckCircle2 className="mr-1 inline h-4 w-4" />
          আপনার <strong>{group.label}</strong>-এর সকল বিষয়ে <strong>{accessDate(groupUntil)}</strong> পর্যন্ত অ্যাক্সেস চালু আছে।
        </Alert>
      ) : ownedSubjects > 0 ? (
        <Alert variant="success">
          <CheckCircle2 className="mr-1 inline h-4 w-4" />
          {group.label}-এর {bn(subjects.length)}টির মধ্যে {bn(ownedSubjects)}টি বিষয়ে আপনার অ্যাক্সেস চালু আছে।
        </Alert>
      ) : null}

      {bundles.length > 0 ? (
        <section className="space-y-3.5">
          <div>
            <h2 className="text-lg font-bold text-[#0a2f5b]">পূর্ণ পার্ট প্যাকেজ · {group.label}</h2>
            <p className="text-xs text-slate-600">{group.label}-এর সকল বিষয় একত্রে আনলক হবে।</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bundles.map((p) => {
              const on = bundlePicked === p.id;
              const save = bundleSaving(p);
              return (
                <div
                  key={p.id}
                  className={cn(
                    'flex flex-col overflow-hidden rounded-2xl border border-[#d7e4ee] bg-white shadow-xs transition',
                    on ? 'ring-2 ring-[#1566b8]' : p.is_featured && 'ring-1 ring-[#1566b8]/40',
                  )}
                >
                  <div className="flex h-20 items-center justify-between bg-[#0a2f5b] px-5 text-white">
                    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
                      পূর্ণ পার্ট
                    </span>
                    <div className="flex items-center gap-1.5">
                      {p.is_featured ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#1566b8] px-2.5 py-0.5 text-[11px] font-semibold">
                          <Sparkles className="h-3 w-3" />
                          জনপ্রিয়
                        </span>
                      ) : null}
                      {save > 0 ? (
                        <span className="rounded-full bg-[#e8f8ef] px-2.5 py-0.5 text-[11px] font-bold text-[#156f4d]">
                          সাশ্রয় {formatBdt(save)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-[#0a2f5b]">{p.name_bn?.trim() || p.name}</h3>
                      <PackageCopy description={p.description} features={p.features} />
                    </div>
                    <div className="mt-4 space-y-3 border-t border-[#eef4f9] pt-3.5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-[#0a2f5b]">
                          {p.price === 0 ? 'ফ্রি' : formatBdt(p.price)}
                        </span>
                        {p.compare_at_price ? (
                          <span className="text-xs text-slate-400 line-through">{formatBdt(p.compare_at_price)}</span>
                        ) : null}
                        <span className="text-xs text-slate-500">/ {durationLabel(p.duration_days)}</span>
                      </div>
                      <Button
                        className={cn(
                          'w-full rounded-xl',
                          !on && 'bg-[#1566b8] hover:bg-[#0f5294]',
                        )}
                        variant={on ? 'outline' : 'default'}
                        disabled={!catalog.can_request || alreadyOwned(p)}
                        onClick={() => toggleBundle(p)}
                      >
                        {on ? (
                          <>
                            <X className="h-4 w-4" />
                            তালিকা থেকে সরান
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="h-4 w-4" />
                            {groupUntil ? 'মেয়াদ বাড়ান' : 'তালিকায় যুক্ত করুন'}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {combos.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-[#0a2f5b]">যৌথ বিষয় প্যাকেজ</h2>
            <p className="text-xs text-slate-600">একাধিক বিষয় একত্রে যুক্ত প্যাকেজসমূহ।</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {combos.map((p) => {
              const on = picked[p.id] === p.id;
              const owned = alreadyOwned(p);
              return (
                <div
                  key={p.id}
                  className={cn(
                    'flex flex-col justify-between rounded-2xl border border-[#d7e4ee] bg-white p-5',
                    on && 'ring-2 ring-[#1566b8]',
                    owned && 'opacity-60',
                  )}
                >
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-[#0a2f5b]">{p.name_bn?.trim() || p.name}</h3>
                    <p className="text-xs text-slate-500">{(p.exam_subject_names ?? []).filter(Boolean).join(', ')}</p>
                    <PackageCopy description={p.description} features={p.features} />
                  </div>
                  <div className="mt-4 space-y-3 border-t border-[#eef4f9] pt-3">
                    <p className="text-2xl font-extrabold text-[#0a2f5b]">{p.price === 0 ? 'ফ্রি' : formatBdt(p.price)}</p>
                    <Button
                      className={cn('w-full rounded-xl', !on && 'bg-[#1566b8] hover:bg-[#0f5294]')}
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
                      {owned ? 'ইতোমধ্যে এনরোল করা' : on ? 'তালিকা থেকে সরান' : 'তালিকায় যুক্ত করুন'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {subjects.length > 0 ? (
        <section className="space-y-3.5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[#0a2f5b]">
                {bundles.length > 0 ? 'অথবা আলাদা বিষয় বেছে নিন' : `${group.label}-এর বিষয়সমূহ`}
              </h2>
              <p className="text-xs text-slate-600">
                প্রয়োজনীয় বিষয় টিক দিন। একসাথে ২টি বিষয়ে {bn(catalog.settings.subject_discount_2)}% ছাড়
                {catalog.settings.subject_discount_3 > 0 ? `, ৩টিতে ${bn(catalog.settings.subject_discount_3)}% ছাড়` : ''}
                {catalog.settings.subject_discount_4 > 0 ? `, ৪টিতে ${bn(catalog.settings.subject_discount_4)}% ছাড়` : ''}।
              </p>
            </div>
            {!bundlePicked && subjects.length > 1 && pickedInGroup < Math.min(MAX_SUBJECTS_PER_ENROLLMENT, subjects.length) ? (
              <Button variant="outline" size="sm" className="rounded-xl border-[#1566b8] text-[#1566b8]" onClick={pickAllSubjects}>
                সর্বোচ্চ {bn(MAX_SUBJECTS_PER_ENROLLMENT)}টি বেছে নিন
              </Button>
            ) : null}
          </div>

          {bundlePicked ? (
            <Alert variant="info">আপনার নির্বাচিত পূর্ণ পার্ট প্যাকেজে সকল বিষয় ইতোমধ্যে অন্তর্ভুক্ত রয়েছে।</Alert>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-[#d7e4ee] bg-white shadow-xs">
            <ul className="divide-y divide-[#eef4f9]">
              {subjects.map((s) => {
                const until = subjectUntil(group.id, s.id);
                const sel = picked[subjectKey(s.id)];
                const isFocused = focusSubjectId === s.id;
                return (
                  <li
                    key={s.id}
                    className={cn(
                      'flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5',
                      bundlePicked && 'opacity-50',
                      isFocused && 'bg-[#f4f9fd]',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 font-bold text-[#0a2f5b]">
                        {sel ? <CheckCircle2 className="h-4 w-4 text-[#1566b8]" /> : null}
                        <span>{s.name}</span>
                        {until ? <Badge variant="success">চালু ({accessDate(until)} পর্যন্ত)</Badge> : null}
                      </div>
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
                              'flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                              on
                                ? 'border-[#1566b8] bg-[#1566b8] text-white'
                                : 'border-[#d7e4ee] bg-[#f4f9fd] text-[#0a2f5b] hover:border-[#1566b8]',
                            )}
                          >
                            {on ? <Check className="h-3.5 w-3.5" /> : null}
                            <span className="font-bold">{p.price === 0 ? 'ফ্রি' : formatBdt(p.price)}</span>
                            <span className={on ? 'text-white/80' : 'text-slate-500'}>/ {durationLabel(p.duration_days)}</span>
                            {p.compare_at_price ? (
                              <span className={cn('text-[11px] line-through', on ? 'text-white/70' : 'text-slate-400')}>
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
          </div>
        </section>
      ) : null}

      {chosen.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d7e4ee] bg-white/95 shadow-[0_-4px_20px_rgba(10,47,91,0.08)] backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-bold text-[#0a2f5b]">{bn(chosen.length)}টি প্যাকেজ নির্বাচিত</p>
              <p className="truncate text-xs text-slate-600">
                {quote.saving > 0 ? (
                  <>
                    <span className="line-through">{formatBdt(quote.full)}</span> {formatBdt(subtotal)} ({formatBdt(quote.saving)} সাশ্রয়)
                  </>
                ) : (
                  formatBdt(subtotal)
                )}
                {charge > 0 ? ` + ${catalog.settings.charge_label} ${formatBdt(charge)}` : ''} ·{' '}
                {chosen.map((p) => p.exam_subject_name ?? p.exam_part_name ?? p.name).join(', ')}
              </p>
              {error ? <p className="text-xs text-red-600">{error}</p> : null}
              {paused ? <p className="text-xs text-red-600">অনলাইন পেমেন্ট সাময়িকভাবে বন্ধ আছে।</p> : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl" disabled={busy} onClick={() => setPicked({})}>
                মুছে ফেলুন
              </Button>
              <Button
                className="rounded-xl bg-[#1566b8] text-white hover:bg-[#0f5294]"
                disabled={busy || paused}
                onClick={() => void checkout()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {total === 0 ? 'ফ্রি চালু করুন' : `চেকআউট · ${formatBdt(total)}`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
