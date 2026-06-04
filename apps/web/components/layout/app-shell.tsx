'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Menu, X, LogOut, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { logoutRequest, fetchMe, getAccessToken, type MeUser } from '@/lib/auth';
import { buildVisibleNav } from '@/lib/capabilities';
import { navGroups, type NavItem } from './nav-config';

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = pathname === item.href || pathname.startsWith(item.href + '/');
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

function SidebarContent({
  pathname,
  visibleNav,
  onNavigate,
  onLogout,
  logoutLabel,
  appName,
  tagline,
}: {
  pathname: string;
  visibleNav: ReturnType<typeof buildVisibleNav>;
  onNavigate?: () => void;
  onLogout: () => void;
  logoutLabel: string;
  appName: string;
  tagline: string;
}) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-active/20 text-sidebar-active">
          <Shield className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-sidebar-foreground">{appName}</div>
          <div className="truncate text-xs text-sidebar-muted">{tagline}</div>
        </div>
      </div>

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
                  pathname={pathname}
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
        setMe({
          ...res.data,
          module_access: res.data.module_access ?? [],
        });
      })
      .catch(() => {});
  }, []);

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
    tagline: tApp('tagline'),
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur-md lg:hidden">
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar lg:flex">
        <SidebarContent {...sidebarProps} />
      </aside>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
