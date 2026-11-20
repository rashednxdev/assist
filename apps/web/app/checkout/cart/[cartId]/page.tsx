'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Clock, GraduationCap, Loader2, Lock, XCircle } from 'lucide-react';
import { formatBdt, type CartRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { accessDate, accessDateTime, durationLabel } from '@/lib/billing-format';
import { toBanglaDigits } from '@/lib/bangla-format';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function scopeText(o: CartRecord['orders'][number]): string {
  return [o.exam_part_name, o.exam_subject_name].filter((s) => s && s !== o.package_name).join(' · ');
}

function Items({ cart, showAccess }: { cart: CartRecord; showAccess?: boolean }) {
  return (
    <ul className="divide-y divide-[#e5eef7] rounded-xl bg-[#f4f9fd] text-sm">
      {cart.orders.map((o) => (
        <li key={o.id} className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="font-bold text-[#0a2f5b]">{o.package_name}</p>
            <p className="text-xs text-slate-500">
              {[scopeText(o), `${durationLabel(o.duration_days)} অ্যাক্সেস`].filter(Boolean).join(' · ')}
              {showAccess ? ` · ${accessDate(o.access_starts_at)} → ${accessDate(o.access_ends_at)}` : ''}
            </p>
          </div>
          <span className="shrink-0 font-bold text-[#0a2f5b]">{formatBdt(o.price)}</span>
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
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ data: { settings: { bkash_number?: string } } }>('/billing/catalog')
      .then((r) => setBkashNumber(r.data.settings.bkash_number ?? ''))
      .catch(() => undefined);
    apiFetch<{ data: CartRecord }>(`/billing/carts/${params.cartId}`)
      .then((r) => {
        setCart(r.data);
        setAmount(String(r.data.total));
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'চেকআউট পাওয়া যায়নি'));
  }, [params.cartId]);

  async function submitClaim() {
    setError('');
    if (!agreed) return setError('এগিয়ে যেতে সম্মতি টিক চিহ্ন দিন');
    if (trxId.trim().length < 4) return setError('সঠিক বিকাশ ট্রানজ্যাকশন আইডি দিন');
    const sent = Number(amount);
    if (!Number.isFinite(sent) || sent <= 0) return setError('পাঠানো টাকার পরিমাণ লিখুন');
    if (sender.trim() && !/^01[3-9]\d{8}$/.test(sender.trim())) return setError('বিকাশ নম্বর অবশ্যই ১১ সংখ্যার হতে হবে');
    setBusy(true);
    try {
      const r = await apiFetch<{ data: CartRecord }>(`/billing/carts/${params.cartId}/claim`, {
        method: 'POST',
        body: JSON.stringify({ trx_id: trxId.trim(), amount: sent, payer_account: sender.trim() }),
      });
      setCart(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'পেমেন্ট তথ্য জমা দেওয়া যায়নি');
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
      setAmount(String(r.data.total));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'আবার শুরু করা যায়নি');
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Alert variant="error">{loadError}</Alert>
        <Button asChild variant="outline">
          <Link href="/packages">কোর্সে ফিরে যান</Link>
        </Button>
      </div>
    );
  }
  if (!cart) return <Skeleton className="mx-auto h-96 w-full max-w-3xl rounded-2xl" />;

  /* PDF Page 10: পেমেন্ট সফল হয়েছে */
  if (cart.status === 'paid') {
    return (
      <div className="mx-auto max-w-lg py-6">
        <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f8ef] text-[#1f9d68]">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#0a2f5b]">পেমেন্ট সফল হয়েছে</h1>
          <p className="mt-1 text-sm text-slate-600">
            আপনার {bn(cart.orders.length)}টি প্যাকেজ এখন চালু হয়েছে। শেখা শুরু করুন।
          </p>

          <div className="mt-6 space-y-3 text-left">
            <Items cart={cart} showAccess />
            <dl className="space-y-1.5 rounded-xl border border-[#eef4f9] p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">সর্বমোট পরিশোধিত</dt>
                <dd className="font-bold text-[#0a2f5b]">{formatBdt(cart.total)}</dd>
              </div>
              {cart.trx_id ? (
                <div className="flex justify-between">
                  <dt className="text-slate-500">ট্রানজ্যাকশন আইডি</dt>
                  <dd className="font-mono font-semibold text-[#0a2f5b]">{cart.trx_id}</dd>
                </div>
              ) : null}
              {cart.paid_at ? (
                <div className="flex justify-between">
                  <dt className="text-slate-500">অনুমোদনের সময়</dt>
                  <dd className="text-xs text-slate-600">{accessDateTime(cart.paid_at)}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="mt-6 space-y-3">
            <Link
              href="/exam-prep"
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1566b8] text-sm font-semibold text-white hover:bg-[#0f5294]"
            >
              শেখা শুরু করুন
            </Link>
            <Link href="/settings/payments" className="inline-block text-xs font-semibold text-[#1566b8] hover:underline">
              রসিদ ও পেমেন্ট ইতিহাস দেখুন →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* PDF Page 69: পেমেন্ট ব্যর্থ হয়েছে */
  if (cart.status === 'failed') {
    return (
      <div className="mx-auto max-w-lg py-6">
        <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fdecec] text-[#d9383a]">
            <XCircle className="h-9 w-9" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#0a2f5b]">পেমেন্ট যাচাই সফল হয়নি</h1>
          <p className="mt-2 text-sm text-slate-600">
            কারণ: {cart.failure_reason ?? 'ট্রানজ্যাকশন তথ্য মেলেনি।'} এখনো কোনো অ্যাক্সেস চালু হয়নি।
          </p>
          {error ? <Alert variant="error" className="mt-4 text-left">{error}</Alert> : null}

          <div className="mt-6 space-y-3">
            <Button
              className="h-11 w-full rounded-xl bg-[#1566b8] text-white hover:bg-[#0f5294]"
              disabled={busy}
              onClick={() => void retry()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              আবার চেষ্টা করুন
            </Button>
            <Link href="/user-questions" className="inline-block text-xs font-semibold text-[#1566b8] hover:underline">
              সমস্যা হচ্ছে? সহায়তা নিন
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* PDF Page 70: পেমেন্ট বাতিল করা হয়েছে */
  if (cart.status !== 'pending') {
    return (
      <div className="mx-auto max-w-lg py-6">
        <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Clock className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#0a2f5b]">
            {cart.status === 'expired' ? 'চেকআউটের সময় শেষ হয়েছে' : 'পেমেন্ট বাতিল করা হয়েছে'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">কোনো টাকা কাটা হয়নি। চাইলে কোর্স পেজ থেকে আবার চেষ্টা করুন।</p>
          <div className="mt-6">
            <Link
              href="/packages?tab=exam_prep"
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1566b8] text-sm font-semibold text-white hover:bg-[#0f5294]"
            >
              কোর্স দেখুন
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* PDF Page 71: আমরা আপনার পেমেন্ট নিশ্চিত করছি */
  if (cart.trx_id) {
    return (
      <div className="mx-auto max-w-lg py-6">
        <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff4d6] text-[#d97706]">
            <Clock className="h-9 w-9" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#0a2f5b]">আমরা আপনার পেমেন্ট নিশ্চিত করছি</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            ট্রানজ্যাকশন আইডি <strong className="font-mono text-[#0a2f5b]">{cart.trx_id}</strong> যাচাই চলছে। অনুমোদনের সাথে সাথেই আপনার বিষয়সমূহ চালু হয়ে যাবে।
          </p>

          <div className="mt-6 text-left">
            <Items cart={cart} />
          </div>

          <div className="mt-6 space-y-3">
            <Link
              href="/settings/payments"
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1566b8] text-sm font-semibold text-white hover:bg-[#0f5294]"
            >
              আমার কোর্স দেখুন
            </Link>
            <Link href="/learning" className="inline-block text-xs font-semibold text-slate-500 hover:text-[#0a2f5b]">
              হোমে ফিরে যান
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* PDF Page 9: চেকআউট (2-Column Layout) */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0a2f5b] sm:text-3xl">চেকআউট</h1>
        <p className="mt-1 text-sm text-slate-600">নির্বাচিত প্যাকেজসমূহ দেখে নিন এবং বিকাশে পেমেন্ট সম্পন্ন করুন।</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitClaim();
        }}
        className="grid items-start gap-6 lg:grid-cols-[1fr_340px]"
      >
        <div className="space-y-5">
          <section className="rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-[#1566b8]" />
              <h2 className="text-base font-bold text-[#0a2f5b]">অর্ডারের সারাংশ ({bn(cart.orders.length)}টি আইটেম)</h2>
            </div>
            <Items cart={cart} />

            <dl className="mt-4 space-y-2 border-t border-[#eef4f9] pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">উপমোট</dt>
                <dd className="font-semibold text-[#0a2f5b]">{formatBdt(cart.price)}</dd>
              </div>
              {cart.charge > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-slate-500">{cart.charge_label}</dt>
                  <dd className="font-semibold text-[#0a2f5b]">{formatBdt(cart.charge)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-[#eef4f9] pt-2 text-base font-extrabold text-[#0a2f5b]">
                <dt>সর্বমোট</dt>
                <dd>{formatBdt(cart.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0a2f5b]">পেমেন্টের মাধ্যম</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f8ef] px-2.5 py-0.5 text-xs font-bold text-[#156f4d]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                নির্বাচিত
              </span>
            </div>

            <div className="mt-3 rounded-xl border-2 border-[#1566b8] bg-[#f4f9fd] p-4">
              <p className="font-bold text-[#0a2f5b]">বিকাশ (bKash)</p>
              <p className="mt-0.5 text-xs text-slate-600">
                বিকাশ নম্বর:{' '}
                <strong className="font-mono text-sm text-[#1566b8]">
                  {bkashNumber || 'অ্যাডমিন নির্ধারিত নম্বর'}
                </strong>{' '}
                এ <strong>{formatBdt(cart.total)}</strong> পাঠিয়ে নিচের তথ্যগুলো দিন।
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-xs font-semibold text-[#0a2f5b]" htmlFor="cart-trx">
                ট্রানজ্যাকশন আইডি (TrxID) *
                <input
                  id="cart-trx"
                  required
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  placeholder="যেমন: BK7X92QA41"
                  className="h-10 w-full rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] px-3 font-mono text-sm uppercase outline-none focus:border-[#1566b8] focus:bg-white"
                />
              </label>

              <label className="block space-y-1.5 text-xs font-semibold text-[#0a2f5b]" htmlFor="cart-amount">
                পাঠানো পরিমাণ (৳) *
                <input
                  id="cart-amount"
                  required
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  enterKeyHint="done"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
                  placeholder={String(cart.total)}
                  className="h-10 w-full rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] px-3 text-sm outline-none focus:border-[#1566b8] focus:bg-white"
                />
              </label>

              <label className="block space-y-1.5 text-xs font-semibold text-[#0a2f5b] sm:col-span-2" htmlFor="cart-from">
                আপনার বিকাশ নম্বর <span className="font-normal text-slate-500">(ঐচ্ছিক, দিলে ১১ সংখ্যা হতে হবে)</span>
                <input
                  id="cart-from"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={11}
                  value={sender}
                  onChange={(e) => setSender(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="01XXXXXXXXX"
                  className="h-10 w-full rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] px-3 text-sm outline-none focus:border-[#1566b8] focus:bg-white"
                />
              </label>
            </div>

            <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <Lock className="h-3.5 w-3.5 shrink-0 text-[#1566b8]" />
              পিন বা ওটিপি কখনোই এখানে দেবেন না। শুধুমাত্র পেমেন্ট শেষে প্রাপ্ত ট্রানজ্যাকশন আইডি জমা দিন।
            </p>
          </section>
        </div>

        <aside className="rounded-2xl border border-[#d7e4ee] bg-white p-6 shadow-xs lg:sticky lg:top-20">
          <h2 className="text-base font-bold text-[#0a2f5b]">পেমেন্ট নিশ্চিত করুন</h2>
          <div className="mt-3 flex items-baseline justify-between border-b border-[#eef4f9] pb-3">
            <span className="text-sm text-slate-500">মোট প্রদেয়</span>
            <span className="text-2xl font-extrabold text-[#0a2f5b]">{formatBdt(cart.total)}</span>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-[#1566b8]"
            />
            <span>আমি প্রদত্ত অর্ডারের বিবরণ যাচাই করেছি এবং পেমেন্ট তথ্য জমা দিচ্ছি।</span>
          </label>

          {error ? <Alert variant="error" className="mt-4">{error}</Alert> : null}

          <div className="mt-5 space-y-2.5">
            <Button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-xl bg-[#1566b8] text-sm font-semibold text-white hover:bg-[#0f5294]"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              বিকাশ পেমেন্ট জমা দিন
            </Button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void close()}
              className="block w-full py-2 text-center text-xs font-semibold text-slate-500 hover:text-[#0a2f5b]"
            >
              বাতিল করে ফিরে যান
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}
