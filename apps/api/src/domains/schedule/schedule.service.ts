import mongoose, { type FilterQuery, type Types } from 'mongoose';
import {
  DEFAULT_SCHEDULE_SETTINGS,
  addDays,
  bdTodayStr,
  computeRestRecreation,
  daysBetween,
  describeRecurrence,
  expandOccurrences,
  scheduleCancelSchema,
  scheduleEventInputSchema,
  schedulePostponeSchema,
  scheduleProfileSchema,
  scheduleRestoreSchema,
  scheduleSettingsSchema,
  type RestRecreationStatus,
  type ScheduleEventRecord,
  type ScheduleLinkRecord,
  type ScheduleOccurrence,
  type ScheduleProfileRecord,
  type ScheduleRecurrence,
  type ScheduleSettingsRecord,
} from '@ibas/shared-types';
import type { AuthUser } from '../../middleware/auth.js';
import { badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';
import { User } from '../users/models/User.model.js';
import { Task } from '../workflow/models/Task.model.js';
import { ToolkitItem } from '../toolkit/models/ToolkitItem.model.js';
import { deliverSystemNotification } from '../notifications/notifications.service.js';
import { ScheduleEvent, type IScheduleEvent } from './models/ScheduleEvent.model.js';
import { ScheduleProfile } from './models/ScheduleProfile.model.js';
import { ScheduleSettings } from './models/ScheduleSettings.model.js';
import { getTypeIndex, typeLabel } from './schedule-types.service.js';
import { deleteSchedulePdf, saveSchedulePdf, schedulePdfPath } from './schedule.storage.js';

const MAX_FEED_DAYS = 400;
const MAX_PERSONAL_EVENTS = 500;
const MAX_ATTACHMENTS = 10;
const MAX_CHANGE_LOG = 50;

export function isAdminUser(user: AuthUser): boolean {
  return user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin';
}

function zodMessage(err: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return err.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
}

/* ------------------------------- settings ------------------------------- */

export async function getSettings(): Promise<ScheduleSettingsRecord> {
  const doc = await ScheduleSettings.findOne({ key: 'global' }).lean();
  return {
    rr_cycle_years: doc?.rr_cycle_years ?? DEFAULT_SCHEDULE_SETTINGS.rr_cycle_years,
    rr_days: doc?.rr_days ?? DEFAULT_SCHEDULE_SETTINGS.rr_days,
    rr_count_from: doc?.rr_count_from ?? DEFAULT_SCHEDULE_SETTINGS.rr_count_from,
    rr_reminder_days: doc?.rr_reminder_days?.length ? doc.rr_reminder_days : DEFAULT_SCHEDULE_SETTINGS.rr_reminder_days,
    reminder_time: doc?.reminder_time ?? DEFAULT_SCHEDULE_SETTINGS.reminder_time,
  };
}

export async function updateSettings(body: unknown, userId: string): Promise<ScheduleSettingsRecord> {
  const parsed = scheduleSettingsSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const data = { ...parsed.data, rr_reminder_days: [...new Set(parsed.data.rr_reminder_days)].sort((a, b) => b - a) };
  await ScheduleSettings.updateOne({ key: 'global' }, { $set: { ...data, updated_by: userId } }, { upsert: true });
  return getSettings();
}

/* --------------------------------- links --------------------------------- */

const TOOLKIT_KIND_LABEL: Record<string, string> = { checklist: 'Checklist', template: 'Template', guide: 'Guide' };

/** Resolves tagged processes / toolkit items for many events at once. */
async function resolveLinks(docs: IScheduleEvent[], includeUnpublished: boolean): Promise<Map<string, ScheduleLinkRecord[]>> {
  const taskIds = new Set<string>();
  const kitIds = new Set<string>();
  for (const d of docs) for (const l of d.links ?? []) (l.type === 'task' ? taskIds : kitIds).add(String(l.id));
  const [tasks, kits] = await Promise.all([
    taskIds.size ? Task.find({ _id: { $in: [...taskIds] }, is_active: true }).select('name_en is_published').lean() : [],
    kitIds.size ? ToolkitItem.find({ _id: { $in: [...kitIds] }, is_active: true }).select('title kind is_published').lean() : [],
  ]);
  const byKey = new Map<string, ScheduleLinkRecord>();
  for (const t of tasks) {
    byKey.set(`task:${String(t._id)}`, {
      type: 'task',
      id: String(t._id),
      title: t.name_en,
      subtitle: 'Process',
      href: `/guided-tasks/${String(t._id)}`,
      is_published: t.is_published,
    });
  }
  for (const k of kits) {
    byKey.set(`toolkit:${String(k._id)}`, {
      type: 'toolkit',
      id: String(k._id),
      title: k.title,
      subtitle: TOOLKIT_KIND_LABEL[k.kind] ?? 'Toolkit',
      href: `/toolkit/${String(k._id)}`,
      is_published: k.is_published,
    });
  }
  const out = new Map<string, ScheduleLinkRecord[]>();
  for (const d of docs) {
    out.set(
      String(d._id),
      (d.links ?? [])
        .map((l) => byKey.get(`${l.type}:${String(l.id)}`))
        .filter((l): l is ScheduleLinkRecord => !!l && (includeUnpublished || l.is_published)),
    );
  }
  return out;
}

export async function linkOptions(q: string): Promise<ScheduleLinkRecord[]> {
  const rx = q.trim() ? new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
  const [tasks, kits] = await Promise.all([
    Task.find({ is_active: true, ...(rx ? { $or: [{ name_en: rx }, { name_bn: rx }, { code: rx }, { tags: rx }] } : {}) })
      .select('name_en is_published')
      .sort({ name_en: 1 })
      .limit(20)
      .lean(),
    ToolkitItem.find({ is_active: true, ...(rx ? { $or: [{ title: rx }, { title_bn: rx }, { tags: rx }] } : {}) })
      .select('title kind is_published')
      .sort({ title: 1 })
      .limit(30)
      .lean(),
  ]);
  return [
    ...tasks.map((t) => ({
      type: 'task' as const,
      id: String(t._id),
      title: t.name_en,
      subtitle: 'Process',
      href: `/guided-tasks/${String(t._id)}`,
      is_published: t.is_published,
    })),
    ...kits.map((k) => ({
      type: 'toolkit' as const,
      id: String(k._id),
      title: k.title,
      subtitle: TOOLKIT_KIND_LABEL[k.kind] ?? 'Toolkit',
      href: `/toolkit/${String(k._id)}`,
      is_published: k.is_published,
    })),
  ];
}

async function assertLinks(links: Array<{ type: 'task' | 'toolkit'; id: string }>) {
  const taskIds = links.filter((l) => l.type === 'task').map((l) => l.id);
  const kitIds = links.filter((l) => l.type === 'toolkit').map((l) => l.id);
  const [t, k] = await Promise.all([
    taskIds.length ? Task.countDocuments({ _id: { $in: taskIds }, is_active: true }) : 0,
    kitIds.length ? ToolkitItem.countDocuments({ _id: { $in: kitIds }, is_active: true }) : 0,
  ]);
  if (t !== new Set(taskIds).size || k !== new Set(kitIds).size) throw badRequest('Some tagged items were not found');
}

/* -------------------------------- events -------------------------------- */

function canEdit(doc: IScheduleEvent, user: AuthUser): boolean {
  return doc.scope === 'personal' ? String(doc.owner_id) === user.id : isAdminUser(user);
}

function canView(doc: IScheduleEvent, user: AuthUser): boolean {
  if (!doc.is_active) return false;
  if (doc.scope === 'personal') return String(doc.owner_id) === user.id;
  if (isAdminUser(user)) return true;
  if (!doc.is_published) return false;
  return doc.target_type === 'all' || doc.target_user_ids.some((id) => String(id) === user.id);
}

function recurrenceOf(doc: IScheduleEvent): ScheduleRecurrence {
  return {
    freq: doc.recurrence?.freq ?? 'none',
    interval: doc.recurrence?.interval ?? 1,
    weekdays: doc.recurrence?.weekdays ?? [],
    month_day: doc.recurrence?.month_day ?? undefined,
    until: doc.recurrence?.until || undefined,
    weekend_shift: doc.recurrence?.weekend_shift ?? 'none',
  };
}

export function toRecord(doc: IScheduleEvent, user: AuthUser, links: ScheduleLinkRecord[] = []): ScheduleEventRecord {
  return {
    id: String(doc._id),
    scope: doc.scope,
    kind: doc.kind,
    title: doc.title,
    description: doc.description || undefined,
    location: doc.location || undefined,
    meeting_link: doc.meeting_link || undefined,
    date: doc.date,
    time: doc.time || undefined,
    end_time: doc.end_time || undefined,
    end_date: doc.end_date || undefined,
    recurrence: recurrenceOf(doc),
    reminders: doc.reminders ?? [],
    target_type: doc.target_type,
    target_user_ids: doc.scope === 'universal' && isAdminUser(user) ? doc.target_user_ids.map(String) : [],
    attachments: (doc.attachments ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      size: a.size,
      uploaded_at: a.uploaded_at.toISOString(),
    })),
    links,
    is_published: doc.is_published,
    status: doc.status ?? 'active',
    cancel_note: doc.cancel_note || undefined,
    postponed_from: doc.postponed_from?.date ? { date: doc.postponed_from.date, time: doc.postponed_from.time || undefined } : undefined,
    overrides: (doc.overrides ?? []).map((o) => ({
      date: o.date,
      new_date: o.new_date || undefined,
      new_time: o.new_time || undefined,
      cancelled: o.cancelled || undefined,
      note: o.note || undefined,
    })),
    change_log: [...(doc.change_log ?? [])]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map((c) => ({
        action: c.action,
        note: c.note || undefined,
        occurrence_date: c.occurrence_date || undefined,
        from: c.from?.date ? { date: c.from.date, time: c.from.time || undefined } : undefined,
        to: c.to?.date ? { date: c.to.date, time: c.to.time || undefined } : undefined,
        at: c.at.toISOString(),
      })),
    can_edit: canEdit(doc, user),
    created_at: doc.created_at.toISOString(),
    updated_at: doc.updated_at.toISOString(),
  };
}

