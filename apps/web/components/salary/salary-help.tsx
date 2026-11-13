'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Calculator, ChevronDown, CircleHelp, ExternalLink, Loader2, Pin, Send } from 'lucide-react';
import type {
  AskSalaryQuestionResult,
  SalaryCircularRecord,
  SalaryFaqRecord,
  SalaryHelpFeed,
  SalaryQuestionCandidate,
} from '@ibas/shared-types';
import { normalizeSalaryQuestion, rankSalaryQuestions } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { toBanglaDigits } from '@/lib/bangla-format';
import type { SalaryLocale } from '@/lib/salary-i18n';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const copy = {
  en: {
    kicker: 'Salary help',
    title: 'Questions, answers & circulars',
    subtitle: 'Read answered salary questions, open the official circular, or ask something new.',
    askPlaceholder: 'Type your salary question…',
    suggestHint: 'If it matches a previous question by more than 80%, suggestions appear as you type.',
    suggestions: 'Similar questions',
    answerReady: 'Answer ready',
    alreadyAsked: 'Already asked — waiting for an answer',
    alreadyShort: 'Already asked',
    ask: 'Ask this question',
    showAnswer: 'Show this answer',
    sending: 'Sending…',
    sent: 'Question sent. It will appear here after an admin answers it.',
    emptyFaq: 'No published salary questions yet. Ask one above.',
    circulars: 'Related circulars',
    emptyCirculars: 'No salary circulars yet.',
    openSource: 'Open source',
    related: 'Related to what you typed',
    waiting: 'Your questions, waiting for an answer',
    rejected: 'Not published',
    toCalculator: 'Calculator',
    manage: 'Add questions',
    pinned: 'Pinned',
    loadError: 'Could not load salary questions.',
    retry: 'Try again',
  },
  bn: {
    kicker: 'বেতন সহায়িকা',
    title: 'প্রশ্ন, উত্তর ও পরিপত্র',
    subtitle: 'উত্তরসহ বেতনের প্রশ্ন পড়ুন, পরিপত্রের সূত্র খুলুন, অথবা নতুন প্রশ্ন করুন।',
    askPlaceholder: 'আপনার বেতন সংক্রান্ত প্রশ্ন লিখুন…',
    suggestHint: 'আগের কোনো প্রশ্নের সাথে ৮০%-এর বেশি মিল হলে লেখার সময় সাজেশন আসবে।',
    suggestions: 'মিলে যাওয়া প্রশ্ন',
    answerReady: 'উত্তর আছে',
    alreadyAsked: 'এই প্রশ্ন আগে করা হয়েছে — উত্তরের অপেক্ষায়',
    alreadyShort: 'আগে করা হয়েছে',
    ask: 'এই প্রশ্ন করুন',
    showAnswer: 'উত্তর দেখুন',
    sending: 'পাঠানো হচ্ছে…',
    sent: 'প্রশ্ন পাঠানো হয়েছে। অ্যাডমিন উত্তর দিলে এখানে দেখা যাবে।',
    emptyFaq: 'এখনো কোনো প্রশ্ন প্রকাশিত হয়নি। উপরে প্রশ্ন করতে পারেন।',
    circulars: 'সংশ্লিষ্ট পরিপত্র',
    emptyCirculars: 'এখনো কোনো পরিপত্র যোগ করা হয়নি।',
    openSource: 'সূত্র খুলুন',
    related: 'আপনার প্রশ্নের সাথে মিল',
    waiting: 'আপনার প্রশ্ন, উত্তরের অপেক্ষায়',
    rejected: 'প্রকাশ করা হয়নি',
    toCalculator: 'বেতন হিসাব',
    manage: 'প্রশ্ন যোগ',
    pinned: 'গুরুত্বপূর্ণ',
    loadError: 'বেতনের প্রশ্ন লোড করা যায়নি।',
    retry: 'আবার চেষ্টা',
  },
} as const;

