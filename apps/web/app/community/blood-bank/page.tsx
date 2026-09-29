'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { BloodBankHome } from '@/components/blood-bank/blood-bank-home';

export default function BloodBankPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
      <BloodBankHome />
    </Suspense>
  );
}
