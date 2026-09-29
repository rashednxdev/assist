'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Send } from 'lucide-react';
import type { MySubmittedQuestionRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { formatDateTimeDdMmYyyy } from '@/lib/date-display';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  'flex h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50';

const STATUS_BADGE: Record<string, { label: string; variant: 'warning' | 'success' | 'destructive' }> = {
  pending: { label: 'Pending review', variant: 'warning' },
  accepted: { label: 'Answered', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },
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
      .catch((err) => setMineError(err instanceof Error ? err.message : 'Failed to load submissions'))
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
      .catch(() => setError('Could not load subjects for this exam.'))
      .finally(() => setLoadingSubjects(false));
  }, [examId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!subjectId) {
      setError('Select a subject first');
      return;
    }
    if (body.trim().length < 5) {
      setError('Please write a more complete question');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/user-questions', {
        method: 'POST',
        body: JSON.stringify({ exam_subject_id: subjectId, body: body.trim() }),
      });
      setBody('');
      setSuccess('Your question has been submitted for review.');
      loadMine();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Submit a Question"
        description="Can't find a question? Submit it for a subject — an admin will review and answer it."
        backHref="/dashboard"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New question</CardTitle>
          <CardDescription>Pick the exam and subject, then write your question.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="uq-exam">Exam</Label>
                <select id="uq-exam" className={selectClass} value={examId} onChange={(e) => setExamId(e.target.value)}>
                  <option value="">Select exam…</option>
                  {exams.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.short_name ? `${x.short_name} — ${x.name}` : x.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uq-subject">Subject</Label>
                <select
                  id="uq-subject"
                  className={selectClass}
                  value={subjectId}
                  disabled={!examId || loadingSubjects}
                  onChange={(e) => setSubjectId(e.target.value)}
                >
                  <option value="">{loadingSubjects ? 'Loading…' : 'Select subject…'}</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uq-body">Question</Label>
              <textarea
                id="uq-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your question here…"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>
            {error && <Alert variant="error">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}
            <Button type="submit" disabled={submitting}>
              <Send className="h-4 w-4" />
              {submitting ? 'Submitting…' : 'Submit question'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My submissions</h2>
        {mineError && <Alert variant="error">{mineError}</Alert>}
        {loadingMine ? (
          <Skeleton className="h-20 w-full" />
        ) : mine.length === 0 ? (
          !mineError && <EmptyState title="No submissions yet" description="Questions you submit will appear here." />
        ) : (
          mine.map((q) => {
            const status = STATUS_BADGE[q.status] ?? { label: q.status, variant: 'warning' as const };
            return (
              <Card key={q.id}>
                <CardContent className="space-y-2 pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-muted">{q.subject_name}</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <p className="whitespace-pre-line text-sm">{q.body}</p>
                  {q.admin_note && (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <span className="font-semibold">Admin note:</span> {q.admin_note}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span>{formatDateTimeDdMmYyyy(q.created_at)}</span>
                    {q.linked_question_id && (
                      <Link href={`/questions/${q.linked_question_id}`} className="font-semibold text-primary hover:underline">
                        View answer
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
