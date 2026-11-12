'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchMe, getAccessToken, clearAccessToken, type MeUser } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/capabilities';
import { hasLearningWebAccess, LEARNING_HOME, SALARY_HOME } from '@/lib/learning-access';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { Skeleton } from '@/components/ui/skeleton';

/** Platform admins keep the ops dashboard; everyone else lands on Learning or Salary. */
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    fetchMe()
      .then((res) => {
        const me = { ...res.data, module_access: res.data.module_access ?? [] };
        if (!isPlatformAdmin(me)) {
          router.replace(hasLearningWebAccess(me) ? LEARNING_HOME : SALARY_HOME);
          return;
        }
        setUser(me);
        setLoading(false);
      })
      .catch(() => {
        clearAccessToken();
        router.replace('/login');
      });
  }, [router]);

  if (loading || !user) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }

  return (
    <AdminDashboard
      user={user}
      onLearnerView={() => router.push(LEARNING_HOME)}
    />
  );
}
