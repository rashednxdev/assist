import { z } from 'zod';

/*
 * Schedule module. All dates are Bangladesh calendar dates (YYYY-MM-DD) and all times are
 * Bangladesh wall-clock times (HH:mm, UTC+6, no DST) so a recurring 10:00 meeting stays at 10:00
 * whatever timezone the server or browser runs in.
 */

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
const mongoId = z.string().regex(/^[a-f\d]{24}$/i);
const optText = (max: number) => z.string().trim().max(max).optional();

/**
 * Built-in schedule types. Seeded into the admin-managed `schedule_types` collection on startup;
 * `system` types cannot be deleted because the app relies on their codes.
 */
export const SCHEDULE_KINDS = [
  { code: 'meeting', label: 'Meeting', color: '#1d4ed8', reminders: [1440, 60], allow_personal: true, system: false },
  { code: 'bill_submission', label: 'Bill submission', color: '#047857', reminders: [4320, 1440, 0], allow_personal: true, system: true },
  { code: 'deadline', label: 'Deadline / return', color: '#b91c1c', reminders: [10080, 1440, 0], allow_personal: true, system: false },
  { code: 'training', label: 'Training / workshop', color: '#7c3aed', reminders: [10080, 1440], allow_personal: true, system: false },
  { code: 'holiday', label: 'Holiday / closure', color: '#c2410c', reminders: [1440], allow_personal: false, system: false },
  { code: 'event', label: 'Official event', color: '#0e7490', reminders: [1440], allow_personal: true, system: false },
  { code: 'rest_recreation', label: 'Rest & recreation', color: '#0f766e', reminders: [], allow_personal: false, system: true },
  { code: 'personal', label: 'Personal', color: '#475569', reminders: [1440, 60], allow_personal: true, system: true },
  { code: 'other', label: 'Other', color: '#64748b', reminders: [1440], allow_personal: true, system: true },
] as const;

/** Type code — built-in or admin-defined (lowercase letters, digits, underscore). */
export type ScheduleKind = string;

export function scheduleKindLabel(code: string): string {
  return SCHEDULE_KINDS.find((k) => k.code === code)?.label ?? code.replace(/_/g, ' ');
}

export function scheduleKindColor(code: string): string {
  return SCHEDULE_KINDS.find((k) => k.code === code)?.color ?? '#64748b';
}

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a colour like #1d4ed8');

export const scheduleTypeInputSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]{1,39}$/, 'Code: 2–40 lowercase letters, digits or _ (start with a letter)'),
  label: z.string().trim().min(1, 'Name is required').max(60),
  label_bn: z.string().trim().max(60).optional().or(z.literal('')),
  description: z.string().trim().max(300).optional().or(z.literal('')),
  color: hexColor,
  default_reminders: z.array(z.number().int().min(0).max(30 * 24 * 60)).max(6).default([]),
  allow_personal: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(9999).default(100),
  is_active: z.boolean().default(true),
});
export type ScheduleTypeInput = z.input<typeof scheduleTypeInputSchema>;

export interface ScheduleTypeRecord {
  id: string;
  code: string;
  label: string;
  label_bn?: string;
  description?: string;
  color: string;
  default_reminders: number[];
  allow_personal: boolean;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  /** Admin list only: schedules using this type. */
  usage_count?: number;
}

/** Content an admin can tag on a schedule so users can open the related procedure or tool. */
export const SCHEDULE_LINK_TYPES = ['task', 'toolkit'] as const;
export type ScheduleLinkType = (typeof SCHEDULE_LINK_TYPES)[number];

export interface ScheduleLinkRecord {
  type: ScheduleLinkType;
  id: string;
  title: string;
  /** "Process", "Checklist", "Template", "Guide" */
  subtitle: string;
  href: string;
  is_published: boolean;
}

export interface ScheduleChangeLogEntry {
  action: 'updated' | 'postponed' | 'cancelled' | 'restored';
  note?: string;
  /** Set when the change affects one occurrence of a repeating schedule. */
  occurrence_date?: string;
  from?: { date: string; time?: string };
  to?: { date: string; time?: string };
  at: string;
}