function pick(locale: SalaryLocale, bn: string, en: string): string {
  const primary = (locale === 'bn' ? bn : en).trim();
  const fallback = (locale === 'bn' ? en : bn).trim();
  return primary || fallback;
}

function digits(locale: SalaryLocale, value: string | number): string {
  return locale === 'bn' ? toBanglaDigits(value) : String(value);
}

function formatDay(locale: SalaryLocale, iso: string): string {
  const day = iso.slice(0, 10);
  const [year, month, date] = day.split('-');
  if (!year || !month || !date) return digits(locale, day);
  return digits(locale, `${date}-${month}-${year}`);
}

function matchLabel(locale: SalaryLocale, score: number): string {
  const pct = digits(locale, Math.round(score * 100));
  return locale === 'bn' ? `${pct}% মিল` : `${pct}% match`;
}

function circularMatches(query: string, circular: SalaryCircularRecord): boolean {
  const normalized = normalizeSalaryQuestion(query);
  if (normalized.length < 4) return false;
  const blob = normalizeSalaryQuestion(
    [circular.title_bn, circular.title_en, circular.summary_bn, circular.summary_en, circular.circular_no, circular.source_name].join(
      ' ',
    ),
  );
  if (!blob) return false;
  if (blob.includes(normalized)) return true;
  const words = normalized.split(' ').filter((word) => word.length > 3);
  if (words.length < 2) return false;
  const hits = words.filter((word) => blob.includes(word)).length;
  return hits / words.length >= 0.6;
}

