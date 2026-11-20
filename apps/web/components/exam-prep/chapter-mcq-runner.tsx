'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import type { PreparationQuizQuestion } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { toBanglaDigits } from '@/lib/bangla-format';
import { cn } from '@/lib/utils';

const OPTION_BANGLA_KEYS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ'];

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${bn(String(m).padStart(2, '0'))}:${bn(String(s).padStart(2, '0'))}`;
}

export function ChapterMcqRunner({
  chapterName,
  bookName,
  wrongOnlyMode,
  questions,
  onBack,
  onRetakeAll,
  onRetakeWrong,
  onProgressSaved,
}: {
  chapterName: string;
  bookName?: string;
  wrongOnlyMode: boolean;
  questions: PreparationQuizQuestion[];
  onBack: () => void;
  onRetakeAll: () => void;
  onRetakeWrong: () => void;
  onProgressSaved: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [openExp, setOpenExp] = useState<Record<string, boolean>>({});
  const [submittingAll, setSubmittingAll] = useState(false);

  useEffect(() => {
    setIndex(0);
    setSelected({});
    setFlagged({});
    setSubmitted(false);
    setElapsedSec(0);
    setOpenExp({});
  }, [questions]);

  useEffect(() => {
    if (submitted || questions.length === 0) return;
    const t = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [submitted, questions.length]);

  const current = questions[index];

  async function pickOption(questionId: string, optionId: string) {
    setSelected((prev) => ({ ...prev, [questionId]: optionId }));
    setSavingId(questionId);
    try {
      await apiFetch(`/evaluation/questions/${questionId}`, {
        method: 'PUT',
        body: JSON.stringify({ selected_option_id: optionId }),
      });
    } catch {
      // Keep local selection; final submit retries any unsaved answers
    } finally {
      setSavingId(null);
    }
  }

  async function finishQuiz() {
    setSubmittingAll(true);
    try {
      await Promise.all(
        Object.entries(selected).map(([questionId, optionId]) =>
          apiFetch(`/evaluation/questions/${questionId}`, {
            method: 'PUT',
            body: JSON.stringify({ selected_option_id: optionId }),
          }).catch(() => undefined),
        ),
      );
      onProgressSaved();
    } finally {
      setSubmittingAll(false);
      setSubmitted(true);
    }
  }

  const results = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    for (const q of questions) {
      const picked = selected[q.id];
      if (!picked) {
        unanswered += 1;
        continue;
      }
      if (q.correct_option_id && picked === q.correct_option_id) correct += 1;
      else wrong += 1;
    }
    const answered = correct + wrong;
    const accuracy = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    return { correct, wrong, unanswered, answered, accuracy };
  }, [questions, selected]);

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-center">
        <p className="font-bold text-[#0a2f5b]">
          {wrongOnlyMode ? 'এই অধ্যায়ে কোনো ভুল উত্তর দেওয়া MCQ নেই!' : 'এই অধ্যায়ে এখনো কোনো MCQ যুক্ত হয়নি।'}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {wrongOnlyMode
            ? 'দারুণ! আপনার পূর্বে ভুল করা কোনো প্রশ্ন বাকি নেই। চাইলে সব প্রশ্ন আবার অনুশীলন করতে পারেন।'
            : 'অন্য অধ্যায় বেছে অনুশীলন শুরু করুন।'}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {wrongOnlyMode ? (
            <button
              type="button"
              onClick={onRetakeAll}
              className="rounded-xl bg-[#1566b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f5294]"
            >
              সব প্রশ্ন অনুশীলন করুন
            </button>
          ) : null}
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] px-4 py-2 text-sm font-semibold text-[#0a2f5b]"
          >
            অধ্যায়ের তালিকায় ফিরুন
          </button>
        </div>
      </div>
    );
  }

  /* PDF Page 18: Results & Answer Review View */
  if (submitted) {
    const mins = Math.max(1, Math.round(elapsedSec / 60));
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1566b8] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              অধ্যায়ভিত্তিক MCQ › ফলাফল
            </button>
            <h2 className="mt-1 text-xl font-bold text-[#0a2f5b]">ফলাফল: {chapterName}</h2>
            {bookName ? <p className="text-xs text-slate-500">{bookName}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {results.wrong > 0 ? (
              <button
                type="button"
                onClick={onRetakeWrong}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1566b8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f5294]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                শুধু ভুল প্রশ্ন আবার দিন ({bn(results.wrong)})
              </button>
            ) : null}
            <button
              type="button"
              onClick={onRetakeAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#1566b8] bg-white px-4 py-2 text-xs font-semibold text-[#1566b8] hover:bg-[#f4f9fd]"
            >
              আবার সব অনুশীলন করুন
            </button>
          </div>
        </div>

        {/* 4 Score Summary Cards (PDF p18) */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <div className="rounded-2xl border border-[#d7e4ee] bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">স্কোর</p>
            <p className="mt-1 text-2xl font-extrabold text-[#0a2f5b]">
              {bn(results.correct)}/{bn(questions.length)}
            </p>
          </div>
          <div className="rounded-2xl border border-[#d7e4ee] bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">সঠিক</p>
            <p className="mt-1 text-2xl font-extrabold text-[#1f9d68]">{bn(results.accuracy)}%</p>
          </div>
          <div className="rounded-2xl border border-[#d7e4ee] bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">ভুল</p>
            <p className="mt-1 text-2xl font-extrabold text-[#d9383a]">{bn(results.wrong)}</p>
          </div>
          <div className="rounded-2xl border border-[#d7e4ee] bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">সময়</p>
            <p className="mt-1 text-2xl font-extrabold text-[#0a2f5b]">{bn(mins)} মি</p>
          </div>
        </div>

        {/* Answer Review List (PDF p18) */}
        <div className="rounded-2xl border border-[#d7e4ee] bg-white p-5">
          <h3 className="text-base font-bold text-[#0a2f5b]">উত্তর পর্যালোচনা</h3>
          <ul className="mt-4 divide-y divide-[#eef4f9]">
            {questions.map((q, idx) => {
              const pickedId = selected[q.id];
              const pickedOpt = q.options.find((o) => o.id === pickedId);
              const correctOpt = q.options.find((o) => o.id === q.correct_option_id);
              const isOk = Boolean(pickedId && q.correct_option_id && pickedId === q.correct_option_id);
              const optLabel = (opt?: { id: string; key: string; text: string }) => {
                if (!opt) return 'উত্তর দেওয়া হয়নি';
                const pos = q.options.findIndex((x) => x.id === opt.id);
                const k = OPTION_BANGLA_KEYS[pos] ?? opt.key;
                return `${k}. ${opt.text}`;
              };

              return (
                <li key={q.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                        isOk ? 'bg-[#e8f8ef] text-[#1f9d68]' : 'bg-[#fdecec] text-[#d9383a]',
                      )}
                    >
                      {isOk ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#0a2f5b]">
                        প্রশ্ন {bn(idx + 1)}: {q.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        আপনার উত্তর: <strong className={isOk ? 'text-[#1f9d68]' : 'text-[#d9383a]'}>{optLabel(pickedOpt)}</strong>
                        {correctOpt ? (
                          <>
                            {' · '}সঠিক: <strong className="text-[#1f9d68]">{optLabel(correctOpt)}</strong>
                          </>
                        ) : null}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {q.explanation ? (
                          <button
                            type="button"
                            onClick={() => setOpenExp((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                            className="text-xs font-semibold text-[#1566b8] hover:underline"
                          >
                            {openExp[q.id] ? 'ব্যাখ্যা লুকান' : 'ব্যাখ্যা দেখুন'}
                          </button>
                        ) : null}
                        <Link href={`/questions/${q.id}`} className="text-xs font-medium text-slate-500 hover:text-[#1566b8]">
                          বিস্তারিত পেজ →
                        </Link>
                      </div>
                      {q.explanation && openExp[q.id] ? (
                        <div className="mt-2 rounded-xl bg-[#f4f9fd] p-3 text-xs leading-relaxed text-[#0a2f5b]">
                          {q.explanation}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  /* PDF Page 17: Interactive MCQ Exam / Practice Runner */
  if (!current) return null;
  const currentPicked = selected[current.id];
  const isFlagged = Boolean(flagged[current.id]);

  return (
    <div className="space-y-4">
      {/* Exam Top Bar (PDF p17) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d7e4ee] bg-white px-5 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#0a2f5b]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              ফিরে যান
            </button>
            <span className="text-xs text-slate-300">|</span>
            <span className="text-xs font-semibold text-[#1566b8]">
              {wrongOnlyMode ? `${chapterName} · ভুল প্রশ্ন রিটেস্ট` : chapterName}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-bold text-[#0a2f5b]">
            প্রশ্ন {bn(index + 1)} / {bn(questions.length)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f9fd] px-3 py-1.5 text-xs font-semibold text-[#0a2f5b]">
            <Clock className="h-3.5 w-3.5 text-[#1566b8]" />
            {formatTimer(elapsedSec)}
          </span>
          <button
            type="button"
            disabled={submittingAll}
            onClick={() => void finishQuiz()}
            className="rounded-xl bg-[#1566b8] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0f5294] disabled:opacity-60"
          >
            {submittingAll ? 'জমা হচ্ছে…' : 'জমা দিন'}
          </button>
        </div>
      </div>

      {/* 2-Column Question + Palette Layout (PDF p17) */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col justify-between rounded-2xl border border-[#d7e4ee] bg-white p-5 sm:p-6">
          <div>
            <p className="text-base font-bold leading-relaxed text-[#0a2f5b] sm:text-lg">{current.title}</p>

            <div className="mt-5 space-y-2.5">
              {current.options.map((opt, optIdx) => {
                const active = currentPicked === opt.id;
                const k = OPTION_BANGLA_KEYS[optIdx] ?? opt.key;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => void pickOption(current.id, opt.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm transition',
                      active
                        ? 'border-[#1566b8] bg-[#eaf3fc] font-semibold text-[#0a2f5b]'
                        : 'border-[#e3edf6] bg-white text-slate-700 hover:border-[#7eb6ea] hover:bg-[#f4f9fd]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        active ? 'bg-[#1566b8] text-white' : 'bg-[#f4f9fd] text-[#0a2f5b]',
                      )}
                    >
                      {k}
                    </span>
                    <span className="flex-1">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#eef4f9] pt-4">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-[#d7e4ee] px-3.5 py-2 text-xs font-semibold text-[#0a2f5b] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              আগের
            </button>

            <button
              type="button"
              onClick={() => setFlagged((prev) => ({ ...prev, [current.id]: !prev[current.id] }))}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition',
                isFlagged ? 'bg-[#fff3d6] text-[#b45309]' : 'text-slate-500 hover:bg-[#f4f9fd] hover:text-[#0a2f5b]',
              )}
            >
              <Flag className="h-3.5 w-3.5" />
              {isFlagged ? 'চিহ্নিত করা হয়েছে' : 'চিহ্নিত রাখুন'}
            </button>

            {index < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                className="inline-flex items-center gap-1 rounded-xl bg-[#0a2f5b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1566b8]"
              >
                পরের
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void finishQuiz()}
                className="inline-flex items-center gap-1 rounded-xl bg-[#1566b8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f5294]"
              >
                ফলাফল দেখুন
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Question Palette Sidebar (PDF p17) */}
        <aside className="rounded-2xl border border-[#d7e4ee] bg-white p-4">
          <p className="text-sm font-bold text-[#0a2f5b]">প্রশ্ন তালিকা</p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {questions.map((q, qIdx) => {
              const isCurrent = qIdx === index;
              const hasAns = Boolean(selected[q.id]);
              const hasFlag = Boolean(flagged[q.id]);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setIndex(qIdx)}
                  className={cn(
                    'flex h-9 items-center justify-center rounded-lg border text-xs font-bold transition',
                    isCurrent
                      ? 'border-[#0a2f5b] bg-[#0a2f5b] text-white ring-2 ring-[#1566b8]/30'
                      : hasFlag
                        ? 'border-[#f59e0b] bg-[#fff8e6] text-[#b45309]'
                        : hasAns
                          ? 'border-[#1566b8] bg-[#1566b8] text-white'
                          : 'border-[#d7e4ee] bg-[#f4f9fd] text-[#0a2f5b] hover:border-[#1566b8]',
                  )}
                >
                  {bn(qIdx + 1)}
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-[#eef4f9] pt-3 text-[11px] text-slate-500">
            <p>
              <span className="inline-block h-2 w-2 rounded-full bg-[#1566b8]" /> উত্তর দেওয়া ({bn(Object.keys(selected).length)}) ·{' '}
              <span className="inline-block h-2 w-2 rounded-full border border-slate-400" /> বাকি (
              {bn(questions.length - Object.keys(selected).length)}) · ⚑ চিহ্নিত
            </p>
            <p className="text-[#1566b8]">
              {savingId ? 'উত্তর সংরক্ষণ হচ্ছে…' : 'উত্তর স্বয়ংক্রিয়ভাবে সংরক্ষিত হচ্ছে'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
