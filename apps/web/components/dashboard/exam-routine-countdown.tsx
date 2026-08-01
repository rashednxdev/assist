'use client';

import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ExamRoutineListItem {
  exam_name_id: string;
  exam_name: string;
  start_date: string;
}

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function countdownLabel(days: number): string {
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`;
  if (days === 0) return 'Today';
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
}

/** Nearest upcoming exam(s) from the Exam Routine module, shown as a countdown on the dashboard. */
export function ExamRoutineCountdown() {
  const [routines, setRoutines] = useState<ExamRoutineListItem[] | null>(null);

  useEffect(() => {
    apiFetch<{ data: ExamRoutineListItem[] }>('/exam-routine/list')
      .then((res) => setRoutines(res.data))
      .catch(() => setRoutines([]));
  }, []);

  if (!routines || routines.length === 0) return null;

  const upcoming = routines
    .map((r) => ({ ...r, days: daysUntil(r.start_date) }))
    .filter((r) => r.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  if (upcoming.length === 0) return null;

  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Timer className="h-5 w-5 text-amber-600" />
        Exam countdown
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {upcoming.map((r) => (
          <Card key={r.exam_name_id} className="border-amber-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted">{r.exam_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-700">{countdownLabel(r.days)}</p>
              <p className="mt-1 text-sm text-muted">Starts {r.start_date}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
