'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  BookOpen,
  CheckCircle2,
  FileText,
  GraduationCap,
  HelpCircle,
  Lock,
  Search,
  Video,
} from 'lucide-react';
import type { PreparationSubjectSummary } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { accessDate } from '@/lib/billing-format';
import { toBanglaDigits } from '@/lib/bangla-format';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const HEADER_TONES = ['bg-[#0a2f5b]', 'bg-[#1566b8]', 'bg-[#1f8a96]'];

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function EnrolledSubjectRow({ subject, index }: { subject: PreparationSubjectSummary; index: number }) {
  const title = subject.name_bn?.trim() || subject.name;
  const accuracy =
    subject.mcq_touched > 0 ? Math.round((subject.mcq_correct / subject.mcq_touched) * 100) : null;

  return (
    <Link
      href={`/exam-prep/${subject.id}`}
      className="group flex flex-col justify-between gap-4 rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs transition hover:border-[#1566b8] sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white ${HEADER_TONES[index % HEADER_TONES.length]}`}
        >
          <GraduationCap className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#eaf3fc] px-2.5 py-0.5 text-[11px] font-semibold text-[#1566b8]">
              {subject.part_label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f8ef] px-2.5 py-0.5 text-[11px] font-bold text-[#156f4d]">
              <CheckCircle2 className="h-3 w-3" />
              এনরোল করা
            </span>
            {subject.next_class ? (
              <span className="rounded-full bg-[#e6f6f8] px-2.5 py-0.5 text-[11px] font-semibold text-[#0e7490]">
                সামনে লাইভ ক্লাস
              </span>
            ) : null}
          </div>

          <h3 className="mt-1.5 text-lg font-bold text-[#0a2f5b] group-hover:text-[#1566b8]">{title}</h3>
          {subject.name_bn?.trim() ? <p className="text-xs text-slate-500">{subject.name}</p> : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span>{bn(subject.books)}টি বই</span>
            <span>
              লিখিত: {bn(subject.written_read)}/{bn(subject.written)} পড়া
            </span>
            <span>
              MCQ: {bn(subject.mcq_touched)}/{bn(subject.mcq)} উত্তর করা
              {accuracy !== null ? ` (${bn(accuracy)}% সঠিক)` : ''}
            </span>
            <span>{bn(subject.papers)}টি বিগত সেট</span>
            <span>{bn(subject.past_classes)}টি সম্পন্ন ক্লাস</span>
          </div>

          <div className="mt-3 flex max-w-md items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e6eff7]">
              <div
                className="h-full rounded-full bg-[#1566b8] transition-all"
                style={{ width: `${Math.max(subject.progress_percent, 4)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-[#0a2f5b]">{bn(subject.progress_percent)}%</span>
          </div>
          {subject.owned_until ? (
            <p className="mt-1.5 text-[11px] text-slate-400">অ্যাক্সেস মেয়াদ: {accessDate(subject.owned_until)}</p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center sm:pl-3">
        <span className="inline-flex w-full items-center justify-center rounded-xl bg-[#1566b8] px-4 py-2.5 text-sm font-semibold text-white transition group-hover:bg-[#0f5294] sm:w-auto">
          ওয়ার্কস্পেসে যান
        </span>
      </div>
    </Link>
  );
}

function AvailableSubjectCard({ subject, index }: { subject: PreparationSubjectSummary; index: number }) {
  const title = subject.name_bn?.trim() || subject.name;
  const examPkg = subject.packages
    .filter((p) => p.kind === 'exam_prep')
    .sort((a, b) => a.price - b.price)[0];
  const hasLivePkg = subject.packages.some((p) => p.kind === 'live');

  return (
    <Link
      href={`/exam-prep/${subject.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[#d7e4ee] bg-white shadow-xs transition hover:border-[#1566b8] hover:shadow-sm"
    >
      <div className={`flex h-24 items-center justify-between px-5 text-white ${HEADER_TONES[index % HEADER_TONES.length]}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
            {subject.part_label}
          </span>
          {hasLivePkg ? (
            <span className="rounded-full bg-[#28b8d8]/25 px-2.5 py-0.5 text-[11px] font-semibold text-[#9ef0ff]">
              লাইভ ক্লাসসহ
            </span>
          ) : null}
        </div>
        <BookOpen className="h-7 w-7 text-white/75" />
      </div>

      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-[#eaf3fc] px-2.5 py-0.5 text-[11px] font-semibold text-[#1566b8]">
              পরীক্ষা প্রস্তুতি
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <Lock className="h-3 w-3" />
              সারাংশ উন্মুক্ত
            </span>
          </div>

          <h3 className="mt-2.5 line-clamp-2 text-base font-bold text-[#0a2f5b] group-hover:text-[#1566b8]">
            {title}
          </h3>
          {subject.name_bn?.trim() ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{subject.name}</p>
          ) : null}

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#f4f9fd] p-3 text-center">
            <div>
              <p className="text-sm font-extrabold text-[#0a2f5b]">{bn(subject.books)}</p>
              <p className="text-[11px] text-slate-500">বই</p>
            </div>
            <div>
              <p className="text-sm font-extrabold text-[#0a2f5b]">{bn(subject.written)}</p>
              <p className="text-[11px] text-slate-500">লিখিত</p>
            </div>
            <div>
              <p className="text-sm font-extrabold text-[#0a2f5b]">{bn(subject.mcq)}</p>
              <p className="text-[11px] text-slate-500">MCQ</p>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-[#1566b8]" />
              {bn(subject.papers)}টি বিগত সেট
            </span>
            <span className="inline-flex items-center gap-1">
              <Video className="h-3.5 w-3.5 text-[#1566b8]" />
              {bn(subject.past_classes)}টি ক্লাস সম্পন্ন
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[#eef4f9] pt-3.5">
          <div>
            {examPkg ? (
              <>
                <p className="text-base font-extrabold text-[#0a2f5b]">
                  {examPkg.price === 0 ? 'ফ্রি' : `৳${examPkg.price.toLocaleString('bn-BD')}`}
                </p>
                <p className="text-[11px] text-slate-400">
                  {examPkg.whole_part ? 'পূর্ণ পার্ট প্যাকেজ' : 'বিষয়ভিত্তিক প্যাকেজ'}
                </p>
              </>
            ) : (
              <p className="text-xs font-semibold text-slate-500">রিসোর্স সারাংশ দেখুন</p>
            )}
          </div>
          <span className="rounded-xl border border-[#1566b8] px-3.5 py-1.5 text-xs font-semibold text-[#1566b8] transition group-hover:bg-[#1566b8] group-hover:text-white">
            বিস্তারিত
          </span>
        </div>
      </div>
    </Link>
  );
}

function ExamPreparationsInner() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [subjects, setSubjects] = useState<PreparationSubjectSummary[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(initialQ);
  const [partFilter, setPartFilter] = useState('all');

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
  }, [searchParams]);

  useEffect(() => {
    apiFetch<{ data: PreparationSubjectSummary[] }>('/exam-prep/subjects')
      .then((res) => setSubjects(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'লোড হয়নি'));
  }, []);

  const parts = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjects ?? []) {
      map.set(s.part_id, s.part_label);
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [subjects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (subjects ?? []).filter((s) => {
      if (partFilter !== 'all' && s.part_id !== partFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.name_bn ?? '').toLowerCase().includes(q) ||
        s.part_label.toLowerCase().includes(q)
      );
    });
  }, [subjects, partFilter, query]);

  const enrolled = filtered.filter((s) => s.owned);
  const others = filtered.filter((s) => !s.owned);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a2f5b] sm:text-3xl">Exam Preparations</h1>
          <p className="mt-1 text-sm text-slate-600">
            বিষয়ভিত্তিক প্রস্তুতি ওয়ার্কস্পেস — আপনার এনরোল করা বিষয়সমূহ সবার উপরে দেখানো হচ্ছে।
          </p>
        </div>
        <Link
          href="/packages?tab=exam_prep"
          className="rounded-xl border border-[#d7e4ee] bg-white px-4 py-2 text-sm font-semibold text-[#1566b8] hover:border-[#1566b8]"
        >
          সব কোর্স ও প্যাকেজ দেখুন
        </Link>
      </div>

      {/* PDF Filter Card (p7 style) */}
      <div className="space-y-3.5 rounded-2xl border border-[#d7e4ee] bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPartFilter('all')}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                partFilter === 'all'
                  ? 'bg-[#0a2f5b] text-white'
                  : 'border border-[#d7e4ee] bg-[#f4f9fd] text-[#0a2f5b] hover:border-[#1566b8]',
              )}
            >
              সব পার্ট ({bn((subjects ?? []).length)})
            </button>
            {parts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPartFilter(p.id)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                  partFilter === p.id
                    ? 'bg-[#1566b8] text-white'
                    : 'border border-[#d7e4ee] bg-[#f4f9fd] text-[#0a2f5b] hover:border-[#1566b8]',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="বিষয়ের নাম খুঁজুন..."
              className="h-9 w-full rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] pl-9 pr-3 text-sm text-[#0a2f5b] outline-none focus:border-[#1566b8] focus:bg-white"
            />
          </div>
        </div>

        {query.trim() ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef4f9] pt-3 text-xs text-slate-600">
            <span>
              “<strong>{query.trim()}</strong>” এর জন্য {bn(filtered.length)}টি বিষয় পাওয়া গেছে
            </span>
            <Link
              href={`/books/regulations?q=${encodeURIComponent(query.trim())}`}
              className="inline-flex items-center gap-1 font-semibold text-[#1566b8] hover:underline"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              রুলস লাইব্রেরিতে “{query.trim()}” খুঁজুন →
            </Link>
          </div>
        ) : null}
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

      {!subjects ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      ) : (
        <>
          {/* Section 1: Enrolled Subjects (Always on Top) */}
          {enrolled.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0a2f5b]">
                  আপনার এনরোল করা বিষয় · {bn(enrolled.length)}টি
                </h2>
              </div>
              <div className="space-y-3">
                {enrolled.map((subject, idx) => (
                  <EnrolledSubjectRow key={subject.id} subject={subject} index={idx} />
                ))}
              </div>
            </section>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#b8d1ea] bg-white/80 px-5 py-4 text-sm text-slate-600">
              আপনার এখনো কোনো বিষয় এনরোল করা নেই। নিচের যেকোনো বিষয়ের উপর ক্লিক করে সম্পূর্ণ রিসোর্স সারাংশ দেখুন এবং প্যাকেজে এনরোল করুন।
            </div>
          )}

          {/* Section 2: Non-Enrolled Subjects */}
          {others.length > 0 ? (
            <section className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0a2f5b]">
                  {enrolled.length > 0 ? `অন্যান্য বিষয়সমূহ · ${bn(others.length)}টি` : `সকল বিষয়সমূহ · ${bn(others.length)}টি`}
                </h2>
                <span className="text-xs text-slate-500">ক্লিক করলে সম্পূর্ণ রিসোর্স সারাংশ দেখা যাবে</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((subject, idx) => (
                  <AvailableSubjectCard key={subject.id} subject={subject} index={idx} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function ExamPreparationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
      <ExamPreparationsInner />
    </Suspense>
  );
}
