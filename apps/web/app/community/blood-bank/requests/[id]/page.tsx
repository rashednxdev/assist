'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useBloodMe } from '@/lib/use-blood-me';
import { Alert } from '@/components/ui/alert';
import { RequestDetail } from '@/components/blood-bank/request-detail';
import { BloodBankHome } from '@/components/blood-bank/blood-bank-home';

export default function BloodRequestPage() {
  const { id } = useParams<{ id: string }>();
  const { me, error } = useBloodMe();
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!me) return <Skeleton className="h-64 rounded-3xl" />;
  if (!me.ready) {
    return (
      <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
        <BloodBankHome />
      </Suspense>
    );
  }
  return <RequestDetail id={id} />;
}
