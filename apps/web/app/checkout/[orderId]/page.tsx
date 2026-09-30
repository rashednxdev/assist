'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Clock, Loader2, Lock, ShieldCheck, XCircle } from 'lucide-react';
import {
  ACCESS_PACKAGE_KIND_LABELS,
  DEMO_BKASH_OTP,
  formatBdt,
  PAYMENT_METHOD_LABELS,
  type PaymentOrderRecord,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { accessDate, accessDateTime, durationLabel } from '@/lib/billing-format';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const BKASH = '#e2136e';

type Step = 'number' | 'otp' | 'pin';

const OPEN_HREF: Record<PaymentOrderRecord['kind'], { href: string; label: string }> = {
  exam_prep: { href: '/dashboard', label: 'Start learning' },
  basic: { href: '/ibas', label: 'Open iBAS++ workspace' },
  live: { href: '/live/zoom', label: 'Go to live classes' },
};

function digits(v: string, max: number): string {
  return v.replace(/\D/g, '').slice(0, max);
}

function BkashHeader({ order }: { order: PaymentOrderRecord }) {
  return (
    <div className="text-white" style={{ backgroundColor: BKASH }}>
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-2xl font-extrabold tracking-tight">bKash</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">Demo</span>
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
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState<Step>('number');
  const [msisdn, setMsisdn] = useState('');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [agree, setAgree] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ data: PaymentOrderRecord }>(`/billing/orders/${params.orderId}`)
      .then((r) => setOrder(r.data))
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Order not found'));
  }, [params.orderId]);

  function next() {
    setError('');
    if (step === 'number') {
      if (!/^01[3-9]\d{8}$/.test(msisdn)) return setError('Enter your 11-digit bKash account number');
      if (!agree) return setError('Please accept the terms to continue');
      setStep('otp');
    } else if (step === 'otp') {
      if (otp !== DEMO_BKASH_OTP) return setError('Wrong verification code');
      setStep('pin');
    } else {
      if (!/^\d{5}$/.test(pin)) return setError('Enter your 5-digit PIN');
      void pay();
    }
  }

  async function pay() {
    setBusy(true);
    try {
      const r = await apiFetch<{ data: PaymentOrderRecord }>(`/billing/orders/${params.orderId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ msisdn, otp, pin, simulate_failure: simulateFailure || undefined }),
      });
      setOrder(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
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
      setStep('number');
      setOtp('');
      setPin('');
      setSimulateFailure(false);
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

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
        <BkashHeader order={order} />
        <div className="space-y-4 p-5">
          <p className="text-center text-sm text-muted">
            {order.package_name} · {durationLabel(order.duration_days)} · access {accessDate(order.access_starts_at)} →{' '}
            {accessDate(order.access_ends_at)}
          </p>

          {step === 'number' && (
            <div className="space-y-3">
              <label className="block text-center text-sm font-medium" htmlFor="bk-msisdn">
                Your bKash Account number
              </label>
              <input
                id="bk-msisdn"
                inputMode="numeric"
                autoFocus
                placeholder="e.g 01XXXXXXXXX"
                value={msisdn}
                onChange={(e) => setMsisdn(digits(e.target.value, 11))}
                onKeyDown={(e) => e.key === 'Enter' && next()}
                className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-[#e2136e]"
              />
              <label className="flex items-start gap-2 text-xs text-muted">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
                By clicking on Confirm, you are agreeing to the terms &amp; conditions.
              </label>
              <label className="flex items-start gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="mt-0.5"
                />
                Demo: simulate &quot;insufficient balance&quot; to see a failed payment.
              </label>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-3">
              <label className="block text-center text-sm font-medium" htmlFor="bk-otp">
                Enter the verification code sent to {msisdn.slice(0, 3)}•••••{msisdn.slice(-3)}
              </label>
              <input
                id="bk-otp"
                inputMode="numeric"
                autoFocus
                placeholder="Verification code"
                value={otp}
                onChange={(e) => setOtp(digits(e.target.value, 6))}
                onKeyDown={(e) => e.key === 'Enter' && next()}
                className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-center text-lg tracking-[0.5em] outline-none focus:border-[#e2136e]"
              />
              <p className="text-center text-xs text-muted">
                Demo code: <span className="font-mono font-semibold">{DEMO_BKASH_OTP}</span>
              </p>
            </div>
          )}

          {step === 'pin' && (
            <div className="space-y-3">
              <label className="block text-center text-sm font-medium" htmlFor="bk-pin">
                Enter PIN of your bKash Account number
              </label>
              <input
                id="bk-pin"
                type="password"
                inputMode="numeric"
                autoFocus
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(digits(e.target.value, 5))}
                onKeyDown={(e) => e.key === 'Enter' && next()}
                className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-center text-lg tracking-[0.5em] outline-none focus:border-[#e2136e]"
              />
              <p className="text-center text-xs text-muted">Demo: any 5 digits work.</p>
            </div>
          )}

          {error && <Alert variant="error">{error}</Alert>}
        </div>
        <div className="grid grid-cols-2">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="bg-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-60"
          >
            Close
          </button>
          <button
            type="button"
            onClick={next}
            disabled={busy}
            className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: BKASH }}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {step === 'pin' ? 'Confirm payment' : 'Confirm'}
          </button>
        </div>
      </div>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <Lock className="h-3.5 w-3.5" />
        Demo gateway — no real bKash payment is made.
        <ShieldCheck className="h-3.5 w-3.5" />
      </p>
    </div>
  );
}
