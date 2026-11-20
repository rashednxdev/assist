'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, CalendarClock, CheckCircle2, GraduationCap, Loader2, ShieldCheck, Sparkles, Video, X } from 'lucide-react';
import type { AccessPackageKind } from '@ibas/shared-constants';
import {
  computeCharge,
  formatBdt,
  roundTaka,
  type AccessPackageRecord,
  type BillingCatalog,
  type PaymentOrderRecord,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { accessDate, accessDateTime, durationLabel } from '@/lib/billing-format';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ExamPrepShop } from '@/components/billing/exam-prep-shop';
import { LiveClassShop } from '@/components/billing/live-class-shop';
import { PackageCopy } from '@/components/billing/package-copy';

const DAY_MS = 86_400_000;

const TABS_BN: Array<{ id: AccessPackageKind; label: string; blurb: string }> = [
  {
    id: 'exam_prep',
    label: 'পরীক্ষা প্রস্তুতি',
    blurb: 'বিষয়ভিত্তিক অথবা পূর্ণ পার্ট প্যাকেজ বেছে নিন — বই, লিখিত প্রশ্নব্যাংক, অধ্যায়ভিত্তিক MCQ ও মডেল টেস্ট অন্তর্ভুক্ত।',
  },
  {
    id: 'live',
    label: 'লাইভ ক্লাস',
    blurb: 'পছন্দের লাইভ প্রোগ্রামের অধীনে এক বা একাধিক বিষয়ে এনরোল করুন (একাধিক বিষয়ে ওয়েভার সুবিধা)।',
  },
  {
    id: 'basic',
    label: 'বেসিক মডিউল',
    blurb: 'দৈনন্দিন দাফতরিক ও সহায়ক মডিউলসমূহ ব্যবহারের প্যাকেজ।',
  },
];

function isKind(v: string | null): v is AccessPackageKind {
  return v === 'exam_prep' || v === 'basic' || v === 'live';
}

function currentUntil(catalog: BillingCatalog, pkg: AccessPackageRecord): string | undefined {
  if (pkg.kind === 'exam_prep') return catalog.access.exam_prep_until;
  if (pkg.kind === 'basic') return catalog.access.basic_until;
  return catalog.access.live_packages.find((p) => p.package_id === pkg.id)?.until;
}

