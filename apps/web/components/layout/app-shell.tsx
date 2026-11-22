'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, ChevronLeft, HelpCircle, LogOut, Menu, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/brand/brand-mark';
import { logoutRequest, fetchMe, getAccessToken, clearAccessToken, SET_PASSWORD_PATH, type MeUser } from '@/lib/auth';
import { adminNavGroupsFor, isPlatformAdmin, learningModuleAccess } from '@/lib/capabilities';
import { LEARNING_HOME, canHostLive, isLearningModulePath } from '@/lib/learning-access';
import {
  hostLiveNavItem,
  learningPrimaryNav,
  salaryBillAccessNavItem,
  type NavItem,
} from './nav-config';
import { ProfileMenu } from './profile-menu';

const MODULE_ROUTES: { prefix: string; code: string }[] = [
  { prefix: '/books', code: 'BOOKS' },
  { prefix: '/questions', code: 'QUESTIONS' },
  { prefix: '/exams', code: 'EXAM' },
  { prefix: '/papers', code: 'PAPER' },
  { prefix: '/qotd', code: 'QOTD' },
  { prefix: '/exam-week', code: 'EXAM_WEEK' },
  { prefix: '/exam-routine', code: 'EXAM_ROUTINE' },
  { prefix: '/marathon', code: 'QUESTIONS' },
  { prefix: '/user-questions', code: 'USER_QUESTIONS' },
  { prefix: '/live-room', code: 'LIVE_STREAM' },
];

function matchesPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SideLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>, item: NavItem) => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={(event) => onNavigate?.(event, item)}
      className={cn(
        'flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-[#1566b8] font-semibold text-white shadow-sm'
          : 'text-white/80 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 leading-snug">{item.label}</span>
    </Link>
  );
}

