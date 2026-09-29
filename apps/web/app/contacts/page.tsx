'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ContactsGate } from '@/components/contacts/contact-access';
import { ContactsBrowser } from '@/components/contacts/contacts-browser';

export default function ContactsPage() {
  return (
    <ContactsGate>
      <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
        <ContactsBrowser />
      </Suspense>
    </ContactsGate>
  );
}
