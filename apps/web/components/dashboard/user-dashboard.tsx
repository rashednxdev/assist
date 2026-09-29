'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowRight,
  Bell,
  BarChart3,
  Briefcase,
  CalendarClock,
  CalendarDays,
  Calculator,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  HelpCircle,
  Inbox,
  Library,
  Loader2,
  Lock,
  MessageSquarePlus,
  MessagesSquare,
  BookUser,
  PauseCircle,
  PlayCircle,
  Radio,
  Route,
  Settings,
  Sparkles,
  Timer,
  Trophy,
  Video,
} from 'lucide-react';
import { fetchMe, type MeUser } from '@/lib/auth';
import {
  hasModuleRead,
  hasOfficeModuleRead,
  isFreeLearningModule,
  isSuperAdmin,
  learningModuleAccess,
  packageTabFor,
  type LearningAccess,
} from '@/lib/capabilities';
import { userDisplayName } from '@/lib/display-text';
import { apiFetch } from '@/lib/api-client';
import type { ProgressDashboardData } from '@/lib/progress';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExamRoutineCountdown } from '@/components/dashboard/exam-routine-countdown';
import { BloodDashboardCard } from '@/components/blood-bank/blood-dashboard-card';
import {
  AccessRequiredDialog,
  type AccessRequiredVariant,
  type PackageTab,
} from '@/components/dashboard/access-required-dialog';
import type { MyAccessSummary } from '@ibas/shared-types';
import { accessDate } from '@/lib/billing-format';

function PackageAccessLines({ access }: { access: MyAccessSummary | null }) {
  if (!access) return <p className="font-semibold">—</p>;
  const lines = [
    access.exam_prep_until && `Exam Preparation · until ${accessDate(access.exam_prep_until)}`,
    access.basic_until && `Basic Module · until ${accessDate(access.basic_until)}`,
    ...access.live_packages.map((p) => `${p.package_name} · until ${accessDate(p.until)}`),
  ].filter(Boolean) as string[];
  if (lines.length === 0) return <p className="font-semibold">No active package</p>;
  return (
    <ul className="space-y-0.5">
      {lines.map((l) => (
        <li key={l} className="font-semibold">
          {l}
        </li>
      ))}
    </ul>
  );
}

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

interface HomeModule {
  id: string;
  /** Omitted for public tools that need no grant. */
  code?: string;
  title: string;
  subtitle: string;
  icon: typeof Library;
  color: string;
  href: string;
}

