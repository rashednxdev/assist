'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Lock, MapPin, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/app-shell';
import SettingsGuardLayout from './settings-guard';

const tabs = [
  { href: '/settings/profile', label: 'Profile', icon: User },
  { href: '/settings/password', label: 'Password', icon: Lock },
  { href: '/settings/address', label: 'Address', icon: MapPin },
  { href: '/settings/subscription', label: 'Subscription', icon: CreditCard },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SettingsGuardLayout>
      <AppShell>
        <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Account settings</h1>
          <p className="text-muted">Manage your profile, security, address, and subscription plan.</p>
        </div>
        <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary-muted text-primary-dark'
                    : 'text-muted hover:bg-slate-100 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
        {children}
        </div>
      </AppShell>
    </SettingsGuardLayout>
  );
}
