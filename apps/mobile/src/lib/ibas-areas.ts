import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

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

/** "IBAS_PRE_AUDIT" → "Pre Audit", shown until the area list arrives or for unknown codes. */
function prettyCode(code: string): string {
  return code
    .replace(/^IBAS_/, '')
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/** iBAS++ Workspace areas (admin-managed), cached for the session. */
export function useIbasAreas() {
  const [areas, setAreas] = useState<IbasAreaOption[]>([]);

  useEffect(() => {
    let live = true;
    loadAreas()
      .then((a) => live && setAreas(a))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const areaName = useCallback((code: string) => areas.find((a) => a.code === code)?.name_en ?? prettyCode(code), [areas]);
  const areaColor = useCallback((code: string) => areas.find((a) => a.code === code)?.color ?? '#475569', [areas]);

  return { areas, activeAreas: areas.filter((a) => a.is_active), areaName, areaColor };
}
