'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { daysFromToday, formatDdMmYyyy } from '@/lib/date-display';
import { toBanglaDigits } from '@/lib/bangla-format';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface RoutineListItem {
  exam_name_id: string;
  exam_name: string;
  start_date: string;
  start_date_note?: string;
}

const BN_MONTH_SHORT = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function parseDateBox(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: '—', month: '' };
  return {
    day: bn(d.getDate()),
    month: BN_MONTH_SHORT[d.getMonth()] ?? '',
  };
}

function countdownLabel(days: number): string {
  if (days > 0) return `${bn(days)} দিন বাকি`;
  if (days === 0) return 'আজ পরীক্ষা';
  return `${bn(Math.abs(days))} দিন আগে`;
}

export default function ExamRoutineListPage() {
  const [items, setItems] = useState<RoutineListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: RoutineListItem[] }>('/exam-routine/list')
      .then((res) => setItems(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'রুটিন লোড করা যায়নি'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a2f5b] sm:text-3xl">পরীক্ষার রুটিন ও ক্যালেন্ডার</h1>
          <p className="mt-1 text-sm text-slate-600">পরীক্ষার সময়সূচি, অবশিষ্ট দিন ও বিষয়ভিত্তিক নির্দেশনাসমূহ।</p>
        </div>
        <Link
          href="/exam-prep"
          className="rounded-xl bg-[#1566b8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f5294]"
        >
          পরীক্ষা প্রস্তুতি দেখুন
        </Link>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-[#d7e4ee] bg-white p-8 text-center">
          <CalendarDays className="mx-auto h-9 w-9 text-[#7eb6ea]" />
          <p className="mt-2 font-bold text-[#0a2f5b]">এখনো কোনো পরীক্ষার রুটিন প্রকাশিত হয়নি</p>
          <p className="mt-1 text-xs text-slate-500">কর্তৃপক্ষ রুটিন প্রকাশ করলে তা এখানে স্বয়ংক্রিয়ভাবে যুক্ত হবে।</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((r) => {
            const days = daysFromToday(r.start_date);
            const box = parseDateBox(r.start_date);
            return (
              <Link
                key={r.exam_name_id}
                href={`/exam-routine/${r.exam_name_id}`}
                className="flex items-center gap-4 rounded-2xl border border-[#d7e4ee] bg-white p-4 shadow-xs transition hover:border-[#1566b8] hover:shadow-sm sm:p-5"
              >
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[#eaf3fc] text-[#1566b8]">
                  <span className="text-[11px] font-bold">{box.month}</span>
                  <span className="text-lg font-extrabold leading-none text-[#0a2f5b]">{box.day}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-[#0a2f5b]">{r.exam_name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    শুরুর তারিখ: {toBanglaDigits(formatDdMmYyyy(r.start_date))}
                    {r.start_date_note?.trim() ? ` · ${r.start_date_note.trim()}` : ''}
                  </p>
                </div>

                <span
                  className={
                    days >= 0
                      ? 'shrink-0 rounded-full bg-[#eaf3fc] px-3 py-1 text-xs font-bold text-[#1566b8]'
                      : 'shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600'
                  }
                >
                  {countdownLabel(days)}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
