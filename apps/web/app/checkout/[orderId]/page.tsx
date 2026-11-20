'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Clock, GraduationCap, Loader2, Lock, XCircle } from 'lucide-react';
import { formatBdt, type PaymentOrderRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { accessDate, accessDateTime, durationLabel } from '@/lib/billing-format';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const OPEN_HREF: Record<PaymentOrderRecord['kind'], { href: string; label: string }> = {
  exam_prep: { href: '/exam-prep', label: 'শেখা শুরু করুন' },
  basic: { href: '/learning', label: 'হোমে যান' },
  live: { href: '/live', label: 'লাইভ ক্লাসে যান' },
};

const KIND_BN: Record<PaymentOrderRecord['kind'], string> = {
  exam_prep: 'পরীক্ষা প্রস্তুতি',
  live: 'লাইভ ক্লাস প্যাকেজ',
  basic: 'বেসিক মডিউল',
};

function SummaryBox({ order }: { order: PaymentOrderRecord }) {
  return (
    <dl className="space-y-2.5 rounded-xl bg-[#f4f9fd] p-4 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-slate-500">আইটেম</dt>
        <dd className="text-right font-bold text-[#0a2f5b]">{order.package_name}</dd>
      </div>
      {(order.exam_part_name || order.exam_subject_name) ? (
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">বিষয় / পার্ট</dt>
          <dd className="text-right font-medium text-[#0a2f5b]">
            {[order.exam_part_name, order.exam_subject_name].filter(Boolean).join(' · ')}
          </dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-4">
        <dt className="text-slate-500">পরিমাণ</dt>
        <dd className="font-bold text-[#0a2f5b]">{formatBdt(order.total)}</dd>
      </div>
      {order.trx_id ? (
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">ট্রানজ্যাকশন আইডি</dt>
          <dd className="font-mono font-semibold text-[#0a2f5b]">{order.trx_id}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-4">
        <dt className="text-slate-500">ইনভয়েস</dt>
        <dd className="font-mono text-xs text-slate-600">{order.invoice_no}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-slate-500">অ্যাক্সেস</dt>
        <dd className="font-medium text-[#0a2f5b]">
          {order.status === 'paid'
            ? `${accessDate(order.access_starts_at)} → ${accessDate(order.access_ends_at)}`
            : durationLabel(order.duration_days)}
        </dd>
      </div>
      {order.paid_at ? (
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">অনুমোদনের সময়</dt>
          <dd className="text-xs text-slate-600">{accessDateTime(order.paid_at)}</dd>
        </div>
      ) : null}
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
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ data: { settings: { bkash_number?: string } } }>('/billing/catalog')
      .then((r) => setBkashNumber(r.data.settings.bkash_number ?? ''))
      .catch(() => undefined);
    apiFetch<{ data: PaymentOrderRecord }>(`/billing/orders/${params.orderId}`)
      .then((r) => {
        if (r.data.cart_id && r.data.status === 'pending') router.replace(`/checkout/cart/${r.data.cart_id}`);
        else {
          setOrder(r.data);
          setAmount(String(r.data.total));
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'অর্ডার পাওয়া যায়নি'));
  }, [params.orderId, router]);

  async function submitClaim() {
    setError('');
    if (!agreed) return setError('এগিয়ে যেতে সম্মতি টিক চিহ্ন দিন');
    if (trxId.trim().length < 4) return setError('সঠিক বিকাশ ট্রানজ্যাকশন আইডি দিন');
    const sent = Number(amount);
    if (!Number.isFinite(sent) || sent <= 0) return setError('পাঠানো টাকার পরিমাণ লিখুন');
    if (sender.trim() && !/^01[3-9]\d{8}$/.test(sender.trim())) return setError('বিকাশ নম্বর অবশ্যই ১১ সংখ্যার হতে হবে');
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
      setError(e instanceof Error ? e.message : 'পেমেন্ট তথ্য জমা দেওয়া যায়নি');
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
  if (!order) return <Skeleton className="mx-auto h-96 w-full max-w-3xl rounded-2xl" />;

  /* PDF Page 10: পেমেন্ট সফল হয়েছে */
  if (order.status === 'paid') {
    const open = OPEN_HREF[order.kind];
    return (
      <div className="mx-auto max-w-lg py-6">
        <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f8ef] text-[#1f9d68]">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#0a2f5b]">পেমেন্ট সফল হয়েছে</h1>
          <p className="mt-1 text-sm text-slate-600">আপনার কোর্স ও বিষয় এখন চালু। শেখা শুরু করুন।</p>

          <div className="mt-6 text-left">
            <SummaryBox order={order} />
          </div>

          <div className="mt-6 space-y-3">
            <Link
              href={open.href}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1566b8] text-sm font-semibold text-white hover:bg-[#0f5294]"
            >
              {open.label}
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
  if (order.status === 'failed') {
    return (
      <div className="mx-auto max-w-lg py-6">
        <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fdecec] text-[#d9383a]">
            <XCircle className="h-9 w-9" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#0a2f5b]">পেমেন্ট যাচাই সফল হয়নি</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            কারণ: {order.failure_reason ?? 'ট্রানজ্যাকশন তথ্য মেলেনি।'} কোর্সে এখনো প্রবেশাধিকার চালু হয়নি।
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
  if (order.status !== 'pending') {
    return (
      <div className="mx-auto max-w-lg py-6">
        <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Clock className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#0a2f5b]">
            {order.status === 'expired' ? 'চেকআউটের সময় শেষ হয়েছে' : 'পেমেন্ট বাতিল করা হয়েছে'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            কোনো টাকা কাটা হয়নি। চাইলে কোর্স পেজে ফিরে আবার চেষ্টা করতে পারেন।
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href={`/packages?tab=${order.kind}`}
              className="flex h-11 flex-1 items-center justify-center rounded-xl bg-[#1566b8] text-sm font-semibold text-white hover:bg-[#0f5294]"
            >
              কোর্স দেখুন
            </Link>
            <Link
              href="/learning"
              className="flex h-11 flex-1 items-center justify-center rounded-xl border border-[#d7e4ee] text-sm font-semibold text-[#0a2f5b]"
            >
              হোমে ফিরে যান
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* PDF Page 71: আমরা আপনার পেমেন্ট নিশ্চিত করছি */
  if (order.trx_id) {
    return (
      <div className="mx-auto max-w-lg py-6">
        <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff4d6] text-[#d97706]">
            <Clock className="h-9 w-9" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#0a2f5b]">আমরা আপনার পেমেন্ট নিশ্চিত করছি</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            আপনার ট্রানজ্যাকশন যাচাই চলছে। অনুমোদিত হলেই আপনার কোর্স চালু হয়ে যাবে। পেজটি বন্ধ করে দিলেও কোনো সমস্যা নেই।
          </p>

          <div className="mt-6 text-left">
            <SummaryBox order={order} />
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
        <p className="mt-1 text-sm text-slate-600">অর্ডার দেখে নিন, তারপর বিকাশে পেমেন্ট করে ট্রানজ্যাকশন আইডি দিন।</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitClaim();
        }}
        className="grid items-start gap-6 lg:grid-cols-[1fr_340px]"
      >
        <div className="space-y-5">
          {/* অর্ডারের সারাংশ */}
          <section className="rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs sm:p-6">
            <h2 className="text-base font-bold text-[#0a2f5b]">অর্ডারের সারাংশ</h2>
            <div className="mt-4 flex items-start gap-4 rounded-xl bg-[#f4f9fd] p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0a2f5b] text-white">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#1566b8]">একবার কেনা · {KIND_BN[order.kind]}</p>
                <p className="mt-0.5 font-bold text-[#0a2f5b]">{order.package_name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {[order.exam_part_name, order.exam_subject_name, `${durationLabel(order.duration_days)} অ্যাক্সেস`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <span className="shrink-0 font-bold text-[#0a2f5b]">{formatBdt(order.price)}</span>
            </div>

            <dl className="mt-4 space-y-2 border-t border-[#eef4f9] pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">প্যাকেজ মূল্য</dt>
                <dd className="font-semibold text-[#0a2f5b]">{formatBdt(order.price)}</dd>
              </div>
              {order.charge > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-slate-500">{order.charge_label}</dt>
                  <dd className="font-semibold text-[#0a2f5b]">{formatBdt(order.charge)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-[#eef4f9] pt-2 text-base font-extrabold text-[#0a2f5b]">
                <dt>মোট</dt>
                <dd>{formatBdt(order.total)}</dd>
              </div>
            </dl>
          </section>

          {/* পেমেন্টের মাধ্যম: বিকাশ */}
          <section className="rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0a2f5b]">পেমেন্টের মাধ্যম</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f8ef] px-2.5 py-0.5 text-xs font-bold text-[#156f4d]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                নির্বাচিত
              </span>
            </div>

            <div className="mt-3 rounded-xl border-2 border-[#1566b8] bg-[#f4f9fd] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-[#0a2f5b]">বিকাশ (bKash Send Money / Payment)</p>
                  <p className="text-xs text-slate-600">
                    বিকাশ নম্বর:{' '}
                    <strong className="font-mono text-sm text-[#1566b8]">
                      {bkashNumber || 'অ্যাডমিন নির্ধারিত নম্বর'}
                    </strong>{' '}
                    এ <strong>{formatBdt(order.total)}</strong> পাঠিয়ে নিচের ঘরগুলো পূরণ করুন।
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-xs font-semibold text-[#0a2f5b]" htmlFor="bk-trx">
                ট্রানজ্যাকশন আইডি (TrxID) *
                <input
                  id="bk-trx"
                  required
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  placeholder="যেমন: BK7X92QA41"
                  className="h-10 w-full rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] px-3 font-mono text-sm uppercase outline-none focus:border-[#1566b8] focus:bg-white"
                />
              </label>

              <label className="block space-y-1.5 text-xs font-semibold text-[#0a2f5b]" htmlFor="bk-amount">
                পাঠানো পরিমাণ (৳) *
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
                  className="h-10 w-full rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] px-3 text-sm outline-none focus:border-[#1566b8] focus:bg-white"
                />
              </label>

              <label className="block space-y-1.5 text-xs font-semibold text-[#0a2f5b] sm:col-span-2" htmlFor="bk-from">
                আপনার বিকাশ নম্বর <span className="font-normal text-slate-500">(ঐচ্ছিক, দিলে ১১ সংখ্যা হতে হবে)</span>
                <input
                  id="bk-from"
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

        {/* Right Action Card (PDF p9) */}
        <aside className="rounded-2xl border border-[#d7e4ee] bg-white p-6 shadow-xs lg:sticky lg:top-20">
          <h2 className="text-base font-bold text-[#0a2f5b]">পেমেন্ট নিশ্চিত করুন</h2>
          <div className="mt-3 flex items-baseline justify-between border-b border-[#eef4f9] pb-3">
            <span className="text-sm text-slate-500">মোট প্রদেয়</span>
            <span className="text-2xl font-extrabold text-[#0a2f5b]">{formatBdt(order.total)}</span>
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

          <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
            জমা দেওয়ার পর রসিদ ও বর্তমান অবস্থা ‘আমার কোর্স’ পেমেন্ট ইতিহাসে সংরক্ষিত থাকবে।
          </p>
        </aside>
      </form>
    </div>
  );
}
