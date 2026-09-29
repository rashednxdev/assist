'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Bell,
  BookOpen,
  Briefcase,
  ClipboardCheck,
  Landmark,
  Link2,
  Calculator,
  CalendarClock,
  CalendarDays,
  Database,
  Eye,
  FileCheck,
  FileText,
  GraduationCap,
  HelpCircle,
  Inbox,
  Layers,
  ListTodo,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  PauseCircle,
  Radio,
  RefreshCw,
  ScrollText,
  Search,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  Video,
  Wallet,
  Workflow,
} from 'lucide-react';
import type { MeUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api-client';
import { userDisplayName } from '@/lib/display-text';
import { formatDateTimeDdMmYyyy } from '@/lib/date-display';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminOverview {
  generated_at: string;
  users: {
    total: number;
    active: number;
    pending_verify: number;
    suspended: number;
    paid: number;
    new_7d: number;
    new_30d: number;
    active_7d: number;
    by_type: Record<string, number>;
  };
  content: {
    questions: { total: number; published: number; draft: number; quality_check: number };
    papers: { total: number; published: number };
    books: { total: number; published: number };
    exam_routines: number;
    qotd: { upcoming_dates: number; today_entries: number };
  };
  engagement: { paper_attempts_7d: number; paper_attempts_30d: number };
  submitted_questions: { pending: number; total: number };
  notifications: { sent: number; sent_30d: number };
  live: { upcoming: number; live_now: number };
  stopped_modules: Array<{ code: string; name: string; reason: string }>;
  recent_users: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    user_type: string;
    status: string;
    created_at: string;
  }>;
  recent_submitted_questions: Array<{ id: string; body: string; created_at: string }>;
  salary: { calculate_all_phases_count: number; pdf_download_count: number } | null;
}

interface QuickLink {
  href: string;
  label: string;
  desc: string;
  icon: typeof Users;
}