function PackageCard({
  pkg,
  owned,
  disabled,
  onBuy,
}: {
  pkg: AccessPackageRecord;
  owned?: string;
  disabled: boolean;
  onBuy: () => void;
}) {
  const title = pkg.name_bn?.trim() || pkg.name;
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-[#d7e4ee] bg-white shadow-xs transition hover:border-[#1566b8]',
        pkg.is_featured && 'ring-2 ring-[#1566b8]',
      )}
    >
      <div className="flex h-24 items-center justify-between bg-[#0a2f5b] px-5 text-white">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
            {pkg.kind === 'live' ? 'লাইভ ক্লাস' : 'কোর্স'}
          </span>
          {pkg.is_featured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1566b8] px-2.5 py-0.5 text-[11px] font-semibold">
              <Sparkles className="h-3 w-3" />
              জনপ্রিয়
            </span>
          ) : null}
          {owned ? (
            <span className="rounded-full bg-[#e8f8ef] px-2.5 py-0.5 text-[11px] font-bold text-[#156f4d]">
              চালু আছে
            </span>
          ) : null}
        </div>
        {pkg.kind === 'live' ? <Video className="h-7 w-7 text-white/75" /> : <BookOpen className="h-7 w-7 text-white/75" />}
      </div>

      <div className="flex flex-1 flex-col justify-between p-5">
        <div className="space-y-2.5">
          <h3 className="text-lg font-bold text-[#0a2f5b]">{title}</h3>
          {pkg.name_bn?.trim() ? <p className="text-xs text-slate-500">{pkg.name}</p> : null}
          <PackageCopy description={pkg.description} features={pkg.features} />

          {pkg.kind === 'live' ? (
            <div className="space-y-1.5 rounded-xl bg-[#f4f9fd] p-3 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-[#0a2f5b]">
                <Video className="h-3.5 w-3.5 text-[#1566b8]" />
                {pkg.class_count ?? 0}টি লাইভ ক্লাস
              </p>
              {pkg.upcoming_classes && pkg.upcoming_classes.length > 0 ? (
                <ul className="space-y-1 text-slate-600">
                  {pkg.upcoming_classes.map((c) => (
                    <li key={c.id} className="flex items-start gap-1.5">
                      <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1566b8]" />
                      <span>
                        <strong className="text-[#0a2f5b]">{c.topic}</strong> · {accessDateTime(c.scheduled_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5 border-t border-[#eef4f9] pt-4">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-2xl font-extrabold text-[#0a2f5b]">
                {pkg.price === 0 ? 'ফ্রি' : formatBdt(pkg.price)}
              </span>
              {pkg.compare_at_price ? (
                <span className="ml-2 text-xs text-slate-400 line-through">{formatBdt(pkg.compare_at_price)}</span>
              ) : null}
              <p className="text-xs text-slate-500">{durationLabel(pkg.duration_days)} অ্যাক্সেস</p>
            </div>
            <Button disabled={disabled} onClick={onBuy} className="rounded-xl bg-[#1566b8] hover:bg-[#0f5294]">
              {owned ? 'মেয়াদ বাড়ান' : pkg.price === 0 ? 'ফ্রি চালু করুন' : 'কিনুন'}
            </Button>
          </div>
          {owned ? <p className="mt-1.5 text-[11px] text-[#156f4d]">মেয়াদ: {accessDate(owned)} পর্যন্ত</p> : null}
        </div>
      </div>
    </div>
  );
}

function CheckoutSummary({
  catalog,
  pkg,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  catalog: BillingCatalog;
  pkg: AccessPackageRecord;
  busy: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const charge = computeCharge(pkg.price, catalog.settings);
  const total = roundTaka(pkg.price + charge);
  const until = currentUntil(catalog, pkg);
  const start = until && new Date(until).getTime() > Date.now() ? new Date(until) : new Date();
  const end = new Date(start.getTime() + pkg.duration_days * DAY_MS);
  const tab = TABS_BN.find((t) => t.id === pkg.kind)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="বন্ধ করুন" className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#d7e4ee] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#eef4f9] p-5">
          <div>
            <p className="text-xs font-semibold text-[#1566b8]">{tab.label}</p>
            <h2 className="mt-0.5 text-lg font-bold text-[#0a2f5b]">{pkg.name_bn?.trim() || pkg.name}</h2>
            {pkg.exam_subject_name ? <p className="text-xs text-slate-500">{pkg.exam_subject_name}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="বন্ধ করুন">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5 text-sm">
          <dl className="space-y-2 rounded-xl bg-[#f4f9fd] p-4">
            <div className="flex justify-between">
              <dt className="text-slate-500">প্যাকেজ মূল্য</dt>
              <dd className="font-semibold text-[#0a2f5b]">{formatBdt(pkg.price)}</dd>
            </div>
            {charge > 0 ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">
                  {catalog.settings.charge_label}
                  {catalog.settings.charge_type === 'percent' ? ` (${catalog.settings.charge_value}%)` : ''}
                </dt>
                <dd className="font-semibold text-[#0a2f5b]">{formatBdt(charge)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-[#d7e4ee] pt-2 text-base font-extrabold text-[#0a2f5b]">
              <dt>সর্বমোট</dt>
              <dd>{formatBdt(total)}</dd>
            </div>
          </dl>

          <div className="rounded-xl border border-[#c5dff6] bg-[#eaf4fc] p-3.5 text-xs text-[#0a2f5b]">
            <p className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="h-4 w-4 text-[#1566b8]" />
              অ্যাক্সেস মেয়াদ: {durationLabel(pkg.duration_days)}
            </p>
            <p className="mt-1 text-slate-600">
              {accessDate(start.toISOString())} → {accessDate(end.toISOString())}
            </p>
          </div>

          {catalog.settings.checkout_note ? <p className="text-xs text-slate-500">{catalog.settings.checkout_note}</p> : null}
          {error ? <Alert variant="error">{error}</Alert> : null}

          <Button
            className="h-11 w-full rounded-xl bg-[#1566b8] text-white hover:bg-[#0f5294]"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {total === 0 ? 'ফ্রি অ্যাক্সেস নিশ্চিত করুন' : 'চেকআউটে এগিয়ে যান'}
          </Button>
          <p className="text-center text-xs text-slate-500">
            পরবর্তী ধাপে বিকাশে পেমেন্ট করে ট্রানজ্যাকশন আইডি জমা দেবেন।
          </p>
        </div>
      </div>
    </div>
  );
}

function PackagesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const tab: AccessPackageKind = isKind(params.get('tab')) ? (params.get('tab') as AccessPackageKind) : 'exam_prep';
  const focusSubjectId = params.get('subject') ?? '';

  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AccessPackageRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [buyError, setBuyError] = useState('');

  useEffect(() => {
    apiFetch<{ data: BillingCatalog }>('/billing/catalog')
      .then((r) => setCatalog(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'প্যাকেজ লোড করা যায়নি'));
  }, []);

  const inTab = useMemo(() => (catalog?.packages ?? []).filter((p) => p.kind === tab), [catalog, tab]);

  async function buy() {
    if (!selected) return;
    setBusy(true);
    setBuyError('');
    try {
      const r = await apiFetch<{ data: PaymentOrderRecord }>('/billing/orders', {
        method: 'POST',
        body: JSON.stringify({ package_id: selected.id }),
      });
      router.push(`/checkout/${r.data.id}`);
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : 'পেমেন্ট শুরু করা যায়নি');
      setBusy(false);
    }
  }

  const tabMeta = TABS_BN.find((t) => t.id === tab)!;
  const activeUntil = catalog && tab === 'basic' ? catalog.access.basic_until : undefined;

  return (
    <div className="space-y-6">
      {/* PDF Page 7 Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a2f5b] sm:text-3xl">কোর্স ও পরীক্ষা প্রস্তুতি</h1>
          <p className="mt-1 text-sm text-slate-600">
            আপনার লক্ষ্য পরীক্ষা অনুযায়ী বিষয়ভিত্তিক বা পূর্ণ পার্ট প্যাকেজ বেছে নিন। সারাংশ দেখে তারপর এনরোল করুন।
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/exam-prep"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#d7e4ee] bg-white px-4 py-2 text-xs font-semibold text-[#0a2f5b] hover:border-[#1566b8]"
          >
            <GraduationCap className="h-4 w-4 text-[#1566b8]" />
            বিষয়সমূহের সারাংশ
          </Link>
          <Link
            href="/settings/payments"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0a2f5b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1566b8]"
          >
            আমার কোর্স ও পেমেন্ট
          </Link>
        </div>
      </div>

      {catalog && !catalog.can_request ? (
        <Alert>
          এই অ্যাকাউন্টে এখনো Learning মডিউল অনুমোদিত হয়নি। প্যাকেজ নেওয়ার আগে অ্যাডমিন অনুমোদন প্রয়োজন।
        </Alert>
      ) : null}

      {/* PDF Page 7 Filter Bar */}
      <div className="rounded-2xl border border-[#d7e4ee] bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {TABS_BN.map((t) => (
            <Link
              key={t.id}
              href={`/packages?tab=${t.id}`}
              replace
              className={cn(
                'rounded-full px-4 py-2 text-xs font-semibold transition',
                tab === t.id
                  ? 'bg-[#0a2f5b] text-white'
                  : 'border border-[#d7e4ee] bg-[#f4f9fd] text-[#0a2f5b] hover:border-[#1566b8]',
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-600">{tabMeta.blurb}</p>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {catalog && !catalog.settings.gateway_enabled ? (
        <Alert variant="error">অনলাইন পেমেন্ট সাময়িকভাবে বন্ধ আছে। প্যাকেজ নিতে সহায়তা দলের সাথে যোগাযোগ করুন।</Alert>
      ) : null}
      {activeUntil ? (
        <Alert variant="success">
          <CheckCircle2 className="mr-1 inline h-4 w-4" />
          আপনার {tabMeta.label} অ্যাক্সেস <strong>{accessDate(activeUntil)}</strong> পর্যন্ত চালু আছে।
        </Alert>
      ) : null}
      {catalog && tab === 'live' && catalog.access.live_packages.length > 0 ? (
        <Alert variant="success">
          এনরোল করা লাইভ প্যাকেজ:{' '}
          {catalog.access.live_packages.map((p) => `${p.package_name} (${accessDate(p.until)} পর্যন্ত)`).join(', ')}
        </Alert>
      ) : null}

      {!catalog && !error ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : inTab.length === 0 ? (
        <EmptyState title="এই বিভাগে এখনো কোনো প্যাকেজ নেই" description="শীঘ্রই নতুন প্যাকেজ যুক্ত হবে।" />
      ) : tab === 'exam_prep' && catalog ? (
        <ExamPrepShop catalog={catalog} focusSubjectId={focusSubjectId} />
      ) : tab === 'live' && catalog ? (
        <LiveClassShop catalog={catalog} focusSubjectId={focusSubjectId} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {inTab.map((p) => (
            <PackageCard
              key={p.id}
              pkg={p}
              owned={catalog ? currentUntil(catalog, p) : undefined}
              disabled={(!catalog?.settings.gateway_enabled && p.price > 0) || catalog?.can_request === false}
              onBuy={() => {
                setBuyError('');
                setSelected(p);
              }}
            />
          ))}
        </div>
      )}

      {catalog && selected ? (
        <CheckoutSummary
          catalog={catalog}
          pkg={selected}
          busy={busy}
          error={buyError}
          onConfirm={buy}
          onClose={() => !busy && setSelected(null)}
        />
      ) : null}
    </div>
  );
}

export default function PackagesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
      <PackagesContent />
    </Suspense>
  );
}
