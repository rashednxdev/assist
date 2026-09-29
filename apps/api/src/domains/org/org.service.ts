import mongoose, { type Types } from 'mongoose';
import {
  designationInputSchema,
  officeInputSchema,
  officeQuerySchema,
  officeTypeInputSchema,
  updateWorkIdentitySchema,
  type DesignationRecord,
  type OfficeOption,
  type OfficeRecord,
  type OfficeTypeRecord,
  type WorkIdentity,
} from '@ibas/shared-types';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { User } from '../users/models/User.model.js';
import { District } from '../setup/models/District.model.js';
import { Thana } from '../setup/models/Thana.model.js';
import { OfficeType, type IOfficeType } from './models/OfficeType.model.js';
import { Designation, type IDesignation } from './models/Designation.model.js';
import { Office, type IOffice } from './models/Office.model.js';

function zodMessage(err: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return err.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
}

function oid(id: string, what: string): Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) throw notFound(`${what} not found`);
  return new mongoose.Types.ObjectId(id);
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

async function countBy(model: mongoose.Model<never>, field: string, filter: Record<string, unknown> = {}): Promise<Map<string, number>> {
  const rows = await model.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { ...filter, [field]: { $ne: null } } },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

/* ------------------------------- office index ------------------------------- */

export interface IndexedOffice {
  id: string;
  name: string;
  short_name?: string;
  office_code?: string;
  parent_id: string | null;
  office_type_id: string;
  is_active: boolean;
}

let indexCache: { at: number; map: Map<string, IndexedOffice> } | null = null;
const INDEX_TTL_MS = 60_000;

function invalidateOffices(): void {
  indexCache = null;
}

export async function officeIndex(): Promise<Map<string, IndexedOffice>> {
  if (indexCache && Date.now() - indexCache.at < INDEX_TTL_MS) return indexCache.map;
  const rows = await Office.find({}).select('name short_name office_code parent_id office_type_id is_active').lean();
  const map = new Map<string, IndexedOffice>(
    rows.map((o) => [
      String(o._id),
      {
        id: String(o._id),
        name: o.name,
        short_name: o.short_name || undefined,
        office_code: o.office_code || undefined,
        parent_id: o.parent_id ? String(o.parent_id) : null,
        office_type_id: String(o.office_type_id),
        is_active: o.is_active,
      },
    ]),
  );
  indexCache = { at: Date.now(), map };
  return map;
}

/** Ancestor names, top first, e.g. "Finance Division › CGA Office". */
export function parentPath(map: Map<string, IndexedOffice>, parentId: string | null): string {
  return ancestorChain(map, parentId)
    .map((n) => n.short_name || n.name)
    .join(' › ');
}

/** Offices from the top down to (and including) `id`. */
export function ancestorChain(map: Map<string, IndexedOffice>, id: string | null): IndexedOffice[] {
  const chain: IndexedOffice[] = [];
  const seen = new Set<string>();
  let cur = id;
  while (cur && !seen.has(cur) && chain.length < 12) {
    seen.add(cur);
    const node = map.get(cur);
    if (!node) break;
    chain.unshift(node);
    cur = node.parent_id;
  }
  return chain;
}

/** `id` plus every office below it. */
export function subtreeIds(map: Map<string, IndexedOffice>, id: string, activeOnly = true): string[] {
  const kids = new Map<string, string[]>();
  for (const o of map.values()) {
    if (!o.parent_id || (activeOnly && !o.is_active)) continue;
    kids.set(o.parent_id, [...(kids.get(o.parent_id) ?? []), o.id]);
  }
  const out: string[] = [];
  const stack = [id];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    stack.push(...(kids.get(cur) ?? []));
  }
  return out;
}

/* ------------------------------- office types ------------------------------- */

function toOfficeType(d: IOfficeType, counts: Map<string, number>): OfficeTypeRecord {
  return {
    id: String(d._id),
    name: d.name,
    name_bn: d.name_bn || undefined,
    short_name: d.short_name,
    serial_no: d.serial_no ?? 0,
    is_active: d.is_active,
    office_count: counts.get(String(d._id)) ?? 0,
  };
}

