import mongoose, { type FilterQuery } from 'mongoose';
import {
  createCircularSchema,
  renameCircularTagSchema,
  updateCircularSchema,
  type CircularFacets,
  type CircularFieldSuggestions,
  type CircularListQuery,
  type CircularRecord,
  type CircularTagCount,
} from '@ibas/shared-types';
import { assertAreaCodes, type AreaIndex } from './areas.service.js';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import type { ModuleAccessChecker } from '../../middleware/moduleAccessChecker.js';
import { ToolkitItem } from '../toolkit/models/ToolkitItem.model.js';
import { Circular, type ICircular } from './models/Circular.model.js';
import { containsRegex, escapeRegex } from './text.js';

/** Module grants that open the Circular Archive (circulars are also part of Books & Tools). */
export const CIRCULAR_MODULE_CODES = ['CIRCULARS', 'BOOKS'];

type CircularLean = Pick<
  ICircular,
  | 'circular_no'
  | 'title'
  | 'title_bn'
  | 'summary'
  | 'full_text'
  | 'issuer'
  | 'ministry'
  | 'department'
  | 'issuer_detail'
  | 'order_by'
  | 'order_by_designation'
  | 'doc_type'
  | 'issue_date'
  | 'effective_date'
  | 'collections'
  | 'areas'
  | 'tags'
  | 'attachment_url'
  | 'source_url'
  | 'supersedes_ids'
  | 'checklist'
  | 'note'
  | 'toolkit_ids'
  | 'is_published'
  | 'created_at'
  | 'updated_at'
> & { _id: mongoose.Types.ObjectId };

type Ref = { id: string; circular_no: string; title: string };

function toRecord(doc: CircularLean, supersedes: Ref[] = [], supersededBy: Ref[] = [], detail = true): CircularRecord {
  return {
    id: String(doc._id),
    circular_no: doc.circular_no,
    title: doc.title,
    title_bn: doc.title_bn || undefined,
    summary: doc.summary || undefined,
    full_text: detail ? doc.full_text || undefined : undefined,
    issuer: doc.issuer as CircularRecord['issuer'],
    ministry: doc.ministry || undefined,
    department: doc.department || undefined,
    issuer_detail: doc.issuer_detail || undefined,
    order_by: doc.order_by || undefined,
    order_by_designation: doc.order_by_designation || undefined,
    doc_type: doc.doc_type as CircularRecord['doc_type'],
    issue_date: doc.issue_date,
    effective_date: doc.effective_date || undefined,
    collections: (doc.collections ?? []) as CircularRecord['collections'],
    areas: (doc.areas ?? []) as CircularRecord['areas'],
    tags: doc.tags ?? [],
    attachment_url: doc.attachment_url || undefined,
    source_url: doc.source_url || undefined,
    supersedes,
    superseded_by: supersededBy,
    checklist_count: doc.checklist?.length ?? 0,
    checklist: detail ? (doc.checklist ?? []).map((c) => ({ id: c.id, text: c.text, required: c.required })) : undefined,
    note: detail ? doc.note || undefined : undefined,
    is_published: doc.is_published,
    created_at: doc.created_at?.toISOString?.() ?? '',
    updated_at: doc.updated_at?.toISOString?.() ?? '',
  };
}

function baseFilter(includeUnpublished: boolean): FilterQuery<ICircular> {
  return includeUnpublished ? { is_active: true } : { is_active: true, is_published: true };
}

const LIST_SELECT = '-full_text -note -checklist.text -toolkit_ids';

export async function listCirculars(query: CircularListQuery, canSeeUnpublished: boolean) {
  const filter = baseFilter(canSeeUnpublished && Boolean(query.include_unpublished));
  if (query.q) {
    const rx = containsRegex(query.q);
    filter.$or = [
      { title: rx },
      { title_bn: rx },
      { circular_no: rx },
      { summary: rx },
      { tags: rx },
      { ministry: rx },
      { department: rx },
      { issuer_detail: rx },
      { order_by: rx },
      { full_text: rx },
    ];
  }
  if (query.issuer) filter.issuer = query.issuer;
  if (query.doc_type) filter.doc_type = query.doc_type;
  if (query.collection) filter.collections = query.collection;
  if (query.area) filter.areas = query.area;
  if (query.tag) filter.tags = query.tag;
  if (query.year) filter.issue_date = { $regex: `^${query.year}-` };

  const dir = query.sort === 'oldest' ? 1 : -1;
  const [docs, total] = await Promise.all([
    Circular.find(filter)
      .sort({ issue_date: dir, created_at: dir })
      .skip(query.offset)
      .limit(query.limit)
      .select(LIST_SELECT)
      .lean<CircularLean[]>(),
    Circular.countDocuments(filter),
  ]);
  const newer = docs.length
    ? await Circular.find({ supersedes_ids: { $in: docs.map((d) => d._id) }, ...baseFilter(false) })
        .select('circular_no title supersedes_ids')
        .lean<CircularLean[]>()
    : [];
  const supersededBy = (id: string): Ref[] =>
    newer
      .filter((n) => n.supersedes_ids?.some((s) => String(s) === id))
      .map((n) => ({ id: String(n._id), circular_no: n.circular_no, title: n.title }));
  return { items: docs.map((d) => toRecord(d, [], supersededBy(String(d._id)), false)), total };
}