async function toRecordWithLinks(doc: IScheduleEvent, user: AuthUser): Promise<ScheduleEventRecord> {
  const links = await resolveLinks([doc], isAdminUser(user));
  return toRecord(doc, user, links.get(String(doc._id)));
}

function visibleFilter(user: AuthUser): FilterQuery<IScheduleEvent> {
  const uid = new mongoose.Types.ObjectId(user.id);
  return {
    is_active: true,
    $or: [
      { scope: 'personal', owner_id: uid },
      { scope: 'universal', is_published: true, $or: [{ target_type: 'all' }, { target_user_ids: uid }] },
    ],
  };
}

/** Events that could have an occurrence in [from, to] (including ones moved into the range). */
export function rangeFilter(from: string, to: string): FilterQuery<IScheduleEvent> {
  return {
    $or: [
      { 'overrides.new_date': { $gte: from, $lte: to } },
      {
        date: { $lte: to },
        $or: [
          { 'recurrence.freq': 'none', $or: [{ date: { $gte: from } }, { end_date: { $gte: from } }] },
          {
            'recurrence.freq': { $ne: 'none' },
            $or: [{ 'recurrence.until': { $exists: false } }, { 'recurrence.until': null }, { 'recurrence.until': { $gte: from } }],
          },
        ],
      },
    ],
  };
}

