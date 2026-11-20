'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  FileCheck2,
  FileText,
  Flame,
  GraduationCap,
  HelpCircle,
  Lock,
  PlayCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import type {
  PreparationChapterRow,
  PreparationQuizQuestion,
  PreparationSubjectWorkspace,
  PreparationWrittenRow,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { accessDate, durationLabel } from '@/lib/billing-format';
import { toBanglaDigits } from '@/lib/bangla-format';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ChapterMcqRunner } from '@/components/exam-prep/chapter-mcq-runner';

type WorkspaceTab = 'overview' | 'books' | 'written' | 'mcq' | 'papers' | 'live';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  DESCRIPTIVE: 'বর্ণনামূলক',
  SHORT_NOTE: 'টীকা',
  DIFFERENCES: 'পার্থক্য',
  TRANSLATION: 'অনুবাদ',
  SUMMARY: 'সারাংশ',
  DRAFTING: 'খসড়া লিখন',
  CALCULATION: 'গাণিতিক',
};

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function moneyBn(price: number): string {
  return price === 0 ? 'ফ্রি' : `৳${price.toLocaleString('bn-BD')}`;
}

function durationBn(days: number): string {
  if (days % 365 === 0) return `${bn(days / 365)} বছর অ্যাক্সেস`;
  if (days % 30 === 0) return `${bn(days / 30)} মাস অ্যাক্সেস`;
  return `${bn(days)} দিন অ্যাক্সেস (${durationLabel(days)})`;
}

function formatClassDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('bn-BD', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SubjectWorkspacePage() {
  const params = useParams<{ subjectId: string }>();
  const subjectId = params.subjectId;

  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [bookFilter, setBookFilter] = useState<string>('');
  const [bankSearch, setBankSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [expandedPreviewBook, setExpandedPreviewBook] = useState<string | null>(null);
  const [lockedPrompt, setLockedPrompt] = useState(false);

  const [data, setData] = useState<PreparationSubjectWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [quizSession, setQuizSession] = useState<{
    chapter: PreparationChapterRow;
    wrongOnly: boolean;
    questions: PreparationQuizQuestion[];
  } | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);

  const loadWorkspace = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const res = await apiFetch<{ data: PreparationSubjectWorkspace }>(
          `/exam-prep/subjects/${subjectId}?read=all`,
        );
        setData(res.data);
        if (res.data.preview_books[0] && !expandedPreviewBook) {
          setExpandedPreviewBook(res.data.preview_books[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'লোড করা যায়নি');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [subjectId, expandedPreviewBook],
  );

  useEffect(() => {
    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  async function launchChapterQuiz(chapter: PreparationChapterRow, wrongOnly: boolean) {
    setQuizLoading(true);
    try {
      const res = await apiFetch<{ data: PreparationQuizQuestion[] }>(
        `/exam-prep/subjects/${subjectId}/chapters/${chapter.id}?wrong=${wrongOnly ? '1' : '0'}`,
      );
      setTab('mcq');
      setQuizSession({ chapter, wrongOnly, questions: res.data });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'প্রশ্ন লোড করা যায়নি');
    } finally {
      setQuizLoading(false);
    }
  }

  /* Filter & group written questions under respective Books / Resources */
  const filteredWritten = useMemo(() => {
    if (!data) return [];
    const q = bankSearch.trim().toLowerCase();
    return data.written_questions.filter((row) => {
      if (readFilter === 'read' && row.read_count === 0) return false;
      if (readFilter === 'unread' && row.read_count > 0) return false;
      if (bookFilter && (row.book_id ?? '__none__') !== bookFilter) return false;
      if (typeFilter && row.question_type_code !== typeFilter) return false;
      if (q && !row.title.toLowerCase().includes(q) && !(row.chapter_name ?? '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [data, readFilter, bookFilter, typeFilter, bankSearch]);

  const writtenGroupedByBook = useMemo(() => {
    const groups = new Map<string, { key: string; bookName: string; items: PreparationWrittenRow[] }>();
    for (const item of filteredWritten) {
      const key = item.book_id ?? '__none__';
      const bookName = item.book_name ?? 'অন্যান্য সংযুক্ত লিখিত প্রশ্ন';
      const g = groups.get(key);
      if (g) g.items.push(item);
      else groups.set(key, { key, bookName, items: [item] });
    }
    return [...groups.values()];
  }, [filteredWritten]);

  const writtenTypes = useMemo(() => {
    const codes = new Set((data?.written_questions ?? []).map((q) => q.question_type_code));
    return [...codes];
  }, [data]);

  const chaptersGroupedByBook = useMemo(() => {
    const groups = new Map<string, { key: string; bookName: string; chapters: PreparationChapterRow[] }>();
    for (const ch of data?.chapters ?? []) {
      const key = ch.book_id ?? '__none__';
      const bookName = ch.book_name ?? 'সাধারণ ও সংযুক্ত অধ্যায়';
      const g = groups.get(key);
      if (g) g.chapters.push(ch);
      else groups.set(key, { key, bookName, chapters: [ch] });
    }
    return [...groups.values()];
  }, [data]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (loading || !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const title = data.name_bn?.trim() || data.name;
  const examPackages = data.packages.filter((p) => p.kind === 'exam_prep');
  const livePackages = data.packages.filter((p) => p.kind === 'live');
  const primaryPkg = examPackages.slice().sort((a, b) => Number(Boolean(a.whole_part)) - Number(Boolean(b.whole_part)) || a.price - b.price)[0];
  const upcomingClasses = data.classes.filter((c) => !c.past);
  const pastClasses = data.classes.filter((c) => c.past);
  const nextUpcoming = upcomingClasses[0] ?? null;
  const mcqAccuracy = data.mcq_touched > 0 ? Math.round((data.mcq_correct / data.mcq_touched) * 100) : 0;

  /* ============================================================================
   * STATE A: NON-ENROLLED USER — PDF PAGE 8 (Course Overview & Resource Summary)
   * Shows complete overview & counts, locks actual content, prompts enrollment.
   * ============================================================================ */
  if (data.locked) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Link href="/exam-prep" className="text-[#1566b8] hover:underline">
            Exam Preparations
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="truncate text-[#0a2f5b]">{title}</span>
        </nav>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          {/* Left Column (PDF p8) */}
          <div className="space-y-6">
            {/* Deep Navy Course Header Card */}
            <section className="rounded-2xl bg-[#0a2f5b] p-6 text-white shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#1566b8] px-3 py-0.5 text-xs font-semibold text-white">
                  পরীক্ষা প্রস্তুতি
                </span>
                <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold text-white/90">
                  {data.part_label}
                </span>
                {livePackages.length > 0 ? (
                  <span className="rounded-full bg-[#28b8d8]/25 px-3 py-0.5 text-xs font-semibold text-[#9ef0ff]">
                    লাইভ ক্লাস প্যাকেজ উপলব্ধ
                  </span>
                ) : null}
              </div>

              <h1 className="mt-3 text-2xl font-bold leading-snug sm:text-3xl">{title}</h1>
              {data.name_bn?.trim() ? <p className="mt-1 text-sm text-white/75">{data.name}</p> : null}
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85">
                এই বিষয়ের সকল বই ও বিধি, অধ্যায়ভিত্তিক লিখিত প্রশ্নব্যাংক, MCQ স্ব-মূল্যায়ন, বিগত বছরের প্রশ্ন সেট এবং লাইভ ক্লাস এক জায়গায় সাজানো।
              </p>

              <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-white/90">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-[#7eb6ea]" />
                  {bn(data.books)}টি বই / রিসোর্স
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-[#7eb6ea]" />
                  {bn(data.written)}টি লিখিত প্রশ্ন
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5">
                  <FileCheck2 className="h-3.5 w-3.5 text-[#7eb6ea]" />
                  {bn(data.mcq)}টি MCQ
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5">
                  <FileText className="h-3.5 w-3.5 text-[#7eb6ea]" />
                  {bn(data.papers)}টি বিগত সেট
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5">
                  <Video className="h-3.5 w-3.5 text-[#7eb6ea]" />
                  {bn(data.past_classes)}টি সম্পন্ন ক্লাস
                </span>
              </div>
            </section>

            {/* Locked Prompt Banner when non-enrolled user clicks a locked preview item */}
            {lockedPrompt ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f3d7a1] bg-[#fff8ee] p-4 text-sm text-[#0a2f5b]">
                <div className="flex items-center gap-2.5">
                  <Lock className="h-4 w-4 shrink-0 text-[#b45309]" />
                  <span>
                    মূল বই, প্রশ্ন ও MCQ খুলতে এই বিষয়ের প্যাকেজে এনরোল করতে হবে।
                  </span>
                </div>
                <Link
                  href={`/packages?tab=exam_prep&subject=${data.id}`}
                  className="rounded-xl bg-[#1566b8] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0f5294]"
                >
                  এখনই এনরোল করুন
                </Link>
              </div>
            ) : null}

            {/* "এতে যা আছে" — Full Subject Resource Summary (PDF p8) */}
            <section className="rounded-2xl border border-[#d7e4ee] bg-white p-6 shadow-xs">
              <h2 className="text-lg font-bold text-[#0a2f5b]">বিষয়ভিত্তিক রিসোর্স সারাংশ (এতে যা আছে)</h2>
              <p className="mt-1 text-xs text-slate-500">
                এনরোল করার আগে এই বিষয়ের আওতাধীন সকল কনটেন্ট ও রিসোর্সের সম্পূর্ণ পরিসংখ্যান দেখে নিন।
              </p>

              <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    icon: BookOpen,
                    label: 'মোট বই ও রিসোর্স',
                    val: `${bn(data.books)}টি`,
                    sub: 'রেফারেন্স বই ও বিধি-বিধান',
                  },
                  {
                    icon: HelpCircle,
                    label: 'লিখিত / বর্ণনামূলক প্রশ্ন',
                    val: `${bn(data.written)}টি`,
                    sub: 'পঠিত ও অপঠিত ট্র্যাকিংসহ',
                  },
                  {
                    icon: FileCheck2,
                    label: 'মোট MCQ প্রশ্ন',
                    val: `${bn(data.mcq)}টি`,
                    sub: 'অধ্যায়ভিত্তিক ও ভুল প্রশ্ন রিটেস্ট',
                  },
                  {
                    icon: FileText,
                    label: 'বিগত বছরের প্রশ্ন সেট',
                    val: `${bn(data.papers)}টি`,
                    sub: 'মডেল টেস্ট ও পূর্ববর্তী প্রশ্নপত্র',
                  },
                  {
                    icon: Video,
                    label: 'সম্পন্ন হওয়া ক্লাস',
                    val: `${bn(data.past_classes)}টি`,
                    sub: data.upcoming_classes > 0 ? `আরও ${bn(data.upcoming_classes)}টি নির্ধারিত` : 'বিষয়ভিত্তিক সেশন',
                  },
                  {
                    icon: GraduationCap,
                    label: 'উপলব্ধ প্যাকেজ',
                    val: `${bn(data.packages.length)}টি`,
                    sub: 'কনটেন্ট ও লাইভ ক্লাস প্যাকেজ',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex items-start gap-3 rounded-xl border border-[#e6eff7] bg-[#f4f9fd] p-3.5"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#1566b8] shadow-2xs">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-lg font-extrabold text-[#0a2f5b]">{item.val}</p>
                        <p className="text-xs font-bold text-[#0a2f5b]">{item.label}</p>
                        <p className="text-[11px] text-slate-500">{item.sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-[#c5dff6] bg-[#eaf4fc] px-4 py-3 text-xs text-[#0a2f5b]">
                <strong>অ্যাক্সেস নিয়ম:</strong> আপনি বর্তমানে এই বিষয়ের সম্পূর্ণ সারাংশ দেখছেন। মূল বই, প্রশ্নব্যাংক বা MCQ খুলতে নিচের যেকোনো প্রযোজ্য প্যাকেজে এনরোল করুন।
              </div>
            </section>

            {/* Syllabus / Books & Chapters Structural Outline (PDF p8 Accordion — Locked Content) */}
            {data.preview_books.length > 0 ? (
              <section className="rounded-2xl border border-[#d7e4ee] bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-[#0a2f5b]">বই ও অধ্যায়ের তালিকা</h2>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Lock className="h-3.5 w-3.5" />
                    এনরোল করলে আনলক হবে
                  </span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {data.preview_books.map((book, idx) => {
                    const isOpen = expandedPreviewBook === book.id;
                    const bTitle = book.name_bn?.trim() || book.name;
                    return (
                      <div key={book.id} className="overflow-hidden rounded-xl border border-[#e3edf6]">
                        <button
                          type="button"
                          onClick={() => setExpandedPreviewBook(isOpen ? null : book.id)}
                          className="flex w-full items-center justify-between gap-3 bg-[#f9fcff] px-4 py-3.5 text-left hover:bg-[#f0f7fe]"
                        >
                          <div>
                            <p className="text-sm font-bold text-[#0a2f5b]">
                              {bn(idx + 1)}. {bTitle}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {bn(book.chapter_count)}টি অধ্যায়
                              {book.short_name ? ` · সূত্র: ${book.short_name}` : ''}
                            </p>
                          </div>
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 shrink-0 text-slate-400 transition-transform',
                              isOpen && 'rotate-180',
                            )}
                          />
                        </button>
                        {isOpen && book.chapters.length > 0 ? (
                          <ul className="divide-y divide-[#eef4f9] bg-white px-4 py-1">
                            {book.chapters.map((ch) => (
                              <li key={ch.id}>
                                <button
                                  type="button"
                                  onClick={() => setLockedPrompt(true)}
                                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-xs text-slate-700 hover:text-[#1566b8]"
                                >
                                  <span className="flex items-center gap-2 font-medium">
                                    <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                    {ch.name}
                                  </span>
                                  <span className="shrink-0 text-[11px] text-slate-400">
                                    লিখিত {bn(ch.written_count)} · MCQ {bn(ch.mcq_count)}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* Available Packages Section (Exam Prep + Live Class Packages) */}
            <section className="rounded-2xl border border-[#d7e4ee] bg-white p-6 shadow-xs">
              <h2 className="text-lg font-bold text-[#0a2f5b]">এই বিষয়ের উপলব্ধ প্যাকেজসমূহ</h2>
              {data.packages.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  এই বিষয়ের আলাদা প্যাকেজ তালিকাভুক্ত নেই। সব প্যাকেজ দেখতে{' '}
                  <Link href="/packages" className="font-semibold text-[#1566b8] hover:underline">
                    কোর্স পেজে যান
                  </Link>
                  ।
                </p>
              ) : (
                <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
                  {data.packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="flex flex-col justify-between rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] p-4"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                              pkg.kind === 'live'
                                ? 'bg-[#e6f6f8] text-[#0e7490]'
                                : 'bg-[#d7e8f8] text-[#1566b8]',
                            )}
                          >
                            {pkg.kind === 'live'
                              ? `লাইভ ক্লাস${pkg.live_program_name ? ` · ${pkg.live_program_name}` : ''}`
                              : pkg.whole_part
                                ? 'পূর্ণ পার্ট প্যাকেজ'
                                : 'বিষয়ভিত্তিক প্যাকেজ'}
                          </span>
                        </div>
                        <p className="mt-2 font-bold text-[#0a2f5b]">{pkg.name_bn?.trim() || pkg.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {durationBn(pkg.duration_days)}
                          {pkg.class_limit ? ` · ${bn(pkg.class_limit)}টি লাইভ ক্লাস` : ''}
                        </p>
                        {pkg.description ? (
                          <p className="mt-2 line-clamp-2 text-xs text-slate-600">{pkg.description}</p>
                        ) : null}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-[#e1ecf6] pt-3">
                        <span className="text-lg font-extrabold text-[#0a2f5b]">{moneyBn(pkg.price)}</span>
                        <Link
                          href={
                            pkg.kind === 'live'
                              ? `/packages?tab=live&subject=${data.id}`
                              : `/packages?tab=exam_prep&subject=${data.id}`
                          }
                          className="rounded-lg bg-[#1566b8] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0f5294]"
                        >
                          এনরোল করুন
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Sticky Pricing & Enrollment Card (PDF p8) */}
          <aside className="rounded-2xl border border-[#d7e4ee] bg-white p-6 shadow-sm lg:sticky lg:top-20">
            {primaryPkg ? (
              <>
                <p className="text-xs font-semibold text-[#1566b8]">
                  {primaryPkg.whole_part ? 'পূর্ণ পার্ট অ্যাক্সেস' : 'বিষয়ভিত্তিক প্রস্তুতি প্যাকেজ'}
                </p>
                <p className="mt-1 text-3xl font-extrabold text-[#0a2f5b]">{moneyBn(primaryPkg.price)}</p>
                <p className="mt-0.5 text-xs text-slate-500">{durationBn(primaryPkg.duration_days)}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-[#1566b8]">বিষয় আনলক করুন</p>
                <p className="mt-1 text-xl font-extrabold text-[#0a2f5b]">প্যাকেজে এনরোল করুন</p>
                <p className="mt-0.5 text-xs text-slate-500">বই, প্রশ্নব্যাংক ও MCQ সম্পূর্ণ খুলতে এনরোল আবশ্যক</p>
              </>
            )}

            <div className="mt-5 space-y-2.5">
              <Link
                href={`/packages?tab=exam_prep&subject=${data.id}`}
                className="flex w-full items-center justify-center rounded-xl bg-[#1566b8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0f5294]"
              >
                এই বিষয়ে এনরোল করুন
              </Link>
              {livePackages.length > 0 ? (
                <Link
                  href={`/packages?tab=live&subject=${data.id}`}
                  className="flex w-full items-center justify-center rounded-xl border border-[#1566b8] bg-white px-4 py-2.5 text-sm font-semibold text-[#1566b8] transition hover:bg-[#f4f9fd]"
                >
                  লাইভ ক্লাস প্যাকেজ ({moneyBn(livePackages[0]!.price)})
                </Link>
              ) : null}
              <Link
                href="/live"
                className="flex w-full items-center justify-center rounded-xl bg-[#f4f9fd] px-4 py-2 text-xs font-semibold text-[#0a2f5b] hover:bg-[#eaf3fc]"
              >
                ফ্রি লাইভ ক্লাসের সময়সূচি দেখুন
              </Link>
            </div>

            <ul className="mt-5 space-y-2.5 border-t border-[#eef4f9] pt-4 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1f9d68]" />
                <span>{bn(data.books)}টি বই ও বিধি সম্পূর্ণ পাঠযোগ্য</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1f9d68]" />
                <span>{bn(data.written)}টি লিখিত প্রশ্ন ও মডেল উত্তর</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1f9d68]" />
                <span>{bn(data.mcq)}টি অধ্যায়ভিত্তিক MCQ ও ভুল প্রশ্ন রিটেস্ট</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#1566b8]" />
                <span>বিকাশ ট্রানজ্যাকশন অনুমোদনের সাথে সাথেই চালু</span>
              </li>
            </ul>
          </aside>
        </div>
      </div>
    );
  }

  /* ============================================================================
   * STATE B: ENROLLED USER — PDF PAGES 12–18 (Full Subject-Scoped Workspace)
   * ============================================================================ */
  const TABS: Array<{ id: WorkspaceTab; label: string; count?: number }> = [
    { id: 'overview', label: 'সারসংক্ষেপ' },
    { id: 'books', label: 'বই ও রিসোর্স', count: data.books },
    { id: 'written', label: 'প্রশ্নব্যাংক (লিখিত)', count: data.written },
    { id: 'mcq', label: 'অধ্যায়ভিত্তিক MCQ', count: data.mcq },
    { id: 'papers', label: 'বিগত সেট ও মডেল টেস্ট', count: data.papers },
    { id: 'live', label: 'লাইভ ক্লাস ও ম্যারাথন', count: upcomingClasses.length + data.past_classes },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb (PDF p12) */}
      <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Link href="/exam-prep" className="text-[#1566b8] hover:underline">
          Exam Preparations
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate text-[#0a2f5b]">{title}</span>
      </nav>

      {/* Top Enrolled Subject Header & Progress Card (PDF p12) */}
      <section className="rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#0a2f5b] px-3 py-0.5 text-xs font-semibold text-white">
                {data.part_label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f8ef] px-2.5 py-0.5 text-xs font-bold text-[#156f4d]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                এনরোল করা
              </span>
              {data.owned_until ? (
                <span className="text-xs text-slate-500">অ্যাক্সেস শেষ: {accessDate(data.owned_until)}</span>
              ) : null}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-[#0a2f5b] sm:text-3xl">{title}</h1>
            {data.name_bn?.trim() ? <p className="text-xs text-slate-500">{data.name}</p> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setQuizSession(null);
                setTab('mcq');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1566b8] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#0f5294]"
            >
              <PlayCircle className="h-4 w-4" />
              অধ্যায়ভিত্তিক অনুশীলন
            </button>
            <Link
              href={`/marathon?exam_subject_id=${data.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] px-4 py-2.5 text-xs font-semibold text-[#0a2f5b] hover:border-[#1566b8]"
            >
              <Flame className="h-4 w-4 text-[#1566b8]" />
              ম্যারাথন রিভিউ
            </Link>
          </div>
        </div>

        {/* Progress Bar (PDF p12) */}
        <div className="mt-5 rounded-xl bg-[#f4f9fd] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
            <span className="text-[#0a2f5b]">সামগ্রিক প্রস্তুতি অগ্রগতি</span>
            <span className="text-[#1566b8]">
              {bn(data.progress_percent)}% · লিখিত পঠিত {bn(data.written_read)}/{bn(data.written)} · MCQ ছোঁয়া{' '}
              {bn(data.mcq_touched)}/{bn(data.mcq)}
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#dce9f5]">
            <div
              className="h-full rounded-full bg-[#1566b8] transition-all"
              style={{ width: `${Math.max(data.progress_percent, 3)}%` }}
            />
          </div>
        </div>

        {/* 6 Resource Summary Counters */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'বই / রিসোর্স', value: bn(data.books), to: 'books' as WorkspaceTab },
            { label: 'লিখিত প্রশ্ন', value: bn(data.written), to: 'written' as WorkspaceTab },
            { label: 'মোট MCQ', value: bn(data.mcq), to: 'mcq' as WorkspaceTab },
            { label: 'বিগত প্রশ্ন সেট', value: bn(data.papers), to: 'papers' as WorkspaceTab },
            { label: 'সম্পন্ন ক্লাস', value: bn(data.past_classes), to: 'live' as WorkspaceTab },
            {
              label: 'MCQ সঠিকতা',
              value: data.mcq_touched > 0 ? `${bn(mcqAccuracy)}%` : '—',
              to: 'mcq' as WorkspaceTab,
            },
          ].map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={() => {
                setQuizSession(null);
                setTab(stat.to);
              }}
              className="rounded-xl border border-[#e5eef7] bg-white p-3 text-left transition hover:border-[#1566b8]"
            >
              <p className="text-lg font-extrabold text-[#0a2f5b]">{stat.value}</p>
              <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Workspace Segmented Navigation Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setQuizSession(null);
                setTab(item.id);
              }}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition',
                active
                  ? 'bg-[#0a2f5b] text-white shadow-xs'
                  : 'border border-[#d7e4ee] bg-white text-[#0a2f5b] hover:border-[#1566b8]',
              )}
            >
              <span>{item.label}</span>
              {typeof item.count === 'number' ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px]',
                    active ? 'bg-white/20 text-white' : 'bg-[#f4f9fd] text-slate-600',
                  )}
                >
                  {bn(item.count)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW (PDF Page 12 2-Column Module + Contextual Sidebar Layout) */}
      {tab === 'overview' ? (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            {/* Books & Modules List (PDF p12) */}
            <div className="rounded-2xl border border-[#d7e4ee] bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0a2f5b]">এই বিষয়ের বই ও অধ্যায়সমূহ</h2>
                <button
                  type="button"
                  onClick={() => setTab('books')}
                  className="text-xs font-semibold text-[#1566b8] hover:underline"
                >
                  সব বই →
                </button>
              </div>
              {data.preview_books.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">এই বিষয়ে এখনো প্রকাশিত বই যুক্ত হয়নি।</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {data.preview_books.map((book, bIdx) => (
                    <div key={book.id} className="rounded-xl border border-[#e6eff7] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-[#1566b8]">বই {bn(bIdx + 1)}</p>
                          <Link
                            href={`/books/${book.id}`}
                            className="font-bold text-[#0a2f5b] hover:text-[#1566b8] hover:underline"
                          >
                            {book.name_bn?.trim() || book.name}
                          </Link>
                        </div>
                        <Link
                          href={`/books/${book.id}`}
                          className="rounded-lg bg-[#eaf3fc] px-3 py-1.5 text-xs font-semibold text-[#1566b8] hover:bg-[#1566b8] hover:text-white"
                        >
                          বই পড়ুন
                        </Link>
                      </div>
                      {book.chapters.length > 0 ? (
                        <ul className="mt-3 divide-y divide-[#f0f5fa] border-t border-[#eef4f9] pt-2">
                          {book.chapters.slice(0, 5).map((ch) => {
                            const mcqRow = data.chapters.find((c) => c.id === ch.id);
                            const done = mcqRow && mcqRow.mcq_total > 0 && mcqRow.touched >= mcqRow.mcq_total;
                            return (
                              <li key={ch.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                                <span className="flex items-center gap-2 font-medium text-[#0a2f5b]">
                                  {done ? (
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1f9d68]" />
                                  ) : (
                                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#1566b8]" />
                                  )}
                                  {ch.name}
                                </span>
                                <div className="flex items-center gap-2">
                                  {ch.written_count > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setBookFilter(book.id);
                                        setTab('written');
                                      }}
                                      className="rounded-full bg-[#f4f9fd] px-2.5 py-0.5 font-semibold text-slate-600 hover:text-[#1566b8]"
                                    >
                                      লিখিত {bn(ch.written_count)}
                                    </button>
                                  ) : null}
                                  {mcqRow ? (
                                    <button
                                      type="button"
                                      onClick={() => void launchChapterQuiz(mcqRow, false)}
                                      className="rounded-full bg-[#eaf3fc] px-2.5 py-0.5 font-semibold text-[#1566b8] hover:bg-[#1566b8] hover:text-white"
                                    >
                                      কুইজ: {bn(mcqRow.mcq_total)}টি প্রশ্ন
                                    </button>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Action Cards ("অনুশীলন ও পরীক্ষা" — PDF p12 bottom) */}
            <div className="grid gap-3.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTab('written')}
                className="flex items-start gap-3.5 rounded-2xl border border-[#d7e4ee] bg-white p-4 text-left transition hover:border-[#1566b8]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf3fc] text-[#1566b8]">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-[#0a2f5b]">বিষয়ভিত্তিক লিখিত প্রশ্নব্যাংক</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    পঠিত {bn(data.written_read)} · অপঠিত {bn(Math.max(0, data.written - data.written_read))}টি প্রশ্ন
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTab('mcq')}
                className="flex items-start gap-3.5 rounded-2xl border border-[#d7e4ee] bg-white p-4 text-left transition hover:border-[#1566b8]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f8ef] text-[#156f4d]">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-[#0a2f5b]">অধ্যায়ভিত্তিক MCQ ও রিটেস্ট</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    সঠিক {bn(data.mcq_correct)} · ভুল {bn(data.mcq_wrong)}টি (ভুল প্রশ্নে আলাদা পরীক্ষা)
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Right Contextual Sidebar (PDF p12) */}
          <aside className="space-y-4">
            {/* Upcoming Live Class Widget */}
            <div className="rounded-2xl border border-[#d7e4ee] bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-[#1566b8]">আগামী লাইভ ক্লাস</p>
              {nextUpcoming ? (
                <div className="mt-2 space-y-3">
                  <p className="font-bold text-[#0a2f5b]">{nextUpcoming.topic}</p>
                  <p className="text-xs text-slate-500">{formatClassDateTime(nextUpcoming.scheduled_at)}</p>
                  {data.live_owned || nextUpcoming.access_type === 'free' ? (
                    <Link
                      href={`/live/zoom/${nextUpcoming.id}`}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1566b8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0f5294]"
                    >
                      <Video className="h-4 w-4" />
                      ক্লাস দেখুন
                    </Link>
                  ) : (
                    <Link
                      href={`/packages?tab=live&subject=${data.id}`}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a2f5b] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1566b8]"
                    >
                      লাইভ প্যাকেজে এনরোল করুন
                    </Link>
                  )}
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-slate-500">এই বিষয়ে বর্তমানে নির্ধারিত আসন্ন ক্লাস নেই।</p>
                  <Link href="/live" className="inline-block text-xs font-semibold text-[#1566b8] hover:underline">
                    সকল লাইভ ক্লাসের রুটিন →
                  </Link>
                </div>
              )}
            </div>

            {/* Marathon Review Widget */}
            <div className="rounded-2xl border border-[#c5dff6] bg-[#eaf4fc] p-5">
              <div className="flex items-center gap-2 text-[#0a2f5b]">
                <Flame className="h-4 w-4 text-[#1566b8]" />
                <p className="text-sm font-bold">বিষয়ভিত্তিক ম্যারাথন রিভিউ</p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                পরীক্ষার আগে দ্রুত রিভিশনের জন্য শুধু এই বিষয়ের প্রশ্ন ও সিলেবাস একটানা পড়ুন।
              </p>
              <Link
                href={`/marathon?exam_subject_id=${data.id}`}
                className="mt-3 flex w-full items-center justify-center rounded-xl bg-[#1566b8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f5294]"
              >
                ম্যারাথন শুরু করুন
              </Link>
            </div>

            {/* Live Class Package Widget if not yet enrolled in live */}
            {!data.live_owned && livePackages.length > 0 ? (
              <div className="rounded-2xl border border-[#d7e4ee] bg-white p-5">
                <p className="text-xs font-bold text-[#0e7490]">লাইভ ক্লাস প্যাকেজ</p>
                <p className="mt-1 text-sm font-bold text-[#0a2f5b]">
                  {livePackages[0]!.name_bn?.trim() || livePackages[0]!.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {moneyBn(livePackages[0]!.price)} · {durationBn(livePackages[0]!.duration_days)}
                </p>
                <Link
                  href={`/packages?tab=live&subject=${data.id}`}
                  className="mt-3 flex w-full items-center justify-center rounded-xl border border-[#1566b8] px-3 py-2 text-xs font-semibold text-[#1566b8] hover:bg-[#f4f9fd]"
                >
                  লাইভ প্যাকেজ দেখুন
                </Link>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {/* TAB 2: BOOKS & RESOURCES */}
      {tab === 'books' ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[#0a2f5b]">বই ও স্টাডি রিসোর্স</h2>
              <p className="text-xs text-slate-500">শুধুমাত্র এই বিষয়ের জন্য নির্ধারিত রেফারেন্স বই ও বিধিমালা।</p>
            </div>
          </div>

          {data.books_list.length === 0 ? (
            <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-sm text-slate-500">
              এই বিষয়ে এখনো কোনো প্রকাশিত বই যুক্ত করা হয়নি।
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.books_list.map((book) => (
                <Link
                  key={book.id}
                  href={`/books/${book.id}`}
                  className="group flex flex-col justify-between rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs transition hover:border-[#1566b8]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf3fc] text-[#1566b8] group-hover:bg-[#1566b8] group-hover:text-white">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      {book.is_superseded ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                          পুরোনো সংস্করণ
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 font-bold text-[#0a2f5b] group-hover:text-[#1566b8]">
                      {book.name_bn?.trim() || book.name}
                    </h3>
                    {book.name_bn?.trim() ? <p className="mt-0.5 text-xs text-slate-500">{book.name}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                      <span className="rounded-md bg-[#f4f9fd] px-2 py-0.5 font-medium text-[#0a2f5b]">
                        {bn(book.chapter_count)}টি অধ্যায়
                      </span>
                      {book.short_name ? (
                        <span className="rounded-md bg-[#f4f9fd] px-2 py-0.5">সূত্র: {book.short_name}</span>
                      ) : null}
                      {book.edition ? (
                        <span className="rounded-md bg-[#f4f9fd] px-2 py-0.5">সংস্করণ: {book.edition}</span>
                      ) : null}
                    </div>
                  </div>
                  <span className="mt-4 inline-block text-xs font-semibold text-[#1566b8]">অধ্যায় ও বিধি পড়ুন →</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* TAB 3: SUBJECT QUESTION BANK (EXCLUDING MCQs — Grouped under Books, Read/Unread + Read Count) */}
      {tab === 'written' ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#0a2f5b]">বিষয়ভিত্তিক লিখিত প্রশ্নব্যাংক (MCQ ব্যতীত)</h2>
                <p className="text-xs text-slate-500">
                  বই ও রিসোর্স অনুযায়ী সাজানো। প্রতিটি প্রশ্নের পঠিত/অপঠিত অবস্থা এবং কতবার পড়া হয়েছে তা সংরক্ষিত থাকে।
                </p>
              </div>
              <div className="flex rounded-full border border-[#d7e4ee] bg-[#f4f9fd] p-1">
                {(
                  [
                    ['all', `সব (${bn(data.written_questions.length)})`],
                    ['unread', `অপঠিত (${bn(data.written_questions.filter((q) => q.read_count === 0).length)})`],
                    ['read', `পঠিত (${bn(data.written_questions.filter((q) => q.read_count > 0).length)})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setReadFilter(key)}
                    className={cn(
                      'rounded-full px-3.5 py-1 text-xs font-semibold transition',
                      readFilter === key ? 'bg-[#1566b8] text-white' : 'text-[#0a2f5b] hover:text-[#1566b8]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* In-Bank Search + Resource Filter + Type Filter */}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  placeholder="প্রশ্ন বা অধ্যায় লিখুন..."
                  className="h-9 w-full rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] pl-9 pr-3 text-xs text-[#0a2f5b] outline-none focus:border-[#1566b8] focus:bg-white"
                />
              </div>

              <select
                value={bookFilter}
                onChange={(e) => setBookFilter(e.target.value)}
                aria-label="বই অনুযায়ী ফিল্টার"
                className="h-9 rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] px-3 text-xs font-medium text-[#0a2f5b] outline-none focus:border-[#1566b8] focus:bg-white"
              >
                <option value="">সকল বই ও রিসোর্স</option>
                {data.books_list.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name_bn?.trim() || b.name}
                  </option>
                ))}
                {data.written_questions.some((q) => !q.book_id) ? (
                  <option value="__none__">অন্যান্য সংযুক্ত প্রশ্ন</option>
                ) : null}
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="প্রশ্নের ধরন"
                className="h-9 rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] px-3 text-xs font-medium text-[#0a2f5b] outline-none focus:border-[#1566b8] focus:bg-white"
              >
                <option value="">সকল প্রশ্নের ধরন</option>
                {writtenTypes.map((code) => (
                  <option key={code} value={code}>
                    {QUESTION_TYPE_LABELS[code] ?? code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {writtenGroupedByBook.length === 0 ? (
            <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-center text-sm text-slate-500">
              নির্বাচিত ফিল্টারে কোনো লিখিত প্রশ্ন পাওয়া যায়নি।
            </div>
          ) : (
            <div className="space-y-5">
              {writtenGroupedByBook.map((group) => (
                <div key={group.key} className="rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-[#eef4f9] pb-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-[#1566b8]" />
                      <h3 className="font-bold text-[#0a2f5b]">{group.bookName}</h3>
                    </div>
                    <span className="rounded-full bg-[#f4f9fd] px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {bn(group.items.length)}টি প্রশ্ন
                    </span>
                  </div>

                  <ul className="mt-3 divide-y divide-[#eef4f9]">
                    {group.items.map((q) => {
                      const isRead = q.read_count > 0;
                      return (
                        <li key={q.id} className="py-3 first:pt-1 last:pb-0">
                          <Link
                            href={`/questions/${q.id}`}
                            className="group flex flex-wrap items-start justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold leading-relaxed text-[#0a2f5b] group-hover:text-[#1566b8]">
                                {q.title}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                <span className="rounded-md bg-[#f4f9fd] px-2 py-0.5 font-semibold text-[#0a2f5b]">
                                  {QUESTION_TYPE_LABELS[q.question_type_code] ?? q.question_type_code}
                                </span>
                                {q.chapter_name ? <span>অধ্যায়: {q.chapter_name}</span> : null}
                              </div>
                            </div>

                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold',
                                isRead
                                  ? 'bg-[#e8f8ef] text-[#156f4d]'
                                  : 'bg-[#f4f9fd] text-slate-500',
                              )}
                            >
                              <Eye className="h-3 w-3" />
                              {isRead ? `${bn(q.read_count)} বার পড়া` : 'অপঠিত'}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* TAB 4: CHAPTER-WISE MCQ & SELF-ASSESSMENT (PDF p15 + p17 Runner + p18 Results) */}
      {tab === 'mcq' ? (
        quizSession ? (
          <ChapterMcqRunner
            chapterName={quizSession.chapter.name}
            bookName={quizSession.chapter.book_name}
            wrongOnlyMode={quizSession.wrongOnly}
            questions={quizSession.questions}
            onBack={() => {
              setQuizSession(null);
              void loadWorkspace(true);
            }}
            onRetakeAll={() => void launchChapterQuiz(quizSession.chapter, false)}
            onRetakeWrong={() => void launchChapterQuiz(quizSession.chapter, true)}
            onProgressSaved={() => void loadWorkspace(true)}
          />
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_290px]">
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-[#0a2f5b]">অধ্যায়ভিত্তিক MCQ ও স্ব-মূল্যায়ন</h2>
                <p className="text-xs text-slate-500">
                  প্রতিটি অধ্যায়ে কত শতাংশ প্রশ্ন ছোঁয়া হয়েছে, মোট সঠিক ও ভুল সংখ্যা এবং শুধুমাত্র ভুল প্রশ্নে পুনরায় পরীক্ষা দিন।
                </p>
              </div>

              {quizLoading ? <Skeleton className="h-28 w-full rounded-2xl" /> : null}

              {chaptersGroupedByBook.length === 0 ? (
                <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-sm text-slate-500">
                  এই বিষয়ে এখনো কোনো MCQ প্রকাশিত হয়নি।
                </div>
              ) : (
                chaptersGroupedByBook.map((group) => (
                  <div key={group.key} className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-[#1566b8]">
                      <BookOpen className="h-4 w-4" />
                      {group.bookName}
                    </h3>
                    <div className="space-y-3">
                      {group.chapters.map((chapter) => {
                        const touchedPct =
                          chapter.mcq_total > 0 ? Math.round((chapter.touched / chapter.mcq_total) * 100) : 0;
                        return (
                          <div
                            key={chapter.id}
                            className="rounded-2xl border border-[#d7e4ee] bg-white p-4 shadow-xs sm:p-5"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-bold text-[#0a2f5b]">{chapter.name}</p>
                                  <span className="rounded-full bg-[#eaf3fc] px-2.5 py-0.5 text-[11px] font-bold text-[#1566b8]">
                                    {bn(touchedPct)}% ছোঁয়া
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                                  <span className="text-slate-600">মোট প্রশ্ন: <strong>{bn(chapter.mcq_total)}</strong></span>
                                  <span className="font-semibold text-[#1f9d68]">সঠিক: {bn(chapter.correct)}</span>
                                  <span className="font-semibold text-[#d9383a]">ভুল: {bn(chapter.wrong)}</span>
                                  <span className="text-slate-400">
                                    বাকি: {bn(Math.max(0, chapter.mcq_total - chapter.touched))}
                                  </span>
                                </div>
                                <div className="mt-2.5 h-2 max-w-md overflow-hidden rounded-full bg-[#e6eff7]">
                                  <div
                                    className="h-full rounded-full bg-[#1566b8]"
                                    style={{ width: `${Math.max(touchedPct, chapter.touched > 0 ? 4 : 0)}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  disabled={quizLoading}
                                  onClick={() => void launchChapterQuiz(chapter, false)}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1566b8] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#0f5294]"
                                >
                                  <PlayCircle className="h-3.5 w-3.5" />
                                  {chapter.touched > 0 ? 'আবার সব দিন' : 'অনুশীলন শুরু'}
                                </button>
                                <button
                                  type="button"
                                  disabled={quizLoading || chapter.wrong === 0}
                                  onClick={() => void launchChapterQuiz(chapter, true)}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#1566b8] bg-white px-3.5 py-2 text-xs font-semibold text-[#1566b8] transition hover:bg-[#f4f9fd] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  শুধু ভুল ({bn(chapter.wrong)})
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Right Stats Card ("আপনার অনুশীলন" — PDF p15) */}
            <aside className="rounded-2xl border border-[#d7e4ee] bg-white p-5 lg:sticky lg:top-20">
              <h3 className="text-sm font-bold text-[#0a2f5b]">আপনার MCQ অগ্রগতি</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#f4f9fd] p-3">
                  <p className="text-[11px] text-slate-500">মোট সমাধান</p>
                  <p className="mt-1 text-2xl font-extrabold text-[#0a2f5b]">{bn(data.mcq_touched)}</p>
                </div>
                <div className="rounded-xl bg-[#f4f9fd] p-3">
                  <p className="text-[11px] text-slate-500">গড় সঠিকতা</p>
                  <p className="mt-1 text-2xl font-extrabold text-[#1f9d68]">{bn(mcqAccuracy)}%</p>
                </div>
                <div className="rounded-xl bg-[#e8f8ef] p-3">
                  <p className="text-[11px] text-[#156f4d]">সঠিক উত্তর</p>
                  <p className="mt-0.5 text-lg font-extrabold text-[#156f4d]">{bn(data.mcq_correct)}</p>
                </div>
                <div className="rounded-xl bg-[#fdecec] p-3">
                  <p className="text-[11px] text-[#d9383a]">ভুল উত্তর</p>
                  <p className="mt-0.5 text-lg font-extrabold text-[#d9383a]">{bn(data.mcq_wrong)}</p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                ভুল উত্তর দেওয়া প্রশ্নগুলোতে পুনরায় পরীক্ষা দিয়ে সঠিক করলে স্বয়ংক্রিয়ভাবে আপনার স্কোর আপডেট হবে।
              </p>
            </aside>
          </div>
        )
      ) : null}

      {/* TAB 5: PREVIOUS YEARS' QUESTION SETS & MODEL TESTS (PDF p16) */}
      {tab === 'papers' ? (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3.5">
            <div>
              <h2 className="text-lg font-bold text-[#0a2f5b]">বিগত বছরের প্রশ্ন সেট ও মডেল টেস্ট</h2>
              <p className="text-xs text-slate-500">এই বিষয়ের প্রকাশিত সকল পূর্ণাঙ্গ প্রশ্নপত্র ও মডেল টেস্ট।</p>
            </div>

            {data.papers_list.length === 0 ? (
              <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-sm text-slate-500">
                এই বিষয়ে এখনো কোনো প্রশ্ন সেট প্রকাশিত হয়নি।
              </div>
            ) : (
              data.papers_list.map((paper) => (
                <div
                  key={paper.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs transition hover:border-[#1566b8]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#e8f8ef] px-2.5 py-0.5 text-[11px] font-bold text-[#156f4d]">
                        উপলব্ধ
                      </span>
                      {paper.session_year ? (
                        <span className="rounded-full bg-[#eaf3fc] px-2.5 py-0.5 text-[11px] font-semibold text-[#1566b8]">
                          {paper.session_year}
                        </span>
                      ) : null}
                      {paper.is_exam_of_week ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                          সাপ্তাহিক পরীক্ষা
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1.5 font-bold text-[#0a2f5b]">{paper.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {bn(paper.question_count)}টি প্রশ্ন · {bn(paper.duration_minutes)} মিনিট · পূর্ণমান{' '}
                      {bn(paper.total_marks)} (পাস {bn(paper.pass_marks)})
                    </p>
                  </div>
                  <Link
                    href={`/papers/${paper.id}`}
                    className="rounded-xl bg-[#1566b8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0f5294]"
                  >
                    প্রশ্নপত্র খুলুন
                  </Link>
                </div>
              ))
            )}
          </div>

          <aside className="rounded-2xl border border-[#d7e4ee] bg-white p-5">
            <h3 className="text-sm font-bold text-[#0a2f5b]">পরীক্ষার নির্দেশনা</h3>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
              <li>• প্রশ্নপত্র খুলে প্রতিটি প্রশ্নে ক্লিক করে মডেল উত্তর ও ব্যাখ্যা দেখা যাবে।</li>
              <li>• নিজের প্রস্তুতির মান যাচাই করতে প্রতিটি প্রশ্নে স্ব-মূল্যায়ন রেটিং দিতে পারবেন।</li>
              <li>• আপনার পঠিত ও মূল্যায়নকৃত অগ্রগতি স্বয়ংক্রিয়ভাবে সংরক্ষিত থাকবে।</li>
            </ul>
          </aside>
        </div>
      ) : null}

      {/* TAB 6: SUBJECT-SCOPED LIVE CLASSES & MARATHON REVIEW (PDF p14) */}
      {tab === 'live' ? (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            {/* Next / Upcoming Class Hero Banner (PDF p14) */}
            {nextUpcoming ? (
              <div className="rounded-2xl bg-[#0a2f5b] p-6 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#1566b8] px-3 py-0.5 text-xs font-semibold">
                    {nextUpcoming.status === 'live' ? 'এখন লাইভ চলছে' : formatClassDateTime(nextUpcoming.scheduled_at)}
                  </span>
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">
                    {nextUpcoming.access_type === 'free' ? 'ফ্রি ক্লাস' : 'পেইড লাইভ'}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-bold">{nextUpcoming.topic}</h2>
                {nextUpcoming.details ? (
                  <p className="mt-1.5 text-sm text-white/80">{nextUpcoming.details}</p>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-3">
                  {data.live_owned || nextUpcoming.access_type === 'free' ? (
                    <Link
                      href={`/live/zoom/${nextUpcoming.id}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#1566b8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c75cf]"
                    >
                      <Video className="h-4 w-4" />
                      ক্লাসে যোগ দিন
                    </Link>
                  ) : (
                    <Link
                      href={`/packages?tab=live&subject=${data.id}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#1566b8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c75cf]"
                    >
                      লাইভ প্যাকেজে এনরোল করুন
                    </Link>
                  )}
                </div>
              </div>
            ) : null}

            {!data.live_owned && livePackages.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#c5dff6] bg-[#eaf4fc] p-4">
                <div>
                  <p className="text-sm font-bold text-[#0a2f5b]">এই বিষয়ের লাইভ ক্লাস প্যাকেজ উপলব্ধ</p>
                  <p className="text-xs text-slate-600">
                    পেইড লাইভ ক্লাস ও রেকর্ডিং আনলক করতে এই বিষয়ের লাইভ প্যাকেজে এনরোল করুন।
                  </p>
                </div>
                <Link
                  href={`/packages?tab=live&subject=${data.id}`}
                  className="rounded-xl bg-[#1566b8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f5294]"
                >
                  লাইভ প্যাকেজ নিন
                </Link>
              </div>
            ) : null}

            {/* Scheduled Classes List */}
            <div className="rounded-2xl border border-[#d7e4ee] bg-white p-5">
              <h3 className="text-base font-bold text-[#0a2f5b]">নির্ধারিত লাইভ ক্লাসসমূহ</h3>
              {upcomingClasses.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">এই বিষয়ে বর্তমানে কোনো নির্ধারিত আসন্ন ক্লাস নেই।</p>
              ) : (
                <ul className="mt-3 divide-y divide-[#eef4f9]">
                  {upcomingClasses.map((cls) => (
                    <li key={cls.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1 last:pb-0">
                      <div>
                        <p className="font-semibold text-[#0a2f5b]">{cls.topic}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="h-3.5 w-3.5 text-[#1566b8]" />
                          {formatClassDateTime(cls.scheduled_at)} ·{' '}
                          {cls.access_type === 'free' ? 'ফ্রি ক্লাস' : 'পেইড ক্লাস'}
                        </p>
                      </div>
                      <Link
                        href={`/live/zoom/${cls.id}`}
                        className="rounded-lg border border-[#1566b8] px-3 py-1.5 text-xs font-semibold text-[#1566b8] hover:bg-[#1566b8] hover:text-white"
                      >
                        বিস্তারিত
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Past Classes List */}
            <div className="rounded-2xl border border-[#d7e4ee] bg-white p-5">
              <h3 className="text-base font-bold text-[#0a2f5b]">পূর্ববর্তী সম্পন্ন ক্লাস ({bn(pastClasses.length)})</h3>
              {pastClasses.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">এই বিষয়ে এখনো কোনো পূর্ববর্তী ক্লাস সম্পন্ন হয়নি।</p>
              ) : (
                <ul className="mt-3 divide-y divide-[#eef4f9]">
                  {pastClasses.map((cls) => (
                    <li key={cls.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1 last:pb-0">
                      <div>
                        <p className="font-semibold text-[#0a2f5b]">{cls.topic}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{formatClassDateTime(cls.scheduled_at)}</p>
                      </div>
                      <Link
                        href={`/live/zoom/${cls.id}`}
                        className="rounded-lg bg-[#f4f9fd] px-3 py-1.5 text-xs font-semibold text-[#1566b8] hover:bg-[#eaf3fc]"
                      >
                        রেকর্ডিং / স্লাইড
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Marathon Review & Full Schedule Sidebar */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#d7e4ee] bg-white p-5">
              <div className="flex items-center gap-2 text-[#0a2f5b]">
                <Sparkles className="h-4 w-4 text-[#1566b8]" />
                <h3 className="text-sm font-bold">ম্যারাথন রিভিউ ({title})</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                এই বিষয়ের সকল প্রকাশিত প্রশ্ন ও মডেল উত্তর একটানা স্ক্রল করে দ্রুত রিভিশন দিন। অন্য কোনো বিষয়ের প্রশ্ন এখানে মিশবে না।
              </p>
              <Link
                href={`/marathon?exam_subject_id=${data.id}`}
                className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#1566b8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0f5294]"
              >
                ম্যারাথন রিভিউ খুলুন
              </Link>
            </div>

            <div className="rounded-2xl border border-[#d7e4ee] bg-white p-5">
              <h3 className="text-sm font-bold text-[#0a2f5b]">সকল বিষয়ের লাইভ ক্লাস</h3>
              <p className="mt-1 text-xs text-slate-500">
                ফ্রি ক্লাস এবং অন্যান্য বিষয়ের সম্পূর্ণ লাইভ সময়সূচি দেখতে Live Classes মেনুতে যান।
              </p>
              <Link
                href="/live"
                className="mt-3 inline-block text-xs font-semibold text-[#1566b8] hover:underline"
              >
                Live Classes সময়সূচি দেখুন →
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
