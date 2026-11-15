'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RemovedAgoraPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/live');
  }, [router]);
  return <p className="p-6 text-sm text-muted">Live class uses Zoom.</p>;
}
