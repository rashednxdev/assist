'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import {
  ACCESS_PACKAGE_KIND_LABELS,
  formatBdt,
  PAYMENT_METHOD_LABELS,
  type PaymentOrderRecord,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { accessDate, accessDateTime } from '@/lib/billing-format';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const BKASH = '#e2136e';

const OPEN_HREF: Record<PaymentOrderRecord['kind'], { href: string; label: string }> = {
  exam_prep: { href: '/dashboard', label: 'Start learning' },
  basic: { href: '/ibas', label: 'Open iBAS++ workspace' },
  live: { href: '/live/zoom', label: 'Go to live classes' },
};

function BkashHeader({ order }: { order: PaymentOrderRecord }) {
  return (
    <div className="text-white" style={{ backgroundColor: BKASH }}>
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-2xl font-extrabold tracking-tight">bKash</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">Send money</span>
      </div>
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold" style={{ color: BKASH }}>
          PA
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">ProAssist</p>
          <p className="truncate text-xs text-white/80">Invoice: {order.invoice_no}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold">{formatBdt(order.total)}</p>
          {order.charge > 0 && (
            <p className="text-[11px] text-white/80">
              incl. {order.charge_label} {formatBdt(order.charge)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Receipt({ order }: { order: PaymentOrderRecord }) {
  return (
    <dl className="space-y-2 rounded-xl border border-border bg-slate-50 p-4 text-sm">
      <Row label="Package" value={order.package_name} />
      <Row label="Type" value={ACCESS_PACKAGE_KIND_LABELS[order.kind]} />
      {order.exam_part_name && <Row label="Part" value={order.exam_part_name} />}
      {order.exam_subject_name && <Row label="Subject" value={order.exam_subject_name} />}
      <Row label="Price" value={formatBdt(order.price)} />
      <Row label={order.charge_label} value={formatBdt(order.charge)} />
      <Row label="Total paid" value={formatBdt(order.total)} />
      <Row label="Method" value={PAYMENT_METHOD_LABELS[order.method]} />
      {order.payer_account && <Row label="bKash account" value={order.payer_account} />}
      {order.trx_id && <Row label="Transaction ID" value={<span className="font-mono">{order.trx_id}</span>} />}
      <Row label="Invoice" value={<span className="font-mono">{order.invoice_no}</span>} />
      {order.paid_at && <Row label="Paid at" value={accessDateTime(order.paid_at)} />}
      <Row label="Access" value={`${accessDate(order.access_starts_at)} → ${accessDate(order.access_ends_at)}`} />
    </dl>
  );
}

export default function CheckoutPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<PaymentOrderRecord | null>(null);
  const [bkashNumber, setBkashNumber] = useState('');
  const [loadError, setLoadError] = useState('');
  const [trxId, setTrxId] = useState('');
  const [amount, setAmount] = useState('');
  const [sender, setSender] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ data: { settings: { bkash_number?: string } } }>('/billing/catalog')
      .then((r) => setBkashNumber(r.data.settings.bkash_number ?? ''))
      .catch(() => undefined);
    apiFetch<{ data: PaymentOrderRecord }>(`/billing/orders/${params.orderId}`)
      .then((r) => {
        if (r.data.cart_id && r.data.status === 'pending') router.replace(`/checkout/cart/${r.data.cart_id}`);
        else setOrder(r.data);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Order not found'));
  }, [params.orderId, router]);

  async function submitClaim() {
    setError('');
    if (trxId.trim().length < 4) return setError('Enter the bKash transaction ID');
    const sent = Number(amount);
    if (!Number.isFinite(sent) || sent <= 0) return setError('Enter the amount you sent');
    if (sender.trim() && !/^01[3-9]\d{8}$/.test(sender.trim())) return setError('bKash number must be 11 digits');
    setBusy(true);
    try {
      const r = await apiFetch<{ data: PaymentOrderRecord }>(`/billing/orders/${params.orderId}/claim`, {
        method: 'POST',
        body: JSON.stringify({
          trx_id: trxId.trim(),
          amount: sent,
          payer_account: sender.trim(),
        }),
      });
      setOrder(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit the payment');
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (order?.status === 'pending') {
      await apiFetch(`/billing/orders/${order.id}/cancel`, { method: 'POST' }).catch(() => undefined);
    }
    router.push(`/packages?tab=${order?.kind ?? 'exam_prep'}`);
  }

  async function retry() {
    if (!order) return;
    setBusy(true);
    try {
      const r = await apiFetch<{ data: PaymentOrderRecord }>('/billing/orders', {
        method: 'POST',
        body: JSON.stringify({ package_id: order.package_id }),
      });
      setTrxId('');
      setError('');
      router.replace(`/checkout/${r.data.id}`);
      setOrder(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start again');
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Alert variant="error">{loadError}</Alert>
        <Button asChild variant="outline">
          <Link href="/packages">Back to packages</Link>
        </Button>
      </div>
    );
  }
  if (!order) return <Skeleton className="mx-auto h-96 w-full max-w-md" />;

  if (order.status === 'paid') {
    const open = OPEN_HREF[order.kind];
    return (
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-600" />
          <h1 className="text-2xl font-bold">{order.total > 0 ? 'Payment successful' : 'Package added'}</h1>
          <p className="text-sm text-muted">
            Your access is active{new Date(order.access_starts_at).getTime() > Date.now() + 60_000 ? ` from ${accessDate(order.access_starts_at)}` : ''} until{' '}
            <strong>{accessDate(order.access_ends_at)}</strong>.
          </p>
        </div>
        <Receipt order={order} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href={open.href}>{open.label}</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/settings/payments">Payment history</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (order.status === 'failed') {
    return (
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <XCircle className="h-14 w-14 text-destructive" />
          <h1 className="text-2xl font-bold">Payment failed</h1>
          <p className="text-sm text-muted">{order.failure_reason ?? 'The payment did not go through.'} No money was taken.</p>
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1 text-white" style={{ backgroundColor: BKASH }} disabled={busy} onClick={retry}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Try again
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/packages?tab=${order.kind}`}>Back to packages</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (order.status !== 'pending') {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <Clock className="mx-auto h-12 w-12 text-muted" />
        <h1 className="text-xl font-bold">{order.status === 'expired' ? 'This checkout expired' : 'This checkout was cancelled'}</h1>
        <p className="text-sm text-muted">No money was taken. Start again from Pricing.</p>
        <Button asChild>
          <Link href={`/packages?tab=${order.kind}`}>Back to packages</Link>
        </Button>
      </div>
    );
  }

  if (order.trx_id) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <Clock className="mx-auto h-12 w-12 text-amber-600" />
        <h1 className="text-xl font-bold">Waiting for confirmation</h1>
        <p className="text-sm text-muted">
          Transaction <span className="font-mono font-semibold">{order.trx_id}</span>
          {order.claimed_amount != null ? ` · ${formatBdt(order.claimed_amount)}` : ''} is with the admin. Access opens after it is
          accepted.
        </p>
        <Button asChild>
          <Link href="/settings/payments">Payment history</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
        <BkashHeader order={order} />
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submitClaim();
          }}
        >
          <p className="text-center text-sm text-muted">
            Send <strong className="text-foreground">{formatBdt(order.total)}</strong> by bKash to{' '}
            <strong className="text-foreground">{bkashNumber || 'the number set by admin'}</strong>, then enter the details below.
          </p>
          <label className="block space-y-1 text-sm font-medium" htmlFor="bk-trx">
            Transaction ID
            <input
              id="bk-trx"
              required
              value={trxId}
              onChange={(e) => setTrxId(e.target.value)}
              className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 font-mono outline-none focus:border-[#e2136e]"
            />
          </label>
          <label className="block space-y-1 text-sm font-medium" htmlFor="bk-amount">
            Amount sent
            <input
              id="bk-amount"
              required
              type="text"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
              placeholder={String(order.total)}
              className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 outline-none focus:border-[#e2136e]"
            />
          </label>
          <label className="block space-y-1 text-sm font-medium" htmlFor="bk-from">
            Your bKash number <span className="font-normal text-muted">(optional)</span>
            <input
              id="bk-from"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={11}
              value={sender}
              onChange={(e) => setSender(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="01XXXXXXXXX"
              className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 outline-none focus:border-[#e2136e]"
            />
          </label>
          {error && <Alert variant="error">{error}</Alert>}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={close}>
              Close
            </Button>
            <Button type="submit" disabled={busy} className="text-white" style={{ backgroundColor: BKASH }}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
