'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
import {
  ACCESS_PACKAGE_KIND_LABELS,
  formatBdt,
  PAYMENT_METHOD_LABELS,
  type EntitlementRecord,
  type MyAccessSummary,
  type PaymentOrderRecord,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { accessDate, accessDateTime, daysLeft, durationLabel, ORDER_STATUS_BADGE } from '@/lib/billing-format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';

const ENTITLEMENT_BADGE: Record<EntitlementRecord['status'], 'success' | 'warning' | 'secondary' | 'destructive'> = {
  active: 'success',
  upcoming: 'warning',
  expired: 'secondary',
  revoked: 'destructive',
};

function AccessTile({ title, until, href }: { title: string; until?: string; href: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm text-muted">{title}</p>
      {until ? (
        <>
          <p className="mt-1 text-lg font-semibold">Until {accessDate(until)}</p>
          <p className="text-xs text-muted">{daysLeft(until)} days left</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-lg font-semibold text-muted">Not active</p>
          <Link href={href} className="text-xs text-primary hover:underline">
            View packages
          </Link>
        </>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: PaymentOrderRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3">
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen((v) => !v)}>
        <div className="min-w-0">
          <p className="font-medium">{order.package_name}</p>
          <p className="text-xs text-muted">
            {ACCESS_PACKAGE_KIND_LABELS[order.kind]}
            {order.exam_part_name ? ` · ${order.exam_part_name}` : ''}
            {order.exam_subject_name ? ` · ${order.exam_subject_name}` : ''} · {accessDateTime(order.created_at)} · {order.invoice_no}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-semibold">{formatBdt(order.total)}</span>
          <Badge variant={ORDER_STATUS_BADGE[order.status]} className="capitalize">
            {order.status}
          </Badge>
          {order.access_revoked && <Badge variant="destructive">Access revoked</Badge>}
          {open ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
        </div>
      </button>
      {open && (
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Price</dt>
            <dd>{formatBdt(order.price)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">{order.charge_label}</dt>
            <dd>{formatBdt(order.charge)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Method</dt>
            <dd>{PAYMENT_METHOD_LABELS[order.method]}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Duration</dt>
            <dd>{durationLabel(order.duration_days)}</dd>
          </div>
          {order.payer_account && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted">bKash account</dt>
              <dd>{order.payer_account}</dd>
            </div>
          )}
          {order.trx_id && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Transaction ID</dt>
              <dd className="font-mono">{order.trx_id}</dd>
            </div>
          )}
          {order.paid_at && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Paid at</dt>
              <dd>{accessDateTime(order.paid_at)}</dd>
            </div>
          )}
          {order.status === 'paid' && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Access</dt>
              <dd>
                {accessDate(order.access_starts_at)} → {accessDate(order.access_ends_at)}
              </dd>
            </div>
          )}
          {order.failure_reason && (
            <div className="flex justify-between gap-2 sm:col-span-2">
              <dt className="text-muted">Reason</dt>
              <dd>{order.failure_reason}</dd>
            </div>
          )}
          {order.note && (
            <div className="flex justify-between gap-2 sm:col-span-2">
              <dt className="text-muted">Note</dt>
              <dd className="text-right">{order.note}</dd>
            </div>
          )}
          {order.status === 'pending' && (
            <div className="sm:col-span-2">
              <Button asChild size="sm">
                <Link href={`/checkout/${order.id}`}>Continue payment</Link>
              </Button>
            </div>
          )}
        </dl>
      )}
    </li>
  );
}

export default function SettingsPaymentsPage() {
  const [access, setAccess] = useState<MyAccessSummary | null>(null);
  const [orders, setOrders] = useState<PaymentOrderRecord[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: MyAccessSummary }>('/billing/my-access'),
      apiFetch<{ data: PaymentOrderRecord[] }>('/billing/orders'),
    ])
      .then(([a, o]) => {
        setAccess(a.data);
        setOrders(o.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load payments'));
  }, []);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!access || !orders) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">My access</CardTitle>
          <Button asChild size="sm">
            <Link href="/packages">
              <ShoppingBag className="h-4 w-4" />
              Buy a package
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <AccessTile title="Exam Preparation" until={access.exam_prep_until} href="/packages?tab=exam_prep" />
            <AccessTile title="Basic Module" until={access.basic_until} href="/packages?tab=basic" />
          </div>
          {access.exam_prep_access.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Exam Preparation subjects</p>
              <ul className="flex flex-wrap gap-2">
                {access.exam_prep_access.map((a) => (
                  <li key={`${a.exam_part_id}|${a.exam_subject_id ?? ''}`}>
                    <Badge variant="success">
                      {a.exam_part_name} · {a.exam_subject_name ?? 'All subjects'} · until {accessDate(a.until)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="mb-2 text-sm font-medium">Live class packages</p>
            {access.live_packages.length === 0 ? (
              <p className="text-sm text-muted">
                None yet.{' '}
                <Link href="/packages?tab=live" className="text-primary hover:underline">
                  Browse live packages
                </Link>
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {access.live_packages.map((p) => (
                  <li key={p.package_id}>
                    <Badge variant="success">
                      {p.package_name} · until {accessDate(p.until)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access details</CardTitle>
        </CardHeader>
        <CardContent>
          {access.entitlements.length === 0 ? (
            <p className="text-sm text-muted">You haven&apos;t bought any package yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {access.entitlements.map((e) => (
                <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {e.package_name}
                      <span className="ml-2 text-xs font-normal text-muted">{ACCESS_PACKAGE_KIND_LABELS[e.kind]}</span>
                    </p>
                    {(e.exam_part_name || e.exam_subject_name) && (
                      <p className="text-xs text-muted">
                        {[e.exam_part_name, e.exam_subject_name ?? (e.exam_part_name ? 'All subjects' : undefined)]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    <p className="text-sm text-muted">
                      {accessDate(e.starts_at)} → {accessDate(e.ends_at)}
                      {e.invoice_no ? ` · ${e.invoice_no}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-muted">Opens: {e.opens.join(', ')}</p>
                  </div>
                  <Badge variant={ENTITLEMENT_BADGE[e.status]} className="capitalize">
                    {e.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment history</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <EmptyState title="No payments yet" description="Your package purchases and receipts will appear here." />
          ) : (
            <ul className="divide-y divide-border">
              {orders.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
