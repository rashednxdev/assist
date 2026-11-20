'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Send, Sparkles } from 'lucide-react';
import type { MySubmittedQuestionRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { formatDateTimeDdMmYyyy } from '@/lib/date-display';
import { toBanglaDigits } from '@/lib/bangla-format';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface ExamProgram {
  id: string;
  name: string;
  short_name: string;
}

interface ExamTree {
  parts: Array<{ subjects: Array<{ id: string; name: string }> }>;
}

const selectClass =
  'flex h-10 w-full rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] px-3 py-2 text-sm text-[#0a2f5b] outline-none focus:border-[#1566b8] focus:bg-white disabled:opacity-50';

const STATUS_BADGE: Record<string, { label: string; variant: 'warning' | 'success' | 'destructive' }> = {
  pending: { label: 'পর্যালোচনাধীন', variant: 'warning' },
  accepted: { label: 'উত্তর দেওয়া হয়েছে', variant: 'success' },
  rejected: { label: 'বাতিল', variant: 'destructive' },
};

export default function UserQuestionsPage() {
  const [exams, setExams] = useState<ExamProgram[]>([]);
  const [examId, setExamId] = useState('');
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [subjectId, setSubjectId] = useState('');
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [mine, setMine] = useState<MySubmittedQuestionRecord[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [mineError, setMineError] = useState('');

  const loadMine = useCallback(() => {
    setLoadingMine(true);
    apiFetch<{ data: MySubmittedQuestionRecord[] }>('/user-questions/mine')
      .then((res) => {
        setMine(res.data);
        setMineError('');
      })
      .catch((err) => setMineError(err instanceof Error ? err.message : 'পূর্বের প্রশ্ন লোড করা যায়নি'))
      .finally(() => setLoadingMine(false));
  }, []);

  useEffect(() => {
    apiFetch<{ data: ExamProgram[] }>('/exams/names')
      .then((res) => setExams(res.data))
      .catch(() => setExams([]));
    loadMine();
  }, [loadMine]);

  useEffect(() => {
    setSubjectId('');
    setSubjects([]);
    if (!examId) return;
    setLoadingSubjects(true);
    apiFetch<{ data: ExamTree }>(`/exams/names/${examId}/tree`)
      .then((res) => setSubjects(res.data.parts.flatMap((p) => p.subjects)))
      .catch(() => setError('বিষয় তালিকা লোড করা যায়নি।'))
      .finally(() => setLoadingSubjects(false));
  }, [examId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!subjectId) {
      setError('প্রথমে একটি বিষয় নির্বাচন করুন');
      return;
    }
    if (body.trim().length < 5) {
      setError('অনুগ্রহ করে আপনার প্রশ্নটি বিস্তারিত লিখুন');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/user-questions', {
        method: 'POST',
        body: JSON.stringify({ exam_subject_id: subjectId, body: body.trim() }),
      });
      setBody('');
      setSuccess('আপনার প্রশ্নটি সফলভাবে জমা হয়েছে। পর্যালোচনার পর উত্তর যুক্ত হবে।');
      loadMine();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'প্রশ্ন জমা দেওয়া যায়নি');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-[#c7dff4] bg-[#eaf3fc] p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1566b8] text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0a2f5b] sm:text-2xl">Ask ProAssist</h1>
            <p className="mt-1 text-sm text-slate-600">
              সার্ভিস রুলস, ফিন্যান্সিয়াল রুলস বা পরীক্ষার কোনো প্রশ্ন খুঁজে না পেলে বিষয় নির্বাচন করে পাঠান — অভিজ্ঞ প্যানেল পর্যালোচনা করে উত্তর যুক্ত করবেন।
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs sm:p-6">
        <h2 className="text-base font-bold text-[#0a2f5b]">নতুন প্রশ্ন পাঠান</h2>
        <p className="mt-0.5 text-xs text-slate-500">পরীক্ষা ও বিষয় নির্বাচন করে আপনার প্রশ্নটি স্পষ্টভাবে লিখুন।</p>

        <form className="mt-4 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="uq-exam" className="text-xs font-semibold text-[#0a2f5b]">পরীক্ষা</Label>
              <select id="uq-exam" className={selectClass} value={examId} onChange={(e) => setExamId(e.target.value)}>
                <option value="">পরীক্ষা নির্বাচন করুন…</option>
                {exams.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.short_name ? `${x.short_name} — ${x.name}` : x.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uq-subject" className="text-xs font-semibold text-[#0a2f5b]">বিষয়</Label>
              <select
                id="uq-subject"
                className={selectClass}
                value={subjectId}
                disabled={!examId || loadingSubjects}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="">{loadingSubjects ? 'লোড হচ্ছে…' : 'বিষয় নির্বাচন করুন…'}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="uq-body" className="text-xs font-semibold text-[#0a2f5b]">আপনার প্রশ্ন</Label>
            <textarea
              id="uq-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="বিধি বা অধ্যায়ের উল্লেখসহ আপনার প্রশ্নটি এখানে লিখুন…"
              className="w-full rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] px-3.5 py-2.5 text-sm text-[#0a2f5b] outline-none focus:border-[#1566b8] focus:bg-white"
            />
          </div>

          {error ? <Alert variant="error">{error}</Alert> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}

          <Button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-[#1566b8] px-5 text-white hover:bg-[#0f5294]"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'পাঠানো হচ্ছে…' : 'প্রশ্ন জমা দিন'}
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-[#0a2f5b]">আপনার পাঠানো প্রশ্নসমূহ</h2>
        {mineError ? <Alert variant="error">{mineError}</Alert> : null}
        {loadingMine ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : mine.length === 0 ? (
          !mineError ? (
            <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-center text-sm text-slate-500">
              আপনি এখনো কোনো প্রশ্ন পাঠাননি।
            </div>
          ) : null
        ) : (
          mine.map((q) => {
            const status = STATUS_BADGE[q.status] ?? { label: q.status, variant: 'warning' as const };
            return (
              <div key={q.id} className="space-y-2 rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-[#eaf3fc] px-2.5 py-0.5 text-xs font-semibold text-[#1566b8]">
                    {q.subject_name}
                  </span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="whitespace-pre-line text-sm text-[#0a2f5b]">{q.body}</p>
                {q.admin_note ? (
                  <p className="rounded-xl bg-[#f4f9fd] px-3.5 py-2.5 text-xs text-slate-700">
                    <span className="font-bold text-[#0a2f5b]">মন্তব্য:</span> {q.admin_note}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
                  <span>{toBanglaDigits(formatDateTimeDdMmYyyy(q.created_at))}</span>
                  {q.linked_question_id ? (
                    <Link
                      href={`/questions/${q.linked_question_id}`}
                      className="font-semibold text-[#1566b8] hover:underline"
                    >
                      সম্পূর্ণ উত্তর দেখুন →
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