export interface ScheduleOverrideRecord {
  /** Original occurrence date. */
  date: string;
  new_date?: string;
  new_time?: string;
  cancelled?: boolean;
  note?: string;
}

const changeNote = z.string().trim().max(1000);

export const schedulePostponeSchema = z.object({
  /** Repeating schedules: which occurrence to move. Omit for one-off schedules. */
  occurrence_date: dateStr.optional(),
  new_date: dateStr,
  new_time: timeStr.optional().or(z.literal('')),
  note: changeNote.min(1, 'Tell users why it was postponed'),
  notify: z.boolean().default(true),
});

export const scheduleCancelSchema = z.object({
  /** Repeating schedules: cancel just this occurrence. Omit to cancel the whole schedule. */
  occurrence_date: dateStr.optional(),
  note: changeNote.min(1, 'Tell users why it was cancelled'),
  notify: z.boolean().default(true),
});

export const scheduleRestoreSchema = z.object({
  occurrence_date: dateStr.optional(),
  note: changeNote.optional(),
  notify: z.boolean().default(true),
});

/** Reminder offsets in minutes before the start time. */
export const SCHEDULE_REMINDER_OPTIONS = [
  { minutes: 0, label: 'At start time' },
  { minutes: 15, label: '15 minutes before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 180, label: '3 hours before' },
  { minutes: 1440, label: '1 day before' },
  { minutes: 2880, label: '2 days before' },
  { minutes: 4320, label: '3 days before' },
  { minutes: 10080, label: '1 week before' },
] as const;

export const SCHEDULE_MAX_REMINDER_MINUTES = 30 * 24 * 60;

/** Bangladesh weekend: Friday (5) and Saturday (6). */
export const BD_WEEKEND_DAYS = [5, 6] as const;

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const scheduleRecurrenceSchema = z.object({
  freq: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).default('none'),
  interval: z.coerce.number().int().min(1).max(12).default(1),
  /** Weekly: days of week (0 = Sunday). Empty means the weekday of the start date. */
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  /** Monthly: day of month 1–31, or -1 for the last day. Missing means the start date's day. */
  month_day: z.number().int().min(-1).max(31).refine((v) => v !== 0, 'Day cannot be 0').optional(),
  until: dateStr.optional(),
  /** If an occurrence lands on the weekend, move it to the previous/next working day. */
  weekend_shift: z.enum(['none', 'before', 'after']).default('none'),
});
export type ScheduleRecurrence = z.infer<typeof scheduleRecurrenceSchema>;

export const scheduleEventInputSchema = z
  .object({
    scope: z.enum(['universal', 'personal']).default('personal'),
    kind: z.string().trim().min(1).max(40).default('personal'),
    title: z.string().trim().min(1, 'Title is required').max(160),
    description: optText(5000),
    location: optText(300),
    meeting_link: z.string().trim().url('Enter a full link (https://…)').max(500).optional().or(z.literal('')),
    date: dateStr,
    /** Missing time means an all-day item. */
    time: timeStr.optional().or(z.literal('')),
    end_time: timeStr.optional().or(z.literal('')),
    end_date: dateStr.optional().or(z.literal('')),
    recurrence: scheduleRecurrenceSchema.default({}),
    reminders: z.array(z.number().int().min(0).max(SCHEDULE_MAX_REMINDER_MINUTES)).max(6).default([1440]),
    target_type: z.enum(['all', 'specific']).default('all'),
    target_user_ids: z.array(mongoId).max(2000).default([]),
    is_published: z.boolean().default(true),
    /** Universal only: related processes, checklists, templates and guides. */
    links: z
      .array(z.object({ type: z.enum(SCHEDULE_LINK_TYPES), id: mongoId }))
      .max(10)
      .default([]),
    /** Universal only: also send an announcement right away. Not stored. */
    notify_now: z.boolean().optional(),
    /** Universal edits: note shown to users and included in the change notification. */
    change_note: changeNote.optional().or(z.literal('')),
  })
  .superRefine((d, ctx) => {
    if (d.end_date && d.end_date < d.date) {
      ctx.addIssue({ code: 'custom', path: ['end_date'], message: 'End date is before the start date' });
    }
    if (d.recurrence.until && d.recurrence.until < d.date) {
      ctx.addIssue({ code: 'custom', path: ['recurrence', 'until'], message: 'Repeat-until is before the start date' });
    }
    if (d.scope === 'universal' && d.target_type === 'specific' && d.target_user_ids.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['target_user_ids'], message: 'Select at least one user' });
    }
  });
