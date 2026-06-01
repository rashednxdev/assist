'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { fetchMe, getAccessToken, type MeUser } from '@/lib/auth';
import { isPlatformAdmin } from '@/components/auth/auth-brand-panel';
import { AppShell } from '@/components/layout/app-shell';
import { UserDashboard } from '@/components/dashboard/user-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { Skeleton } from '@/components/ui/skeleton';

interface Summary {
  profile_complete_percent: number;
  address_count: number;
  subscription: { plan: { name: string } | null; expires_at: string } | null;
  workflow?: {
    inbox_count: number;
    published_task_count: number;
    can_start_task_count: number;
    my_runs_in_progress: number;
    workflow_role_codes: string[];
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    Promise.all([fetchMe(), apiFetch<{ data: Summary }>('/account/summary').catch(() => null)])
      .then(([meRes, sumRes]) => {
        const me = meRes.data;
        if (me.status === 'pending_verify' || !me.is_verified) {
          router.replace('/register/verify');
          return;
        }
        setUser(me);
        if (sumRes) setSummary(sumRes.data);
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!user) return null;

  return (
    <AppShell>
      {isPlatformAdmin(user) ? (
        <AdminDashboard user={user} />
      ) : (
        <UserDashboard user={user} summary={summary} />
      )}
    </AppShell>
  );
}
