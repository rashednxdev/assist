'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WorkIdentity } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';

let cached: WorkIdentity | null = null;
let inflight: Promise<WorkIdentity> | null = null;
const listeners = new Set<(w: WorkIdentity) => void>();

function fetchIdentity(force = false): Promise<WorkIdentity> {
  if (cached && !force) return Promise.resolve(cached);
  if (!inflight || force) {
    inflight = apiFetch<{ data: WorkIdentity }>('/org/me')
      .then((r) => {
        publishWorkIdentity(r.data);
        return r.data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function publishWorkIdentity(w: WorkIdentity): void {
  cached = w;
  listeners.forEach((fn) => fn(w));
}

export function isWorkIdentityComplete(w: WorkIdentity | null | undefined): boolean {
  return !!w?.office && !!w.designation;
}

/** The signed-in user's office and designation, shared across components on the page. */
export function useWorkIdentity() {
  const [identity, setIdentity] = useState<WorkIdentity | null>(cached);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    listeners.add(setIdentity);
    fetchIdentity()
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => {
      listeners.delete(setIdentity);
    };
  }, []);

  const refresh = useCallback(() => fetchIdentity(true), []);

  return { identity, loading, complete: isWorkIdentityComplete(identity), refresh };
}