export type ScheduleEventInput = z.input<typeof scheduleEventInputSchema>;
export type ScheduleEventParsed = z.infer<typeof scheduleEventInputSchema>;

export const scheduleFeedQuerySchema = z.object({
  from: dateStr,
  to: dateStr,
});

export interface ScheduleAttachment {
  id: string;
  name: string;
  size: number;
  uploaded_at: string;
}

export interface ScheduleEventRecord {
  id: string;
  scope: 'universal' | 'personal';
  kind: ScheduleKind;
  title: string;
  description?: string;
  location?: string;
  meeting_link?: string;
  date: string;
  time?: string;
  end_time?: string;
  end_date?: string;
  recurrence: ScheduleRecurrence;
  reminders: number[];
  target_type: 'all' | 'specific';
  target_user_ids: string[];
  attachments: ScheduleAttachment[];
  links: ScheduleLinkRecord[];
  is_published: boolean;
  /** 'cancelled' for a whole schedule the admin called off (kept visible with the note). */
  status: 'active' | 'cancelled';
  cancel_note?: string;
  /** One-off schedule moved by the admin: where it was before. */
  postponed_from?: { date: string; time?: string };
  overrides: ScheduleOverrideRecord[];
  /** Newest first. */
  change_log: ScheduleChangeLogEntry[];
  /** True when the signed-in user may edit/delete it. */
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduleOccurrence {
  /** event id, or "rr" for the computed rest & recreation due date */
  event_id: string;
  source: 'event' | 'rr';
  scope: 'universal' | 'personal';
  kind: ScheduleKind;
  title: string;
  date: string;
  time?: string;
  end_time?: string;
  end_date?: string;
  location?: string;
  meeting_link?: string;
  attachments_count: number;
  links_count: number;
  recurring: boolean;
  status: 'scheduled' | 'postponed' | 'cancelled';
  /** For postponed occurrences: the original slot. */
  original_date?: string;
  original_time?: string;
  /** Admin note for a postponed/cancelled occurrence. */
  note?: string;
}

/* --------------------------- rest & recreation --------------------------- */

export const rrHistoryItemSchema = z
  .object({
    start_date: dateStr,
    end_date: dateStr.optional().or(z.literal('')),
    note: optText(200),
  })
  .refine((d) => !d.end_date || d.end_date >= d.start_date, { message: 'Leave ends before it starts', path: ['end_date'] });

export const scheduleProfileSchema = z.object({
  joining_date: dateStr.optional().or(z.literal('')),
  rr_history: z.array(rrHistoryItemSchema).max(30).default([]),
  rr_reminders: z.boolean().default(true),
});
export type ScheduleProfileInput = z.input<typeof scheduleProfileSchema>;

export interface ScheduleProfileRecord {
  joining_date?: string;
  rr_history: Array<{ start_date: string; end_date?: string; note?: string }>;
  rr_reminders: boolean;
}

export const scheduleSettingsSchema = z.object({
  rr_cycle_years: z.coerce.number().int().min(1).max(10),
  rr_days: z.coerce.number().int().min(1).max(60),
  /** Where the next cycle counts from after a leave: the leave's first day, or the day after it ended. */
  rr_count_from: z.enum(['leave_start', 'leave_end']),
  rr_reminder_days: z.array(z.number().int().min(0).max(365)).min(1).max(6),
  /** Time reminders go out for all-day items and R&R (HH:mm, Bangladesh time). */
  reminder_time: timeStr,
});
export type ScheduleSettingsRecord = z.infer<typeof scheduleSettingsSchema>;

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettingsRecord = {
  rr_cycle_years: 3,
  rr_days: 15,
  rr_count_from: 'leave_end',
  rr_reminder_days: [30, 7, 0],
  reminder_time: '09:00',
};

export interface RestRecreationStatus {
  /** What the current cycle counts from. */
  basis: 'joining' | 'last_leave' | null;
  basis_date?: string;
  due_date?: string;
  /** Negative once the leave is due (overdue by that many days). */
  days_left?: number;
  eligible: boolean;
  cycle_years: number;
  leave_days: number;
  last_leave?: { start_date: string; end_date?: string };
}

/* ------------------------------ date helpers ------------------------------ */

const DAY_MS = 86_400_000;
const BDT_OFFSET_MS = 6 * 3_600_000;

function parseDay(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

function fmtDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function addDays(date: string, days: number): string {
  return fmtDay(parseDay(date) + days * DAY_MS);
}

export function addYears(date: string, years: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dim = new Date(Date.UTC(y! + years, m!, 0)).getUTCDate();
  return fmtDay(Date.UTC(y! + years, m! - 1, Math.min(d!, dim)));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to) - parseDay(from)) / DAY_MS);
}

