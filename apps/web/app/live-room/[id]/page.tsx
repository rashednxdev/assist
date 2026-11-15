'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function LiveRoomRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    if (id) router.replace(`/live/zoom-room/${id}`);
  }, [id, router]);
  return <p className="p-6 text-sm text-slate-300">Opening the class room…</p>;
}
