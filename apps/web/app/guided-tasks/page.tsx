'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpenCheck, PlayCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { fetchMe, type MeUser } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/workflow/role-badge';

interface TaskItem {
  id: string;
  name_en: string;
  description_en: string;
  module_name_en: string;
  total_steps: number;
  roles_involved: string[];
  estimated_time?: string;
}

interface TaskDetail {
  task: TaskItem;
  steps: Array<{ step_number: number; role_code: string }>;
}

export default function GuidedTasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [user, setUser] = useState<MeUser | null>(null);
  const [firstStepRoles, setFirstStepRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: TaskItem[] }>('/workflow/tasks'),
      fetchMe(),
    ])
      .then(async ([tasksRes, meRes]) => {
        const published = tasksRes.data.filter((t) => t);
        setTasks(published);
        setUser(meRes.data);

        const roleMap: Record<string, string> = {};
        await Promise.all(
          published.slice(0, 10).map(async (t) => {
            try {
              const detail = await apiFetch<{ data: TaskDetail }>(`/workflow/tasks/${t.id}`);
              const first = detail.data.steps[0];
              if (first) roleMap[t.id] = first.role_code;
            } catch {
              /* ignore */
            }
          }),
        );
        setFirstStepRoles(roleMap);
      })
      .finally(() => setLoading(false));
  }, []);

  const canStart = (taskId: string) => {
    if (!user) return false;
    if (user.is_super_admin) return true;
    const role = firstStepRoles[taskId];
    if (!role) return false;
    return user.workflow_roles.some((r) => r.is_active && r.role_code === role);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guided processes"
        description="Step-by-step iBAS-style workflows for pay bills, receipts, and office procedures. Preview the full guide or start an interactive run."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">Available processes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{tasks.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">You can start</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{tasks.filter((t) => canStart(t.id)).length}</p>
            {user?.user_type === 'officer' && user.workflow_roles.length === 0 && (
              <p className="mt-1 text-xs text-muted">SDO role assigned after verification</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/guided-tasks/my-runs">My runs</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/workflow/inbox">Action inbox</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-primary" />
            Process catalog
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted">No guided processes published yet.</p>
          ) : (
            <div className="space-y-4">
              {tasks.map((t) => {
                const startable = canStart(t.id);
                return (
                  <div
                    key={t.id}
                    className="rounded-xl border border-border bg-slate-50/50 p-4 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{t.name_en}</h3>
                          {startable ? (
                            <Badge variant="success">Ready to run</Badge>
                          ) : (
                            <Badge variant="secondary">Preview mode</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted">{t.description_en}</p>
                        <p className="mt-2 text-xs text-muted">
                          {t.module_name_en} · {t.total_steps} steps
                          {t.estimated_time ? ` · ~${t.estimated_time}` : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.roles_involved.map((r) => (
                            <RoleBadge key={r} code={r} />
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/guided-tasks/${t.id}`}>
                            View guide
                            <ArrowRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                        {startable && (
                          <Button asChild size="sm">
                            <Link href={`/workflow/guide?task=${t.id}`}>
                              <PlayCircle className="h-4 w-4" />
                              Start run
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
