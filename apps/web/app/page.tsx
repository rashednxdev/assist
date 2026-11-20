'use client';

import { useLayoutEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/auth';
import { PublicLanding } from '@/components/marketing/public-landing';

/** Guests see the public home. A saved login still goes to Learning or Salary. */
export default function HomePage() {
  const router = useRouter();
  const [showLanding, setShowLanding] = useState(false);

  useLayoutEffect(() => {
    if (getAccessToken()) router.replace('/learning');
    else setShowLanding(true);
  }, [router]);

  if (!showLanding) return <div className="min-h-screen bg-[#f4f9fd]" />;
  return <PublicLanding />;
}
