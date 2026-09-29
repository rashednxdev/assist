import mongoose from 'mongoose';
import { SCHEDULE_KINDS, scheduleTypeInputSchema, type ScheduleTypeRecord } from '@ibas/shared-types';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { ScheduleEvent } from './models/ScheduleEvent.model.js';
import { ScheduleType, type IScheduleType } from './models/ScheduleType.model.js';

const CACHE_MS = 30_000;
let cache: { at: number; byCode: Map<string, ScheduleTypeRecord> } | null = null;

function toRecord(doc: IScheduleType): ScheduleTypeRecord {
  return {
    id: String(doc._id),
    code: doc.code,
    label: doc.label,
    label_bn: doc.label_bn || undefined,
    description: doc.description || undefined,
    color: doc.color,
    default_reminders: doc.default_reminders ?? [],
    allow_personal: doc.allow_personal,
    sort_order: doc.sort_order,
    is_active: doc.is_active,
    is_system: doc.is_system,
  };
}

function zodMessage(err: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return err.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
}

/** Inserts missing built-in types; never overwrites admin edits. */
export async function ensureDefaultScheduleTypes(): Promise<void> {
  await ScheduleType.bulkWrite(
    SCHEDULE_KINDS.map((k, idx) => ({
      updateOne: {
        filter: { code: k.code },
        update: {
          $setOnInsert: {
            code: k.code,
            label: k.label,
            color: k.color,
            default_reminders: [...k.reminders],
            allow_personal: k.allow_personal,
            sort_order: (idx + 1) * 10,
            is_active: true,
          },
          $set: { is_system: k.system },
        },
        upsert: true,
      },
    })),
  );
  cache = null;
}

export async function getTypeIndex(): Promise<Map<string, ScheduleTypeRecord>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.byCode;
  const docs = await ScheduleType.find().sort({ sort_order: 1, label: 1 });
  const byCode = new Map(docs.map((d) => [d.code, toRecord(d)]));
  cache = { at: Date.now(), byCode };
  return byCode;
}

export async function typeLabel(code: string): Promise<string> {
  return (await getTypeIndex()).get(code)?.label ?? code.replace(/_/g, ' ');
}

export async function listTypes(includeInactive: boolean, withUsage: boolean): Promise<ScheduleTypeRecord[]> {
  const docs = await ScheduleType.find(includeInactive ? {} : { is_active: true }).sort({ sort_order: 1, label: 1 });
  const records = docs.map(toRecord);
  if (!withUsage) return records;
  const counts = await ScheduleEvent.aggregate<{ _id: string; n: number }>([
    { $match: { is_active: true } },
    { $group: { _id: '$kind', n: { $sum: 1 } } },
  ]);
  const byCode = new Map(counts.map((c) => [c._id, c.n]));
  return records.map((r) => ({ ...r, usage_count: byCode.get(r.code) ?? 0 }));
}

export async function createType(body: unknown, userId: string): Promise<ScheduleTypeRecord> {
  const parsed = scheduleTypeInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  if (await ScheduleType.exists({ code: parsed.data.code })) throw badRequest(`Code "${parsed.data.code}" is already used`);
  const doc = await ScheduleType.create({
    ...parsed.data,
    label_bn: parsed.data.label_bn || undefined,
    description: parsed.data.description || undefined,
    is_system: false,
    updated_by: userId,
  });
  cache = null;
  return toRecord(doc);
}

async function load(id: string): Promise<IScheduleType> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Schedule type not found');
  const doc = await ScheduleType.findById(id);
  if (!doc) throw notFound('Schedule type not found');
  return doc;
}

export async function updateType(id: string, body: unknown, userId: string): Promise<ScheduleTypeRecord> {
  const doc = await load(id);
  const parsed = scheduleTypeInputSchema.safeParse({ ...(body as object), code: doc.code });
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  if (doc.code === 'rest_recreation' && parsed.data.allow_personal) {
    throw badRequest('Rest & recreation is calculated automatically and cannot be added as a personal schedule');
  }
  if (doc.is_system && !parsed.data.is_active) throw badRequest('Built-in types cannot be turned off');
  doc.set({
    label: parsed.data.label,
    label_bn: parsed.data.label_bn || undefined,
    description: parsed.data.description || undefined,
    color: parsed.data.color,
    default_reminders: [...new Set(parsed.data.default_reminders)].sort((a, b) => b - a),
    allow_personal: parsed.data.allow_personal,
    sort_order: parsed.data.sort_order,
    is_active: parsed.data.is_active,
    updated_by: userId,
  });
  await doc.save();
  cache = null;
  return toRecord(doc);
}

export async function deleteType(id: string): Promise<void> {
  const doc = await load(id);
  if (doc.is_system) throw badRequest('Built-in types cannot be deleted');
  const used = await ScheduleEvent.countDocuments({ kind: doc.code, is_active: true });
  if (used > 0) throw badRequest(`${used} schedule(s) use this type. Change them or turn the type off instead.`);
  await doc.deleteOne();
  cache = null;
}