export async function circularFacets(): Promise<CircularFacets> {
  const filter = baseFilter(false);
  const [dates, tags, total] = await Promise.all([
    Circular.distinct('issue_date', filter),
    listTags(false, '', 40),
    Circular.countDocuments(filter),
  ]);
  const years = [...new Set((dates as string[]).map((d) => Number(d.slice(0, 4))).filter(Boolean))].sort((a, b) => b - a);
  return { years, tags, total };
}

async function loadCircular(id: string, canSeeUnpublished: boolean): Promise<CircularLean> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Circular not found');
  const doc = await Circular.findOne({ _id: id, ...baseFilter(canSeeUnpublished) }).lean<CircularLean>();
  if (!doc) throw notFound('Circular not found');
  return doc;
}

/** Circular Archive or Books & Tools grant, or access to any iBAS++ area the circular is filed under. */
export function canViewCircular(checker: ModuleAccessChecker, index: AreaIndex, areas: string[]): boolean {
  if (checker.canRead(CIRCULAR_MODULE_CODES)) return true;
  return areas.some((a) => index.get(a)?.is_active && checker.stateForPrimary(a, index.accessCodes(a)) === 'open');
}

export async function getCircularAreas(id: string, canSeeUnpublished: boolean): Promise<string[]> {
  return (await loadCircular(id, canSeeUnpublished)).areas ?? [];
}

export async function getCircular(id: string, canSeeUnpublished: boolean): Promise<CircularRecord> {
  const doc = await loadCircular(id, canSeeUnpublished);
  const visible = baseFilter(canSeeUnpublished);
  const [older, newer, kits] = await Promise.all([
    doc.supersedes_ids?.length
      ? Circular.find({ _id: { $in: doc.supersedes_ids }, ...visible }).select('circular_no title').lean<CircularLean[]>()
      : Promise.resolve([] as CircularLean[]),
    Circular.find({ supersedes_ids: doc._id, ...visible }).select('circular_no title').lean<CircularLean[]>(),
    doc.toolkit_ids?.length
      ? ToolkitItem.find({
          _id: { $in: doc.toolkit_ids },
          is_active: true,
          ...(canSeeUnpublished ? {} : { is_published: true }),
        })
          .select('title kind is_published')
          .lean()
      : Promise.resolve([]),
  ]);
  const ref = (d: CircularLean): Ref => ({ id: String(d._id), circular_no: d.circular_no, title: d.title });
  const kitById = new Map(kits.map((k) => [String(k._id), k]));
  return {
    ...toRecord(doc, older.map(ref), newer.map(ref)),
    toolkit: (doc.toolkit_ids ?? [])
      .map((id) => kitById.get(String(id)))
      .filter((k): k is NonNullable<typeof k> => !!k)
      .map((k) => ({ id: String(k._id), title: k.title, kind: k.kind, is_published: k.is_published })),
  };
}

/* ------------------------------ tags ------------------------------ */

const cleanTag = (t: string) => t.replace(/\s+/g, ' ').trim();

/**
 * Dedupes tags case-insensitively and reuses the spelling already in use ("eft" → "EFT"), so one
 * tag is shared by every circular that uses it.
 */
async function canonicalTags(tags: string[]): Promise<string[]> {
  const cleaned = tags.map(cleanTag).filter(Boolean);
  if (cleaned.length === 0) return [];
  const existing = (await Circular.distinct('tags', {
    tags: { $in: cleaned.map((t) => new RegExp(`^${escapeRegex(t)}$`, 'i')) },
  })) as string[];
  const byLower = new Map(existing.map((t) => [t.toLowerCase(), t]));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of cleaned) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(byLower.get(key) ?? t);
  }
  return out;
}

