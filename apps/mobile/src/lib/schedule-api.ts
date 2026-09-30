import { useEffect, useState } from 'react';
import {
  SCHEDULE_KINDS,
  scheduleKindColor,
  scheduleKindLabel,
  type RestRecreationStatus,
  type ScheduleEventInput,
  type ScheduleEventRecord,
  type ScheduleOccurrence,
  type ScheduleProfileInput,
  type ScheduleProfileRecord,
  type ScheduleSettingsRecord,
  type ScheduleTypeRecord,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api';

export interface RestRecreationData {
  profile: ScheduleProfileRecord;
  settings: ScheduleSettingsRecord;
  status: RestRecreationStatus;
}

export type ScheduleChangeMode = 'postpone' | 'cancel' | 'restore';

export async function fetchScheduleFeed(from: string, to: string): Promise<ScheduleOccurrence[]> {
  const r = await apiFetch<{ data: ScheduleOccurrence[] }>(`/schedule/feed?from=${from}&to=${to}`);
  return r.data;
}

export async function fetchScheduleEvent(id: string): Promise<ScheduleEventRecord> {
  const r = await apiFetch<{ data: ScheduleEventRecord }>(`/schedule/events/${id}`);
  return r.data;
}

export async function saveScheduleEvent(body: ScheduleEventInput, id?: string): Promise<ScheduleEventRecord> {
  const r = await apiFetch<{ data: ScheduleEventRecord }>(id ? `/schedule/events/${id}` : '/schedule/events', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(body),
  });
  return r.data;
}

export async function deleteScheduleEvent(id: string): Promise<void> {
  await apiFetch(`/schedule/events/${id}`, { method: 'DELETE' });
}

export async function changeScheduleEvent(id: string, mode: ScheduleChangeMode, body: Record<string, unknown>): Promise<ScheduleEventRecord> {
  const r = await apiFetch<{ data: ScheduleEventRecord }>(`/schedule/events/${id}/${mode}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return r.data;
}

export async function fetchRestRecreation(): Promise<RestRecreationData> {
  const r = await apiFetch<{ data: RestRecreationData }>('/schedule/rest-recreation');
  return r.data;
}

export async function saveScheduleProfile(body: ScheduleProfileInput): Promise<RestRecreationData> {
  const r = await apiFetch<{ data: RestRecreationData }>('/schedule/profile', { method: 'PUT', body: JSON.stringify(body) });
  return r.data;
}

/** Maps a feed date (which may be a postponed slot) back to the original occurrence date. */
export function originalOccurrence(ev: ScheduleEventRecord, date?: string): string | undefined {
  if (!date) return undefined;
  return ev.overrides.find((o) => o.new_date === date)?.date ?? date;
}

/* ------------------------------ schedule types ------------------------------ */

const FALLBACK_TYPES: ScheduleTypeRecord[] = SCHEDULE_KINDS.map((k, i) => ({
  id: k.code,
  code: k.code,
  label: k.label,
  color: k.color,
  default_reminders: [...k.reminders],
  allow_personal: k.allow_personal,
  sort_order: i * 10,
  is_active: true,
  is_system: k.system,
}));

let cachedTypes: ScheduleTypeRecord[] | null = null;
let inflight: Promise<ScheduleTypeRecord[]> | null = null;

function loadTypes(): Promise<ScheduleTypeRecord[]> {
  if (cachedTypes) return Promise.resolve(cachedTypes);
  if (!inflight) {
    inflight = apiFetch<{ data: ScheduleTypeRecord[] }>('/schedule/types')
      .then((r) => {
        cachedTypes = r.data.length ? r.data : FALLBACK_TYPES;
        return cachedTypes;
      })
      .catch(() => FALLBACK_TYPES)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Admin-managed schedule types (cached for the session), with built-in fallbacks. */
export function useScheduleTypes() {
  const [types, setTypes] = useState<ScheduleTypeRecord[]>(cachedTypes ?? FALLBACK_TYPES);
  useEffect(() => {
    let live = true;
    void loadTypes().then((t) => live && setTypes(t));
    return () => {
      live = false;
    };
  }, []);
  const typeLabel = (code: string) => types.find((t) => t.code === code)?.label ?? scheduleKindLabel(code);
  const typeColor = (code: string) => types.find((t) => t.code === code)?.color ?? scheduleKindColor(code);
  return { types, typeLabel, typeColor };
}

/* --------------------------------- formatting -------------------------------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatTime12(time?: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h! < 12 ? 'AM' : 'PM'}`;
}

export function formatDayLong(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return `${DAYS[wd]}, ${d} ${MONTHS[m! - 1]} ${y}`;
}

export function formatDayShort(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m! - 1]} ${y}`;
}

export function monthTitle(year: number, month: number): string {
  return `${MONTHS_LONG[month]} ${year}`;
}

export function occurrenceTimeText(o: Pick<ScheduleOccurrence, 'time' | 'end_time' | 'end_date'>): string {
  if (o.end_date) return `Until ${formatDayShort(o.end_date)}`;
  if (!o.time) return 'All day';
  return o.end_time ? `${formatTime12(o.time)} – ${formatTime12(o.end_time)}` : formatTime12(o.time);
}

export function slotText(date: string, time?: string): string {
  return time ? `${formatDayShort(date)}, ${formatTime12(time)}` : formatDayShort(date);
}

export function reminderLabel(minutes: number): string {
  if (minutes === 0) return 'At start';
  if (minutes < 60) return `${minutes} min before`;
  if (minutes < 1440) return `${minutes / 60} h before`;
  const d = minutes / 1440;
  return d === 7 ? '1 week before' : `${d} day${d > 1 ? 's' : ''} before`;
}

export function formatAt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Dhaka',
  });
}

/** 42-cell (6-week) grid starting on Sunday for the given month (0-based). */
export function monthRange(year: number, month: number): { from: string; to: string; days: string[] } {
  const first = Date.UTC(year, month, 1);
  const start = first - new Date(first).getUTCDay() * 86_400_000;
  const days = Array.from({ length: 42 }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10));
  return { from: days[0]!, to: days[41]!, days };
}
