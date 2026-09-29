'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { ContactsGate } from '@/components/contacts/contact-access';
import { OfficeDetail } from '@/components/contacts/office-detail';

export default function ContactOfficePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ContactsGate>
      <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
        <OfficeDetail id={id} />
      </Suspense>
    </ContactsGate>
  );
}
