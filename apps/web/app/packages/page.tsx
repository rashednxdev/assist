'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, Check, CheckCircle2, Loader2, ShieldCheck, Sparkles, Video, X } from 'lucide-react';
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
import { accessDate, accessDateTime, durationLabel, PACKAGE_TABS } from '@/lib/billing-format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const DAY_MS = 86_400_000;

function isKind(v: string | null): v is AccessPackageKind {
  return v === 'exam_prep' || v === 'basic' || v === 'live';
}

/** When the current access of the same kind (same package for live) ends, or null if none. */
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
  return (
    <Card className={cn('flex flex-col', pkg.is_featured && 'ring-2 ring-primary')}>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {pkg.is_featured && (
            <Badge>
              <Sparkles className="mr-1 h-3 w-3" />
              Popular
            </Badge>
          )}
          {owned && <Badge variant="success">Active until {accessDate(owned)}</Badge>}
        </div>
        <CardTitle className="text-lg">{pkg.name}</CardTitle>
        {pkg.name_bn && <p className="text-sm text-muted">{pkg.name_bn}</p>}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{pkg.price === 0 ? 'Free' : formatBdt(pkg.price)}</span>
          {pkg.compare_at_price ? (
            <span className="text-sm text-muted line-through">{formatBdt(pkg.compare_at_price)}</span>
          ) : null}
          <span className="text-sm text-muted">/ {durationLabel(pkg.duration_days)}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {pkg.description && <p className="whitespace-pre-line text-sm text-muted">{pkg.description}</p>}
        {pkg.features.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {pkg.features.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
        )}
        {pkg.kind === 'live' && (
          <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Video className="h-4 w-4 text-primary" />
              {pkg.class_count ?? 0} class{pkg.class_count === 1 ? '' : 'es'} in this package
            </p>
            {pkg.upcoming_classes && pkg.upcoming_classes.length > 0 ? (
              <ul className="space-y-1">
                {pkg.upcoming_classes.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-muted">
                    <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <span className="text-foreground">{c.topic}</span> · {accessDateTime(c.scheduled_at)}
                      {c.status === 'live' && <Badge variant="destructive" className="ml-2">Live now</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Upcoming classes will be announced.</p>
            )}
          </div>
        )}
        <Button className="mt-auto w-full" disabled={disabled} onClick={onBuy}>
          {owned ? 'Extend' : pkg.price === 0 ? 'Get it free' : 'Buy now'}
        </Button>
      </CardContent>
    </Card>
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
  const tab = PACKAGE_TABS.find((t) => t.id === pkg.kind)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{tab.label}</p>
            <h2 className="text-lg font-bold">{pkg.name}</h2>
            {pkg.exam_subject_name && <p className="text-sm text-muted">{pkg.exam_subject_name}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5 text-sm">
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-muted">Package price</dt>
              <dd>{formatBdt(pkg.price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">
                {catalog.settings.charge_label}
                {catalog.settings.charge_type === 'percent' && charge > 0 ? ` (${catalog.settings.charge_value}%)` : ''}
              </dt>
              <dd>{formatBdt(charge)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatBdt(total)}</dd>
            </div>
          </dl>
          <div className="rounded-lg bg-primary-muted/60 p-3">
            <p className="flex items-center gap-2 font-medium text-primary-dark">
              <ShieldCheck className="h-4 w-4" />
              Access for {durationLabel(pkg.duration_days)}
            </p>
            <p className="mt-1 text-muted">
              {accessDate(start.toISOString())} → {accessDate(end.toISOString())}
              {until && new Date(until).getTime() > Date.now() ? ' (starts when your current access ends)' : ''}
            </p>
            <p className="mt-1 text-muted">{pkg.kind === 'live' ? 'Opens every class in this package.' : `Opens ${tab.blurb}`}</p>
          </div>
          {catalog.settings.checkout_note && <p className="text-xs text-muted">{catalog.settings.checkout_note}</p>}
          {error && <Alert variant="error">{error}</Alert>}
          <Button
            className="w-full bg-[#e2136e] text-white hover:bg-[#c10f5d]"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {total === 0 ? 'Confirm' : `Pay ${formatBdt(total)} with bKash`}
          </Button>
          <p className="text-center text-xs text-muted">Demo payment — no real money is charged.</p>
        </div>
      </div>
    </div>
  );
}

function PackagesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const tab: AccessPackageKind = isKind(params.get('tab')) ? (params.get('tab') as AccessPackageKind) : 'exam_prep';
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AccessPackageRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [buyError, setBuyError] = useState('');

  useEffect(() => {
    apiFetch<{ data: BillingCatalog }>('/billing/catalog')
      .then((r) => setCatalog(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load packages'));
  }, []);

  const inTab = useMemo(() => (catalog?.packages ?? []).filter((p) => p.kind === tab), [catalog, tab]);
  const examGroups = useMemo(() => {
    if (tab !== 'exam_prep') return [];
    const groups = new Map<string, AccessPackageRecord[]>();
    for (const p of inTab) {
      const key = p.exam_subject_name ?? 'All subjects';
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    return [...groups.entries()];
  }, [inTab, tab]);

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
      setBuyError(e instanceof Error ? e.message : 'Could not start the payment');
      setBusy(false);
    }
  }

  const tabMeta = PACKAGE_TABS.find((t) => t.id === tab)!;
  const activeUntil =
    catalog && tab === 'exam_prep' ? catalog.access.exam_prep_until : catalog && tab === 'basic' ? catalog.access.basic_until : undefined;

  function grid(list: AccessPackageRecord[]) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <PackageCard
            key={p.id}
            pkg={p}
            owned={catalog ? currentUntil(catalog, p) : undefined}
            disabled={!catalog?.settings.gateway_enabled && p.price > 0}
            onBuy={() => {
              setBuyError('');
              setSelected(p);
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages"
        description="Choose a package and pay with bKash — access opens as soon as the payment succeeds."
        action={
          <Button asChild variant="outline">
            <Link href="/settings/payments">Payments &amp; access</Link>
          </Button>
        }
      />

      <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
        {PACKAGE_TABS.map((t) => (
          <Link
            key={t.id}
            href={`/packages?tab=${t.id}`}
            replace
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'bg-primary-muted text-primary-dark' : 'text-muted hover:bg-slate-100 hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <p className="text-sm text-muted">{tabMeta.blurb}</p>

      {error && <Alert variant="error">{error}</Alert>}
      {catalog && !catalog.settings.gateway_enabled && (
        <Alert variant="error">Online payments are paused right now. Please message us on WhatsApp to buy a package.</Alert>
      )}
      {activeUntil && (
        <Alert variant="success">
          <CheckCircle2 className="mr-1 inline h-4 w-4" />
          Your {tabMeta.label} access is active until <strong>{accessDate(activeUntil)}</strong>. Buying again extends it.
        </Alert>
      )}
      {catalog && tab === 'live' && catalog.access.live_packages.length > 0 && (
        <Alert variant="success">
          You own: {catalog.access.live_packages.map((p) => `${p.package_name} (until ${accessDate(p.until)})`).join(', ')}
        </Alert>
      )}

      {!catalog && !error ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : inTab.length === 0 ? (
        <EmptyState title="No packages yet" description="Packages for this section will be available soon." />
      ) : tab === 'exam_prep' ? (
        <div className="space-y-8">
          <p className="text-sm text-muted">
            Pick your exam subject. Any Exam Preparation package opens every exam-prep module for its period.
          </p>
          {examGroups.map(([subject, list]) => (
            <section key={subject} className="space-y-3">
              <h2 className="text-lg font-semibold">{subject}</h2>
              {grid(list)}
            </section>
          ))}
        </div>
      ) : (
        grid(inTab)
      )}

      {catalog && selected && (
        <CheckoutSummary
          catalog={catalog}
          pkg={selected}
          busy={busy}
          error={buyError}
          onConfirm={buy}
          onClose={() => !busy && setSelected(null)}
        />
      )}
    </div>
  );
}

export default function PackagesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <PackagesContent />
    </Suspense>
  );
}
