import type { ScheduleOccurrence } from '@ibas/shared-types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
  return `${new Date(Date.UTC(year, month, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} ${year}`;
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
