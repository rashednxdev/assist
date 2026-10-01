import mongoose, { type FilterQuery } from 'mongoose';
import {
  DEDUCTION_SETUP_KINDS,
  deductionEntryInputSchema,
  deductionSetupInputSchema,
  type CircularRecord,
  type DeductionEntryDetail,
  type DeductionEntryInput,
  type DeductionEntrySummary,
  type DeductionLinkedCircular,
  type DeductionLinkedProcess,
  type DeductionListQuery,
  type DeductionSetupItem,
  type DeductionSetupKind,
  type DeductionSetupRef,
} from '@ibas/shared-types';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { containsRegex } from '../policy/text.js';
import { Circular } from '../policy/models/Circular.model.js';
import { getCircular } from '../policy/circulars.service.js';
import { Task } from '../workflow/models/Task.model.js';
import { DeductionSetup, type IDeductionSetup } from './models/DeductionSetup.model.js';
import { DeductionEntry, type IDeductionEntry } from './models/DeductionEntry.model.js';

type SetupLean = Omit<IDeductionSetup, keyof mongoose.Document> & { _id: mongoose.Types.ObjectId };
type EntryLean = Omit<IDeductionEntry, keyof mongoose.Document> & { _id: mongoose.Types.ObjectId };

function zodMessage(err: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return err.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
}

function toSetupItem(d: SetupLean): DeductionSetupItem {
  return {
    id: String(d._id),
    kind: d.kind,
    code: d.code || undefined,
    name_en: d.name_en,
    name_bn: d.name_bn || undefined,
    description: d.description || undefined,
    sort_order: d.sort_order ?? 0,
    is_active: d.is_active,
  };
}

export async function listSetup(kind: string | undefined, includeInactive: boolean): Promise<DeductionSetupItem[]> {
  const filter: FilterQuery<IDeductionSetup> = {};
  if (kind) {
    if (!(DEDUCTION_SETUP_KINDS as readonly string[]).includes(kind)) throw badRequest('Unknown setup kind');
    filter.kind = kind;
  }
  if (!includeInactive) filter.is_active = true;
  const docs = await DeductionSetup.find(filter).sort({ kind: 1, sort_order: 1, code: 1, name_en: 1 }).lean<SetupLean[]>();
  return docs.map(toSetupItem);
}

export async function createSetup(body: unknown): Promise<DeductionSetupItem> {
  const parsed = deductionSetupInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const doc = await DeductionSetup.create(parsed.data);
  return toSetupItem(doc.toObject() as SetupLean);
}

export async function updateSetup(id: string, body: unknown): Promise<DeductionSetupItem> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Setup item not found');
  const doc = await DeductionSetup.findById(id);
  if (!doc) throw notFound('Setup item not found');
  const parsed = deductionSetupInputSchema.safeParse({ ...(body as object), kind: doc.kind });
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  doc.set(parsed.data);
  await doc.save();
  return toSetupItem(doc.toObject() as SetupLean);
}

export async function deactivateSetup(id: string): Promise<void> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Setup item not found');
  const res = await DeductionSetup.updateOne({ _id: id }, { $set: { is_active: false } });
  if (res.matchedCount === 0) throw notFound('Setup item not found');
}

const ref = (d: SetupLean | undefined, id: mongoose.Types.ObjectId): DeductionSetupRef =>
  d ? { id: String(d._id), code: d.code || undefined, name_en: d.name_en, name_bn: d.name_bn || undefined } : { id: String(id), name_en: 'Removed item' };

async function setupMap(docs: EntryLean[]): Promise<Map<string, SetupLean>> {
  const ids = new Set<string>();
  for (const d of docs) {
    ids.add(String(d.economic_code_id));
    ids.add(String(d.bill_type_id));
    for (const l of d.deductions ?? []) ids.add(String(l.deduction_type_id));
  }
  const setups = await DeductionSetup.find({ _id: { $in: [...ids] } }).lean<SetupLean[]>();
  return new Map(setups.map((s) => [String(s._id), s]));
}

