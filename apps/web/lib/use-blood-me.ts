'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BloodMe } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';

let cached: BloodMe | null = null;
let inflight: Promise<BloodMe> | null = null;
const listeners = new Set<(m: BloodMe) => void>();

function fetchBloodMe(force = false): Promise<BloodMe> {
  if (cached && !force) return Promise.resolve(cached);
  if (!inflight || force) {
    inflight = apiFetch<{ data: BloodMe }>('/blood-bank/me')
      .then((r) => {
        publishBloodMe(r.data);
        return r.data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function publishBloodMe(m: BloodMe): void {
  cached = m;
  listeners.forEach((fn) => fn(m));
}

/** The signed-in user's blood group and donor status, shared across the page. */
export function useBloodMe() {
  const [me, setMe] = useState<BloodMe | null>(cached);
  const [error, setError] = useState('');

  useEffect(() => {
    listeners.add(setMe);
    fetchBloodMe().catch((e) => setError(e instanceof Error ? e.message : 'Could not load the blood bank'));
    return () => {
      listeners.delete(setMe);
    };
  }, []);

  const refresh = useCallback(() => fetchBloodMe(true), []);
  return { me, error, refresh };
}