const QUICK_GROUPS: Array<{ title: string; links: QuickLink[] }> = [
  {
    title: 'People & access',
    links: [
      { href: '/admin/users', label: 'Users', desc: 'Accounts, module access, payments', icon: Users },
      { href: '/admin/users/new', label: 'New user', desc: 'Create an account manually', icon: UserPlus },
      { href: '/notifications/admin', label: 'Send notification', desc: 'Broadcast to all or selected users', icon: Bell },
      { href: '/admin/schedule', label: 'Official schedule', desc: 'Meetings, bill dates, R&R rules, PDFs', icon: CalendarClock },
      { href: '/admin/unpaid-message', label: 'Unpaid message', desc: 'Text shown on locked modules', icon: MessageCircle },
    ],
  },
  {
    title: 'Learning content',
    links: [
      { href: '/books/admin', label: 'Books', desc: 'Rule library & regulations', icon: BookOpen },
      { href: '/questions/new', label: 'New question', desc: 'Add to the question bank', icon: HelpCircle },
      { href: '/questions', label: 'Question bank', desc: 'Review, publish, edit', icon: HelpCircle },
      { href: '/questions/trash', label: 'Question trash', desc: 'Restore deleted questions', icon: Trash2 },
      { href: '/exams/admin', label: 'Exam setup', desc: 'Programs, parts, subjects', icon: GraduationCap },
      { href: '/papers/new', label: 'New paper', desc: 'Model test / exam paper', icon: FileText },
      { href: '/qotd/admin', label: 'Questions of the Day', desc: 'Schedule daily questions', icon: CalendarDays },
      { href: '/exam-routine/admin', label: 'Exam routine', desc: 'Schedules & instructions', icon: CalendarClock },
      { href: '/user-questions/admin', label: 'Submitted questions', desc: 'Accept or reject learner questions', icon: MessageSquarePlus },
      { href: '/live/zoom/admin', label: 'Live classes', desc: 'Schedule and host sessions', icon: Video },
    ],
  },
  {
    title: 'iBAS++ & Policy',
    links: [
      { href: '/admin/circulars', label: 'Circular archive', desc: 'Add circulars, SROs, gazettes', icon: Archive },
      { href: '/admin/policy-library', label: 'Policy collections', desc: 'Group books into collections', icon: Landmark },
      { href: '/admin/ibas-areas', label: 'iBAS++ areas', desc: 'Add or edit workspace areas', icon: Layers },
      { href: '/admin/ibas-links', label: 'iBAS++ area links', desc: 'Rules & circulars per area drawer', icon: Link2 },
      { href: '/admin/toolkit', label: 'Toolkit', desc: 'Checklists, templates & guides', icon: ClipboardCheck },
      { href: '/ibas', label: 'iBAS++ Workspace', desc: 'Preview what users see', icon: Briefcase },
    ],
  },
  {
    title: 'Platform',
    links: [
      { href: '/admin/setup/modules', label: 'Modules', desc: 'Stop / resume modules globally', icon: Layers },
      { href: '/admin/setup/geography', label: 'Geography', desc: 'Divisions, districts, thanas', icon: MapPin },
      { href: '/admin/setup/pension-leaves', label: 'Pension leave types', desc: 'Leave rules for the calculator', icon: Calculator },
      { href: '/admin/cache', label: 'Content cache', desc: 'Rebuild cached content', icon: Database },
      { href: '/admin/terms', label: 'Terms & Conditions', desc: 'Registration terms', icon: FileCheck },
      { href: '/admin/audit', label: 'Audit log', desc: 'System activity trail', icon: ScrollText },
      { href: '/admin/salary-stats', label: 'Salary calculator', desc: 'Public tool usage', icon: Wallet },
    ],
  },
  {
    title: 'Workflow',
    links: [
      { href: '/workflow/admin', label: 'Workflow builder', desc: 'Tasks & step definitions', icon: Workflow },
      { href: '/workflow/inbox', label: 'Workflow inbox', desc: 'Pending approvals', icon: Inbox },
      { href: '/workflow/tasks', label: 'Tasks', desc: 'Published processes', icon: ListTodo },
      { href: '/workflow/notifications', label: 'Workflow notifications', desc: 'Step alerts', icon: Bell },
    ],
  },
];

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  tone,
  href,
}: {
  title: string;
  value: number | string;
  sub?: React.ReactNode;
  icon: typeof Users;
  tone: string;
  href?: string;
}) {
  const body = (
    <Card className={cn('h-full transition-all', href && 'hover:border-primary/30 hover:shadow-md')}>
      <CardContent className="flex items-start gap-3 pt-5">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted">{title}</p>
          <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Meter({ value, total, className = 'bg-primary' }: { value: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={cn('h-2 rounded-full', className)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AdminDashboard({ user, onLearnerView }: { user: MeUser; onLearnerView?: () => void }) {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    apiFetch<{ data: AdminOverview }>('/admin/overview')
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load overview'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return QUICK_GROUPS;
    return QUICK_GROUPS.map((g) => ({
      ...g,
      links: g.links.filter((l) => `${l.label} ${l.desc}`.toLowerCase().includes(q)),
    })).filter((g) => g.links.length > 0);
  }, [filter]);

  const attention = data
    ? [
        data.users.pending_verify > 0 && {
          href: '/admin/users',
          icon: Users,
          text: `${data.users.pending_verify} user${data.users.pending_verify === 1 ? '' : 's'} waiting for verification`,
        },
        data.submitted_questions.pending > 0 && {
          href: '/user-questions/admin',
          icon: MessageSquarePlus,
          text: `${data.submitted_questions.pending} submitted question${data.submitted_questions.pending === 1 ? '' : 's'} to review`,
        },
        data.content.questions.quality_check > 0 && {
          href: '/questions',
          icon: HelpCircle,
          text: `${data.content.questions.quality_check} question${data.content.questions.quality_check === 1 ? '' : 's'} in quality check`,
        },
        data.content.qotd.upcoming_dates === 0 && {
          href: '/qotd/admin',
          icon: CalendarDays,
          text: 'No Questions of the Day scheduled from today',
        },
        data.live.live_now > 0 && {
          href: '/live/zoom/admin',
          icon: Radio,
          text: `${data.live.live_now} live class${data.live.live_now === 1 ? '' : 'es'} running now`,
        },
      ].filter((x): x is { href: string; icon: typeof Users; text: string } => Boolean(x))
    : [];

  const typeLabels: Record<string, string> = {
    officer: 'Officers',
    applicant: 'Applicants',
    admin: 'Admins',
    system_admin: 'System admins',
  };

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-primary-dark p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge className="bg-white/15 text-white ring-0">
              {user.is_super_admin ? 'Super admin' : user.user_type.replace('_', ' ')}
            </Badge>
            <h1 className="text-2xl font-bold sm:text-3xl">Admin panel</h1>
            <p className="text-sm text-white/75">
              Welcome back, {userDisplayName(user)}. Everything that needs your attention, in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
            {onLearnerView && (
              <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90" onClick={onLearnerView}>
                <Eye className="h-4 w-4" />
                Learner view
              </Button>
            )}
          </div>
        </div>
        {data && (
          <p className="mt-4 text-xs text-white/50">Updated {formatDateTimeDdMmYyyy(data.generated_at)}</p>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : data ? (
        <>
          {(attention.length > 0 || data.stopped_modules.length > 0) && (
            <div className="space-y-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Needs attention
              </h2>
              <div className="grid gap-2 md:grid-cols-2">
                {attention.map((a) => {
                  const Icon = a.icon;
                  return (
                    <Link
                      key={a.text}
                      href={a.href}
                      className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{a.text}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  );
                })}
                {data.stopped_modules.map((m) => (
                  <Link
                    key={m.code}
                    href="/admin/setup/modules"
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    <PauseCircle className="h-4 w-4 shrink-0" />
                    <span className="flex-1">
                      <span className="font-medium">{m.name}</span> is stopped
                      {m.reason ? ` — ${m.reason}` : ''}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Users"
              value={data.users.total}
              sub={`+${data.users.new_7d} this week · +${data.users.new_30d} in 30 days`}
              icon={Users}
              tone="bg-sky-100 text-sky-700"
              href="/admin/users"
            />
            <StatCard
              title="Active learners (7 days)"
              value={data.users.active_7d}
              sub={`${data.users.active} active accounts · ${data.users.suspended} suspended`}
              icon={TrendingUp}
              tone="bg-emerald-100 text-emerald-700"
            />
            <StatCard
              title="Paid users"
              value={data.users.paid}
              sub={
                data.users.total > 0
                  ? `${Math.round((data.users.paid / data.users.total) * 100)}% of all users`
                  : undefined
              }
              icon={Wallet}
              tone="bg-amber-100 text-amber-700"
              href="/admin/users"
            />
            <StatCard
              title="Paper attempts"
              value={data.engagement.paper_attempts_7d}
              sub={`this week · ${data.engagement.paper_attempts_30d} in 30 days`}
              icon={FileText}
              tone="bg-violet-100 text-violet-700"
            />
            <StatCard
              title="Submitted questions"
              value={data.submitted_questions.pending}
              sub={`pending · ${data.submitted_questions.total} total`}
              icon={MessageSquarePlus}
              tone="bg-lime-100 text-lime-700"
              href="/user-questions/admin"
            />
            <StatCard
              title="Live classes"
              value={data.live.upcoming}
              sub={`upcoming · ${data.live.live_now} live now`}
              icon={Video}
              tone="bg-pink-100 text-pink-700"
              href="/live/zoom/admin"
            />
            <StatCard
              title="Notifications sent"
              value={data.notifications.sent_30d}
              sub={`in 30 days · ${data.notifications.sent} total`}
              icon={Bell}
              tone="bg-indigo-100 text-indigo-700"
              href="/notifications/admin"
            />
            <StatCard
              title="Salary calculator"
              value={data.salary?.calculate_all_phases_count ?? 0}
              sub={`calculations · ${data.salary?.pdf_download_count ?? 0} PDFs`}
              icon={Calculator}
              tone="bg-green-100 text-green-700"
              href="/admin/salary-stats"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Content health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Questions published</span>
                    <span className="font-semibold">
                      {data.content.questions.published.toLocaleString()} / {data.content.questions.total.toLocaleString()}
                    </span>
                  </div>
                  <Meter value={data.content.questions.published} total={data.content.questions.total} className="bg-emerald-500" />
                  <p className="text-xs text-muted">
                    {data.content.questions.draft} draft · {data.content.questions.quality_check} in quality check
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Papers published</span>
                    <span className="font-semibold">
                      {data.content.papers.published} / {data.content.papers.total}
                    </span>
                  </div>
                  <Meter value={data.content.papers.published} total={data.content.papers.total} className="bg-amber-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Books published</span>
                    <span className="font-semibold">
                      {data.content.books.published} / {data.content.books.total}
                    </span>
                  </div>
                  <Meter value={data.content.books.published} total={data.content.books.total} className="bg-sky-500" />
                </div>
                <div className="flex justify-between border-t border-border pt-3">
                  <span>QOTD dates scheduled ahead</span>
                  <span className="font-semibold">{data.content.qotd.upcoming_dates}</span>
                </div>
                <div className="flex justify-between">
                  <span>Exam routines</span>
                  <span className="font-semibold">{data.content.exam_routines}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Users by type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {Object.entries(data.users.by_type)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="space-y-1">
                      <div className="flex justify-between">
                        <span>{typeLabels[type] ?? type}</span>
                        <span className="font-semibold">{count.toLocaleString()}</span>
                      </div>
                      <Meter value={count} total={data.users.total} />
                    </div>
                  ))}
                <div className="flex justify-between border-t border-border pt-3">
                  <span>Pending verification</span>
                  <span className="font-semibold">{data.users.pending_verify}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Newest users</CardTitle>
                <Link href="/admin/users" className="text-xs font-semibold text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.recent_users.length === 0 ? (
                  <p className="text-sm text-muted">No users yet.</p>
                ) : (
                  data.recent_users.map((u) => (
                    <Link
                      key={u.id}
                      href={`/admin/users/${u.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{u.name}</p>
                        <p className="truncate text-xs text-muted">{u.phone || u.email}</p>
                      </div>
                      <Badge variant={u.status === 'active' ? 'success' : u.status === 'pending_verify' ? 'warning' : 'secondary'}>
                        {u.status.replace('_', ' ')}
                      </Badge>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {data.recent_submitted_questions.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Latest submitted questions</CardTitle>
                <Link href="/user-questions/admin" className="text-xs font-semibold text-primary hover:underline">
                  Review all
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.recent_submitted_questions.map((q) => (
                  <Link
                    key={q.id}
                    href="/user-questions/admin"
                    className="block rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary/30"
                  >
                    <p className="line-clamp-2">{q.body}</p>
                    <p className="mt-1 text-xs text-muted">{formatDateTimeDdMmYyyy(q.created_at)}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Manage</h2>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Find an admin tool…"
              className="pl-9"
            />
          </div>
        </div>
        {filteredGroups.length === 0 && <p className="text-sm text-muted">No tools match “{filter}”.</p>}
        {filteredGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{group.title}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-primary-muted group-hover:text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold">{link.label}</span>
                      <p className="mt-0.5 text-xs text-muted">{link.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
