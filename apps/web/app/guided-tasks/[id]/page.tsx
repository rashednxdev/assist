'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, PlayCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { fetchMe, type MeUser } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { RoleBadge } from '@/components/workflow/role-badge';
import { TaskGuideSteps, type GuideStep } from '@/components/guided-tasks/task-guide-steps';

interface RoleItem {
  code: string;
  color: string;
}

interface TaskDetail {
  task: {
    id: string;
    name_en: string;
    description_en: string;
    module_name_en: string;
    total_steps: number;
    roles_involved: string[];
    estimated_time?: string;
  };
  steps: GuideStep[];
}

function canStartTask(user: MeUser | null, steps: GuideStep[]): boolean {
  if (!user || !steps.length) return false;
  if (user.is_super_admin) return true;
  const firstRole = steps[0]?.role_code;
  return user.workflow_roles.some((r) => r.is_active && r.role_code === firstRole);
}

export default function GuidedTaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [roleColors, setRoleColors] = useState<Record<string, string>>({});
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: TaskDetail }>(`/workflow/tasks/${taskId}`),
      apiFetch<{ data: RoleItem[] }>('/workflow/roles'),
      fetchMe(),
    ])
      .then(([detailRes, rolesRes, meRes]) => {
        setDetail(detailRes.data);
        setRoleColors(Object.fromEntries(rolesRes.data.map((r) => [r.code, r.color])));
        setUser(meRes.data);
      })
      .catch(() => setError('Could not load this guided process.'))
      .finally(() => setLoading(false));
  }, [taskId]);

  const startable = detail ? canStartTask(user, detail.steps) : false;

  if (loading) {
    return <p className="text-sm text-muted">Loading guide...</p>;
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{error || 'Process not found.'}</Alert>
        <Button asChild variant="outline">
          <Link href="/guided-tasks">
            <ArrowLeft className="h-4 w-4" />
            Back to catalog
          </Link>
        </Button>
      </div>
    );
  }

  const { task, steps } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/guided-tasks">
            <ArrowLeft className="h-4 w-4" />
            Catalog
          </Link>
        </Button>
      </div>

      <PageHeader
        title={task.name_en}
        description={task.description_en}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{task.module_name_en}</Badge>
        <Badge variant="outline">{task.total_steps} steps</Badge>
        {task.estimated_time && <Badge variant="outline">~{task.estimated_time}</Badge>}
        {startable ? (
          <Badge variant="success">You can start this run</Badge>
        ) : (
          <Badge variant="warning">Read-only preview</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {task.roles_involved.map((r) => (
          <RoleBadge key={r} code={r} color={roleColors[r]} />
        ))}
      </div>

      {!startable && (
        <Alert variant="info">
          {user?.user_type === 'officer'
            ? 'Your office role (e.g. SDO) is required to start an interactive run. You can still follow the step-by-step guide below.'
            : 'Interactive runs require an office workflow role. Follow the step-by-step guide below to learn the procedure, or register as an officer to run tasks.'}
        </Alert>
      )}

      {startable && (
        <Button asChild>
          <Link href={`/workflow/guide?task=${task.id}`}>
            <PlayCircle className="h-4 w-4" />
            Start interactive run
          </Link>
        </Button>
      )}

      {steps.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Step by step</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskGuideSteps steps={steps} roleColors={roleColors} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
