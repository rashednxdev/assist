'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  FileText,
  GraduationCap,
  HelpCircle,
  Inbox,
  Library,
  PlayCircle,
  Radio,
  Route,
  Settings,
  Sparkles,
  Calculator,
} from 'lucide-react';
import type { MeUser } from '@/lib/auth';
import { hasModuleRead, hasOfficeModuleRead, isSuperAdmin } from '@/lib/capabilities';
import { userDisplayName } from '@/lib/display-text';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExamRoutineCountdown } from '@/components/dashboard/exam-routine-countdown';
import type { ProgressDashboardData } from '@/app/dashboard/page';

interface WorkflowSummary {
  inbox_count: number;
  published_task_count: number;
  can_start_task_count: number;
  my_runs_in_progress: number;
  workflow_role_codes: string[];
}

interface Summary {
  profile_complete_percent: number;
  address_count: number;
  subscription: { plan: { name: string } | null; expires_at: string } | null;
  workflow?: WorkflowSummary;
}

const learnLinks = [
  {
    href: '/books',
    label: 'Rule library',
    desc: 'GFR and government financial regulations',
    icon: Library,
    moduleCode: 'BOOKS',
  },
  {
    href: '/books/regulations',
    label: 'Regulations',
    desc: 'Acts, circulars, and amendments',
    icon: BookOpen,
    moduleCode: 'BOOKS',
  },
  {
    href: '/exams',
    label: 'Exam programs',
    desc: 'SAS, SRAS syllabus & structure',
    icon: GraduationCap,
    moduleCode: 'EXAM',
  },
  {
    href: '/questions',
    label: 'Question bank',
    desc: 'MCQ, short notes linked to rules',
    icon: HelpCircle,
    moduleCode: 'QUESTIONS',
  },
  {
    href: '/papers',
    label: 'Exam papers',
    desc: 'Model tests for your subject',
    icon: FileText,
    moduleCode: 'PAPER',
  },
  {
    href: '/pension',
    label: 'Pension calculator',
    desc: 'Leave account and lamp grant',
    icon: Calculator,
    moduleCode: 'PENSION',
  },
  {
    href: '/joining-period',
    label: 'Joining period',
    desc: 'Transfer / posting joining time',
    icon: Calculator,
    moduleCode: 'PENSION',
  },
] as const;

interface HostingRow {
  id: string;
  topic: string;
  scheduled_at: string;
  status: string;
  is_previous?: boolean;
  video_platform?: 'agora' | 'zoom';
}

function openLiveRoom(sessionId: string, platform?: 'agora' | 'zoom') {
  const path =
    platform === 'agora' ? `/live-room/${sessionId}` : `/live/zoom-room/${sessionId}`;
  window.open(path, '_blank', 'noopener,noreferrer');
}

