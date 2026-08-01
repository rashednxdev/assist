'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import type { QotdDateDetail, QotdQuestionItem } from '@ibas/shared-types';
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

/** Questions of the Day gets its own cool emerald accent, distinct from the app's default blue. */
const qotdButton = 'bg-emerald-600 text-white hover:bg-emerald-700';
const qotdCard = 'border-emerald-100';

export default function QotdDatePage() {
  const params = useParams<{ date: string }>();
  const date = params.date;

  const [detail, setDetail] = useState<QotdDateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [exams, setExams] = useState<ExamRow[]>([]);
  const [examId, setExamId] = useState('');
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [publishTime, setPublishTime] = useState('00:00');

  const [search, setSearch] = useState('');
  const [bank, setBank] = useState<QotdQuestionItem[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankFetched, setBankFetched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: QotdDateDetail }>(`/qotd/admin/dates/${date}`);
      setDetail(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (date) void load();
  }, [date]);

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
            const p = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
            if (search.trim()) p.set('q', search.trim());
            const r = await apiFetch<{ data: QotdQuestionItem[]; meta?: { has_more?: boolean } }>(
              `/qotd/subjects/${subjectId}/questions?${p.toString()}`,
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

  function resetAddForm() {
    setExamId('');
    setSubjectId('');
    setSubjects([]);
    setPublishTime('00:00');
    setSearch('');
    setSelected(new Set());
  }

  async function addSubject() {
    setError('');
    if (!subjectId) {
      setError('Select a subject');
      return;
    }
    if (selected.size === 0) {
      setError('Select at least one question');
      return;
    }
    setAdding(true);
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
      resetAddForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subject');
    } finally {
      setAdding(false);
    }
  }

  async function removeGroup(entryId: string) {
    if (!confirm('Remove this subject from the date?')) return;
    try {
      await apiFetch(`/qotd/entries/${entryId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function updatePublishTime(entryId: string, time: string) {
    setDetail((prev) =>
      prev
        ? { ...prev, groups: prev.groups.map((g) => (g.entry_id === entryId ? { ...g, publish_time: time } : g)) }
        : prev,
    );
    try {
      await apiFetch(`/qotd/entries/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ publish_time: time }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update publish time');
      await load();
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading...</p>;
  if (!detail) return <Alert variant="error">{error || 'Not found'}</Alert>;

  const existingSubjectIds = new Set(detail.groups.map((g) => g.exam_subject_id));

  return (
    <div className="space-y-6">
      <PageHeader title={date} description="Questions of the Day for this date" backHref="/qotd/admin" />

      {error && <Alert variant="error">{error}</Alert>}

      <Card className={qotdCard}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Add a subject
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
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
                  <option key={s.id} value={s.id} disabled={existingSubjectIds.has(s.id)}>
                    {s.name}
                    {existingSubjectIds.has(s.id) ? ' (already added)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qotd-publish-time">Publish time</Label>
              <Input
                id="qotd-publish-time"
                type="time"
                value={publishTime}
                onChange={(e) => setPublishTime(e.target.value)}
              />
            </div>
          </div>

          {subjectId && (
            <div className="space-y-3 rounded-lg border border-emerald-100 p-3">
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
                            className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm hover:bg-emerald-50/60 ${
                              selected.has(q.id) ? 'border-emerald-300 bg-emerald-50/40' : 'border-border'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 accent-emerald-600"
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

              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted">{selected.size} selected</span>
                <Button type="button" className={qotdButton} disabled={adding} onClick={() => void addSubject()}>
                  <Plus className="h-4 w-4" />
                  {adding ? 'Adding...' : 'Add subject'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={qotdCard}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Subjects for {date} ({detail.groups.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {detail.groups.length === 0 ? (
            <p className="text-sm text-muted">No subjects added for this date yet.</p>
          ) : (
            <div className="space-y-2">
              {detail.groups.map((g) => (
                <div key={g.entry_id} className="rounded-md border border-emerald-100 bg-emerald-50/40 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="font-medium text-emerald-900">{g.subject_name}</span>
                      <span className="ml-2 text-xs text-muted">
                        {g.questions.length} question{g.questions.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor={`publish-time-${g.entry_id}`} className="text-xs text-muted">
                          Publish
                        </Label>
                        <Input
                          id={`publish-time-${g.entry_id}`}
                          type="time"
                          value={g.publish_time}
                          onChange={(e) => void updatePublishTime(g.entry_id, e.target.value)}
                          className="h-8 w-28 text-xs"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 px-2"
                        onClick={() => void removeGroup(g.entry_id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