const MODULES: HomeModule[] = [
  { id: 'schedule', title: 'Schedule', subtitle: 'Meetings, bill dates, R&R reminders', icon: CalendarClock, color: '#0f766e', href: '/schedule' },
  { id: 'community', title: 'Community', subtitle: 'Ask, share & discuss what’s new', icon: MessagesSquare, color: '#0e7490', href: '/community' },
  { id: 'contacts', title: 'Contacts', subtitle: 'Offices, sub-offices & colleagues', icon: BookUser, color: '#0f766e', href: '/contacts' },
  { id: 'ibas', title: 'iBAS++ Workspace', subtitle: 'Procedures, rules & tools by area', icon: Briefcase, color: '#1e40af', href: '/ibas' },
  { id: 'toolkit', title: 'Checklists & Templates', subtitle: 'Pre-audit, broadsheet replies, guides', icon: ClipboardCheck, color: '#047857', href: '/toolkit' },
  { id: 'circulars', code: 'CIRCULARS', title: 'Circular Archive', subtitle: 'Govt. circulars, SROs & orders', icon: Archive, color: '#4338ca', href: '/circulars' },
  { id: 'books', code: 'BOOKS', title: 'Books & Tools', subtitle: 'Books & regulatory tools', icon: Library, color: '#0f5c8c', href: '/books' },
  { id: 'paper', code: 'PAPER', title: 'Exam Papers', subtitle: 'Session-wise model papers', icon: FileText, color: '#d97706', href: '/papers' },
  { id: 'live', code: 'LIVE_STREAM', title: 'Live class', subtitle: 'Upcoming, live & previous', icon: Video, color: '#0369a1', href: '/live/zoom' },
  { id: 'questions', code: 'QUESTIONS', title: 'Question Bank', subtitle: 'Browse & practice questions', icon: HelpCircle, color: '#7c3aed', href: '/questions' },
  { id: 'exam', code: 'EXAM', title: 'Exam Programs', subtitle: 'SAS, SRAS & exam structure', icon: GraduationCap, color: '#059669', href: '/exams' },
  { id: 'qotd', code: 'QOTD', title: 'Questions of the Day', subtitle: 'Daily subject-wise questions', icon: CalendarDays, color: '#047857', href: '/qotd' },
  { id: 'exam-week', code: 'EXAM_WEEK', title: 'Exams of the Week', subtitle: 'Featured exam papers, by week', icon: Trophy, color: '#6d28d9', href: '/exam-week' },
  { id: 'pension', code: 'PENSION', title: 'Pension Calculator', subtitle: 'Leave math & lamp grant', icon: Calculator, color: '#0e7490', href: '/pension' },
  { id: 'joining-period', code: 'PENSION', title: 'Joining Period', subtitle: 'Prep + travel math', icon: Calculator, color: '#0369a1', href: '/joining-period' },
  { id: 'exam-routine', code: 'EXAM_ROUTINE', title: 'Exam Routine', subtitle: 'Schedules, countdown & instructions', icon: Timer, color: '#7c2d12', href: '/exam-routine' },
  { id: 'salary', title: 'Salary On 2026', subtitle: 'NPS 2015 → 2026 basic pay conversion', icon: Calculator, color: '#15803d', href: '/salary' },
];

function accessFor(user: MeUser, m: HomeModule): LearningAccess {
  if (!m.code) return { state: 'open' };
  const own = learningModuleAccess(user, m.code);
  if (m.id === 'circulars' && own.state !== 'open') {
    const viaBooks = learningModuleAccess(user, 'BOOKS');
    if (viaBooks.state === 'open') return viaBooks;
  }
  return own;
}

interface HostingRow {
  id: string;
  topic: string;
  scheduled_at: string;
  status: string;
  is_previous?: boolean;
  video_platform?: 'agora' | 'zoom';
}

function openLiveRoom(sessionId: string, platform?: 'agora' | 'zoom') {
  const path = platform === 'agora' ? `/live-room/${sessionId}` : `/live/zoom-room/${sessionId}`;
  window.open(path, '_blank', 'noopener,noreferrer');
}

function ModuleTile({
  module,
  access,
  checking,
  onOpen,
}: {
  module: HomeModule;
  access: LearningAccess;
  checking: boolean;
  onOpen: () => void;
}) {
  const Icon = module.icon;
  const enabled = access.state === 'open';
  const lockLabel =
    access.state === 'stopped' ? 'Paused' : access.state === 'unpaid' ? 'Buy package' : access.state === 'denied' ? 'Locked' : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative flex flex-col items-start rounded-2xl border bg-surface p-4 text-left shadow-sm transition-all',
        enabled ? 'border-border hover:-translate-y-0.5 hover:shadow-md' : 'border-dashed border-slate-300 bg-slate-50/60',
      )}
    >
      <div
        className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-white', !enabled && 'opacity-50 grayscale')}
        style={{ backgroundColor: module.color }}
      >
        {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </div>
      <span className={cn('mt-3 font-semibold leading-tight', !enabled && 'text-slate-500')}>{module.title}</span>
      <span className="mt-1 text-xs text-muted">{module.subtitle}</span>
      {lockLabel && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {access.state === 'stopped' ? <PauseCircle className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {lockLabel}
        </span>
      )}
    </button>
  );
}