export function weekdayOf(date: string): number {
  return new Date(parseDay(date)).getUTCDay();
}

/** Today in Bangladesh as YYYY-MM-DD. */
export function bdTodayStr(now: Date = new Date()): string {
  return fmtDay(now.getTime() + BDT_OFFSET_MS);
}

/** The UTC instant for a Bangladesh date + wall-clock time. */
export function bdInstant(date: string, time = '00:00'): Date {
  const [h, m] = time.split(':').map(Number);
  return new Date(parseDay(date) + (h! * 60 + m!) * 60_000 - BDT_OFFSET_MS);
}

function shiftWeekend(ms: number, mode: ScheduleRecurrence['weekend_shift']): number {
  if (mode === 'none') return ms;
  let cur = ms;
  for (let i = 0; i < 3; i++) {
    const wd = new Date(cur).getUTCDay();
    if (!(BD_WEEKEND_DAYS as readonly number[]).includes(wd)) break;
    cur += mode === 'before' ? -DAY_MS : DAY_MS;
  }
  return cur;
}

/**
 * All occurrence dates of a (possibly recurring) item that fall in [from, to], after weekend
 * shifting. Capped so a bad rule can never loop forever.
 */
export function expandOccurrences(
  start: string,
  rec: Pick<ScheduleRecurrence, 'freq' | 'interval' | 'weekdays' | 'month_day' | 'until' | 'weekend_shift'>,
  from: string,
  to: string,
): string[] {
  const s = parseDay(start);
  const f = parseDay(from);
  const t = parseDay(to);
  const scanFrom = f - 3 * DAY_MS;
  const scanTo = t + 3 * DAY_MS;
  const until = rec.until ? parseDay(rec.until) : Infinity;
  const interval = Math.max(1, rec.interval || 1);
  const out = new Set<string>();
  let guard = 0;

  const push = (d: number) => {
    if (d < s || d > until) return;
    const shifted = shiftWeekend(d, rec.weekend_shift ?? 'none');
    if (shifted >= f && shifted <= t) out.add(fmtDay(shifted));
  };

  switch (rec.freq) {
    case 'none':
      push(s);
      break;
    case 'daily': {
      const step = interval * DAY_MS;
      let k = Math.max(0, Math.ceil((scanFrom - s) / step));
      for (let d = s + k * step; d <= scanTo && d <= until && guard++ < 500; k++, d = s + k * step) push(d);
      break;
    }
    case 'weekly': {
      const days = rec.weekdays?.length ? [...new Set(rec.weekdays)].sort() : [new Date(s).getUTCDay()];
      const weekStart = s - new Date(s).getUTCDay() * DAY_MS;
      const step = interval * 7 * DAY_MS;
      let k = Math.max(0, Math.floor((scanFrom - weekStart) / step));
      for (let w = weekStart + k * step; w <= scanTo && w <= until && guard++ < 300; k++, w = weekStart + k * step) {
        for (const wd of days) push(w + wd * DAY_MS);
      }
      break;
    }
    case 'monthly': {
      const sd = new Date(s);
      const md = rec.month_day ?? sd.getUTCDate();
      const base = sd.getUTCFullYear() * 12 + sd.getUTCMonth();
      const fd = new Date(scanFrom);
      let k = Math.max(0, Math.floor((fd.getUTCFullYear() * 12 + fd.getUTCMonth() - base) / interval) - 1);
      while (guard++ < 300) {
        const mi = base + k * interval;
        const y = Math.floor(mi / 12);
        const m = mi % 12;
        const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        const d = Date.UTC(y, m, md === -1 ? dim : Math.min(md, dim));
        if (d > scanTo || d > until) break;
        push(d);
        k++;
      }
      break;
    }
    case 'yearly': {
      const sd = new Date(s);
      const fy = new Date(scanFrom).getUTCFullYear();
      let k = Math.max(0, Math.floor((fy - sd.getUTCFullYear()) / interval) - 1);
      while (guard++ < 100) {
        const y = sd.getUTCFullYear() + k * interval;
        const dim = new Date(Date.UTC(y, sd.getUTCMonth() + 1, 0)).getUTCDate();
        const d = Date.UTC(y, sd.getUTCMonth(), Math.min(sd.getUTCDate(), dim));
        if (d > scanTo || d > until) break;
        push(d);
        k++;
      }
      break;
    }
  }
  return [...out].sort();
}

