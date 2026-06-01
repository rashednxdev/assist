'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { RoleBadge } from '@/components/workflow/role-badge';

interface TaskItem {
  id: string;
  name_en: string;
  description_en: string;
  module_name_en: string;
  total_steps: number;
  roles_involved: string[];
  is_published: boolean;
}

export default function WorkflowTasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: TaskItem[] }>('/workflow/tasks')
      .then((r) => setTasks(r.data.filter((t) => t.is_published)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Published workflow tasks available to run." />

      <Card>
        <CardHeader>
          <CardTitle>Available tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted">No published tasks yet.</p>
          ) : (
            <div className="space-y-4">
              {tasks.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-slate-50/50 p-4 transition-colors hover:bg-slate-50">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{t.name_en}</h3>
                      <p className="mt-1 text-sm text-muted">{t.description_en}</p>
                      <p className="mt-2 text-xs text-muted">
                        {t.module_name_en} · {t.total_steps} steps
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.roles_involved.map((r) => (
                          <RoleBadge key={r} code={r} />
                        ))}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/guided-tasks/${t.id}`}>View guide</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/workflow/guide?task=${t.id}`}>Run guide</Link>
                    </Button>
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