function toSummary(d: EntryLean, map: Map<string, SetupLean>): DeductionEntrySummary {
  return {
    id: String(d._id),
    economic_code: ref(map.get(String(d.economic_code_id)), d.economic_code_id),
    bill_type: ref(map.get(String(d.bill_type_id)), d.bill_type_id),
    title: d.title || undefined,
    deductions: (d.deductions ?? []).map((l) => ({
      deduction_type: ref(map.get(String(l.deduction_type_id)), l.deduction_type_id),
      mode: l.mode,
      value: l.value ?? undefined,
      text: l.text || undefined,
      note: l.note || undefined,
    })),
    is_published: d.is_published,
    updated_at: d.updated_at?.toISOString?.() ?? '',
  };
}

const idOrNull = (v?: string) => (v && mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : null);

export async function listEntries(query: DeductionListQuery, admin: boolean): Promise<DeductionEntrySummary[]> {
  const filter: FilterQuery<IDeductionEntry> = { is_active: true };
  if (!(admin && query.include_unpublished)) filter.is_published = true;
  const eco = idOrNull(query.economic_code);
  const bill = idOrNull(query.bill_type);
  const ded = idOrNull(query.deduction_type);
  if (eco) filter.economic_code_id = eco;
  if (bill) filter.bill_type_id = bill;
  if (ded) filter['deductions.deduction_type_id'] = ded;
  if (query.q) {
    const rx = containsRegex(query.q);
    const setupIds = (await DeductionSetup.find({ $or: [{ code: rx }, { name_en: rx }, { name_bn: rx }] }).select('_id').lean()).map((s) => s._id);
    filter.$or = [
      { title: rx },
      { details: rx },
      { highlights: rx },
      { source: rx },
      { economic_code_id: { $in: setupIds } },
      { bill_type_id: { $in: setupIds } },
      { 'deductions.deduction_type_id': { $in: setupIds } },
    ];
  }
  const docs = await DeductionEntry.find(filter).select('-details -highlights -source').sort({ updated_at: -1 }).limit(500).lean<EntryLean[]>();
  const map = await setupMap(docs);
  return docs
    .map((d) => toSummary(d, map))
    .sort((a, b) => (a.economic_code.code ?? '').localeCompare(b.economic_code.code ?? '', undefined, { numeric: true }) || a.bill_type.name_en.localeCompare(b.bill_type.name_en));
}

async function loadEntry(id: string, admin: boolean): Promise<EntryLean> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Entry not found');
  const doc = await DeductionEntry.findOne({ _id: id, is_active: true, ...(admin ? {} : { is_published: true }) }).lean<EntryLean>();
  if (!doc) throw notFound('Entry not found');
  return doc;
}

export async function getEntry(id: string, admin: boolean): Promise<DeductionEntryDetail> {
  const doc = await loadEntry(id, admin);
  const [map, tasks, circulars] = await Promise.all([
    setupMap([doc]),
    Task.find({ _id: { $in: doc.process_ids ?? [] }, is_active: true }).select('name_en name_bn is_published').lean(),
    Circular.find({ _id: { $in: doc.circular_ids ?? [] }, is_active: true }).select('circular_no title issue_date attachment_url is_published').lean(),
  ]);
  const processes = (doc.process_ids ?? []).flatMap((pid): DeductionLinkedProcess[] => {
    const t = tasks.find((x) => String(x._id) === String(pid));
    if (t && (admin || t.is_published)) return [{ id: String(pid), name_en: t.name_en, name_bn: t.name_bn || undefined, missing: !t.is_published || undefined }];
    return admin ? [{ id: String(pid), name_en: 'Missing or deleted process', missing: true }] : [];
  });
  const linked = (doc.circular_ids ?? []).flatMap((cid): DeductionLinkedCircular[] => {
    const c = circulars.find((x) => String(x._id) === String(cid));
    if (c && (admin || c.is_published)) {
      return [{ id: String(cid), circular_no: c.circular_no, title: c.title, issue_date: c.issue_date || undefined, attachment_url: c.attachment_url || undefined, missing: !c.is_published || undefined }];
    }
    return admin ? [{ id: String(cid), circular_no: '—', title: 'Missing or deleted circular', missing: true }] : [];
  });
  return {
    ...toSummary(doc, map),
    details: doc.details || undefined,
    highlights: doc.highlights ?? [],
    source: doc.source || undefined,
    processes,
    circulars: linked,
  };
}

