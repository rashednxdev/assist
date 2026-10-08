'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Calculator, ClipboardCheck, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';

const tabs = [
  { href: '/admin/salary-access', label: 'Request approval', icon: ClipboardCheck },
  { href: '/admin/salary-access/settings', label: 'Settings', icon: Settings },
  { href: '/admin/salary-access/offices', label: 'User offices', icon: Building2 },
];

export default function SalaryAccessLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Salary arrears bill access"
        description="The salary page is for signed-in users only. Users request bills in bulks; each T.R. Form 13 / 15 download uses one approved bill."
        action={
          <Button asChild className="gap-1.5">
            <Link href="/salary">
              <Calculator className="h-4 w-4" />
              Open salary page
            </Link>
          </Button>
        }
      />
      <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-primary-muted text-primary-dark' : 'text-muted hover:bg-slate-100 hover:text-foreground',
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
  );
}
