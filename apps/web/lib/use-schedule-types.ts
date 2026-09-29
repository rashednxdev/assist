'use client';

import { useCallback, useEffect, useState } from 'react';
import { SCHEDULE_KINDS, scheduleKindColor, scheduleKindLabel, type ScheduleTypeRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';

const FALLBACK: ScheduleTypeRecord[] = SCHEDULE_KINDS.map((k, i) => ({
  id: k.code,
  code: k.code,
  label: k.label,
  color: k.color,
  default_reminders: [...k.reminders],
  allow_personal: k.allow_personal,
  sort_order: (i + 1) * 10,
  is_active: true,
  is_system: k.system,
}));

let cache: ScheduleTypeRecord[] | null = null;
let inflight: Promise<ScheduleTypeRecord[]> | null = null;
const listeners = new Set<(t: ScheduleTypeRecord[]) => void>();

function fetchTypes(): Promise<ScheduleTypeRecord[]> {
  if (!inflight) {
    inflight = apiFetch<{ data: ScheduleTypeRecord[] }>('/schedule/types')
      .then((r) => {
        cache = r.data;
        listeners.forEach((fn) => fn(r.data));
        return r.data;
      })
      .catch(() => cache ?? FALLBACK)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Drop the cached list after admins change types so every page picks up the new names/colours. */
export function refreshScheduleTypes(): void {
  void fetchTypes();
}

/** Active schedule types (admin-managed), with label/colour lookups that fall back to built-ins. */
export function useScheduleTypes() {
  const [types, setTypes] = useState<ScheduleTypeRecord[]>(cache ?? FALLBACK);

  useEffect(() => {
    listeners.add(setTypes);
    if (!cache) void fetchTypes();
    return () => {
      listeners.delete(setTypes);
    };
  }, []);

  const typeLabel = useCallback(
    (code: string) => types.find((t) => t.code === code)?.label ?? scheduleKindLabel(code),
    [types],
  );
  const typeColor = useCallback(
    (code: string) => types.find((t) => t.code === code)?.color ?? scheduleKindColor(code),
    [types],
  );

  return { types, typeLabel, typeColor };
}