/** A circular opens for anyone when a published entry links it, even without circular-archive access. */
export async function getLinkedCircular(circularId: string, admin: boolean): Promise<CircularRecord> {
  if (!mongoose.isValidObjectId(circularId)) throw notFound('Circular not found');
  if (!admin) {
    const linked = await DeductionEntry.exists({ circular_ids: new mongoose.Types.ObjectId(circularId), is_active: true, is_published: true });
    if (!linked) throw notFound('Circular not found');
  }
  return getCircular(circularId, admin);
}

async function assertRefs(input: DeductionEntryInput): Promise<void> {
  const want: Array<[string, DeductionSetupKind, string]> = [
    [input.economic_code_id, 'economic_code', 'Economic code'],
    [input.bill_type_id, 'bill_type', 'Type of bill'],
    ...input.deductions.map((l): [string, DeductionSetupKind, string] => [l.deduction_type_id, 'deduction_type', 'Deduction type']),
  ];
  const found = await DeductionSetup.find({ _id: { $in: want.map((w) => w[0]) } }).select('kind is_active').lean<SetupLean[]>();
  for (const [id, kind, label] of want) {
    const f = found.find((x) => String(x._id) === id);
    if (!f || f.kind !== kind) throw badRequest(`${label} not found`);
  }
  const types = input.deductions.map((l) => l.deduction_type_id);
  if (new Set(types).size !== types.length) throw badRequest('Each deduction type can be added only once');
  if (input.process_ids.length) {
    const n = await Task.countDocuments({ _id: { $in: input.process_ids }, is_active: true });
    if (n !== new Set(input.process_ids).size) throw badRequest('One of the tagged processes was not found');
  }
  if (input.circular_ids.length) {
    const n = await Circular.countDocuments({ _id: { $in: input.circular_ids }, is_active: true });
    if (n !== new Set(input.circular_ids).size) throw badRequest('One of the linked circulars was not found');
  }
}

function parseEntry(body: unknown): DeductionEntryInput {
  const parsed = deductionEntryInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  return parsed.data;
}

function toDoc(input: DeductionEntryInput) {
  return {
    economic_code_id: input.economic_code_id,
    bill_type_id: input.bill_type_id,
    title: input.title,
    details: input.details,
    deductions: input.deductions.map((l) => ({
      deduction_type_id: l.deduction_type_id,
      mode: l.mode,
      value: l.mode === 'text' ? undefined : l.value,
      text: l.mode === 'text' ? l.text : undefined,
      note: l.note,
    })),
    highlights: input.highlights,
    source: input.source,
    process_ids: [...new Set(input.process_ids)],
    circular_ids: [...new Set(input.circular_ids)],
    is_published: input.is_published,
  };
}

export async function createEntry(body: unknown, userId: string): Promise<DeductionEntryDetail> {
  const input = parseEntry(body);
  await assertRefs(input);
  const doc = await DeductionEntry.create({ ...toDoc(input), created_by: userId });
  return getEntry(String(doc._id), true);
}

export async function updateEntry(id: string, body: unknown, userId: string): Promise<DeductionEntryDetail> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Entry not found');
  const doc = await DeductionEntry.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Entry not found');
  const input = parseEntry(body);
  await assertRefs(input);
  doc.set({ ...toDoc(input), updated_by: userId });
  await doc.save();
  return getEntry(id, true);
}

export async function deleteEntry(id: string): Promise<void> {
  await loadEntry(id, true);
  await DeductionEntry.updateOne({ _id: id }, { $set: { is_active: false, is_published: false } });
}
