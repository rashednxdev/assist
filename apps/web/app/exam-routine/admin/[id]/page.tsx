'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import type { ExamRoutineDetail } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { formatDdMmYyyy } from '@/lib/date-display';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

interface SubjectRow {
  id: string;
  name: string;
}

interface TreeResponse {
  parts: { subjects: SubjectRow[] }[];
}

export default function ExamRoutineDetailPage() {
  const params = useParams<{ id: string }>();
  const routineId = params.id;

  const [routine, setRoutine] = useState<ExamRoutineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [instruction, setInstruction] = useState('');
  const [adding, setAdding] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [startDateNote, setStartDateNote] = useState('');
  const [savingStart, setSavingStart] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: ExamRoutineDetail }>(`/exam-routine/admin/${routineId}`);
      setRoutine(res.data);
      setStartDate(res.data.start_date);
      setStartDateNote(res.data.start_date_note ?? '');
      const tree = await apiFetch<{ data: TreeResponse }>(`/exams/names/${res.data.exam_name_id}/tree`);
      setSubjects(tree.data.parts.flatMap((p) => p.subjects));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (routineId) void load();
  }, [routineId]);

  async function saveStartDate() {
    setSavingStart(true);
    setError('');
    try {
      await apiFetch(`/exam-routine/${routineId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          start_date: startDate,
          start_date_note: startDateNote.trim() || null,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingStart(false);
    }
  }

  async function addEntry() {
    setError('');
    if (!subjectId || !date || !time) {
      setError('Subject, date, and time are required');
      return;
    }
    setAdding(true);
    try {
      await apiFetch(`/exam-routine/${routineId}/entries`, {
        method: 'POST',
        body: JSON.stringify({
          exam_subject_id: subjectId,
          date,
          time,
          instruction: instruction.trim() || undefined,
        }),
      });
      setSubjectId('');
      setDate('');
      setTime('');
      setInstruction('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subject');
    } finally {
      setAdding(false);
    }
  }

  async function removeEntry(entryId: string) {
    if (!confirm('Remove this subject from the routine?')) return;
    try {
      await apiFetch(`/exam-routine/entries/${entryId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading...</p>;
  if (!routine) return <Alert variant="error">{error || 'Routine not found'}</Alert>;

  return (
    <div className="space-y-6">
      <PageHeader title={routine.exam_name} description="Exam routine" backHref="/exam-routine/admin" />

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exam start date (countdown target)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date">Start date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-48"
              />
            </div>
            <Button type="button" size="sm" disabled={savingStart} onClick={() => void saveStartDate()}>
              {savingStart ? 'Saving...' : 'Save'}
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start-date-note">Note for countdown (optional)</Label>
            <Input
              id="start-date-note"
              value={startDateNote}
              onChange={(e) => setStartDateNote(e.target.value)}
              placeholder="Shown under the countdown on mobile, e.g. Admit card release TBD"
              maxLength={500}
            />
            <p className="text-xs text-muted">Appears on the mobile home countdown and exam routine screens.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add subject</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="entry-subject">Subject</Label>
            <select
              id="entry-subject"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-date">Date</Label>
            <Input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-time">Time</Label>
            <Input id="entry-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="button" disabled={adding} onClick={() => void addEntry()}>
              <Plus className="h-4 w-4" />
              {adding ? 'Adding...' : 'Add'}
            </Button>
          </div>
          <div className="space-y-1.5 sm:col-span-4">
            <Label htmlFor="entry-instruction">Instruction (optional)</Label>
            <textarea
              id="entry-instruction"
              className="ibas-textarea"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Shown to users when they tap this subject..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subjects ({routine.entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {routine.entries.length === 0 ? (
            <p className="text-sm text-muted">No subjects added yet.</p>
          ) : (
            <div className="space-y-2">
              {routine.entries.map((e) => (
                <div key={e.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{e.subject_name}</span>
                      <span className="ml-2 text-xs text-muted">
                        {formatDdMmYyyy(e.date)} · {e.time}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 px-2"
                      onClick={() => void removeEntry(e.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {e.instruction && <p className="mt-1 text-muted">{e.instruction}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
