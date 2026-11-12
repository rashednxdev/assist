'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2, Lock, PauseCircle, type LucideIcon } from 'lucide-react';
import { fetchMe, type MeUser } from '@/lib/auth';
import {
  hasModuleCreate,
  isPlatformAdmin,
  learningModuleAccess,
  type LearningAccess,
} from '@/lib/capabilities';
import { canHostLive, hasLearningWebAccess, SALARY_HOME } from '@/lib/learning-access';
import {
  HOST_LIVE_LINK,
  LEARNING_MODULE_TILES,
  MARATHON_LINK,
  QUESTION_UPDATE_TILE,
  SUBMIT_QUESTION_LINK,
  type LearningModuleTile,
} from '@/lib/learning-modules';
import { userManageNavItem, moduleAccessNavItem } from '@/components/layout/nav-config';
import { userDisplayName } from '@/lib/display-text';
import { cn } from '@/lib/utils';
import { ExamRoutineCountdown } from '@/components/dashboard/exam-routine-countdown';
import {
  AccessRequiredDialog,
  type AccessRequiredVariant,
  type PackageTab,
} from '@/components/dashboard/access-required-dialog';
import { Skeleton } from '@/components/ui/skeleton';

type ExtraLink = typeof MARATHON_LINK | typeof SUBMIT_QUESTION_LINK | typeof HOST_LIVE_LINK;

export default function LearningHubPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [accessDialog, setAccessDialog] = useState<{
    variant: AccessRequiredVariant;
    moduleTitle: string;
    packageTab: PackageTab | null;
  } | null>(null);

  useEffect(() => {
    fetchMe()
      .then((res) => {
        const user = { ...res.data, module_access: res.data.module_access ?? [] };
        if (!hasLearningWebAccess(user)) {
          router.replace(SALARY_HOME);
          return;
        }
        setMe(user);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  const tiles = useMemo((): LearningModuleTile[] => {
    if (!me) return LEARNING_MODULE_TILES;
    if (learningModuleAccess(me, 'QUESTION_EDIT').state === 'open') {
      return [...LEARNING_MODULE_TILES, QUESTION_UPDATE_TILE];
    }
    return LEARNING_MODULE_TILES;
  }, [me]);

  const extras = useMemo((): ExtraLink[] => {
    if (!me) return [MARATHON_LINK];
    const links: ExtraLink[] = [MARATHON_LINK];
    if (learningModuleAccess(me, 'USER_QUESTIONS').state === 'open') links.push(SUBMIT_QUESTION_LINK);
    if (canHostLive(me)) links.push(HOST_LIVE_LINK);
    return links;
  }, [me]);

  function openTile(id: string, code: string, title: string, href: string) {
    if (!me) return;
    setCheckingId(id);
    const access = learningModuleAccess(me, code);
    setCheckingId(null);
    if (access.state === 'open') {
      router.push(href);
      return;
    }
    setAccessDialog({
      variant: access.state === 'stopped' ? 'stopped' : access.state === 'unpaid' ? 'unpaid' : 'denied',
      moduleTitle: title,
      packageTab: access.state === 'unpaid' ? 'exam_prep' : null,
    });
  }

  if (!me) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const name = userDisplayName(me);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-primary">Exam Preparation</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {name ? `Welcome, ${name}` : 'Learning'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Same Learning tools as the mobile app — open a module below. Salary On 2026 stays in the top bar for everyone.
        </p>
      </div>

      <ExamRoutineCountdown />

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">Learning modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((m) => {
            const access = learningModuleAccess(me, m.code);
            return (
              <ModuleTile
                key={m.id}
                title={m.title}
                subtitle={m.subtitle}
                color={m.color}
                icon={m.icon}
                access={access}
                checking={checkingId === m.id}
                onOpen={() => openTile(m.id, m.code, m.title, m.href)}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">More</h2>
        {extras.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if (m.id === 'hosting') {
                  router.push(m.href);
                  return;
                }
                openTile(m.id, m.code, m.title, m.href);
              }}
              className="flex w-full items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: m.color }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{m.title}</p>
                <p className="text-sm text-muted">{m.subtitle}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted" />
            </button>
          );
        })}
      </section>

      {isPlatformAdmin(me) ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Administration</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[userManageNavItem, moduleAccessNavItem].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{item.label}</p>
                    <p className="text-sm text-muted">
                      {item.href === '/admin/users'
                        ? 'Accounts, roles, and per-user module grants'
                        : 'Stop or resume modules for everyone'}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted" />
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {hasModuleCreate(me.module_access ?? [], 'BOOKS') ||
      hasModuleCreate(me.module_access ?? [], 'QUESTIONS') ||
      hasModuleCreate(me.module_access ?? [], 'LIVE_STREAM') ? (
        <p className="text-sm text-muted">
          Content staff: use the <span className="font-semibold text-foreground">Admin</span> menu in the top bar to
          manage books, questions, exams, papers, and live hosts.
        </p>
      ) : null}

      {accessDialog ? (
        <AccessRequiredDialog
          variant={accessDialog.variant}
          moduleTitle={accessDialog.moduleTitle}
          packageTab={accessDialog.packageTab}
          onClose={() => setAccessDialog(null)}
        />
      ) : null}
    </div>
  );
}

function ModuleTile({
  title,
  subtitle,
  color,
  icon: Icon,
  access,
  checking,
  onOpen,
}: {
  title: string;
  subtitle: string;
  color: string;
  icon: LucideIcon;
  access: LearningAccess;
  checking: boolean;
  onOpen: () => void;
}) {
  const enabled = access.state === 'open';
  const lockLabel =
    access.state === 'stopped'
      ? 'Paused'
      : access.state === 'unpaid'
        ? 'Buy package'
        : access.state === 'denied'
          ? 'Locked'
          : null;
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
        style={{ backgroundColor: color }}
      >
        {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </div>
      <span className={cn('mt-3 font-semibold leading-tight', !enabled && 'text-slate-500')}>{title}</span>
      <span className="mt-1 text-xs text-muted">{subtitle}</span>
      {lockLabel ? (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {access.state === 'stopped' ? <PauseCircle className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {lockLabel}
        </span>
      ) : null}
    </button>
  );
}