/** Every signed-in user gets the same primary menu; module access is enforced per page / API. */
function primaryNavFor(me: MeUser | null): NavItem[] {
  if (!me) return [...learningPrimaryNav];
  const base = canHostLive(me) ? [...learningPrimaryNav, hostLiveNavItem] : [...learningPrimaryNav];
  if (!isPlatformAdmin(me) || base.some((item) => item.href === salaryBillAccessNavItem.href)) return base;
  const settingsAt = base.findIndex((item) => item.href === '/settings/profile');
  const at = settingsAt >= 0 ? settingsAt : base.length;
  return [...base.slice(0, at), salaryBillAccessNavItem, ...base.slice(at)];
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [me, setMe] = useState<MeUser | null>(null);
  const [lockedLabel, setLockedLabel] = useState('');
  const [topSearch, setTopSearch] = useState('');

  useEffect(() => {
    setMobileOpen(false);
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

  useEffect(() => {
    if (!me) return;
    const hit = MODULE_ROUTES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
    if (!hit) return;
    if (learningModuleAccess(me, hit.code).state !== 'open') router.replace(LEARNING_HOME);
  }, [me, pathname, router]);

  const primaryLinks = useMemo(() => primaryNavFor(me), [me]);

  function handleNav(event: React.MouseEvent<HTMLAnchorElement>, item: NavItem) {
    if (item.moduleCode && me && learningModuleAccess(me, item.moduleCode).state !== 'open') {
      event.preventDefault();
      setLockedLabel(item.label);
      setMobileOpen(false);
      return;
    }
    setLockedLabel('');
    setMobileOpen(false);
  }

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

  function handleTopSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = topSearch.trim();
    if (!q) {
      router.push('/exam-prep');
      return;
    }
    router.push(`/exam-prep?q=${encodeURIComponent(q)}`);
  }

  const activeHref =
    [...primaryLinks, ...adminNav.flatMap((group) => group.items)]
      .map((item) => item.href)
      .filter((href) => matchesPath(pathname, href))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  const homeHref = LEARNING_HOME;
  const hasPaidAccess = Boolean(me && (me.has_paid || isPlatformAdmin(me)));

  function renderNav(items: NavItem[]) {
    return items.map((item) => (
      <SideLink key={item.href} item={item} active={item.href === activeHref} onNavigate={handleNav} />
    ));
  }

  function ShellMenu() {
    return (
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {renderNav(primaryLinks)}
        {showAdmin
          ? adminNav.map((group) => (
              <div key={group.title} className="pt-4">
                <p className="mb-1 px-3.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">{group.title}</p>
                {renderNav(group.items)}
              </div>
            ))
          : null}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f9fd] lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#0a2f5b] print:hidden lg:flex">
        <Link href={homeHref} className="border-b border-white/10 px-5 py-4">
          <BrandMark tone="white" />
        </Link>
        <ShellMenu />
        <div className="space-y-1 border-t border-white/10 p-3">
          <Link
            href="/user-questions"
            className="flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            <span>Help</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2.5 rounded-xl px-3.5 text-white/75 hover:bg-white/10 hover:text-white"
            onClick={() => void handleLogout()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* PDF Unified White Top Bar (Desktop + Mobile) */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-[#d7e4ee] bg-white px-4 sm:px-6 lg:px-8 print:hidden">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d7e4ee] text-[#0a2f5b]"
              onClick={() => setMobileOpen(true)}
              aria-label="মেনু খুলুন"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href={homeHref} className="shrink-0">
              <BrandMark />
            </Link>
          </div>

          <form onSubmit={handleTopSearch} className="hidden max-w-xl flex-1 sm:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                placeholder="বিষয়, নিয়ম বা প্রশ্ন খুঁজুন..."
                className="h-10 w-full rounded-full border border-[#d7e4ee] bg-[#f4f9fd] pl-10 pr-4 text-sm text-[#0a2f5b] placeholder:text-slate-400 outline-none transition focus:border-[#1566b8] focus:bg-white focus:ring-2 focus:ring-[#1566b8]/15"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2.5 sm:gap-3">
            <Link
              href={hasPaidAccess ? '/settings/payments' : '/packages'}
              className={cn(
                'hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:inline-flex',
                hasPaidAccess
                  ? 'bg-[#e6f6f8] text-[#0e7490] hover:bg-[#d2f0f4]'
                  : 'bg-[#d7e8f8] text-[#1566b8] hover:bg-[#c3ddf6]',
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {hasPaidAccess ? 'Enrolled' : 'Get a course'}
            </Link>

            <ProfileMenu me={me} onLogout={() => void handleLogout()} />
          </div>
        </header>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/50"
              onClick={() => setMobileOpen(false)}
              aria-label="মেনু বন্ধ করুন"
            />
            <aside className="relative flex h-full w-[min(100%,300px)] flex-col bg-[#0a2f5b] text-white">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <BrandMark tone="white" />
                <button type="button" className="rounded-lg p-2 text-white/80 hover:bg-white/10" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ShellMenu />
              <div className="border-t border-white/10 p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-white/80 hover:bg-white/10 hover:text-white"
                  onClick={() => void handleLogout()}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </aside>
          </div>
        ) : null}

        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:p-0">
            {lockedLabel ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f3d7a1] bg-[#fff8ee] px-4 py-3 text-sm text-[#0a2f5b] print:hidden">
                <p>
                  <span className="font-semibold">{lockedLabel}</span> খুলতে প্যাকেজে এনরোল করতে হবে।
                </p>
                <Link href="/packages" className="font-semibold text-[#1566b8] hover:underline" onClick={() => setLockedLabel('')}>
                  কোর্স দেখুন →
                </Link>
              </div>
            ) : null}
            {me && isLearningModulePath(pathname) && pathname !== '/exam-prep' && pathname !== '/live' ? (
              <button
                type="button"
                className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#1566b8] hover:text-[#0f5294] print:hidden"
                onClick={() => {
                  if (window.history.length > 1) router.back();
                  else router.push(LEARNING_HOME);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                পেছনে
              </button>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
