'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calculator,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  Sparkles,
  Target,
  Video,
} from 'lucide-react';
import type { PreparationSubjectSummary } from '@ibas/shared-types';
import { fetchMe, type MeUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api-client';
import { learningModuleAccess } from '@/lib/capabilities';
import { ArrearBillPrompt } from '@/components/learning/arrear-bill-prompt';
import { UpcomingClassesBlock } from '@/components/home/upcoming-classes-block';
import { HostClassesBlock } from '@/components/home/host-classes-block';
import { userDisplayName } from '@/lib/display-text';
import { toBanglaDigits } from '@/lib/bangla-format';
import { Skeleton } from '@/components/ui/skeleton';

interface HomeLive {
  id: string;
  topic: string;
  scheduled_at: string;
  status: string;
  exam_subject_name?: string;
  is_previous?: boolean;
  access_type?: 'free' | 'paid';
}

interface RoutineItem {
  exam_name_id: string;
  exam_name: string;
  start_date: string;
  start_date_note?: string;
}

interface HomePaper {
  id: string;
  name: string;
  exam_subject_name?: string;
  duration_minutes: number;
  question_count: number;
  is_published: boolean;
  is_exam_of_week?: boolean;
}

const BANGLA_MONTHS = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
const CARD_HEADERS = ['bg-[#0a2f5b]', 'bg-[#1566b8]', 'bg-[#1f8a96]'];

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function greetingNow(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'শুভ সকাল';
  if (hour < 17) return 'শুভ অপরাহ্ন';
  if (hour < 20) return 'শুভ সন্ধ্যা';
  return 'শুভ রাত্রি';
}

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function dateBoxParts(dateStr: string): { day: string; month: string } {
  const [, m, d] = dateStr.split('-').map(Number);
  return {
    day: bn(d ?? 1),
    month: BANGLA_MONTHS[(m ?? 1) - 1] ?? '',
  };
}

function formatClassWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('bn-BD', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeUntilShort(iso: string): string | null {
  const diff = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return null;
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `শুরু হতে ${bn(mins)} মিনিট বাকি`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs < 24) return `শুরু হতে ${bn(hrs)} ঘণ্টা ${rem > 0 ? `${bn(rem)} মি` : ''} বাকি`.trim();
  const days = Math.ceil(hrs / 24);
  return `${bn(days)} দিন পর`;
}

function nextLiveClass(rows: HomeLive[]): HomeLive | null {
  const live = rows.find((row) => row.status === 'live');
  if (live) return live;
  const now = Date.now();
  return (
    rows
      .filter((row) => !row.is_previous && row.status !== 'ended' && row.status !== 'cancelled' && new Date(row.scheduled_at).getTime() >= now - 60 * 60 * 1000)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null
  );
}

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null>(null);
  const [liveRows, setLiveRows] = useState<HomeLive[] | null>(null);
  const [subjects, setSubjects] = useState<PreparationSubjectSummary[] | null>(null);
  const [routines, setRoutines] = useState<RoutineItem[]>([]);
  const [papers, setPapers] = useState<HomePaper[]>([]);

  useEffect(() => {
    fetchMe()
      .then((res) => {
        setMe({ ...res.data, module_access: res.data.module_access ?? [] });
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  useEffect(() => {
    if (!me) return;
    apiFetch<{ data: HomeLive[] }>('/live-streams')
      .then((res) => setLiveRows(res.data))
      .catch(() => setLiveRows([]));
    apiFetch<{ data: PreparationSubjectSummary[] }>('/exam-prep/subjects')
      .then((res) => setSubjects(res.data))
      .catch(() => setSubjects([]));
    apiFetch<{ data: RoutineItem[] }>('/exam-routine/list')
      .then((res) => setRoutines(res.data))
      .catch(() => setRoutines([]));
    if (learningModuleAccess(me, 'PAPER').state === 'open') {
      apiFetch<{ data: HomePaper[] }>('/papers')
        .then((res) => setPapers(res.data.filter((p) => p.is_published)))
        .catch(() => setPapers([]));
    }
  }, [me]);

  const enrolled = useMemo(() => (subjects ?? []).filter((s) => s.owned), [subjects]);
  const offered = useMemo(() => (subjects ?? []).filter((s) => !s.owned), [subjects]);

  const upcomingRoutines = useMemo(
    () =>
      routines
        .map((r) => ({ ...r, days: daysUntil(r.start_date) }))
        .filter((r) => r.days >= 0)
        .sort((a, b) => a.days - b.days)
        .slice(0, 3),
    [routines],
  );

  const overallPrepPercent = useMemo(() => {
    if (enrolled.length === 0) return 0;
    const sum = enrolled.reduce((acc, s) => acc + s.progress_percent, 0);
    return Math.round(sum / enrolled.length);
  }, [enrolled]);

  const accuracySummary = useMemo(() => {
    const withMcq = (subjects ?? []).filter((s) => s.owned && s.mcq_touched > 0);
    const touched = withMcq.reduce((sum, s) => sum + s.mcq_touched, 0);
    const correct = withMcq.reduce((sum, s) => sum + s.mcq_correct, 0);
    const overall = touched > 0 ? Math.round((correct / touched) * 100) : 0;
    const rows = withMcq
      .map((s) => ({
        id: s.id,
        title: s.name_bn?.trim() || s.name,
        percent: Math.round((s.mcq_correct / s.mcq_touched) * 100),
        touched: s.mcq_touched,
      }))
      .sort((a, b) => b.percent - a.percent);
    const weakest = rows.length > 0 ? rows[rows.length - 1] : null;
    return { touched, correct, overall, rows: rows.slice(0, 4), weakest };
  }, [subjects]);

  if (!me) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-72 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    );
  }

  const name = me.full_name_bn?.trim() || userDisplayName(me);
  const nextClass = nextLiveClass(liveRows ?? []);
  const nearestExam = upcomingRoutines[0] ?? null;
  const featuredPaper = papers.find((p) => p.is_exam_of_week) ?? papers[0] ?? null;
  const startsIn = nextClass ? timeUntilShort(nextClass.scheduled_at) : null;

  return (
    <div className="space-y-7">
      <ArrearBillPrompt />
      <HostClassesBlock me={me} />
      {/* 1. Greeting & Eligibility / Enrollment Pill */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a2f5b] sm:text-3xl">
            {greetingNow()}, {name || 'স্বাগতম'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {enrolled.length > 0
              ? 'পদোন্নতি ও বিভাগীয় পরীক্ষার বিষয়ভিত্তিক প্রস্তুতি চলছে।'
              : 'বিষয়ভিত্তিক প্রস্তুতি শুরু করতে আপনার প্রয়োজনীয় বিষয়ে এনরোল করুন।'}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Link
            href="/exam-prep"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#bce3d6] bg-[#eaf8f2] px-3.5 py-1.5 text-xs font-semibold text-[#156f4d]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {enrolled.length > 0
              ? `${bn(enrolled.length)}টি বিষয়ে এনরোল করা`
              : 'সকল বিষয়ের সারাংশ উন্মুক্ত'}
          </Link>
          <Link
            href="/salary"
            className="inline-flex max-w-xs flex-col gap-0.5 rounded-xl border border-[#9f1239] bg-[#9f1239] px-3.5 py-2 text-left text-white shadow-xs transition hover:border-[#7f1d1d] hover:bg-[#7f1d1d] sm:text-right"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-bold sm:justify-end">
              <Calculator className="h-3.5 w-3.5 text-white/90" />
              বেতন ও বকেয়া হিসাব
            </span>
            <span className="text-[11px] leading-snug text-white/85">
              বেতন স্কেল, টি.আর. ফরম ও বকেয়া বিল
            </span>
          </Link>
        </div>
      </div>

      {/* 2. PDF Top Hero Row: Live Class Hero (Left) + Exam Countdown & Prep Bar (Right) */}
      <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
        {nextClass ? (
          <div className="flex flex-col justify-between rounded-2xl bg-[#0a2f5b] p-5 text-white shadow-sm sm:p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1566b8] px-2.5 py-0.5 text-xs font-semibold text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#28b8d8]" />
                  {nextClass.status === 'live' ? 'লাইভ চলছে' : `লাইভ · ${formatClassWhen(nextClass.scheduled_at)}`}
                </span>
                {nextClass.access_type === 'free' ? (
                  <span className="rounded-full bg-[#2aabb8]/25 px-2.5 py-0.5 text-xs font-semibold text-[#8be9f5]">
                    ফ্রি ক্লাস
                  </span>
                ) : null}
              </div>
              <h2 className="mt-3 text-xl font-bold leading-snug sm:text-2xl">{nextClass.topic}</h2>
              <p className="mt-1.5 text-sm text-white/75">
                {[nextClass.exam_subject_name, startsIn].filter(Boolean).join(' · ') ||
                  formatClassWhen(nextClass.scheduled_at)}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={`/live/zoom/${nextClass.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1566b8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1c75cf]"
              >
                <Video className="h-4 w-4" />
                ক্লাসে যোগ দিন
              </Link>
              <Link href="/live" className="text-xs font-semibold text-white/80 hover:text-white">
                সব লাইভ ক্লাস দেখুন →
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-between rounded-2xl bg-[#0a2f5b] p-5 text-white shadow-sm sm:p-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold text-white/90">
                বিষয়ভিত্তিক প্রস্তুতি
              </span>
              <h2 className="mt-3 text-xl font-bold leading-snug sm:text-2xl">
                প্রতিটি বিষয়ের বই, লিখিত প্রশ্ন, MCQ ও লাইভ ক্লাস এক ওয়ার্কস্পেসে
              </h2>
              <p className="mt-1.5 text-sm text-white/75">
                ফ্রি লাইভ ক্লাস এনরোল ছাড়াই দেখা যায়। যেকোনো বিষয়ের রিসোর্স সারাংশ দেখে প্রস্তুতি শুরু করুন।
              </p>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/exam-prep"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1566b8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1c75cf]"
              >
                <GraduationCap className="h-4 w-4" />
                Exam Preparations খুলুন
              </Link>
              <Link
                href="/live"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
              >
                <Video className="h-4 w-4" />
                Live Classes
              </Link>
            </div>
          </div>
        )}

        {/* Right column: upcoming classes (top) + সামগ্রিক প্রস্তুতি (bottom) */}
        <div className="flex flex-col gap-4">
          <UpcomingClassesBlock items={liveRows} layout="stack" />

          <div className="flex flex-col justify-between rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs sm:p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {nearestExam ? 'সামনের পরীক্ষা' : 'সামগ্রিক প্রস্তুতি'}
                </p>
                <CalendarClock className="h-4 w-4 text-[#1566b8]" />
              </div>
              {nearestExam ? (
                <>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold text-[#0a2f5b]">{nearestExam.exam_name}</p>
                  <p className="mt-2 text-3xl font-extrabold text-[#0a2f5b]">
                    {nearestExam.days === 0 ? 'আজ' : `${bn(nearestExam.days)} দিন বাকি`}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm font-semibold text-[#0a2f5b]">এনরোল করা বিষয়ের অগ্রগতি</p>
                  <p className="mt-2 text-3xl font-extrabold text-[#0a2f5b]">{bn(overallPrepPercent)}%</p>
                </>
              )}
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">প্রস্তুতি</span>
                <span className="text-[#1566b8]">{bn(overallPrepPercent)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#e6eff7]">
                <div
                  className="h-full rounded-full bg-[#1566b8] transition-all"
                  style={{ width: `${Math.max(overallPrepPercent, enrolled.length > 0 ? 4 : 0)}%` }}
                />
              </div>
              <Link href="/exam-routine" className="inline-block pt-1 text-xs font-semibold text-[#1566b8] hover:underline">
                পরীক্ষার রুটিন ও বিজ্ঞপ্তি দেখুন →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PDF "চালিয়ে যান" (Continue Learning — Enrolled Subjects + Model Test Banner) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#0a2f5b]">চালিয়ে যান</h2>
          <Link href="/exam-prep" className="text-sm font-semibold text-[#1566b8] hover:underline">
            সব বিষয় দেখুন
          </Link>
        </div>

        {enrolled.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#d7e4ee] bg-white p-5">
            <div>
              <p className="font-semibold text-[#0a2f5b]">এখনো কোনো বিষয়ে এনরোল করা হয়নি</p>
              <p className="mt-0.5 text-sm text-slate-600">
                Exam Preparations থেকে প্রতিটি বিষয়ের বই, লিখিত প্রশ্ন ও MCQ সংখ্যা দেখে পছন্দের প্যাকেজে এনরোল করুন।
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/exam-prep"
                className="rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] px-4 py-2 text-sm font-semibold text-[#0a2f5b] hover:border-[#1566b8]"
              >
                বিষয়সমূহ দেখুন
              </Link>
              <Link
                href="/packages"
                className="rounded-xl bg-[#1566b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f5294]"
              >
                কোর্স ও প্যাকেজ
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2">
            {enrolled.slice(0, 4).map((subject, idx) => {
              const title = subject.name_bn?.trim() || subject.name;
              const totalItems = subject.written + subject.mcq;
              const doneItems = subject.written_read + subject.mcq_touched;
              return (
                <Link
                  key={subject.id}
                  href={`/exam-prep/${subject.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-[#d7e4ee] bg-white p-4 shadow-xs transition hover:border-[#1566b8]"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white ${CARD_HEADERS[idx % CARD_HEADERS.length]}`}
                  >
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-[#1566b8]">{subject.part_label}</p>
                    <p className="truncate font-bold text-[#0a2f5b] group-hover:text-[#1566b8]">{title}</p>
                    <div className="mt-2 flex items-center gap-2.5">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e6eff7]">
                        <div
                          className="h-full rounded-full bg-[#1566b8]"
                          style={{ width: `${Math.max(subject.progress_percent, 4)}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-slate-500">
                        {bn(doneItems)} / {bn(totalItems)}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-[#f4f9fd] px-3 py-1.5 text-xs font-semibold text-[#1566b8] group-hover:bg-[#1566b8] group-hover:text-white">
                    চালিয়ে যান
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {featuredPaper ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f2d9a0] bg-[#fff9eb] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f59e0b]/15 text-[#b45309]">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-[#0a2f5b]">{featuredPaper.name}</p>
                <p className="text-xs text-slate-600">
                  {bn(featuredPaper.question_count)}টি প্রশ্ন · {bn(featuredPaper.duration_minutes)} মিনিট
                  {featuredPaper.exam_subject_name ? ` · ${featuredPaper.exam_subject_name}` : ''}
                </p>
              </div>
            </div>
            <Link
              href={`/papers/${featuredPaper.id}`}
              className="rounded-xl bg-[#1566b8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f5294]"
            >
              পরীক্ষা শুরু করুন
            </Link>
          </div>
        ) : null}
      </section>

      {/* 4. PDF Middle Row: পরীক্ষার রুটিন (Left) + আপনার নির্ভুলতা (Right) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#0a2f5b]">পরীক্ষার রুটিন</h2>
            <Link href="/exam-routine" className="text-xs font-semibold text-[#1566b8] hover:underline">
              ক্যালেন্ডার
            </Link>
          </div>

          {upcomingRoutines.length === 0 ? (
            <p className="mt-4 rounded-xl bg-[#f4f9fd] p-4 text-sm text-slate-500">
              বর্তমানে কোনো আসন্ন পরীক্ষার তারিখ ঘোষিত নেই। নতুন রুটিন প্রকাশিত হলে এখানে দেখা যাবে।
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcomingRoutines.map((item) => {
                const box = dateBoxParts(item.start_date);
                return (
                  <li key={item.exam_name_id}>
                    <Link
                      href={`/exam-routine/${item.exam_name_id}`}
                      className="flex items-center gap-3.5 rounded-xl border border-[#e6eff7] p-3 transition hover:border-[#1566b8]/40 hover:bg-[#f4f9fd]"
                    >
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[#eaf3fc] text-[#0a2f5b]">
                        <span className="text-sm font-extrabold leading-none">{box.day}</span>
                        <span className="mt-0.5 text-[11px] font-semibold text-[#1566b8]">{box.month}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#0a2f5b]">{item.exam_name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {item.start_date_note?.trim() || 'পরীক্ষার সময়সূচি ও নির্দেশনা দেখুন'}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#eaf3fc] px-2.5 py-1 text-xs font-bold text-[#1566b8]">
                        {item.days === 0 ? 'আজ' : `${bn(item.days)} দিন`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#0a2f5b]">আপনার নির্ভুলতা</h2>
            <Link href="/exam-prep" className="text-xs font-semibold text-[#1566b8] hover:underline">
              বিস্তারিত
            </Link>
          </div>

          {accuracySummary.touched === 0 ? (
            <div className="mt-4 rounded-xl bg-[#f4f9fd] p-4">
              <div className="flex items-center gap-2 text-[#0a2f5b]">
                <Target className="h-4 w-4 text-[#1566b8]" />
                <p className="text-sm font-semibold">এখনো কোনো MCQ অনুশীলন করা হয়নি</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                এনরোল করা বিষয়ের অধ্যায়ভিত্তিক MCQ উত্তর দিলে এখানে সঠিকতার হার ও দুর্বল অধ্যায় দেখা যাবে।
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-3.5">
              <div className="flex items-baseline gap-2.5">
                <span className="text-3xl font-extrabold text-[#0a2f5b]">{bn(accuracySummary.overall)}%</span>
                <span className="text-xs text-slate-500">
                  মোট {bn(accuracySummary.touched)}টি অনুশীলনে গড় সঠিকতা
                </span>
              </div>
              <div className="space-y-2.5">
                {accuracySummary.rows.map((row) => (
                  <div key={row.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="truncate text-[#0a2f5b]">{row.title}</span>
                      <span className="text-slate-600">{bn(row.percent)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#e6eff7]">
                      <div
                        className={`h-full rounded-full ${
                          row.percent >= 75 ? 'bg-[#1f9d68]' : row.percent >= 55 ? 'bg-[#1566b8]' : 'bg-[#e07c24]'
                        }`}
                        style={{ width: `${Math.max(row.percent, 5)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {accuracySummary.weakest && accuracySummary.weakest.percent < 75 ? (
                <Link
                  href={`/exam-prep/${accuracySummary.weakest.id}`}
                  className="block rounded-xl bg-[#fff8ee] px-3 py-2 text-xs font-medium text-[#9a5b13] hover:underline"
                >
                  <strong>{accuracySummary.weakest.title}</strong> বিষয়ে আরও অনুশীলন করুন →
                </Link>
              ) : null}
            </div>
          )}
        </section>
      </div>

      {/* 5. Calculator Doors (Salary, Pension, Joining Period) */}
      <section className="grid gap-3.5 sm:grid-cols-3">
        {[
          { href: '/salary', title: 'বেতন ও বকেয়া হিসাব', text: 'বেতন স্কেল, টি.আর. ফরম ও বকেয়া বিল' },
          { href: '/pension', title: 'পেনশন ক্যালকুলেটর', text: 'আনুতোষিক, ছুটি ও পিআরএল হিসাব' },
          { href: '/joining-period', title: 'যোগদানকাল হিসাব', text: 'বদলি ও ভ্রমণজনিত যোগদান সময়কাল' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center gap-3.5 rounded-2xl border border-[#d7e4ee] bg-white p-4 shadow-xs transition hover:border-[#1566b8]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eaf3fc] text-[#1566b8] group-hover:bg-[#1566b8] group-hover:text-white">
              <Calculator className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#0a2f5b]">{item.title}</p>
              <p className="truncate text-xs text-slate-500">{item.text}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#1566b8]" />
          </Link>
        ))}
      </section>

      {/* 6. PDF Ask ProAssist Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#c5dff6] bg-[#eaf4fc] px-5 py-4">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1566b8] text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-[#0a2f5b]">Ask ProAssist</p>
            <p className="mt-0.5 text-sm text-slate-600">
              কোনো বিধি বা পরীক্ষার প্রশ্ন নিয়ে জিজ্ঞাসা আছে? বিষয় উল্লেখ করে প্রশ্ন পাঠান ও যাচাইকৃত উত্তর পান।
            </p>
          </div>
        </div>
        <Link
          href="/user-questions"
          className="rounded-xl bg-[#1566b8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f5294]"
        >
          প্রশ্ন করুন
        </Link>
      </div>

      {/* 7. PDF "আপনার জন্য প্রস্তাবিত" (Recommended Subjects Grid) */}
      {offered.length > 0 ? (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[#0a2f5b]">আপনার জন্য প্রস্তাবিত</h2>
            <Link href="/packages" className="text-sm font-semibold text-[#1566b8] hover:underline">
              সব কোর্স
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offered.slice(0, 3).map((subject, idx) => {
              const title = subject.name_bn?.trim() || subject.name;
              const cheapest = subject.packages
                .slice()
                .sort((a, b) => a.price - b.price)[0];
              return (
                <div
                  key={subject.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#d7e4ee] bg-white shadow-xs transition hover:border-[#1566b8]"
                >
                  <div className={`flex h-24 items-center justify-between px-5 text-white ${CARD_HEADERS[idx % CARD_HEADERS.length]}`}>
                    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">
                      {subject.part_label}
                    </span>
                    <GraduationCap className="h-8 w-8 text-white/80" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <span className="inline-block rounded-full bg-[#eaf3fc] px-2.5 py-0.5 text-[11px] font-semibold text-[#1566b8]">
                        পরীক্ষা প্রস্তুতি
                      </span>
                      <h3 className="mt-2 line-clamp-2 font-bold text-[#0a2f5b]">{title}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {bn(subject.books)}টি বই · {bn(subject.written)}টি লিখিত · {bn(subject.mcq)}টি MCQ
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-[#eef4f9] pt-3">
                      <span className="font-bold text-[#0a2f5b]">
                        {cheapest ? `৳${cheapest.price.toLocaleString('bn-BD')}` : 'প্যাকেজ দেখুন'}
                      </span>
                      <Link
                        href={`/exam-prep/${subject.id}`}
                        className="rounded-lg border border-[#1566b8] px-3.5 py-1.5 text-xs font-semibold text-[#1566b8] transition hover:bg-[#1566b8] hover:text-white"
                      >
                        দেখুন
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