export async function listOfficeTypes(includeInactive: boolean): Promise<OfficeTypeRecord[]> {
  const [docs, counts] = await Promise.all([
    OfficeType.find(includeInactive ? {} : { is_active: true }).sort({ serial_no: 1, name: 1 }),
    countBy(Office as never, 'office_type_id'),
  ]);
  return docs.map((d) => toOfficeType(d, counts));
}

export async function createOfficeType(body: unknown, userId: string): Promise<OfficeTypeRecord> {
  const parsed = officeTypeInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const dup = await OfficeType.findOne({ name: new RegExp(`^${escapeRx(parsed.data.name)}$`, 'i') });
  if (dup) throw badRequest('An office type with this name already exists');
  const doc = await OfficeType.create({ ...parsed.data, updated_by: userId });
  return toOfficeType(doc, new Map());
}

export async function updateOfficeType(id: string, body: unknown, userId: string): Promise<OfficeTypeRecord> {
  const doc = await OfficeType.findById(oid(id, 'Office type'));
  if (!doc) throw notFound('Office type not found');
  const parsed = officeTypeInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const dup = await OfficeType.findOne({ _id: { $ne: doc._id }, name: new RegExp(`^${escapeRx(parsed.data.name)}$`, 'i') });
  if (dup) throw badRequest('An office type with this name already exists');
  Object.assign(doc, parsed.data, { updated_by: userId });
  await doc.save();
  return toOfficeType(doc, await countBy(Office as never, 'office_type_id', { office_type_id: doc._id }));
}

export async function deleteOfficeType(id: string): Promise<void> {
  const doc = await OfficeType.findById(oid(id, 'Office type'));
  if (!doc) throw notFound('Office type not found');
  const used = await Office.countDocuments({ office_type_id: doc._id });
  if (used > 0) throw badRequest(`${used} office(s) use this type. Change them first, or turn the type off.`);
  await doc.deleteOne();
}

/* ------------------------------- designations ------------------------------- */

function toDesignation(d: IDesignation, counts: Map<string, number>): DesignationRecord {
  return {
    id: String(d._id),
    name: d.name,
    name_bn: d.name_bn || undefined,
    short_name: d.short_name,
    grade: d.grade ?? null,
    serial_no: d.serial_no ?? 0,
    is_active: d.is_active,
    user_count: counts.get(String(d._id)) ?? 0,
  };
}

export async function listDesignations(includeInactive: boolean): Promise<DesignationRecord[]> {
  const [docs, counts] = await Promise.all([
    Designation.find(includeInactive ? {} : { is_active: true }).sort({ serial_no: 1, grade: 1, name: 1 }),
    includeInactive ? countBy(User as never, 'designation_id') : Promise.resolve(new Map<string, number>()),
  ]);
  return docs.map((d) => toDesignation(d, counts));
}

export async function createDesignation(body: unknown, userId: string): Promise<DesignationRecord> {
  const parsed = designationInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const dup = await Designation.findOne({ name: new RegExp(`^${escapeRx(parsed.data.name)}$`, 'i') });
  if (dup) throw badRequest('A designation with this name already exists');
  const doc = await Designation.create({ ...parsed.data, updated_by: userId });
  return toDesignation(doc, new Map());
}

export async function updateDesignation(id: string, body: unknown, userId: string): Promise<DesignationRecord> {
  const doc = await Designation.findById(oid(id, 'Designation'));
  if (!doc) throw notFound('Designation not found');
  const parsed = designationInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const dup = await Designation.findOne({ _id: { $ne: doc._id }, name: new RegExp(`^${escapeRx(parsed.data.name)}$`, 'i') });
  if (dup) throw badRequest('A designation with this name already exists');
  Object.assign(doc, parsed.data, { updated_by: userId });
  await doc.save();
  return toDesignation(doc, await countBy(User as never, 'designation_id', { designation_id: doc._id }));
}

export async function deleteDesignation(id: string): Promise<void> {
  const doc = await Designation.findById(oid(id, 'Designation'));
  if (!doc) throw notFound('Designation not found');
  const used = await User.countDocuments({ designation_id: doc._id });
  if (used > 0) throw badRequest(`${used} user(s) have this designation. Turn it off instead.`);
  await doc.deleteOne();
}

/* ---------------------------------- offices --------------------------------- */

