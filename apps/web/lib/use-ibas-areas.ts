'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export interface IbasAreaOption {
  code: string;
  name_en: string;
  name_bn: string;
  color: string;
  is_active: boolean;
}

let cache: Promise<IbasAreaOption[]> | null = null;

function loadAreas(): Promise<IbasAreaOption[]> {
  cache ??= apiFetch<{ data: IbasAreaOption[] }>('/ibas/area-options')
    .then((r) => r.data)
    .catch((err) => {
      cache = null;
      throw err;
    });
  return cache;
}

/** Call after admins add or edit areas so every picker refetches. */
export function invalidateIbasAreas() {
  cache = null;
}

/** "IBAS_PRE_AUDIT" → "Pre Audit", shown until the area list arrives or for unknown codes. */
function prettyCode(code: string): string {
  return code
    .replace(/^IBAS_/, '')
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * iBAS++ Workspace areas from the API (admin-managed). Admins also receive hidden areas, flagged
 * with `is_active: false`.
 */
export function useIbasAreas() {
  const [areas, setAreas] = useState<IbasAreaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (fresh = false) => {
    if (fresh) invalidateIbasAreas();
    setLoading(true);
    try {
      setAreas(await loadAreas());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load iBAS++ areas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const areaName = useCallback(
    (code: string) => areas.find((a) => a.code === code)?.name_en ?? prettyCode(code),
    [areas],
  );

  return { areas, activeAreas: areas.filter((a) => a.is_active), areaName, loading, error, reload: () => load(true) };
}