export async function listTags(includeUnpublished: boolean, q = '', limit = 200): Promise<CircularTagCount[]> {
  const rows = await Circular.aggregate<{ _id: string; count: number }>([
    { $match: baseFilter(includeUnpublished) },
    { $unwind: '$tags' },
    ...(q.trim() ? [{ $match: { tags: containsRegex(q.trim()) } }] : []),
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: Math.min(Math.max(limit, 1), 500) },
  ]);
  return rows.map((r) => ({ tag: r._id, count: r.count }));
}

/** Renames a tag on every circular; if the new name already exists the two tags are merged. */
export async function renameTag(body: unknown): Promise<{ updated: number }> {
  const parsed = renameCircularTagSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
  const from = parsed.data.from;
  const wanted = cleanTag(parsed.data.to);
  const to = wanted.toLowerCase() === from.toLowerCase() ? wanted : (await canonicalTags([wanted]))[0]!;
  if (!to || from === to) return { updated: 0 };
  const res = await Circular.updateMany({ tags: from }, [
    {
      $set: {
        tags: {
          $concatArrays: [
            { $filter: { input: '$tags', cond: { $and: [{ $ne: ['$$this', from] }, { $ne: ['$$this', to] }] } } },
            [to],
          ],
        },
      },
    },
  ]);
  return { updated: res.modifiedCount };
}

export async function deleteTag(tag: string): Promise<{ updated: number }> {
  if (!tag.trim()) throw badRequest('Tag is required');
  const res = await Circular.updateMany({ tags: tag }, { $pull: { tags: tag } });
  return { updated: res.modifiedCount };
}

export async function fieldSuggestions(): Promise<CircularFieldSuggestions> {
  const filter = { is_active: true };
  const distinct = async (field: keyof CircularFieldSuggestions) =>
    ((await Circular.distinct(field, filter)) as string[])
      .map((v) => v?.trim())
      .filter((v): v is string => !!v)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 300);
  const [ministry, department, issuer_detail, order_by, order_by_designation] = await Promise.all([
    distinct('ministry'),
    distinct('department'),
    distinct('issuer_detail'),
    distinct('order_by'),
    distinct('order_by_designation'),
  ]);
  return { ministry, department, issuer_detail, order_by, order_by_designation };
}

/* ------------------------------ writes ------------------------------ */

async function assertToolkitIds(ids: string[] | undefined) {
  if (!ids?.length) return;
  const found = await ToolkitItem.countDocuments({ _id: { $in: ids }, is_active: true });
  if (found !== new Set(ids).size) throw badRequest('A linked Toolkit checklist no longer exists');
}

async function normalize<
  T extends { tags?: string[]; effective_date?: string; attachment_url?: string; source_url?: string; toolkit_ids?: string[] },
>(data: T): Promise<T> {
  return {
    ...data,
    tags: data.tags ? await canonicalTags(data.tags) : data.tags,
    toolkit_ids: data.toolkit_ids ? [...new Set(data.toolkit_ids)] : data.toolkit_ids,
    effective_date: data.effective_date === '' ? undefined : data.effective_date,
    attachment_url: data.attachment_url === '' ? undefined : data.attachment_url,
    source_url: data.source_url === '' ? undefined : data.source_url,
  };
}

function issues(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
}

export async function createCircular(body: unknown, userId: string): Promise<CircularRecord> {
  const parsed = createCircularSchema.safeParse(body);
  if (!parsed.success) throw badRequest(issues(parsed.error));
  await assertAreaCodes(parsed.data.areas);
  await assertToolkitIds(parsed.data.toolkit_ids);
  const doc = await Circular.create({ ...(await normalize(parsed.data)), created_by: userId });
  return getCircular(String(doc._id), true);
}

export async function updateCircular(id: string, body: unknown, userId: string): Promise<CircularRecord> {
  const parsed = updateCircularSchema.safeParse(body);
  if (!parsed.success) throw badRequest(issues(parsed.error));
  await loadCircular(id, true);
  await assertAreaCodes(parsed.data.areas);
  await assertToolkitIds(parsed.data.toolkit_ids);
  const data = await normalize(parsed.data);
  if (data.supersedes_ids?.includes(id)) throw badRequest('A circular cannot supersede itself');
  const unset: Record<string, 1> = {};
  for (const key of ['effective_date', 'attachment_url', 'source_url'] as const) {
    if (key in parsed.data && data[key] === undefined) unset[key] = 1;
  }
  const set = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  await Circular.updateOne(
    { _id: id },
    { $set: { ...set, updated_by: userId }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
  );
  return getCircular(id, true);
}

export async function deleteCircular(id: string): Promise<void> {
  await loadCircular(id, true);
  await Circular.updateOne({ _id: id }, { $set: { is_active: false, is_published: false } });
}