async function toOfficeRecords(docs: IOffice[]): Promise<OfficeRecord[]> {
  const typeIds = [...new Set(docs.map((d) => String(d.office_type_id)))];
  const districtIds = [...new Set(docs.map((d) => d.district_id && String(d.district_id)).filter(Boolean))] as string[];
  const thanaIds = [...new Set(docs.map((d) => d.thana_id && String(d.thana_id)).filter(Boolean))] as string[];
  const ids = docs.map((d) => d._id);
  const [map, types, districts, thanas, children, users] = await Promise.all([
    officeIndex(),
    OfficeType.find({ _id: { $in: typeIds } }).select('name short_name').lean(),
    districtIds.length ? District.find({ _id: { $in: districtIds } }).select('name_en').lean() : [],
    thanaIds.length ? Thana.find({ _id: { $in: thanaIds } }).select('name_en').lean() : [],
    countBy(Office as never, 'parent_id', { parent_id: { $in: ids } }),
    countBy(User as never, 'office_id', { office_id: { $in: ids } }),
  ]);
  const typeMap = new Map(types.map((t) => [String(t._id), t]));
  const distMap = new Map(districts.map((d) => [String(d._id), d.name_en]));
  const thanaMap = new Map(thanas.map((t) => [String(t._id), t.name_en]));
  return docs.map((d) => {
    const t = typeMap.get(String(d.office_type_id));
    const parentId = d.parent_id ? String(d.parent_id) : null;
    return {
      id: String(d._id),
      name: d.name,
      name_bn: d.name_bn || undefined,
      short_name: d.short_name || undefined,
      office_code: d.office_code || undefined,
      office_type: t ? { id: String(t._id), name: t.name, short_name: t.short_name } : null,
      parent_id: parentId,
      parent_path: parentPath(map, parentId),
      email: d.email || undefined,
      mobile: d.mobile || undefined,
      telephone: d.telephone || undefined,
      pabx: d.pabx || undefined,
      fax: d.fax || undefined,
      address: d.address || undefined,
      district_id: d.district_id ? String(d.district_id) : null,
      thana_id: d.thana_id ? String(d.thana_id) : null,
      district_name: d.district_id ? distMap.get(String(d.district_id)) : undefined,
      thana_name: d.thana_id ? thanaMap.get(String(d.thana_id)) : undefined,
      web_address: d.web_address || undefined,
      description: d.description || undefined,
      serial_no: d.serial_no ?? 0,
      is_active: d.is_active,
      child_count: children.get(String(d._id)) ?? 0,
      user_count: users.get(String(d._id)) ?? 0,
    };
  });
}

/** Admin list: every office (optionally filtered), with parent paths for the tree. */
export async function listOfficesAdmin(query: unknown): Promise<OfficeRecord[]> {
  const parsed = officeQuerySchema.safeParse(query);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const q = parsed.data;
  const filter: Record<string, unknown> = {};
  if (!q.include_inactive) filter.is_active = true;
  if (q.office_type_id) filter.office_type_id = new mongoose.Types.ObjectId(q.office_type_id);
  if (q.q) {
    const rx = new RegExp(escapeRx(q.q), 'i');
    filter.$or = [{ name: rx }, { name_bn: rx }, { short_name: rx }, { office_code: rx }, { email: rx }];
  }
  const docs = await Office.find(filter).sort({ serial_no: 1, name: 1 }).limit(2000);
  return toOfficeRecords(docs);
}

