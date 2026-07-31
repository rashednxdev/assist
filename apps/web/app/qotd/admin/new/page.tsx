'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QotdQuestionItem } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

interface ExamRow {
  id: string;
  name: string;
}

interface SubjectRow {
  id: string;
  name: string;
}

interface TreeResponse {
  parts: { subjects: SubjectRow[] }[];
}

function truncate(text: string, len = 140) {
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

/** Question of the Day gets its own cool teal accent, distinct from the app's default blue. */
const qotdButton = 'bg-teal-600 text-white hover:bg-teal-700';
const qotdCard = 'border-teal-100';

export default function NewQotdEntryPage() {
  const router = useRouter();

  const [exams, setExams] = useState<ExamRow[]>([]);
  const [examId, setExamId] = useState('');
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState('');
  const [publishTime, setPublishTime] = useState('00:00');

  const [search, setSearch] = useState('');
  const [bank, setBank] = useState<QotdQuestionItem[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankFetched, setBankFetched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: ExamRow[] }>('/exams/names')
      .then((r) => setExams(r.data))
      .catch(() => setExams([]));
  }, []);

  useEffect(() => {
    setSubjectId('');
    setSubjects([]);
    if (!examId) return;
    apiFetch<{ data: TreeResponse }>(`/exams/names/${examId}/tree`)
      .then((r) => setSubjects(r.data.parts.flatMap((p) => p.subjects)))
      .catch(() => setSubjects([]));
  }, [examId]);

  useEffect(() => {
    setBank([]);
    setBankFetched(false);
    setSelected(new Set());
    if (!subjectId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setBankLoading(true);
        try {
          const pageSize = 100;
          const all: QotdQuestionItem[] = [];
          let offset = 0;
          for (;;) {
            if (cancelled) return;
            const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
            if (search.trim()) params.set('q', search.trim());
            const r = await apiFetch<{ data: QotdQuestionItem[]; meta?: { has_more?: boolean } }>(
              `/qotd/subjects/${subjectId}/questions?${params.toString()}`,
            );
            all.push(...r.data);
            if (!r.meta?.has_more) break;
            offset += pageSize;
          }
          if (!cancelled) setBank(all);
        } catch {
          if (!cancelled) setBank([]);
        } finally {
          if (!cancelled) {
            setBankLoading(false);
            setBankFetched(true);
          }
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [subjectId, search]);

  const groupedByBook = useMemo(() => {
    const groups = new Map<string, { label: string; items: QotdQuestionItem[] }>();
    for (const q of bank) {
      const key = q.book_name ?? '__none__';
      const label = q.book_name ?? 'Not linked to a book';
      if (!groups.has(key)) groups.set(key, { label, items: [] });
      groups.get(key)!.items.push(q);
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [bank]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setError('');
    if (!subjectId) {
      setError('Select a subject');
      return;
    }
    if (!date) {
      setError('Select a date');
      return;
    }
    if (selected.size === 0) {
      setError('Select at least one question');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/qotd/entries', {
        method: 'POST',
        body: JSON.stringify({
          exam_subject_id: subjectId,
          date,
          publish_time: publishTime,
          question_ids: [...selected],
        }),
      });
      router.push('/qotd/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entry');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Question of the Day entry"
        description="Pick an exam subject, a date, and the syllabus-linked questions to show for that day."
        backHref="/qotd/admin"
      />

      {error && <Alert variant="error">{error}</Alert>}

      <Card className={qotdCard}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
            Subject and date
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="qotd-exam">Exam</Label>
            <select
              id="qotd-exam"
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select exam</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qotd-subject">Subject</Label>
            <select
              id="qotd-subject"
              value={subjectId}
              disabled={!examId || subjects.length === 0}
              onChange={(e) => setSubjectId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{examId ? 'Select subject' : 'Select an exam first'}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qotd-date">Date</Label>
            <Input id="qotd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qotd-publish-time">Publish time</Label>
            <Input
              id="qotd-publish-time"
              type="time"
              value={publishTime}
              onChange={(e) => setPublishTime(e.target.value)}
            />
            <p className="text-xs text-muted">Hidden from users until this time on the date above.</p>
          </div>
        </CardContent>
      </Card>

      {subjectId && (
        <Card className={qotdCard}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
              Questions ({selected.size} selected)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search syllabus-linked questions..."
              className="max-w-sm"
            />

            {bankLoading ? (
              <p className="text-sm text-muted">Loading questions...</p>
            ) : bankFetched && bank.length === 0 ? (
              <p className="text-sm text-muted">
                No published questions are linked to this subject&apos;s syllabus yet.
              </p>
            ) : (
              <div className="max-h-96 space-y-4 overflow-y-auto">
                {groupedByBook.map((group) => (
                  <div key={group.label}>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      {group.label}
                    </div>
                    <div className="space-y-1">
                      {group.items.map((q) => (
                        <label
                          key={q.id}
                          className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm hover:bg-teal-50/60 ${
                            selected.has(q.id) ? 'border-teal-300 bg-teal-50/40' : 'border-border'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 accent-teal-600"
                            checked={selected.has(q.id)}
                            onChange={() => toggle(q.id)}
                          />
                          <span className="min-w-0 flex-1">
                            {truncate(q.body_en || q.body_bn || '')}
                            <span className="ml-2 text-xs text-muted">
                              ({q.question_type_code}, {q.marks}m)
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button type="button" className={qotdButton} disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Saving...' : 'Create entry'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