function isOccurrence(doc: IScheduleEvent, date: string): boolean {
  return expandOccurrences(doc.date, recurrenceOf(doc), date, date).includes(date);
}

/** Occurrences in [from, to] with admin postponements and cancellations applied. */
export function occurrencesOf(doc: IScheduleEvent, from: string, to: string): ScheduleOccurrence[] {
  const span = doc.end_date ? daysBetween(doc.date, doc.end_date) : 0;
  const recurring = (doc.recurrence?.freq ?? 'none') !== 'none';
  const overrides = new Map((doc.overrides ?? []).map((o) => [o.date, o]));
  const cancelledAll = doc.status === 'cancelled';
  const base = {
    event_id: String(doc._id),
    source: 'event' as const,
    scope: doc.scope,
    kind: doc.kind,
    title: doc.title,
    end_time: doc.end_time || undefined,
    location: doc.location || undefined,
    meeting_link: doc.meeting_link || undefined,
    attachments_count: doc.attachments?.length ?? 0,
    links_count: doc.links?.length ?? 0,
    recurring,
  };
  const out: ScheduleOccurrence[] = [];
  const postponed = !recurring && !!doc.postponed_from?.date;
  const postponeNote = postponed
    ? [...(doc.change_log ?? [])].filter((c) => c.action === 'postponed' && !c.occurrence_date).sort((a, b) => b.at.getTime() - a.at.getTime())[0]?.note
    : undefined;

  for (const date of expandOccurrences(doc.date, recurrenceOf(doc), span > 0 ? addDays(from, -span) : from, to)) {
    const ov = overrides.get(date);
    if (ov?.new_date) continue;
    out.push({
      ...base,
      date,
      time: doc.time || undefined,
      end_date: span > 0 ? addDays(date, span) : undefined,
      status: cancelledAll || ov?.cancelled ? 'cancelled' : postponed ? 'postponed' : 'scheduled',
      original_date: postponed ? doc.postponed_from!.date : undefined,
      original_time: postponed ? doc.postponed_from!.time || undefined : undefined,
      note: ov?.cancelled
        ? ov.note || undefined
        : cancelledAll
          ? doc.cancel_note || undefined
          : postponeNote || undefined,
    });
  }

  for (const ov of doc.overrides ?? []) {
    if (!ov.new_date || ov.new_date < from || ov.new_date > to) continue;
    out.push({
      ...base,
      date: ov.new_date,
      time: ov.new_time || doc.time || undefined,
      end_date: span > 0 ? addDays(ov.new_date, span) : undefined,
      status: cancelledAll || ov.cancelled ? 'cancelled' : 'postponed',
      original_date: ov.date,
      original_time: doc.time || undefined,
      note: ov.note || undefined,
    });
  }
  return out;
}