/** Picker search over active offices; matches the office or any of its ancestors' names. */
export async function officeOptions(query: unknown): Promise<OfficeOption[]> {
  const parsed = officeQuerySchema.safeParse(query);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const { q, limit, office_type_id } = parsed.data;
  const [map, types] = await Promise.all([officeIndex(), OfficeType.find({}).select('short_name').lean()]);
  const typeShort = new Map(types.map((t) => [String(t._id), t.short_name]));
  const terms = (q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const out: Array<OfficeOption & { score: number }> = [];
  for (const o of map.values()) {
    if (!o.is_active) continue;
    if (office_type_id && o.office_type_id !== office_type_id) continue;
    const path = parentPath(map, o.parent_id);
    const own = `${o.name} ${o.short_name ?? ''} ${o.office_code ?? ''}`.toLowerCase();
    const hay = `${own} ${path.toLowerCase()}`;
    if (terms.length && !terms.every((t) => hay.includes(t))) continue;
    const score = terms.length ? (terms.every((t) => own.includes(t)) ? 0 : 1) : path ? 1 : 0;
    out.push({
      id: o.id,
      name: o.name,
      short_name: o.short_name,
      office_code: o.office_code,
      type_short: typeShort.get(o.office_type_id),
      parent_path: path,
      score,
    });
  }
  out.sort((a, b) => a.score - b.score || a.parent_path.localeCompare(b.parent_path) || a.name.localeCompare(b.name));
  return out.slice(0, limit).map(({ score: _score, ...o }) => o);
}

export async function getOffice(id: string): Promise<OfficeRecord> {
  const doc = await Office.findById(oid(id, 'Office'));
  if (!doc) throw notFound('Office not found');
  return (await toOfficeRecords([doc]))[0]!;
}

async function validateOfficeRefs(
  data: ReturnType<typeof officeInputSchema.parse>,
  selfId: string | null,
): Promise<void> {
  const type = await OfficeType.findById(data.office_type_id).select('_id').lean();
  if (!type) throw badRequest('Choose a valid office type');
  if (data.parent_id) {
    if (selfId && data.parent_id === selfId) throw badRequest('An office cannot be its own parent');
    const map = await officeIndex();
    if (!map.has(data.parent_id)) {
      invalidateOffices();
      const parent = await Office.findById(data.parent_id).select('_id').lean();
      if (!parent) throw badRequest('Parent office not found');
    }
    if (selfId) {
      const fresh = await officeIndex();
      let cur: string | null = data.parent_id;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        if (cur === selfId) throw badRequest('That parent is already under this office — pick a different parent');
        seen.add(cur);
        cur = fresh.get(cur)?.parent_id ?? null;
      }
    }
  }
  if (data.thana_id && !data.district_id) throw badRequest('Choose the district before the upazila/thana');
  if (data.district_id) {
    const d = await District.findById(data.district_id).select('_id').lean();
    if (!d) throw badRequest('District not found');
  }
  if (data.thana_id) {
    const t = await Thana.findById(data.thana_id).select('district_id').lean();
    if (!t || String(t.district_id) !== data.district_id) throw badRequest('That upazila/thana is not in the selected district');
  }
}

function officeFields(data: ReturnType<typeof officeInputSchema.parse>) {
  return {
    ...data,
    office_code: data.office_code || undefined,
    parent_id: data.parent_id ? new mongoose.Types.ObjectId(data.parent_id) : null,
    district_id: data.district_id ? new mongoose.Types.ObjectId(data.district_id) : null,
    thana_id: data.thana_id ? new mongoose.Types.ObjectId(data.thana_id) : null,
    office_type_id: new mongoose.Types.ObjectId(data.office_type_id),
  };
}

export async function createOffice(body: unknown, userId: string): Promise<OfficeRecord> {
  const parsed = officeInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  await validateOfficeRefs(parsed.data, null);
  try {
    const doc = await Office.create({ ...officeFields(parsed.data), updated_by: userId });
    invalidateOffices();
    return (await toOfficeRecords([doc]))[0]!;
  } catch (err) {
    if (isDuplicateKey(err)) throw badRequest('Another office already uses this office code');
    throw err;
  }
}

export async function updateOffice(id: string, body: unknown, userId: string): Promise<OfficeRecord> {
  const doc = await Office.findById(oid(id, 'Office'));
  if (!doc) throw notFound('Office not found');
  const parsed = officeInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  await validateOfficeRefs(parsed.data, String(doc._id));
  const fields = officeFields(parsed.data);
  doc.set({ ...fields, updated_by: userId });
  if (!fields.office_code) doc.set('office_code', undefined);
  try {
    await doc.save();
  } catch (err) {
    if (isDuplicateKey(err)) throw badRequest('Another office already uses this office code');
    throw err;
  }
  invalidateOffices();
  return (await toOfficeRecords([doc]))[0]!;
}

export async function deleteOffice(id: string): Promise<void> {
  const doc = await Office.findById(oid(id, 'Office'));
  if (!doc) throw notFound('Office not found');
  const [children, users] = await Promise.all([Office.countDocuments({ parent_id: doc._id }), User.countDocuments({ office_id: doc._id })]);
  if (children > 0) throw badRequest(`This office has ${children} sub-office(s). Move or delete them first.`);
  if (users > 0) throw badRequest(`${users} user(s) belong to this office. Turn it off instead.`);
  await doc.deleteOne();
  invalidateOffices();
}

