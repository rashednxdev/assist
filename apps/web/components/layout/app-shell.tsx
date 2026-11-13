'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { logoutRequest, fetchMe, getAccessToken, clearAccessToken, SET_PASSWORD_PATH, type MeUser } from '@/lib/auth';
import { adminNavGroupsFor, isPlatformAdmin } from '@/lib/capabilities';
import {
  LEARNING_HOME,
  SALARY_HOME,
  canHostLive,
  hasLearningWebAccess,
  isPublicSignedInPath,
  isSalaryOnlyUser,
} from '@/lib/learning-access';
import { Skeleton } from '@/components/ui/skeleton';
import {
  hostLiveNavItem,
  learningPrimaryNav,
  salaryBillAccessNavItem,
  salaryPrimaryNav,
  type NavItem,
} from './nav-config';

function matchesPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function TopLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap">{item.label}</span>
    </Link>
  );
}

function primaryNavFor(me: MeUser | null): NavItem[] {
  if (!me) return salaryPrimaryNav;
  const base = !hasLearningWebAccess(me)
    ? salaryPrimaryNav
    : canHostLive(me)
      ? [...learningPrimaryNav, hostLiveNavItem]
      : [...learningPrimaryNav];
  if (!isPlatformAdmin(me) || base.some((item) => item.href === salaryBillAccessNavItem.href)) return base;
  const salaryAt = base.findIndex((item) => item.href === '/salary');
  const at = salaryAt >= 0 ? salaryAt + 1 : base.length;
  return [...base.slice(0, at), salaryBillAccessNavItem, ...base.slice(at)];
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const tAuth = useTranslations('auth');
  const tApp = useTranslations('app');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [me, setMe] = useState<MeUser | null>(null);

  useEffect(() => {
    setMobileOpen(false);
    setAdminOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!getAccessToken()) return;
    fetchMe()
      .then((res) => {
        if (res.data.must_change_password) {
          router.replace(SET_PASSWORD_PATH);
          return;
        }
        setMe({
          ...res.data,
          module_access: res.data.module_access ?? [],
        });
      })
      .catch(() => {
        clearAccessToken();
        router.replace('/login');
      });
  }, [router]);

  const learningAccess = hasLearningWebAccess(me);
  const blocked = isSalaryOnlyUser(me) && !isPublicSignedInPath(pathname);

  useEffect(() => {
    if (blocked) router.replace(SALARY_HOME);
  }, [blocked, router]);

  const primaryLinks = useMemo(() => primaryNavFor(me), [me]);

  const adminNav = useMemo(() => {
    if (!me) return [];
    const grants = me.module_access ?? [];
    const staff =
      isPlatformAdmin(me) ||
      grants.some(
        (g) =>
          g.can_create ||
          g.can_update ||
          g.can_publish ||
          g.can_grade ||
          (g.module_code === 'USER' && g.can_read && me.user_type !== 'applicant'),
      );
    if (!staff) return [];
    return adminNavGroupsFor(me);
  }, [me]);

  const showAdmin = adminNav.length > 0;

  async function handleLogout() {
    await logoutRequest();
    router.replace('/login');
  }

  const activePrimary =
    primaryLinks
      .map((i) => i.href)
      .filter((href) => matchesPath(pathname, href))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href={learningAccess ? LEARNING_HOME : SALARY_HOME} className="min-w-0 shrink-0">
            <p className="truncate text-sm font-bold text-foreground sm:text-base">{tApp('name')}</p>
          </Link>

          <nav className="ml-2 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex">
            {primaryLinks.map((item) => (
              <TopLink key={item.href} item={item} active={item.href === activePrimary} />
            ))}
            {showAdmin ? (
              <div className="relative">
                <button
                  type="button"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold',
                    adminOpen || pathname.startsWith('/admin') || pathname.includes('/admin')
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100',
                  )}
                  onClick={() => setAdminOpen((v) => !v)}
                >
                  Admin
                  <ChevronDown className="h-4 w-4" />
                </button>
                {adminOpen ? (
                  <div className="absolute left-0 top-full z-50 mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-border bg-surface p-3 shadow-xl">
                    {adminNav.map((group) => (
                      <div key={group.title} className="mb-3 last:mb-0">
                        <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          {group.title}
                        </p>
                        <div className="space-y-0.5">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            const active = matchesPath(pathname, item.href);
                            return (
                              <Link
                                key={`${group.title}-${item.href}`}
                                href={item.href}
                                onClick={() => setAdminOpen(false)}
                                className={cn(
                                  'flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium',
                                  active ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-slate-50',
                                )}
                              >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </nav>

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-2 text-muted hover:text-foreground"
            onClick={() => void handleLogout()}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{tAuth('logout')}</span>
          </Button>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <aside className="relative flex h-full w-[min(100%,300px)] flex-col bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <p className="font-bold">{tApp('name')}</p>
              <button
                type="button"
                className="rounded-lg p-2 text-muted hover:bg-slate-100"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {primaryLinks.map((item) => (
                <TopLink
                  key={item.href}
                  item={item}
                  active={item.href === activePrimary}
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
              {showAdmin
                ? adminNav.map((group) => (
                    <div key={group.title} className="pt-4">
                      <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
                        {group.title}
                      </p>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={`${group.title}-${item.href}`}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  ))
                : null}
            </nav>
          </aside>
        </div>
      ) : null}

      <main>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:p-0">
          {blocked ? <Skeleton className="h-32 w-full rounded-2xl" /> : children}
        </div>
      </main>
    </div>
  );
}