export async function getFeed(user: AuthUser, from: string, to: string): Promise<ScheduleOccurrence[]> {
  if (to < from) throw badRequest('"to" is before "from"');
  if (daysBetween(from, to) > MAX_FEED_DAYS) throw badRequest(`Range is limited to ${MAX_FEED_DAYS} days`);
  const [docs, profile, settings] = await Promise.all([
    ScheduleEvent.find({ $and: [visibleFilter(user), rangeFilter(addDays(from, -60), to)] }).limit(2000),
    ScheduleProfile.findOne({ user_id: user.id }).lean(),
    getSettings(),
  ]);
  const out = docs.flatMap((d) => occurrencesOf(d, from, to));

  const rrBase = {
    event_id: 'rr',
    source: 'rr' as const,
    scope: 'personal' as const,
    kind: 'rest_recreation',
    attachments_count: 0,
    links_count: 0,
    recurring: false,
    status: 'scheduled' as const,
  };
  if (profile) {
    const rr = computeRestRecreation(profile, settings);
    if (rr.due_date && rr.due_date >= from && rr.due_date <= to) {
      out.push({ ...rrBase, title: `Rest & recreation leave due (${rr.leave_days} days)`, date: rr.due_date });
    }
    for (const leave of profile.rr_history ?? []) {
      const end = leave.end_date || leave.start_date;
      if (end < from || leave.start_date > to) continue;
      out.push({
        ...rrBase,
        title: 'Rest & recreation leave',
        date: leave.start_date,
        end_date: leave.end_date && leave.end_date !== leave.start_date ? leave.end_date : undefined,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
}

async function loadEvent(id: string): Promise<IScheduleEvent> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Schedule not found');
  const doc = await ScheduleEvent.findById(id);
  if (!doc || !doc.is_active) throw notFound('Schedule not found');
  return doc;
}

export async function getEvent(id: string, user: AuthUser): Promise<ScheduleEventRecord> {
  const doc = await loadEvent(id);
  if (!canView(doc, user)) throw notFound('Schedule not found');
  return toRecordWithLinks(doc, user);
}

async function parseInput(body: unknown, user: AuthUser, currentKind?: string) {
  const parsed = scheduleEventInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const d = parsed.data;
  if (d.scope === 'universal' && !isAdminUser(user)) throw forbidden('Only admins can add schedules for everyone');

  const type = (await getTypeIndex()).get(d.kind);
  if (!type) throw badRequest(`Unknown schedule type "${d.kind}"`);
  if (!type.is_active && d.kind !== currentKind) throw badRequest(`Schedule type "${type.label}" is turned off`);
  if (d.kind === 'rest_recreation') throw badRequest('Rest & recreation is calculated automatically from the R&R section');
  if (d.scope === 'personal' && !type.allow_personal) throw badRequest(`"${type.label}" can only be used for official schedules`);

  const targetIds = d.scope === 'universal' && d.target_type === 'specific' ? [...new Set(d.target_user_ids)] : [];
  if (targetIds.length) {
    const found = await User.countDocuments({ _id: { $in: targetIds } });
    if (found !== targetIds.length) throw badRequest('Some selected users were not found');
  }
  const links = d.scope === 'universal' ? d.links.filter((l, i, arr) => arr.findIndex((x) => x.type === l.type && x.id === l.id) === i) : [];
  if (links.length) await assertLinks(links);

  const time = d.time || undefined;
  return {
    data: {
      scope: d.scope,
      kind: d.kind,
      title: d.title,
      description: d.description || undefined,
      location: d.location || undefined,
      meeting_link: d.meeting_link || undefined,
      date: d.date,
      time,
      end_time: time ? d.end_time || undefined : undefined,
      end_date: d.end_date && d.end_date !== d.date ? d.end_date : undefined,
      recurrence: {
        ...d.recurrence,
        weekdays: d.recurrence.freq === 'weekly' ? d.recurrence.weekdays : [],
        month_day: d.recurrence.freq === 'monthly' ? d.recurrence.month_day : undefined,
        until: d.recurrence.freq === 'none' ? undefined : d.recurrence.until,
      },
      reminders: [...new Set(d.reminders)].sort((a, b) => b - a),
      target_type: d.scope === 'universal' ? d.target_type : ('all' as const),
      target_user_ids: targetIds,
      links: links.map((l) => ({ type: l.type, id: new mongoose.Types.ObjectId(l.id) })),
      is_published: d.scope === 'universal' ? d.is_published : true,
    },
    notify: d.scope === 'universal' && d.is_published && Boolean(d.notify_now),
    changeNote: d.change_note?.trim() || undefined,
  };
}

function pushLog(doc: IScheduleEvent, entry: Omit<IScheduleEvent['change_log'][number], 'at' | 'by'>, userId: string) {
  doc.change_log.push({ ...entry, by: new mongoose.Types.ObjectId(userId) as Types.ObjectId, at: new Date() });
  if (doc.change_log.length > MAX_CHANGE_LOG) doc.change_log.splice(0, doc.change_log.length - MAX_CHANGE_LOG);
}

export async function createEvent(body: unknown, user: AuthUser): Promise<ScheduleEventRecord> {
  const { data, notify } = await parseInput(body, user);
  if (data.scope === 'personal') {
    const count = await ScheduleEvent.countDocuments({ scope: 'personal', owner_id: user.id, is_active: true });
    if (count >= MAX_PERSONAL_EVENTS) throw badRequest(`You can keep up to ${MAX_PERSONAL_EVENTS} personal schedules`);
  }
  const doc = await ScheduleEvent.create({
    ...data,
    owner_id: data.scope === 'personal' ? user.id : undefined,
    created_by: user.id,
  });
  if (notify) {
    await notifyRecipients(doc, `New schedule: ${doc.title}`, await summaryLines(doc, doc.date, doc.time));
  }
  return toRecordWithLinks(doc, user);
}

export async function updateEvent(id: string, body: unknown, user: AuthUser): Promise<ScheduleEventRecord> {
  const doc = await loadEvent(id);
  if (!canEdit(doc, user)) throw forbidden('You cannot edit this schedule');
  const { data, notify, changeNote } = await parseInput({ ...(body as object), scope: doc.scope }, user, doc.kind);

  const before = { date: doc.date, time: doc.time || undefined, location: doc.location, title: doc.title };
  const moved = before.date !== data.date || before.time !== data.time;
  const changes: string[] = [];
  if (before.title !== data.title) changes.push(`Title: ${data.title}`);
  if (moved) changes.push(`Moved from ${formatWhen(before.date, before.time)} to ${formatWhen(data.date, data.time)}`);
  if ((before.location ?? '') !== (data.location ?? '')) changes.push(`Venue: ${data.location || 'removed'}`);

  doc.set({ ...data, updated_by: user.id });
  if (!data.end_time) doc.set('end_time', undefined);
  if (!data.end_date) doc.set('end_date', undefined);
  if (!data.time) doc.set('time', undefined);
  if (doc.scope === 'universal' && (changeNote || moved)) {
    pushLog(
      doc,
      {
        action: 'updated',
        note: changeNote,
        from: moved ? { date: before.date, time: before.time } : undefined,
        to: moved ? { date: data.date, time: data.time } : undefined,
      },
      user.id,
    );
  }
  await doc.save();

  if (notify) {
    const lines = [...changes, ...(await summaryLines(doc, doc.date, doc.time))];
    if (changeNote) lines.unshift(`Note from admin: ${changeNote}`);
    await notifyRecipients(doc, `Schedule updated: ${doc.title}`, lines);
  }
  return toRecordWithLinks(doc, user);
}

export async function deleteEvent(id: string, user: AuthUser): Promise<void> {
  const doc = await loadEvent(id);
  if (!canEdit(doc, user)) throw forbidden('You cannot delete this schedule');
  doc.is_active = false;
  doc.updated_by = new mongoose.Types.ObjectId(user.id);
  await doc.save();
}

/* ----------------------- postpone / cancel / restore ----------------------- */

function currentSlot(doc: IScheduleEvent, occurrenceDate?: string): { date: string; time?: string } {
  if (!occurrenceDate) return { date: doc.date, time: doc.time || undefined };
  const ov = doc.overrides.find((o) => o.date === occurrenceDate);
  return { date: ov?.new_date || occurrenceDate, time: ov?.new_time || doc.time || undefined };
}

function requireOccurrence(doc: IScheduleEvent, occurrenceDate: string | undefined, action: string): string | undefined {
  const recurring = (doc.recurrence?.freq ?? 'none') !== 'none';
  if (!recurring) return undefined;
  if (!occurrenceDate) return undefined;
  if (!isOccurrence(doc, occurrenceDate)) throw badRequest(`${occurrenceDate} is not a date of this schedule, so it cannot be ${action}`);
  return occurrenceDate;
}

function shiftTime(time: string | undefined, fromTime: string | undefined, toTime: string | undefined): string | undefined {
  if (!time || !fromTime || !toTime) return time;
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const m = Math.min(23 * 60 + 59, Math.max(0, mins(time) + mins(toTime) - mins(fromTime)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export async function postponeEvent(id: string, body: unknown, user: AuthUser): Promise<ScheduleEventRecord> {
  const doc = await loadEvent(id);
  if (!canEdit(doc, user)) throw forbidden('You cannot change this schedule');
  const parsed = schedulePostponeSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const p = parsed.data;
  if (p.new_date < bdTodayStr()) throw badRequest('The new date is in the past');
  const recurring = (doc.recurrence?.freq ?? 'none') !== 'none';
  if (recurring && !p.occurrence_date) {
    throw badRequest('Choose which date of this repeating schedule to postpone (use Edit to move the whole series)');
  }
  const occ = requireOccurrence(doc, p.occurrence_date, 'postponed');
  const from = currentSlot(doc, occ);
  const newTime = p.new_time || from.time;
  if (from.date === p.new_date && from.time === newTime) throw badRequest('The new date and time are the same as now');

  if (occ) {
    const existing = doc.overrides.find((o) => o.date === occ);
    if (existing) Object.assign(existing, { new_date: p.new_date, new_time: newTime, cancelled: false, note: p.note });
    else doc.overrides.push({ date: occ, new_date: p.new_date, new_time: newTime, note: p.note });
  } else {
    if (!doc.postponed_from?.date) doc.postponed_from = { date: doc.date, time: doc.time || undefined };
    if (doc.end_date) doc.end_date = addDays(doc.end_date, daysBetween(doc.date, p.new_date));
    doc.end_time = shiftTime(doc.end_time || undefined, doc.time || undefined, newTime);
    doc.date = p.new_date;
    doc.time = newTime;
    doc.status = 'active';
    doc.cancel_note = undefined;
  }
  pushLog(doc, { action: 'postponed', note: p.note, occurrence_date: occ, from, to: { date: p.new_date, time: newTime } }, user.id);
  doc.updated_by = new mongoose.Types.ObjectId(user.id);
  await doc.save();

  if (p.notify && doc.scope === 'universal' && doc.is_published) {
    await notifyRecipients(doc, `Postponed: ${doc.title}`, [
      `New time: ${formatWhen(p.new_date, newTime)}`,
      `Was: ${formatWhen(from.date, from.time)}`,
      `Note from admin: ${p.note}`,
      ...(await summaryLines(doc, p.new_date, newTime, { skipWhen: true })),
    ]);
  }
  return toRecordWithLinks(doc, user);
}

export async function cancelEvent(id: string, body: unknown, user: AuthUser): Promise<ScheduleEventRecord> {
  const doc = await loadEvent(id);
  if (!canEdit(doc, user)) throw forbidden('You cannot change this schedule');
  const parsed = scheduleCancelSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const c = parsed.data;
  const occ = requireOccurrence(doc, c.occurrence_date, 'cancelled');
  const slot = currentSlot(doc, occ);

  if (occ) {
    const existing = doc.overrides.find((o) => o.date === occ);
    if (existing?.cancelled) throw badRequest('That date is already cancelled');
    if (existing) Object.assign(existing, { cancelled: true, note: c.note });
    else doc.overrides.push({ date: occ, cancelled: true, note: c.note });
  } else {
    if (doc.status === 'cancelled') throw badRequest('This schedule is already cancelled');
    doc.status = 'cancelled';
    doc.cancel_note = c.note;
  }
  pushLog(doc, { action: 'cancelled', note: c.note, occurrence_date: occ, from: slot }, user.id);
  doc.updated_by = new mongoose.Types.ObjectId(user.id);
  await doc.save();

  if (c.notify && doc.scope === 'universal' && doc.is_published) {
    const recurring = (doc.recurrence?.freq ?? 'none') !== 'none';
    await notifyRecipients(doc, `Cancelled: ${doc.title}`, [
      occ || !recurring ? `Date: ${formatWhen(slot.date, slot.time)}` : 'All upcoming dates are cancelled',
      `Note from admin: ${c.note}`,
    ]);
  }
  return toRecordWithLinks(doc, user);
}

export async function restoreEvent(id: string, body: unknown, user: AuthUser): Promise<ScheduleEventRecord> {
  const doc = await loadEvent(id);
  if (!canEdit(doc, user)) throw forbidden('You cannot change this schedule');
  const parsed = scheduleRestoreSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const r = parsed.data;
  const occ = r.occurrence_date;
  let slot: { date: string; time?: string };

  if (occ) {
    if (!doc.overrides.some((o) => o.date === occ)) throw badRequest('That date has no change to undo');
    doc.overrides = doc.overrides.filter((o) => o.date !== occ);
    slot = { date: occ, time: doc.time || undefined };
  } else {
    if (doc.status !== 'cancelled') throw badRequest('This schedule is not cancelled');
    doc.status = 'active';
    doc.cancel_note = undefined;
    slot = { date: doc.date, time: doc.time || undefined };
  }
  pushLog(doc, { action: 'restored', note: r.note || undefined, occurrence_date: occ, to: slot }, user.id);
  doc.updated_by = new mongoose.Types.ObjectId(user.id);
  await doc.save();

  if (r.notify && doc.scope === 'universal' && doc.is_published) {
    const lines = [`Back on: ${formatWhen(slot.date, slot.time)}`];
    if (r.note) lines.push(`Note from admin: ${r.note}`);
    await notifyRecipients(doc, `Back on schedule: ${doc.title}`, lines);
  }
  return toRecordWithLinks(doc, user);
}

export async function listUniversal(q = '', includePast = false, user?: AuthUser) {
  const today = bdTodayStr();
  const filter: FilterQuery<IScheduleEvent> = { scope: 'universal', is_active: true };
  if (!includePast) {
    filter.$or = [
      { date: { $gte: today } },
      { end_date: { $gte: today } },
      { 'overrides.new_date': { $gte: today } },
      {
        'recurrence.freq': { $ne: 'none' },
        $or: [{ 'recurrence.until': { $exists: false } }, { 'recurrence.until': null }, { 'recurrence.until': { $gte: today } }],
      },
    ];
  }
  if (q.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$and = [{ $or: [{ title: rx }, { description: rx }, { location: rx }] }];
  }
  const docs = await ScheduleEvent.find(filter).sort({ date: 1, time: 1 }).limit(300);
  if (!user) return docs.map((d) => ({ doc: d, links: [] as ScheduleLinkRecord[] }));
  const links = await resolveLinks(docs, true);
  return docs.map((d) => ({ doc: d, links: links.get(String(d._id)) ?? [] }));
}

/* ------------------------------ attachments ------------------------------ */

export async function addAttachment(id: string, file: Express.Multer.File | undefined, user: AuthUser) {
  if (!file) throw badRequest('Choose a PDF file');
  const doc = await loadEvent(id);
  if (doc.scope !== 'universal' || !isAdminUser(user)) throw forbidden('Only admins can attach files to schedules');
  if ((doc.attachments?.length ?? 0) >= MAX_ATTACHMENTS) throw badRequest(`Up to ${MAX_ATTACHMENTS} files per schedule`);
  const saved = await saveSchedulePdf(String(doc._id), file);
  doc.attachments.push(saved);
  await doc.save();
  return toRecordWithLinks(doc, user);
}

export async function removeAttachment(id: string, fileId: string, user: AuthUser) {
  const doc = await loadEvent(id);
  if (!canEdit(doc, user)) throw forbidden('You cannot edit this schedule');
  const file = doc.attachments.find((a) => a.id === fileId);
  if (!file) throw notFound('File not found');
  doc.attachments = doc.attachments.filter((a) => a.id !== fileId);
  await doc.save();
  await deleteSchedulePdf(String(doc._id), file.stored_name);
  return toRecordWithLinks(doc, user);
}

export async function getAttachmentFile(id: string, fileId: string, user: AuthUser) {
  const doc = await loadEvent(id);
  if (!canView(doc, user)) throw notFound('Schedule not found');
  const file = doc.attachments.find((a) => a.id === fileId);
  if (!file) throw notFound('File not found');
  return { path: schedulePdfPath(String(doc._id), file.stored_name), name: file.name };
}

/* ------------------------------ notifications ------------------------------ */

export async function resolveRecipients(doc: IScheduleEvent): Promise<string[]> {
  if (doc.scope === 'personal') return doc.owner_id ? [String(doc.owner_id)] : [];
  if (doc.target_type === 'specific') return doc.target_user_ids.map(String);
  const users = await User.find({ status: 'active' }).select('_id').lean();
  return users.map((u) => String(u._id));
}

export function formatWhen(date: string, time?: string): string {
  const [y, m, d] = date.split('-');
  const day = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  if (!time) return `${day} ${d}-${m}-${y}`;
  const [hh, mm] = time.split(':').map(Number);
  const h12 = ((hh! + 11) % 12) + 1;
  return `${day} ${d}-${m}-${y}, ${h12}:${String(mm).padStart(2, '0')} ${hh! < 12 ? 'AM' : 'PM'}`;
}

async function summaryLines(doc: IScheduleEvent, date: string, time?: string, opts: { skipWhen?: boolean } = {}): Promise<string[]> {
  return [
    opts.skipWhen ? '' : `${await typeLabel(doc.kind)} · ${formatWhen(date, time)}`,
    !opts.skipWhen && doc.recurrence?.freq && doc.recurrence.freq !== 'none' ? describeRecurrence(recurrenceOf(doc), doc.date) : '',
    doc.location ? `Venue: ${doc.location}` : '',
    doc.attachments?.length ? `${doc.attachments.length} document(s) attached` : '',
    doc.links?.length ? `${doc.links.length} related process/checklist item(s) — open the schedule for details` : '',
  ].filter(Boolean);
}

async function notifyRecipients(doc: IScheduleEvent, title: string, lines: string[]) {
  await deliverSystemNotification({
    userIds: await resolveRecipients(doc),
    title,
    message: lines.join('\n'),
    createdBy: String(doc.updated_by ?? doc.created_by),
    link: `/schedule?event=${String(doc._id)}`,
    data: { type: 'schedule', event_id: String(doc._id) },
  });
}

/* ------------------------------ R&R profile ------------------------------ */

export async function getProfile(userId: string): Promise<ScheduleProfileRecord> {
  const doc = await ScheduleProfile.findOne({ user_id: userId }).lean();
  return {
    joining_date: doc?.joining_date || undefined,
    rr_history: (doc?.rr_history ?? []).map((h) => ({
      start_date: h.start_date,
      end_date: h.end_date || undefined,
      note: h.note || undefined,
    })),
    rr_reminders: doc?.rr_reminders ?? true,
  };
}

export async function updateProfile(userId: string, body: unknown): Promise<ScheduleProfileRecord> {
  const parsed = scheduleProfileSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const d = parsed.data;
  const today = bdTodayStr();
  if (d.joining_date && d.joining_date > today) throw badRequest('Joining date cannot be in the future');
  const history = [...d.rr_history]
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .map((h) => ({ start_date: h.start_date, end_date: h.end_date || undefined, note: h.note || undefined }));
  await ScheduleProfile.updateOne(
    { user_id: userId },
    d.joining_date
      ? { $set: { joining_date: d.joining_date, rr_history: history, rr_reminders: d.rr_reminders } }
      : { $set: { rr_history: history, rr_reminders: d.rr_reminders }, $unset: { joining_date: 1 } },
    { upsert: true },
  );
  return getProfile(userId);
}

export async function getRestRecreation(userId: string): Promise<{
  profile: ScheduleProfileRecord;
  settings: ScheduleSettingsRecord;
  status: RestRecreationStatus;
}> {
  const [profile, settings] = await Promise.all([getProfile(userId), getSettings()]);
  return { profile, settings, status: computeRestRecreation(profile, settings) };
}
