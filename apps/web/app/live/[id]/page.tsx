'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Every class is a Zoom class. Recordings and the join room live on the Zoom page. */
export default function LiveStreamWatchRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    if (id) router.replace(`/live/zoom/${id}`);
  }, [id, router]);
  return <p className="p-6 text-sm text-muted">Opening class…</p>;
}
