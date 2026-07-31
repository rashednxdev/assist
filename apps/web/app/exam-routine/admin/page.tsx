'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { ExamRoutineListItem } from '@ibas/shared-types';
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

export default function ExamRoutineAdminPage() {
  const [routines, setRoutines] = useState<ExamRoutineListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [exams, setExams] = useState<ExamRow[]>([]);
  const [examId, setExamId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: ExamRoutineListItem[] }>('/exam-routine/admin?limit=100');
      setRoutines(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    apiFetch<{ data: ExamRow[] }>('/exams/names')
      .then((r) => setExams(r.data))
      .catch(() => setExams([]));
  }, []);

  async function createRoutine() {
    setError('');
    if (!examId || !startDate) {
      setError('Select an exam and a start date');
      return;
    }
    setCreating(true);
    try {
      await apiFetch('/exam-routine', {
        method: 'POST',
        body: JSON.stringify({ exam_name_id: examId, start_date: startDate }),
      });
      setExamId('');
      setStartDate('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create routine');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam Routine"
        description="Publish an exam's schedule with a countdown, per-subject date/time, and reveal-in-place instructions."
      />

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New routine</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="routine-exam">Exam</Label>
            <select
              id="routine-exam"
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
            <Label htmlFor="routine-start">Start date (countdown target)</Label>
            <Input
              id="routine-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" disabled={creating} onClick={() => void createRoutine()}>
              <Plus className="h-4 w-4" />
              {creating ? 'Creating...' : 'Create routine'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Routines</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : routines.length === 0 ? (
            <p className="text-sm text-muted">No routines yet.</p>
          ) : (
            <div className="space-y-2">
              {routines.map((r) => (
                <Link
                  key={r.id}
                  href={`/exam-routine/admin/${r.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border p-3 text-sm hover:bg-slate-50"
                >
                  <div>
                    <span className="font-medium">{r.exam_name}</span>
                    <span className="ml-2 text-xs text-muted">
                      Starts {r.start_date} · {r.entry_count} subject{r.entry_count === 1 ? '' : 's'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