export function SalaryHelp({
  locale,
  isAdmin,
  fullPage = false,
}: {
  locale: SalaryLocale;
  isAdmin: boolean;
  fullPage?: boolean;
}) {
  const t = copy[locale];
  const [feed, setFeed] = useState<SalaryHelpFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState<'success' | 'info'>('info');
  const [openId, setOpenId] = useState<string | null>(null);
  const hashDone = useRef(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ data: SalaryHelpFeed }>('/salary/help')
      .then((res) => {
        setFeed(res.data);
        setLoadError('');
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load salary questions.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!feed || hashDone.current) return;
    const id = window.location.hash.replace(/^#/, '');
    if (!id) return;
    hashDone.current = true;
    if (id.startsWith('salary-faq-')) setOpenId(id.slice('salary-faq-'.length));
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [feed]);

  const candidates = useMemo<SalaryQuestionCandidate[]>(() => {
    if (!feed) return [];
    return [
      ...feed.faqs.map((item) => ({
        id: item.id,
        status: 'published',
        texts: [item.question_bn, item.question_en],
      })),
      ...feed.open_questions
        .filter((item) => item.status === 'pending')
        .map((item) => ({
          id: item.id,
          status: 'pending',
          texts: [item.question_bn, item.question_en],
        })),
    ];
  }, [feed]);

  const suggestions = useMemo(() => {
    if (!feed || question.trim().length < 4) return [];
    return rankSalaryQuestions(question, candidates).map((match) => {
      const faq = feed.faqs.find((item) => item.id === match.id);
      const open = feed.open_questions.find((item) => item.id === match.id);
      const label = faq
        ? pick(locale, faq.question_bn, faq.question_en)
        : open
          ? pick(locale, open.question_bn, open.question_en)
          : '';
      return { ...match, label };
    }).filter((match) => match.label);
  }, [candidates, feed, locale, question]);

  const circulars = useMemo(() => {
    const rows = feed?.circulars ?? [];
    const related = rows.filter((item) => circularMatches(question, item));
    const rest = rows.filter((item) => !related.includes(item));
    return { related, rest };
  }, [feed?.circulars, question]);

  const top = suggestions[0];
  const showAnswer = top?.status === 'published';
  const blocked = suggestions.length > 0 && !showAnswer;

  function focusFaq(id: string) {
    setOpenId(id);
    setNotice('');
    window.setTimeout(() => {
      document.getElementById(`salary-faq-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 30);
  }

  async function onAsk(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (showAnswer && top) {
      focusFaq(top.id);
      return;
    }
    if (suggestions.length > 0) {
      setNoticeTone('info');
      setNotice(t.alreadyAsked);
      return;
    }
    const text = question.trim();
    if (text.length < 8) return;
    setSubmitting(true);
    setNotice('');
    try {
      const res = await apiFetch<{ data: AskSalaryQuestionResult }>('/salary/help/questions', {
        method: 'POST',
        body: JSON.stringify({ question: text, locale }),
      });
      if (!res.data.created) {
        const match = res.data.matches.find((item) => item.status === 'published') ?? res.data.matches[0];
        if (match?.status === 'published') focusFaq(match.id);
        else {
          setNoticeTone('info');
          setNotice(t.alreadyAsked);
        }
        return;
      }
      setQuestion('');
      setNoticeTone('success');
      setNotice(t.sent);
      load();
    } catch (err) {
      setNoticeTone('info');
      setNotice(err instanceof Error ? err.message : t.loadError);
    } finally {
      setSubmitting(false);
    }
  }

  const mine = (feed?.open_questions ?? []).filter((item) => item.mine);
  const byId = new Map((feed?.circulars ?? []).map((item) => [item.id, item]));

  return (
    <section
      id="salary-help"
      className="salary-print-hide scroll-mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm"
    >
      <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
              <CircleHelp className="h-3.5 w-3.5" aria-hidden />
              {t.kicker}
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-slate-900 sm:text-xl">{t.title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{t.subtitle}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="border-emerald-200 bg-white">
              <Link href="/salary#salary-calculator">
                <Calculator className="h-3.5 w-3.5" />
                {t.toCalculator}
              </Link>
            </Button>
            {isAdmin ? (
              <Button asChild size="sm" className="bg-emerald-700 hover:bg-emerald-800">
                <Link href="/admin/salary-help">{t.manage}</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <form id="salary-ask" onSubmit={(event) => void onAsk(event)} className="mt-4 scroll-mt-24">
          <label htmlFor="salary-question" className="sr-only">
            {t.askPlaceholder}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="salary-question"
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                setNotice('');
              }}
              placeholder={t.askPlaceholder}
              maxLength={500}
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm shadow-sm outline-none ring-emerald-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2"
            />
            <Button
              type="submit"
              disabled={submitting || question.trim().length < 8 || blocked}
              className="h-11 shrink-0 bg-emerald-700 hover:bg-emerald-800"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : showAnswer ? null : <Send className="h-4 w-4" />}
              {submitting ? t.sending : showAnswer ? t.showAnswer : blocked ? t.alreadyShort : t.ask}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{t.suggestHint}</p>

          {suggestions.length > 0 ? (
            <div className="mt-2 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-lg">
              <p className="border-b border-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                {t.suggestions}
              </p>
              <ul>
                {suggestions.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-emerald-50"
                      onClick={() => {
                        if (item.status === 'published') focusFaq(item.id);
                        else {
                          setNoticeTone('info');
                          setNotice(t.alreadyAsked);
                        }
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900">{item.label}</span>
                        <span className="text-xs text-slate-500">{item.status === 'published' ? t.answerReady : t.alreadyAsked}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        {matchLabel(locale, item.score)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </form>

        {notice ? (
          <Alert variant={noticeTone === 'success' ? 'success' : 'info'} className="mt-3">
            {notice}
          </Alert>
        ) : null}

        {mine.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            <li className="text-xs font-semibold text-slate-500">{t.waiting}</li>
            {mine.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 text-sm ring-1 ring-emerald-100">
                <span className="min-w-0 text-slate-800">{pick(locale, item.question_bn, item.question_en)}</span>
                <span className={`shrink-0 text-xs font-semibold ${item.status === 'rejected' ? 'text-rose-700' : 'text-amber-700'}`}>
                  {item.status === 'rejected' ? t.rejected : t.alreadyShort}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-2/3" />
        </div>
      ) : loadError ? (
        <div className="p-4">
          <Alert variant="error">
            {loadError}{' '}
            <button type="button" className="font-semibold underline" onClick={load}>
              {t.retry}
            </button>
          </Alert>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.9fr)]">
          <div className={fullPage ? '' : 'max-h-80 overflow-y-auto'}>
            {(feed?.faqs.length ?? 0) === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">{t.emptyFaq}</p>
            ) : (
              <ul>
                {feed?.faqs.map((item) => (
                  <FaqRow
                    key={item.id}
                    locale={locale}
                    item={item}
                    open={openId === item.id}
                    pinnedLabel={t.pinned}
                    circulars={item.circular_ids.map((id) => byId.get(id)).filter((row): row is SalaryCircularRecord => Boolean(row))}
                    onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
                  />
                ))}
              </ul>
            )}
          </div>
          <div className={`border-t border-emerald-100 bg-slate-50/70 lg:border-l lg:border-t-0 ${fullPage ? '' : 'max-h-80 overflow-y-auto'}`}>
            <h3 className="sticky top-0 z-10 border-b border-emerald-100 bg-slate-50/95 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-emerald-800 backdrop-blur">
              {t.circulars}
            </h3>
            {circulars.related.length + circulars.rest.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">{t.emptyCirculars}</p>
            ) : (
              <ul className="space-y-2 p-3">
                {[...circulars.related, ...circulars.rest].map((item) => (
                  <CircularRow
                    key={item.id}
                    locale={locale}
                    item={item}
                    related={circulars.related.includes(item)}
                    relatedLabel={t.related}
                    openLabel={t.openSource}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function FaqRow({
  locale,
  item,
  open,
  pinnedLabel,
  circulars,
  onToggle,
}: {
  locale: SalaryLocale;
  item: SalaryFaqRecord;
  open: boolean;
  pinnedLabel: string;
  circulars: SalaryCircularRecord[];
  onToggle: () => void;
}) {
  const question = pick(locale, item.question_bn, item.question_en);
  const answer = pick(locale, item.answer_bn, item.answer_en);
  return (
    <li id={`salary-faq-${item.id}`} className="scroll-mt-24 border-b border-emerald-50 last:border-b-0">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-emerald-50/60"
        aria-expanded={open}
        onClick={onToggle}
      >
        <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-emerald-700 transition ${open ? 'rotate-180' : ''}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{question}</span>
          {item.pinned ? (
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <Pin className="h-3 w-3" />
              {pinnedLabel}
            </span>
          ) : null}
        </span>
      </button>
      {open ? (
        <div className="px-4 pb-4 pl-11">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{answer}</p>
          {circulars.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {circulars.map((circular) => (
                <a
                  key={circular.id}
                  href={circular.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-900 ring-1 ring-teal-200 hover:bg-teal-100"
                >
                  <span className="truncate">{pick(locale, circular.title_bn, circular.title_en)}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function CircularRow({
  locale,
  item,
  related,
  relatedLabel,
  openLabel,
}: {
  locale: SalaryLocale;
  item: SalaryCircularRecord;
  related: boolean;
  relatedLabel: string;
  openLabel: string;
}) {
  const title = pick(locale, item.title_bn, item.title_en);
  const summary = pick(locale, item.summary_bn, item.summary_en);
  return (
    <li id={`salary-circular-${item.id}`} className={`rounded-xl bg-white p-3 shadow-sm ring-1 ${related ? 'ring-emerald-300' : 'ring-slate-200'}`}>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <span>{formatDay(locale, item.publish_date)}</span>
        {item.circular_no ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{digits(locale, item.circular_no)}</span> : null}
        {related ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">{relatedLabel}</span> : null}
      </div>
      <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{item.source_name}</p>
      {summary ? <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{summary}</p> : null}
      <a
        href={item.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:underline"
      >
        {openLabel}
        <ExternalLink className="h-3 w-3" />
      </a>
    </li>
  );
}
