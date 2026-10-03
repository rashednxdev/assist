'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Menu, X, LogOut, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { logoutRequest, fetchMe, getAccessToken, clearAccessToken, SET_PASSWORD_PATH, type MeUser } from '@/lib/auth';
import { buildVisibleNav } from '@/lib/capabilities';
import { navGroups, type NavItem } from './nav-config';

function matchesPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

function NavLink({
  item,
  activeHref,
  onNavigate,
}: {
  item: NavItem;
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  const active = item.href === activeHref;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
        active
          ? 'bg-sidebar-active/15 text-sidebar-active'
          : 'text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground',
      )}
    >
      <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-sidebar-active')} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SidebarSearch({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form
      className="px-3 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
        setQ('');
        onNavigate?.();
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search rules, circulars…"
          aria-label="Search"
          className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-sidebar-foreground placeholder:text-sidebar-muted focus:border-sidebar-active/60 focus:outline-none"
        />
      </div>
    </form>
  );
}

function SidebarContent({
  pathname,
  visibleNav,
  onNavigate,
  onLogout,
  logoutLabel,
  appName,
}: {
  pathname: string;
  visibleNav: ReturnType<typeof buildVisibleNav>;
  onNavigate?: () => void;
  onLogout: () => void;
  logoutLabel: string;
  appName: string;
}) {
  const activeHref =
    visibleNav
      .flatMap((g) => g.items.map((i) => i.href))
      .filter((href) => matchesPath(pathname, href))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  return (
    <>
      <div className="border-b border-white/10 px-4 py-5">
        <div className="truncate text-base font-bold text-sidebar-foreground">{appName}</div>
      </div>

      <SidebarSearch onNavigate={onNavigate} />

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {visibleNav.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={`${group.title}-${item.href}-${item.label}`}
                  item={item}
                  activeHref={activeHref}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
          {logoutLabel}
        </Button>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const tAuth = useTranslations('auth');
  const tApp = useTranslations('app');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [me, setMe] = useState<MeUser | null>(null);

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

  const visibleNav =
    me !== null ? buildVisibleNav(me, me.module_access, navGroups) : [{ title: 'Overview', items: navGroups[0]!.items }];

  async function handleLogout() {
    await logoutRequest();
    router.replace('/login');
  }

  const sidebarProps = {
    pathname,
    visibleNav,
    onLogout: handleLogout,
    logoutLabel: tAuth('logout'),
    appName: tApp('name'),
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur-md lg:hidden print:hidden">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{tApp('name')}</p>
        </div>
        <Link
          href="/search"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </Link>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <aside className="relative flex h-full w-[min(100%,280px)] flex-col bg-sidebar shadow-xl">
            <button
              type="button"
              className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-muted hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent {...sidebarProps} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar lg:flex print:hidden">
        <SidebarContent {...sidebarProps} />
      </aside>

      <main className="lg:pl-64 print:pl-0">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:p-0">{children}</div>
      </main>
    </div>
  );
}
