'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { fetchMe, getAccessToken, clearAccessToken, type MeUser } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/capabilities';
import type { ProgressDashboardData } from '@/lib/progress';
import { AppShell } from '@/components/layout/app-shell';
import { UserDashboard } from '@/components/dashboard/user-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

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
  const [progress, setProgress] = useState<ProgressDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [learnerView, setLearnerView] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    fetchMe()
      .then(async (meRes) => {
        const me = { ...meRes.data, module_access: meRes.data.module_access ?? [] };
        if (me.status === 'pending_verify') {
          router.replace('/register/verify');
          return;
        }
        setUser(me);
        const [sumRes, progressRes] = await Promise.all([
          apiFetch<{ data: Summary }>('/account/summary').catch(() => null),
          apiFetch<{ data: ProgressDashboardData }>('/evaluation/dashboard').catch(() => null),
        ]);
        if (sumRes) setSummary(sumRes.data);
        if (progressRes) setProgress(progressRes.data);
      })
      .catch(() => {
        clearAccessToken();
        router.replace('/login');
      })
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

  const admin = isPlatformAdmin(user);

  return (
    <AppShell>
      {admin && !learnerView ? (
        <AdminDashboard user={user} onLearnerView={() => setLearnerView(true)} />
      ) : (
        <div className="space-y-4">
          {admin && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              <span>You are viewing the learner home. Admins can open every module.</span>
              <Button size="sm" variant="outline" onClick={() => setLearnerView(false)}>
                Back to admin panel
              </Button>
            </div>
          )}
          <UserDashboard user={user} summary={summary} progress={progress} />
        </div>
      )}
    </AppShell>
  );
}