export function UserDashboard({
  user,
  summary,
  progress,
}: {
  user: MeUser;
  summary: Summary | null;
  progress: ProgressDashboardData | null;
}) {
  const complete = summary?.profile_complete_percent ?? 0;
  const workflow = summary?.workflow;
  const grants = user.module_access ?? [];
  const visibleLearn = learnLinks.filter(
    (link) => isSuperAdmin(user) || hasModuleRead(grants, link.moduleCode),
  );
  const grantLabel = (code: string) =>
    grants.find((g) => g.module_code === code)?.module_name_en;
  const showWorkflow =
    isSuperAdmin(user) || hasModuleRead(grants, 'WORKFLOW') || hasOfficeModuleRead(grants);
  const [hosting, setHosting] = useState<HostingRow[]>([]);

  useEffect(() => {
    apiFetch<{ data: HostingRow[] }>('/live-streams/hosting?video_platform=zoom')
      .then((res) =>
        setHosting(
          res.data.filter(
            (row) => !row.is_previous && row.status !== 'ended' && row.status !== 'cancelled',
          ),
        ),
      )
      .catch(() => setHosting([]));
  }, []);

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary-dark to-slate-900 p-6 text-white sm:p-8">
        <div className="relative z-10 max-w-2xl space-y-3">
          <Badge className="bg-white/20 text-white ring-0">ProAssist</Badge>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Welcome, {userDisplayName(user)}
          </h1>
          <p className="text-primary-light/90 text-sm sm:text-base">
            Master government pay &amp; receipt rules, prepare for promotion exams, and stay compliant — at your own
            pace.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {hosting.length > 0 && (
              <Button asChild size="sm" variant="outline" className="bg-white text-primary-dark hover:bg-white/90 border-0">
                <Link href="/live/zoom/hosting">Host live classes ({hosting.length})</Link>
              </Button>
            )}
            {showWorkflow && (
              <Button asChild size="sm" variant="outline" className="bg-white text-primary-dark hover:bg-white/90 border-0">
                <Link href="/guided-tasks">{grantLabel('WORKFLOW') ?? 'Guided processes'}</Link>
              </Button>
            )}
            {(isSuperAdmin(user) || hasModuleRead(grants, 'BOOKS')) && (
              <Button asChild size="sm" variant="outline" className="border-white/40 text-white hover:bg-white/10">
                <Link href="/books">{grantLabel('BOOKS') ?? 'Browse rules'}</Link>
              </Button>
            )}
            {(isSuperAdmin(user) || hasModuleRead(grants, 'PAPER')) && (
              <Button asChild size="sm" variant="outline" className="border-white/40 text-white hover:bg-white/10">
                <Link href="/papers">{grantLabel('PAPER') ?? 'Practice now'}</Link>
              </Button>
            )}
          </div>
        </div>
        <Sparkles className="absolute -right-4 -top-4 h-32 w-32 text-white/10" />
      </div>

      {hosting.length > 0 ? (
        <div>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Your host classes</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/live/zoom/hosting">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-3">
            {hosting.slice(0, 5).map((item) => (
              <Card key={item.id} className="border-pink-100 bg-pink-50/40">
                <CardContent className="flex flex-wrap items-center gap-3 pt-5">
                  <div className="rounded-xl bg-pink-100 p-2 text-pink-800">
                    <Radio className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">{item.topic}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(item.scheduled_at).toLocaleString()} · {item.status}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openLiveRoom(item.id, item.video_platform ?? 'zoom')}
                  >
                    Open control room
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">Profile complete</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{complete}%</p>
            {complete < 100 && (
              <Button asChild variant="ghost" className="mt-1 h-auto p-0 text-primary hover:bg-transparent">
                <Link href="/settings/profile">Complete setup</Link>
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={user.is_verified ? 'success' : 'warning'}>
              {user.is_verified ? 'Verified' : 'Pending'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">Addresses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary?.address_count ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{summary?.subscription?.plan?.name ?? 'Free Starter'}</p>
            <Button asChild variant="ghost" className="mt-1 h-auto p-0 text-primary hover:bg-transparent">
              <Link href="/settings/subscription">Manage</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <ExamRoutineCountdown />

      {progress &&
        (progress.mcq.submitted > 0 ||
          progress.papers.attempted > 0 ||
          progress.exam_attempts.total_attempts > 0) && (
          <div>
            <h2 className="mb-4 text-lg font-semibold">Your progress</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted">MCQ accuracy</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{progress.mcq.accuracy_percent}%</p>
                  <p className="mt-1 text-sm text-muted">
                    {progress.mcq.correct} correct of {progress.mcq.submitted}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted">Papers started</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{progress.papers.attempted}</p>
                  <p className="mt-1 text-sm text-muted">
                    {progress.papers.average_progress_percent}% avg progress
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted">MCQ exam attempts</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{progress.exam_attempts.total_attempts}</p>
                  <p className="mt-1 text-sm text-muted">
                    {progress.exam_attempts.papers_passed}/{progress.exam_attempts.papers_attempted} papers
                    passed
                  </p>
                </CardContent>
              </Card>
            </div>

            {progress.exam_attempts.items.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Recent MCQ exam results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {progress.exam_attempts.items.slice(0, 5).map((item) => (
                    <Link
                      key={item.paper_id}
                      href={`/papers/${item.paper_id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm transition-colors hover:border-primary/30"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.paper_name}</p>
                        <p className="text-muted">
                          Best: {item.best_scored_marks}/{item.best_total_marks} · {item.attempts_count}{' '}
                          attempt{item.attempts_count === 1 ? '' : 's'}
                        </p>
                      </div>
                      <Badge variant={item.is_pass ? 'success' : 'warning'}>
                        {item.best_percent}% · {item.is_pass ? 'Pass' : 'Fail'}
                      </Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

      {showWorkflow && (
      <div>
        <h2 className="mb-4 text-lg font-semibold">Guided office processes</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/guided-tasks"
            className="group flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-muted text-primary">
              <Route className="h-5 w-5" />
            </div>
            <span className="mt-3 font-semibold">Process catalog</span>
            <p className="mt-1 text-sm text-muted">
              {workflow?.published_task_count ?? 0} step-by-step workflows
            </p>
          </Link>
          <Link
            href="/workflow/guide"
            className="group flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-muted text-primary">
              <PlayCircle className="h-5 w-5" />
            </div>
            <span className="mt-3 font-semibold">Run guide</span>
            <p className="mt-1 text-sm text-muted">
              {workflow?.can_start_task_count ?? 0} ready to start
              {(workflow?.my_runs_in_progress ?? 0) > 0 && (
                <> · {workflow!.my_runs_in_progress} in progress</>
              )}
            </p>
          </Link>
          <Link
            href="/workflow/inbox"
            className="group flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-muted text-primary">
              <Inbox className="h-5 w-5" />
            </div>
            <span className="mt-3 font-semibold">Action inbox</span>
            <p className="mt-1 text-sm text-muted">
              {(workflow?.inbox_count ?? 0) > 0 ? (
                <Badge variant="warning">{workflow!.inbox_count} pending</Badge>
              ) : (
                'No pending actions'
              )}
            </p>
          </Link>
          <Link
            href="/guided-tasks/my-runs"
            className="group flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-muted text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <span className="mt-3 font-semibold">My runs</span>
            <p className="mt-1 text-sm text-muted">Track processes you started</p>
          </Link>
        </div>
        {user.user_type === 'officer' && (workflow?.workflow_role_codes.length ?? 0) === 0 && (
          <p className="mt-3 text-sm text-muted">
            After verification, officers receive the SDO role to start pay &amp; receipt workflows.
          </p>
        )}
        {user.user_type === 'applicant' && (
          <p className="mt-3 text-sm text-muted">
            Preview any process step-by-step. Register as an officer to run interactive workflows.
          </p>
        )}
      </div>
      )}

      {visibleLearn.length > 0 && (
      <div>
        <h2 className="mb-4 text-lg font-semibold">Learning &amp; exam prep</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLearn.map((link) => {
            const Icon = link.icon;
            const title = grantLabel(link.moduleCode) ?? link.label;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{title}</span>
                    <ArrowRight className="h-4 w-4 text-muted group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{link.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Account settings</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href="/settings/profile">
              <Settings className="h-4 w-4" />
              Open settings
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          Update profile, change password, add your address, or upgrade your subscription plan anytime.
        </CardContent>
      </Card>
    </div>
  );
}