/* ------------------------------- work identity ------------------------------ */

export async function getWorkIdentity(userId: string): Promise<WorkIdentity> {
  const user = await User.findById(userId).select('office_id designation_id').lean();
  if (!user) throw notFound('User not found');
  const [map, types, designation] = await Promise.all([
    user.office_id ? officeIndex() : Promise.resolve(null),
    user.office_id ? OfficeType.find({}).select('short_name').lean() : Promise.resolve([]),
    user.designation_id ? Designation.findById(user.designation_id).select('name short_name grade').lean() : Promise.resolve(null),
  ]);
  const o = user.office_id && map ? map.get(String(user.office_id)) : undefined;
  const typeShort = new Map(types.map((t) => [String(t._id), t.short_name]));
  return {
    office_id: user.office_id ? String(user.office_id) : null,
    designation_id: user.designation_id ? String(user.designation_id) : null,
    office: o
      ? {
          id: o.id,
          name: o.name,
          short_name: o.short_name,
          office_code: o.office_code,
          type_short: typeShort.get(o.office_type_id),
          parent_path: parentPath(map!, o.parent_id),
        }
      : null,
    designation: designation
      ? { id: String(designation._id), name: designation.name, short_name: designation.short_name, grade: designation.grade ?? null }
      : null,
  };
}

export async function setWorkIdentity(userId: string, body: unknown): Promise<WorkIdentity> {
  const parsed = updateWorkIdentitySchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const [office, designation] = await Promise.all([
    Office.findOne({ _id: parsed.data.office_id, is_active: true }).select('_id').lean(),
    Designation.findOne({ _id: parsed.data.designation_id, is_active: true }).select('_id').lean(),
  ]);
  if (!office) throw badRequest('Choose a valid office');
  if (!designation) throw badRequest('Choose a valid designation');
  await User.updateOne(
    { _id: userId },
    { $set: { office_id: office._id, designation_id: designation._id } },
  );
  return getWorkIdentity(userId);
}

export interface WorkSnapshot {
  office_id: Types.ObjectId;
  office_name: string;
  office_short?: string;
  designation_id: Types.ObjectId;
  designation_name: string;
  designation_short?: string;
}

/** Office + designation copied onto a post; null when the user hasn't set a valid one. */
export async function workSnapshot(userId: string): Promise<WorkSnapshot | null> {
  const user = await User.findById(userId).select('office_id designation_id').lean();
  if (!user?.office_id || !user.designation_id) return null;
  const [office, designation] = await Promise.all([
    Office.findOne({ _id: user.office_id, is_active: true }).select('name short_name').lean(),
    Designation.findOne({ _id: user.designation_id, is_active: true }).select('name short_name').lean(),
  ]);
  if (!office || !designation) return null;
  return {
    office_id: office._id,
    office_name: office.name,
    office_short: office.short_name || undefined,
    designation_id: designation._id,
    designation_name: designation.name,
    designation_short: designation.short_name || undefined,
  };
}

/** Current office/designation names for many users (fallback for posts written before snapshots). */
export async function workLabels(userIds: string[]): Promise<Map<string, Omit<WorkSnapshot, 'office_id' | 'designation_id'>>> {
  const out = new Map<string, Omit<WorkSnapshot, 'office_id' | 'designation_id'>>();
  if (userIds.length === 0) return out;
  const users = await User.find({ _id: { $in: userIds }, office_id: { $ne: null }, designation_id: { $ne: null } })
    .select('office_id designation_id')
    .lean();
  if (users.length === 0) return out;
  const [offices, designations] = await Promise.all([
    Office.find({ _id: { $in: users.map((u) => u.office_id) } }).select('name short_name').lean(),
    Designation.find({ _id: { $in: users.map((u) => u.designation_id) } }).select('name short_name').lean(),
  ]);
  const om = new Map(offices.map((o) => [String(o._id), o]));
  const dm = new Map(designations.map((d) => [String(d._id), d]));
  for (const u of users) {
    const o = om.get(String(u.office_id));
    const d = dm.get(String(u.designation_id));
    if (!o || !d) continue;
    out.set(String(u._id), {
      office_name: o.name,
      office_short: o.short_name || undefined,
      designation_name: d.name,
      designation_short: d.short_name || undefined,
    });
  }
  return out;
}
