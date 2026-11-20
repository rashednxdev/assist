'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown, ChevronUp, GraduationCap, ShoppingBag, Video } from 'lucide-react';
import {
  formatBdt,
  PAYMENT_METHOD_LABELS,
  type MyAccessSummary,
  type PaymentOrderRecord,
  type PreparationSubjectSummary,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { accessDate, accessDateTime, daysLeft, durationLabel, ORDER_STATUS_BADGE } from '@/lib/billing-format';
import { toBanglaDigits } from '@/lib/bangla-format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const ORDER_STATUS_BN: Record<PaymentOrderRecord['status'], string> = {
  paid: 'পরিশোধিত',
  pending: 'অপেক্ষমাণ',
  failed: 'ব্যর্থ',
  cancelled: 'বাতিল',
  expired: 'মেয়াদোত্তীর্ণ',
};

const KIND_BN: Record<PaymentOrderRecord['kind'], string> = {
  exam_prep: 'পরীক্ষা প্রস্তুতি',
  live: 'লাইভ ক্লাস',
  basic: 'বেসিক মডিউল',
};

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function OrderRow({ order }: { order: PaymentOrderRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3.5 first:pt-1 last:pb-0">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0">
          <p className="font-bold text-[#0a2f5b]">{order.package_name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {KIND_BN[order.kind]}
            {order.exam_part_name ? ` · ${order.exam_part_name}` : ''}
            {order.exam_subject_name ? ` · ${order.exam_subject_name}` : ''} · {accessDateTime(order.created_at)} ·{' '}
            {order.invoice_no}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-bold text-[#0a2f5b]">{formatBdt(order.total)}</span>
          <Badge variant={ORDER_STATUS_BADGE[order.status]}>{ORDER_STATUS_BN[order.status]}</Badge>
          {order.access_revoked ? <Badge variant="destructive">বাতিলকৃত</Badge> : null}
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {open ? (
        <dl className="mt-3 grid gap-x-6 gap-y-2 rounded-xl bg-[#f4f9fd] p-4 text-xs sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">মূল্য</dt>
            <dd className="font-semibold text-[#0a2f5b]">{formatBdt(order.price)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">{order.charge_label}</dt>
            <dd className="font-semibold text-[#0a2f5b]">{formatBdt(order.charge)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">মাধ্যম</dt>
            <dd className="font-medium text-[#0a2f5b]">{PAYMENT_METHOD_LABELS[order.method]}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">মেয়াদ</dt>
            <dd className="font-medium text-[#0a2f5b]">{durationLabel(order.duration_days)}</dd>
          </div>
          {order.payer_account ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">বিকাশ নম্বর</dt>
              <dd className="font-mono">{order.payer_account}</dd>
            </div>
          ) : null}
          {order.trx_id ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">ট্রানজ্যাকশন আইডি</dt>
              <dd className="font-mono font-semibold text-[#0a2f5b]">{order.trx_id}</dd>
            </div>
          ) : null}
          {order.status === 'paid' ? (
            <div className="flex justify-between gap-2 sm:col-span-2">
              <dt className="text-slate-500">অ্যাক্সেস সময়কাল</dt>
              <dd className="font-medium text-[#0a2f5b]">
                {accessDate(order.access_starts_at)} → {accessDate(order.access_ends_at)}
              </dd>
            </div>
          ) : null}
          {order.failure_reason ? (
            <div className="flex justify-between gap-2 sm:col-span-2">
              <dt className="text-red-600">কারণ</dt>
              <dd className="text-red-700">{order.failure_reason}</dd>
            </div>
          ) : null}
          {order.status === 'pending' ? (
            <div className="pt-1 sm:col-span-2">
              <Button asChild size="sm" className="rounded-xl bg-[#1566b8] hover:bg-[#0f5294]">
                <Link href={`/checkout/${order.id}`}>
                  {order.trx_id ? 'পেমেন্ট স্ট্যাটাস দেখুন' : 'পেমেন্ট সম্পন্ন করুন'}
                </Link>
              </Button>
            </div>
          ) : null}
        </dl>
      ) : null}
    </li>
  );
}

export default function SettingsPaymentsPage() {
  const [access, setAccess] = useState<MyAccessSummary | null>(null);
  const [orders, setOrders] = useState<PaymentOrderRecord[] | null>(null);
  const [subjects, setSubjects] = useState<PreparationSubjectSummary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: MyAccessSummary }>('/billing/my-access'),
      apiFetch<{ data: PaymentOrderRecord[] }>('/billing/orders'),
      apiFetch<{ data: PreparationSubjectSummary[] }>('/exam-prep/subjects').catch(() => ({
        data: [] as PreparationSubjectSummary[],
      })),
    ])
      .then(([a, o, s]) => {
        setAccess(a.data);
        setOrders(o.data);
        setSubjects(s.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'তথ্য লোড করা যায়নি'));
  }, []);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!access || !orders) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const enrolledSubjects = subjects.filter((s) => s.owned);
  const totalOngoing = enrolledSubjects.length + access.live_packages.length + (access.basic_until ? 1 : 0);

  return (
    <div className="space-y-7">
      {/* PDF Page 11 Header: আমার কোর্স */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a2f5b] sm:text-3xl">আমার কোর্স</h1>
          <p className="mt-1 text-sm text-slate-600">আপনার কেনা কোর্স, পরীক্ষা প্রস্তুতি ও পেমেন্ট ইতিহাস এক জায়গায়।</p>
        </div>
        <Link
          href="/packages"
          className="inline-flex items-center gap-2 rounded-xl border border-[#1566b8] bg-white px-4 py-2 text-xs font-semibold text-[#1566b8] transition hover:bg-[#1566b8] hover:text-white"
        >
          <ShoppingBag className="h-4 w-4" />
          নতুন কোর্স দেখুন
        </Link>
      </div>

      {/* Section A: চলমান কোর্স ও বিষয়সমূহ (PDF Page 11 Horizontal Progress Cards) */}
      <section className="space-y-3.5">
        <h2 className="text-base font-bold text-[#0a2f5b]">চলমান · {bn(totalOngoing)}টি</h2>

        {totalOngoing === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#b8d1ea] bg-white p-6 text-center">
            <p className="font-bold text-[#0a2f5b]">আপনার এখনো কোনো চলমান কোর্স বা বিষয় নেই</p>
            <p className="mt-1 text-xs text-slate-500">
              পছন্দের বিষয়ে এনরোল করলে অগ্রগতি, লাইভ ক্লাস ও মেয়াদ এখানে দেখা যাবে।
            </p>
            <Link
              href="/packages"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#1566b8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f5294]"
            >
              কোর্স ও প্যাকেজ দেখুন
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {enrolledSubjects.map((subj) => {
              const title = subj.name_bn?.trim() || subj.name;
              const left = subj.owned_until ? daysLeft(subj.owned_until) : null;
              const done = subj.written_read + subj.mcq_touched;
              const total = subj.written + subj.mcq;

              return (
                <div
                  key={subj.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0a2f5b] text-white">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#eaf3fc] px-2.5 py-0.5 text-[11px] font-semibold text-[#1566b8]">
                          পরীক্ষা প্রস্তুতি · {subj.part_label}
                        </span>
                        {subj.next_class ? (
                          <span className="rounded-full bg-[#e6f6f8] px-2.5 py-0.5 text-[11px] font-bold text-[#0e7490]">
                            সামনে লাইভ ক্লাস
                          </span>
                        ) : null}
                        {left !== null && left <= 7 ? (
                          <span className="rounded-full bg-[#fff3d6] px-2.5 py-0.5 text-[11px] font-bold text-[#b45309]">
                            {bn(left)} দিন বাকি
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-1.5 text-base font-bold text-[#0a2f5b]">{title}</h3>

                      <div className="mt-2.5 flex max-w-md items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e6eff7]">
                          <div
                            className="h-full rounded-full bg-[#1566b8]"
                            style={{ width: `${Math.max(subj.progress_percent, 4)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-[#0a2f5b]">{bn(subj.progress_percent)}%</span>
                      </div>

                      <p className="mt-1.5 text-xs text-slate-500">
                        {bn(done)} / {bn(total)} আইটেম সম্পন্ন
                        {subj.owned_until ? ` · অ্যাক্সেস শেষ: ${accessDate(subj.owned_until)}` : ''}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/exam-prep/${subj.id}`}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#1566b8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0f5294]"
                  >
                    চালিয়ে যান
                  </Link>
                </div>
              );
            })}

            {access.live_packages.map((lp) => (
              <div
                key={lp.package_id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1f8a96] text-white">
                    <Video className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="rounded-full bg-[#e6f6f8] px-2.5 py-0.5 text-[11px] font-bold text-[#0e7490]">
                      লাইভ ক্লাস প্যাকেজ
                    </span>
                    <h3 className="mt-1.5 text-base font-bold text-[#0a2f5b]">{lp.package_name}</h3>
                    <p className="mt-1 text-xs text-slate-500">অ্যাক্সেস শেষ: {accessDate(lp.until)}</p>
                  </div>
                </div>
                <Link
                  href="/live"
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#1566b8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0f5294]"
                >
                  ক্লাস দেখুন
                </Link>
              </div>
            ))}

            {access.basic_until ? (
              <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs sm:flex-row sm:items-center">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1566b8] text-white">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="rounded-full bg-[#eaf3fc] px-2.5 py-0.5 text-[11px] font-semibold text-[#1566b8]">
                      বেসিক মডিউল
                    </span>
                    <h3 className="mt-1.5 text-base font-bold text-[#0a2f5b]">বেসিক ওয়ার্কস্পেস অ্যাক্সেস</h3>
                    <p className="mt-1 text-xs text-slate-500">অ্যাক্সেস শেষ: {accessDate(access.basic_until)}</p>
                  </div>
                </div>
                <Link
                  href="/learning"
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#1566b8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0f5294]"
                >
                  চালিয়ে যান
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* Section B: পেমেন্ট ও রসিদ ইতিহাস */}
      <section className="rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-center justify-between border-b border-[#eef4f9] pb-3">
          <h2 className="text-base font-bold text-[#0a2f5b]">পেমেন্ট ও রসিদ ইতিহাস</h2>
          <span className="text-xs text-slate-500">{bn(orders.length)}টি লেনদেন</span>
        </div>

        {orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">এখনো কোনো পেমেন্ট বা অর্ডার করা হয়নি।</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#eef4f9]">
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