function ShortcutCard({
  href,
  icon,
  iconClass,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
    >
      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white', iconClass)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted" />
    </Link>
  );
}

export function UserDashboard({
  user: initialUser,
  summary,
  progress,
}: {
  user: MeUser;
  summary: Summary | null;
  progress: ProgressDashboardData | null;
}) {
  const router = useRouter();
  const [user, setUser] = useState<MeUser>(initialUser);
  const [hosting, setHosting] = useState<HostingRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    variant: AccessRequiredVariant;
    moduleTitle?: string;
    stoppedReason?: string;
    packageTab?: PackageTab | null;
  } | null>(null);
  const [access, setAccess] = useState<MyAccessSummary | null>(null);

  const grants = user.module_access ?? [];
  const workflow = summary?.workflow;
  const complete = summary?.profile_complete_percent ?? 0;
  const showWorkflow = isSuperAdmin(user) || hasModuleRead(grants, 'WORKFLOW') || hasOfficeModuleRead(grants);
  const canSubmitQuestion = learningModuleAccess(user, 'USER_QUESTIONS').state === 'open';
  const canMarathon = learningModuleAccess(user, 'QUESTIONS').state === 'open';

  const homeModules = useMemo(() => {
    const hasPaidModule = MODULES.some(
      (m) => m.code && !isFreeLearningModule(m.code) && accessFor(user, m).state === 'open',
    );
    if (hasPaidModule) return MODULES;
    // Until paid: pin free promo modules at the top — QOTD, then Live class.
    const pinnedIds = ['qotd', 'live'];
    const pinned = pinnedIds.map((id) => MODULES.find((m) => m.id === id)!).filter(Boolean);
    return [...pinned, ...MODULES.filter((m) => !pinnedIds.includes(m.id))];
  }, [user]);

  useEffect(() => {
    apiFetch<{ data: HostingRow[] }>('/live-streams/hosting?video_platform=zoom')
      .then((res) =>
        setHosting(res.data.filter((row) => !row.is_previous && row.status !== 'ended' && row.status !== 'cancelled')),
      )
      .catch(() => setHosting([]));
    apiFetch<{ meta: { unread_count: number } }>('/admin-notifications/mine?limit=1&unread_only=true')
      .then((res) => setUnreadCount(res.meta.unread_count ?? 0))
      .catch(() => setUnreadCount(0));
    apiFetch<{ data: MyAccessSummary }>('/billing/my-access')
      .then((res) => setAccess(res.data))
      .catch(() => setAccess(null));
  }, []);

  function showBlocked(m: HomeModule, access: LearningAccess) {
    if (access.state === 'stopped') setDialog({ variant: 'stopped', moduleTitle: m.title, stoppedReason: access.reason });
    else if (access.state === 'unpaid') {
      setDialog({ variant: 'unpaid', moduleTitle: m.title, packageTab: m.code ? packageTabFor(m.code) : null });
    }
    else setDialog({ variant: 'denied', moduleTitle: m.title });
  }

  async function openModule(m: HomeModule) {
    const access = accessFor(user, m);
    if (access.state === 'open') {
      router.push(m.href);
      return;
    }
    if (access.state !== 'denied') {
      showBlocked(m, access);
      return;
    }
    // Grants can change while the page stays open — re-check before showing "Access Required".
    setCheckingId(m.id);
    try {
      const res = await fetchMe();
      const fresh = { ...res.data, module_access: res.data.module_access ?? [] };
      setUser(fresh);
      const next = accessFor(fresh, m);
      if (next.state === 'open') router.push(m.href);
      else showBlocked(m, next);
    } catch {
      setDialog({ variant: 'network-error' });
    } finally {
      setCheckingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary-dark to-slate-900 p-6 text-white sm:p-8">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <Badge className="bg-white/20 text-white ring-0">ProAssist</Badge>
            <h1 className="text-2xl font-bold sm:text-3xl">Welcome, {userDisplayName(user)}</h1>
            <p className="text-sm text-white/80 sm:text-base">Level up your services.</p>
          </div>
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 transition-colors hover:bg-white/25"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-primary-dark bg-red-500 px-1 text-[10px] font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
        <Sparkles className="absolute -right-4 -top-4 h-32 w-32 text-white/10" />
      </div>

      <Link
        href="/progress"
        className="grid gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md sm:grid-cols-4"
      >
        <div className="flex items-center gap-3 sm:col-span-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-muted text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold">Your performance</p>
            <p className="text-xs text-muted">Open progress dashboard</p>
          </div>
        </div>
        <div>
          <p className="text-2xl font-bold">{progress?.mcq.accuracy_percent ?? 0}%</p>
          <p className="text-xs text-muted">
            MCQ accuracy · {progress?.mcq.correct ?? 0}/{progress?.mcq.submitted ?? 0}
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold">{progress?.papers.attempted ?? 0}</p>
          <p className="text-xs text-muted">Papers started · {progress?.papers.average_progress_percent ?? 0}% avg</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{progress?.exam_attempts.total_attempts ?? 0}</p>
          <p className="text-xs text-muted">
            MCQ exam attempts · {progress?.exam_attempts.papers_passed ?? 0} passed
          </p>
        </div>
      </Link>

      <ExamRoutineCountdown />

      <BloodDashboardCard />

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
                  <Button type="button" size="sm" onClick={() => openLiveRoom(item.id, item.video_platform ?? 'zoom')}>
                    Open control room
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h2 className="mb-4 text-lg font-semibold">Learning modules</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {homeModules.map((m) => (
            <ModuleTile
              key={m.id}
              module={m}
              access={accessFor(user, m)}
              checking={checkingId === m.id}
              onOpen={() => void openModule(m)}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {canMarathon && (
          <ShortcutCard
            href="/marathon"
            iconClass="bg-[#0f5c8c]"
            icon={<span className="text-xs font-extrabold tracking-wide">MR</span>}
            title="Marathon Review"
            subtitle="Short questions & answers on Books & Tools — reveal answers as you go"
          />
        )}
        {canSubmitQuestion && (
          <ShortcutCard
            href="/user-questions"
            iconClass="bg-lime-700"
            icon={<MessageSquarePlus className="h-5 w-5" />}
            title="Can't find a question?"
            subtitle="Submit it for a subject — an admin will review and answer it"
          />
        )}
      </div>

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
              <p className="mt-1 text-sm text-muted">{workflow?.published_task_count ?? 0} step-by-step workflows</p>
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
                {(workflow?.my_runs_in_progress ?? 0) > 0 && <> · {workflow!.my_runs_in_progress} in progress</>}
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
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Account</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href="/settings/profile">
              <Settings className="h-4 w-4" />
              Open settings
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted">Profile complete</p>
            <p className="text-xl font-bold">{complete}%</p>
            {complete < 100 && (
              <Link href="/settings/profile" className="text-primary hover:underline">
                Complete setup
              </Link>
            )}
          </div>
          <div>
            <p className="text-muted">Verification</p>
            <Badge variant={user.is_verified ? 'success' : 'warning'}>{user.is_verified ? 'Verified' : 'Pending'}</Badge>
          </div>
          <div>
            <p className="text-muted">Packages</p>
            <PackageAccessLines access={access} />
            <Link href="/settings/payments" className="text-primary hover:underline">
              Payments &amp; access
            </Link>
            <span className="text-muted"> · </span>
            <Link href="/packages" className="text-primary hover:underline">
              Buy
            </Link>
          </div>
        </CardContent>
      </Card>

      {dialog && (
        <AccessRequiredDialog
          variant={dialog.variant}
          moduleTitle={dialog.moduleTitle}
          stoppedReason={dialog.stoppedReason}
          unpaidMessage={user.unpaid_message}
          packageTab={dialog.packageTab}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