export function describeRecurrence(rec: ScheduleRecurrence, start: string): string {
  const every = (unit: string) => (rec.interval > 1 ? `Every ${rec.interval} ${unit}s` : `Every ${unit}`);
  let text: string;
  switch (rec.freq) {
    case 'none':
      return 'Does not repeat';
    case 'daily':
      text = every('day');
      break;
    case 'weekly': {
      const days = rec.weekdays.length ? rec.weekdays : [weekdayOf(start)];
      text = `${every('week')} on ${[...days].sort().map((d) => WEEKDAY_LABELS[d]).join(', ')}`;
      break;
    }
    case 'monthly': {
      const md = rec.month_day ?? Number(start.slice(8, 10));
      text = `${every('month')} on ${md === -1 ? 'the last day' : `day ${md}`}`;
      break;
    }
    case 'yearly':
      text = every('year');
      break;
  }
  if (rec.weekend_shift === 'before') text += ' (weekend → previous working day)';
  if (rec.weekend_shift === 'after') text += ' (weekend → next working day)';
  if (rec.until) text += ` until ${rec.until}`;
  return text;
}

/**
 * Rest & recreation leave (শ্রান্তি ও বিনোদন ছুটি): due every `cycle_years` from the joining date,
 * or from the most recent R&R leave once one has been taken.
 */
export function computeRestRecreation(
  profile: Pick<ScheduleProfileRecord, 'joining_date' | 'rr_history'>,
  settings: Pick<ScheduleSettingsRecord, 'rr_cycle_years' | 'rr_days' | 'rr_count_from'>,
  today: string = bdTodayStr(),
): RestRecreationStatus {
  const base = { cycle_years: settings.rr_cycle_years, leave_days: settings.rr_days };
  const last = [...(profile.rr_history ?? [])].sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  let basis: RestRecreationStatus['basis'] = null;
  let basisDate: string | undefined;
  if (last) {
    basis = 'last_leave';
    basisDate =
      settings.rr_count_from === 'leave_end' && last.end_date ? addDays(last.end_date, 1) : last.start_date;
  } else if (profile.joining_date) {
    basis = 'joining';
    basisDate = profile.joining_date;
  }
  if (!basisDate) return { ...base, basis: null, eligible: false };
  const due = addYears(basisDate, settings.rr_cycle_years);
  const daysLeft = daysBetween(today, due);
  return {
    ...base,
    basis,
    basis_date: basisDate,
    due_date: due,
    days_left: daysLeft,
    eligible: daysLeft <= 0,
    last_leave: last ? { start_date: last.start_date, end_date: last.end_date || undefined } : undefined,
  };
}
