'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SiteInactiveNotice } from '@/components/shared/site-inactive-notice';

export default function RegisterVerifyRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/unavailable');
  }, [router]);
  return <SiteInactiveNotice />;
}
