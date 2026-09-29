import {
  SCHEDULE_MAX_REMINDER_MINUTES,
  addDays,
  bdInstant,
  bdTodayStr,
  computeRestRecreation,
  type ScheduleOccurrence,
} from '@ibas/shared-types';
import { logger } from '../../shared/logger.js';
import { deliverSystemNotification } from '../notifications/notifications.service.js';
import { ScheduleDispatch } from './models/ScheduleDispatch.model.js';
import { ScheduleEvent, type IScheduleEvent } from './models/ScheduleEvent.model.js';
import { ScheduleProfile } from './models/ScheduleProfile.model.js';
import { formatWhen, getSettings, occurrencesOf, rangeFilter, resolveRecipients } from './schedule.service.js';
import { typeLabel } from './schedule-types.service.js';

const TICK_MS = 60_000;
/** Reminders missed while the server was down are still sent if they are at most this old. */
const GRACE_MS = 15 * 60_000;

let lastTick = 0;
let rrDoneFor = '';
let running = false;
let timer: ReturnType<typeof setInterval> | undefined;

/** Claims a reminder key; false when it was already sent. */
async function claim(key: string): Promise<boolean> {
  try {
    await ScheduleDispatch.create({ key });
    return true;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return false;
    throw err;
  }
}

function leadText(minutes: number): string {
  if (minutes === 0) return 'Starting now';
  if (minutes < 60) return `In ${minutes} minutes`;
  if (minutes < 1440) return `In ${Math.round(minutes / 60)} hour${minutes >= 120 ? 's' : ''}`;
  const days = Math.round(minutes / 1440);
  return days === 7 ? 'In 1 week' : `In ${days} day${days > 1 ? 's' : ''}`;
}

async function sendEventReminder(doc: IScheduleEvent, occ: ScheduleOccurrence, minutes: number) {
  const date = occ.date;
  const key = `ev:${String(doc._id)}:${date}@${occ.time ?? ''}:${minutes}`;
  if (!(await claim(key))) return;
  const userIds = await resolveRecipients(doc);
  const lines = [
    `${await typeLabel(doc.kind)} · ${formatWhen(date, occ.time)}`,
    occ.status === 'postponed' && occ.original_date
      ? `Postponed from ${formatWhen(occ.original_date, occ.original_time)}`
      : '',
    occ.note ? `Note: ${occ.note}` : '',
    doc.location ? `Venue: ${doc.location}` : '',
    doc.meeting_link ? `Join: ${doc.meeting_link}` : '',
    doc.attachments?.length ? `${doc.attachments.length} document(s) attached` : '',
  ].filter(Boolean);
  const { recipients } = await deliverSystemNotification({
    userIds,
    title: `${leadText(minutes)}: ${doc.title}`,
    message: lines.join('\n'),
    createdBy: String(doc.created_by),
    link: `/schedule?event=${String(doc._id)}`,
    data: { type: 'schedule', event_id: String(doc._id), date },
  });
  await ScheduleDispatch.updateOne({ key }, { recipients });
}

async function runEventReminders(windowStart: number, now: number, reminderTime: string) {
  const from = bdTodayStr(new Date(windowStart));
  const to = bdTodayStr(new Date(now + SCHEDULE_MAX_REMINDER_MINUTES * 60_000));
  const docs = await ScheduleEvent.find({
    $and: [
      { is_active: true, 'reminders.0': { $exists: true } },
      { $or: [{ scope: 'personal' }, { scope: 'universal', is_published: true }] },
      rangeFilter(from, to),
    ],
  });
  for (const doc of docs) {
    for (const occ of occurrencesOf(doc, from, to)) {
      if (occ.status === 'cancelled') continue;
      const start = bdInstant(occ.date, occ.time || reminderTime).getTime();
      for (const minutes of doc.reminders) {
        const at = start - minutes * 60_000;
        if (at > windowStart && at <= now) {
          await sendEventReminder(doc, occ, minutes).catch((err) =>
            logger.warn({ err, event: String(doc._id) }, 'Schedule reminder failed'),
          );
        }
      }
    }
  }
}

async function runRestRecreationReminders(today: string) {
  const settings = await getSettings();
  const cursor = ScheduleProfile.find({ rr_reminders: { $ne: false } }).lean().cursor();
  for await (const profile of cursor) {
    const status = computeRestRecreation(profile, settings, today);
    if (!status.due_date) continue;
    for (const lead of settings.rr_reminder_days) {
      if (addDays(status.due_date, -lead) !== today) continue;
      const key = `rr:${String(profile.user_id)}:${status.due_date}:${lead}`;
      if (!(await claim(key))) continue;
      const [y, m, d] = status.due_date.split('-');
      await deliverSystemNotification({
        userIds: [String(profile.user_id)],
        title: lead === 0 ? 'Rest & recreation leave is due today' : `Rest & recreation leave due in ${lead} days`,
        message: `You become eligible for ${status.leave_days} days of rest & recreation leave on ${d}-${m}-${y} (every ${status.cycle_years} years, counted from your ${status.basis === 'joining' ? 'joining date' : 'last R&R leave'}). Apply in time; R&R allowance is usually paid with it.`,
        createdBy: String(profile.user_id),
        link: '/schedule?tab=rr',
        data: { type: 'schedule_rr' },
      }).catch((err) => logger.warn({ err, user: String(profile.user_id) }, 'R&R reminder failed'));
    }
  }
}

async function tick() {
  if (running) return;
  running = true;
  const now = Date.now();
  const windowStart = Math.max(lastTick || now - GRACE_MS, now - GRACE_MS);
  try {
    const settings = await getSettings();
    await runEventReminders(windowStart, now, settings.reminder_time);
    const today = bdTodayStr(new Date(now));
    if (rrDoneFor !== today && now >= bdInstant(today, settings.reminder_time).getTime()) {
      await runRestRecreationReminders(today);
      rrDoneFor = today;
    }
    lastTick = now;
  } catch (err) {
    logger.error({ err }, 'Schedule runner tick failed');
  } finally {
    running = false;
  }
}

export function startScheduleRunner(): void {
  if (timer) return;
  timer = setInterval(() => void tick(), TICK_MS);
  setTimeout(() => void tick(), 5_000);
  logger.info('Schedule reminder runner started');
}
