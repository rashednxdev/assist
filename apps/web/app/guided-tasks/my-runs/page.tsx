'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface RunItem {
  id: string;
  task_id: string;
  task_name_en: string;
  status: string;
  current_step: number;
  current_role: string;
  started_at: string;
  last_activity_at: string;
}

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'default';
    case 'rejected':
      return 'destructive';
    case 'cancelled':
      return 'warning';
    default:
      return 'secondary';
  }
}

export default function MyRunsPage() {
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: RunItem[] }>('/workflow/runs/mine')
      .then((r) => setRuns(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My runs"
        description="Processes you have started. Continue an in-progress run or review completed ones."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Your process runs</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href="/guided-tasks">Browse processes</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : runs.length === 0 ? (
            <div className="space-y-3 text-sm text-muted">
              <p>You have not started any guided processes yet.</p>
              <Button asChild size="sm">
                <Link href="/guided-tasks">Open process catalog</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{run.task_name_en}</span>
                      <Badge variant={statusVariant(run.status)}>{run.status.replace('_', ' ')}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Started {new Date(run.started_at).toLocaleString()}
                      {run.status === 'in_progress' && (
                        <> · Step {run.current_step} · Role {run.current_role}</>
                      )}
                    </p>
                  </div>
                  {run.status === 'in_progress' && (
                    <Button asChild size="sm">
                      <Link href={`/workflow/guide?task=${run.task_id}&run=${run.id}`}>Continue</Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
