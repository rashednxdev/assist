'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { formatBdt, PAYMENT_METHOD_LABELS, type CartRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { accessDate, accessDateTime, durationLabel } from '@/lib/billing-format';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const BKASH = '#e2136e';

function scopeText(o: CartRecord['orders'][number]): string {
  return [o.exam_part_name, o.exam_subject_name].filter((s) => s && s !== o.package_name).join(' · ');
}

function Items({ cart, showAccess }: { cart: CartRecord; showAccess?: boolean }) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-slate-50 text-sm">
      {cart.orders.map((o) => (
        <li key={o.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="font-medium">{o.package_name}</p>
            <p className="text-xs text-muted">
              {[scopeText(o), durationLabel(o.duration_days)].filter(Boolean).join(' · ')}
              {showAccess ? ` · ${accessDate(o.access_starts_at)} → ${accessDate(o.access_ends_at)}` : ''}
            </p>
          </div>
          <span className="shrink-0 font-medium">{formatBdt(o.price)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CartCheckoutPage() {
  const params = useParams<{ cartId: string }>();
  const router = useRouter();
  const [cart, setCart] = useState<CartRecord | null>(null);
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
    apiFetch<{ data: CartRecord }>(`/billing/carts/${params.cartId}`)
      .then((r) => setCart(r.data))
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Checkout not found'));
  }, [params.cartId]);

  async function submitClaim() {
    setError('');
    if (trxId.trim().length < 4) return setError('Enter the bKash transaction ID');
    const sent = Number(amount);
    if (!Number.isFinite(sent) || sent <= 0) return setError('Enter the amount you sent');
    if (sender.trim() && !/^01[3-9]\d{8}$/.test(sender.trim())) return setError('bKash number must be 11 digits');
    setBusy(true);
    try {
      const r = await apiFetch<{ data: CartRecord }>(`/billing/carts/${params.cartId}/claim`, {
        method: 'POST',
        body: JSON.stringify({ trx_id: trxId.trim(), amount: sent, payer_account: sender.trim() }),
      });
      setCart(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit the payment');
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (cart?.status === 'pending' && !cart.trx_id) {
      await apiFetch(`/billing/carts/${cart.cart_id}/cancel`, { method: 'POST' }).catch(() => undefined);
    }
    router.push('/packages?tab=exam_prep');
  }

  async function retry() {
    if (!cart) return;
    setBusy(true);
    try {
      const r = await apiFetch<{ data: CartRecord }>('/billing/carts', {
        method: 'POST',
        body: JSON.stringify({ package_ids: cart.orders.map((o) => o.package_id) }),
      });
      setTrxId('');
      setError('');
      router.replace(`/checkout/cart/${r.data.cart_id}`);
      setCart(r.data);
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
  if (!cart) return <Skeleton className="mx-auto h-96 w-full max-w-md" />;

  if (cart.status === 'paid') {
    return (
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-600" />
          <h1 className="text-2xl font-bold">{cart.total > 0 ? 'Payment successful' : 'Packages added'}</h1>
          <p className="text-sm text-muted">
            {cart.orders.length} package{cart.orders.length === 1 ? ' is' : 's are'} now on your account.
          </p>
        </div>
        <Items cart={cart} showAccess />
        <dl className="space-y-1.5 rounded-xl border border-border p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Total paid</dt>
            <dd className="font-semibold">{formatBdt(cart.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Method</dt>
            <dd>{PAYMENT_METHOD_LABELS[cart.method]}</dd>
          </div>
          {cart.payer_account && (
            <div className="flex justify-between">
              <dt className="text-muted">bKash account</dt>
              <dd>{cart.payer_account}</dd>
            </div>
          )}
          {cart.trx_id && (
            <div className="flex justify-between">
              <dt className="text-muted">Transaction ID</dt>
              <dd className="font-mono">{cart.trx_id}</dd>
            </div>
          )}
          {cart.paid_at && (
            <div className="flex justify-between">
              <dt className="text-muted">Paid at</dt>
              <dd>{accessDateTime(cart.paid_at)}</dd>
            </div>
          )}
        </dl>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href="/dashboard">Start learning</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/settings/payments">Payment history</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (cart.status === 'failed') {
    return (
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <XCircle className="h-14 w-14 text-destructive" />
          <h1 className="text-2xl font-bold">Payment failed</h1>
          <p className="text-sm text-muted">{cart.failure_reason ?? 'The payment did not go through.'} No money was taken.</p>
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1 text-white" style={{ backgroundColor: BKASH }} disabled={busy} onClick={retry}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Try again
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/packages?tab=exam_prep">Back to packages</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (cart.status !== 'pending') {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <Clock className="mx-auto h-12 w-12 text-muted" />
        <h1 className="text-xl font-bold">{cart.status === 'expired' ? 'This checkout expired' : 'This checkout was cancelled'}</h1>
        <p className="text-sm text-muted">No money was taken. Start again from Pricing.</p>
        <Button asChild>
          <Link href="/packages?tab=exam_prep">Back to packages</Link>
        </Button>
      </div>
    );
  }

  if (cart.trx_id) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <Clock className="mx-auto h-12 w-12 text-amber-600" />
        <h1 className="text-xl font-bold">Waiting for confirmation</h1>
        <p className="text-sm text-muted">
          Transaction <span className="font-mono font-semibold">{cart.trx_id}</span> is with the admin. Access opens after it is
          accepted.
        </p>
        <Items cart={cart} />
        <Button asChild>
          <Link href="/settings/payments">Payment history</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
        <div className="text-white" style={{ backgroundColor: BKASH }}>
          <div className="flex items-center justify-between px-5 pt-4">
            <span className="text-2xl font-extrabold tracking-tight">bKash</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">Send money</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold"
              style={{ color: BKASH }}
            >
              PA
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">ProAssist</p>
              <p className="truncate text-xs text-white/80">
                {cart.orders.length} package{cart.orders.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">{formatBdt(cart.total)}</p>
              {cart.charge > 0 && (
                <p className="text-[11px] text-white/80">
                  incl. {cart.charge_label} {formatBdt(cart.charge)}
                </p>
              )}
            </div>
          </div>
        </div>
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submitClaim();
          }}
        >
          <Items cart={cart} />
          <p className="text-center text-sm text-muted">
            Send <strong className="text-foreground">{formatBdt(cart.total)}</strong> by bKash to{' '}
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
              placeholder={String(cart.total)}
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
