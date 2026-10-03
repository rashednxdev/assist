import crypto from 'node:crypto';
import mongoose, { type FilterQuery } from 'mongoose';
import { BASIC_MODULE_CODES, EXAM_PREP_MODULE_CODES, type AccessPackageKind } from '@ibas/shared-constants';
import {
  ACCESS_PACKAGE_KIND_LABELS,
  DEFAULT_BILLING_SETTINGS,
  DEMO_BKASH_OTP,
  accessPackageInputSchema,
  adminOrderQuerySchema,
  billingSettingsSchema,
  bulkSubjectPackagesSchema,
  computeCharge,
  createCartSchema,
  createOrderSchema,
  demoPaySchema,
  formatBdt,
  manualGrantSchema,
  roundTaka,
  setPackageClassesSchema,
  type AccessPackageRecord,
  type BillingCatalog,
  type BillingSettingsRecord,
  type BulkSubjectPackagesResult,
  type CartRecord,
  type EntitlementRecord,
  type ExamPrepAccessItem,
  type ExamPrepScopeKind,
  type LiveClassBrief,
  type MyAccessSummary,
  type PaymentOrderRecord,
} from '@ibas/shared-types';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError, badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/logger.js';
import { ExamPart } from '../exams/models/ExamPart.model.js';
import { ExamSubject } from '../exams/models/ExamSubject.model.js';
import { loadExamPrepParts, partLabel } from '../exam-prep/exam-prep.service.js';
import { LiveStream } from '../live-stream/models/LiveStream.model.js';
import { deliverSystemNotification } from '../notifications/notifications.service.js';
import { User } from '../users/models/User.model.js';
import { AccessPackage, type IAccessPackage } from './models/AccessPackage.model.js';
import { BillingSettings } from './models/BillingSettings.model.js';
import { PaymentOrder, type IPaymentOrder } from './models/PaymentOrder.model.js';
import { UserEntitlement, type IUserEntitlement } from './models/UserEntitlement.model.js';

const DAY_MS = 86_400_000;
/** Pending checkouts lapse after this. */
const ORDER_TTL_MS = 30 * 60_000;

function zodMessage(err: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return err.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
}

export function isAdminUser(user: Pick<AuthUser, 'is_super_admin' | 'user_type'>): boolean {
  return user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin';
}

function displayName(u: { full_name_en?: string; full_name_bn?: string; email?: string; phone?: string } | null | undefined): string {
  return u?.full_name_en?.trim() || u?.full_name_bn?.trim() || u?.email?.split('@')[0] || u?.phone || 'User';
}

/* -------------------------------- settings -------------------------------- */

export async function getBillingSettings(): Promise<BillingSettingsRecord> {
  const doc = await BillingSettings.findOne({ key: 'global' }).lean();
  if (!doc) return { ...DEFAULT_BILLING_SETTINGS };
  return {
    charge_type: doc.charge_type,
    charge_value: doc.charge_value,
    charge_label: doc.charge_label,
    checkout_note: doc.checkout_note ?? '',
    gateway_enabled: doc.gateway_enabled,
  };
}

export async function updateBillingSettings(body: unknown, userId: string): Promise<BillingSettingsRecord> {
  const parsed = billingSettingsSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  await BillingSettings.updateOne(
    { key: 'global' },
    { $set: { ...parsed.data, checkout_note: parsed.data.checkout_note || undefined, updated_by: userId } },
    { upsert: true },
  );
  return getBillingSettings();
}

/* -------------------------------- packages -------------------------------- */

type ScopeRef = { exam_subject_id?: unknown; exam_part_id?: unknown };

/** Subject and part names (and each subject's part) for Exam Preparation packages, orders and grants. */
interface ScopeNames {
  subjects: Map<string, string>;
  subjectPart: Map<string, string>;
  parts: Map<string, string>;
}

async function scopeNames(items: ScopeRef[]): Promise<ScopeNames> {
  const subjectIds = [...new Set(items.map((i) => i.exam_subject_id).filter(Boolean).map(String))];
  const subjectDocs = subjectIds.length
    ? await ExamSubject.find({ _id: { $in: subjectIds } }).select('name exam_part_id').lean()
    : [];
  const subjects = new Map(subjectDocs.map((d) => [String(d._id), d.name]));
  const subjectPart = new Map(subjectDocs.map((d) => [String(d._id), String(d.exam_part_id)]));
  const rows = await loadExamPrepParts();
  const parts = new Map(rows.map((r) => [r.id, partLabel(r, rows)]));
  const missing = [
    ...new Set([...items.map((i) => i.exam_part_id).filter(Boolean).map(String), ...subjectPart.values()]),
  ].filter((id) => !parts.has(id));
  if (missing.length) {
    const docs = await ExamPart.find({ _id: { $in: missing } }).select('name part_number').lean();
    for (const d of docs) parts.set(String(d._id), d.name || `Part ${d.part_number}`);
  }
  return { subjects, subjectPart, parts };
}

/** Part of a package/order/grant: stored, or the subject's part for older subject packages. */
function partIdOf(ref: ScopeRef, names: ScopeNames): string | undefined {
  if (ref.exam_part_id) return String(ref.exam_part_id);
  if (ref.exam_subject_id) return names.subjectPart.get(String(ref.exam_subject_id));
  return undefined;
}

function scopeKindOf(ref: ScopeRef, names: ScopeNames): ExamPrepScopeKind {
  if (ref.exam_subject_id) return 'subject';
  return partIdOf(ref, names) ? 'part' : 'legacy';
}

async function primaryPartLabel(): Promise<string> {
  const rows = await loadExamPrepParts();
  const primary = rows.find((r) => r.is_primary);
  return primary ? partLabel(primary, rows) : 'Part 1';
}

function briefClass(doc: { _id: unknown; topic: string; scheduled_at: Date; status: string; video_platform?: string }): LiveClassBrief {
  return {
    id: String(doc._id),
    topic: doc.topic,
    scheduled_at: doc.scheduled_at.toISOString(),
    status: doc.status,
    video_platform: doc.video_platform === 'zoom' ? 'zoom' : 'agora',
  };
}

function toPackageRecord(doc: IAccessPackage, names: ScopeNames, legacyPart: string): AccessPackageRecord {
  const subjectId = doc.exam_subject_id ? String(doc.exam_subject_id) : undefined;
  const partId = doc.kind === 'exam_prep' ? partIdOf(doc, names) : undefined;
  const scope = doc.kind === 'exam_prep' ? scopeKindOf(doc, names) : undefined;
  return {
    id: String(doc._id),
    kind: doc.kind,
    name: doc.name,
    name_bn: doc.name_bn || undefined,
    description: doc.description || undefined,
    exam_part_id: partId,
    exam_part_name: partId ? names.parts.get(partId) : scope === 'legacy' ? legacyPart : undefined,
    exam_subject_id: subjectId,
    exam_subject_name: subjectId ? names.subjects.get(subjectId) : undefined,
    scope,
    duration_days: doc.duration_days,
    price: doc.price,
    compare_at_price: doc.compare_at_price || undefined,
    features: doc.features ?? [],
    is_featured: doc.is_featured,
    sort_order: doc.sort_order,
    is_active: doc.is_active,
  };
}

async function classCounts(packageIds: mongoose.Types.ObjectId[]): Promise<Map<string, number>> {
  if (packageIds.length === 0) return new Map();
  const rows = await LiveStream.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
    { $match: { is_active: true, package_ids: { $in: packageIds } } },
    { $unwind: '$package_ids' },
    { $match: { package_ids: { $in: packageIds } } },
    { $group: { _id: '$package_ids', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export async function listPackagesAdmin(kind?: string): Promise<AccessPackageRecord[]> {
  const filter: FilterQuery<IAccessPackage> = { is_deleted: false };
  if (kind) filter.kind = kind;
  const docs = await AccessPackage.find(filter).sort({ kind: 1, sort_order: 1, price: 1 });
  const ids = docs.map((d) => d._id as mongoose.Types.ObjectId);
  const [names, legacyPart, counts, sold] = await Promise.all([
    scopeNames(docs),
    primaryPartLabel(),
    classCounts(docs.filter((d) => d.kind === 'live').map((d) => d._id as mongoose.Types.ObjectId)),
    PaymentOrder.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
      { $match: { package_id: { $in: ids }, status: 'paid' } },
      { $group: { _id: '$package_id', n: { $sum: 1 } } },
    ]),
  ]);
  const soldMap = new Map(sold.map((s) => [String(s._id), s.n]));
  return docs.map((d) => ({
    ...toPackageRecord(d, names, legacyPart),
    ...(d.kind === 'live' ? { class_count: counts.get(String(d._id)) ?? 0 } : {}),
    sold_count: soldMap.get(String(d._id)) ?? 0,
  }));
}

async function parsePackage(body: unknown) {
  const parsed = accessPackageInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const d = parsed.data;
  const subjectId = d.kind === 'exam_prep' && d.exam_subject_id ? d.exam_subject_id : null;
  let partId = d.kind === 'exam_prep' && d.exam_part_id ? d.exam_part_id : null;
  if (subjectId) {
    const subject = await ExamSubject.findById(subjectId).select('exam_part_id').lean();
    if (!subject) throw badRequest('Exam subject not found');
    if (partId && String(subject.exam_part_id) !== partId) throw badRequest('This subject belongs to another exam part');
    partId = String(subject.exam_part_id);
  } else if (partId && !(await ExamPart.exists({ _id: partId }))) {
    throw badRequest('Exam part not found');
  }
  return {
    kind: d.kind,
    name: d.name,
    name_bn: d.name_bn || undefined,
    description: d.description || undefined,
    exam_part_id: partId,
    exam_subject_id: subjectId,
    duration_days: d.duration_days,
    price: roundTaka(d.price),
    compare_at_price: d.compare_at_price ? roundTaka(d.compare_at_price) : null,
    features: d.features,
    is_featured: d.is_featured,
    sort_order: d.sort_order,
    is_active: d.is_active,
  };
}

async function loadPackage(id: string): Promise<IAccessPackage> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Package not found');
  const doc = await AccessPackage.findOne({ _id: id, is_deleted: false });
  if (!doc) throw notFound('Package not found');
  return doc;
}

async function recordFor(doc: IAccessPackage): Promise<AccessPackageRecord> {
  const [names, legacyPart] = await Promise.all([scopeNames([doc]), primaryPartLabel()]);
  return toPackageRecord(doc, names, legacyPart);
}

/** One subject package per subject of a part, so the admin prices a whole part in one step. */
export async function bulkSubjectPackages(body: unknown, userId: string): Promise<BulkSubjectPackagesResult> {
  const parsed = bulkSubjectPackagesSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const d = parsed.data;
  if (!(await ExamPart.exists({ _id: d.exam_part_id }))) throw badRequest('Exam part not found');
  const subjects = await ExamSubject.find({ exam_part_id: d.exam_part_id, is_active: true })
    .select('name name_bn')
    .sort({ name: 1 })
    .lean();
  if (subjects.length === 0) throw badRequest('This part has no subjects yet. Add subjects in Exam setup first.');
  const existing = await AccessPackage.find({
    kind: 'exam_prep',
    is_deleted: false,
    duration_days: d.duration_days,
    exam_subject_id: { $in: subjects.map((s) => s._id) },
  });
  const bySubject = new Map(existing.map((p) => [String(p.exam_subject_id), p]));
  const price = roundTaka(d.price);
  const compare = d.compare_at_price ? roundTaka(d.compare_at_price) : null;
  const result: BulkSubjectPackagesResult = { created: 0, updated: 0, skipped: 0 };
  for (const s of subjects) {
    const pkg = bySubject.get(String(s._id));
    if (pkg) {
      if (!d.update_existing) {
        result.skipped += 1;
        continue;
      }
      pkg.set({ price, compare_at_price: compare, exam_part_id: d.exam_part_id, updated_by: userId });
      await pkg.save();
      result.updated += 1;
      continue;
    }
    await AccessPackage.create({
      kind: 'exam_prep',
      name: s.name,
      name_bn: s.name_bn || undefined,
      exam_part_id: d.exam_part_id,
      exam_subject_id: s._id,
      duration_days: d.duration_days,
      price,
      compare_at_price: compare,
      features: [],
      is_featured: false,
      sort_order: 100,
      is_active: true,
      created_by: userId,
      updated_by: userId,
    });
    result.created += 1;
  }
  return result;
}

export async function createPackage(body: unknown, userId: string): Promise<AccessPackageRecord> {
  const data = await parsePackage(body);
  const doc = await AccessPackage.create({ ...data, created_by: userId, updated_by: userId });
  return recordFor(doc);
}

export async function updatePackage(id: string, body: unknown, userId: string): Promise<AccessPackageRecord> {
  const doc = await loadPackage(id);
  const data = await parsePackage(body);
  if (data.kind !== doc.kind) throw badRequest('The package type cannot change after creation');
  doc.set({ ...data, updated_by: userId });
  await doc.save();
  return recordFor(doc);
}

/** Removes a package. Sold packages are kept (hidden) so invoices and access history stay intact. */
export async function deletePackage(id: string): Promise<{ archived: boolean }> {
  const doc = await loadPackage(id);
  await LiveStream.updateMany({ package_ids: doc._id }, { $pull: { package_ids: doc._id } });
  const hasOrders = await PaymentOrder.exists({ package_id: doc._id });
  if (hasOrders) {
    doc.is_deleted = true;
    doc.is_active = false;
    await doc.save();
    return { archived: true };
  }
  await doc.deleteOne();
  return { archived: false };
}

export async function packageClasses(id: string): Promise<LiveClassBrief[]> {
  const doc = await loadPackage(id);
  const rows = await LiveStream.find({ is_active: true, package_ids: doc._id })
    .select('topic scheduled_at status video_platform')
    .sort({ scheduled_at: 1 })
    .lean();
  return rows.map(briefClass);
}

export async function setPackageClasses(id: string, body: unknown): Promise<LiveClassBrief[]> {
  const doc = await loadPackage(id);
  if (doc.kind !== 'live') throw badRequest('Only live class packages have classes');
  const parsed = setPackageClassesSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const ids = [...new Set(parsed.data.class_ids)].map((c) => new mongoose.Types.ObjectId(c));
  await LiveStream.updateMany({ package_ids: doc._id, _id: { $nin: ids } }, { $pull: { package_ids: doc._id } });
  if (ids.length) await LiveStream.updateMany({ _id: { $in: ids }, is_active: true }, { $addToSet: { package_ids: doc._id } });
  return packageClasses(id);
}

/** Classes an admin can put in a package: upcoming plus the last 60 days. */
export async function liveClassOptions(): Promise<Array<LiveClassBrief & { package_ids: string[] }>> {
  const rows = await LiveStream.find({
    is_active: true,
    status: { $ne: 'cancelled' },
    scheduled_at: { $gte: new Date(Date.now() - 60 * DAY_MS) },
  })
    .select('topic scheduled_at status video_platform package_ids')
    .sort({ scheduled_at: 1 })
    .limit(300)
    .lean();
  return rows.map((r) => ({ ...briefClass(r), package_ids: (r.package_ids ?? []).map(String) }));
}

export async function subjectOptions(): Promise<Array<{ id: string; name: string; group: string; exam_part_id: string }>> {
  const rows = await ExamSubject.find({ is_active: true })
    .select('name exam_type_id exam_part_id')
    .populate<{ exam_type_id: { name?: string } | null; exam_part_id: { _id: unknown; name?: string } | null }>([
      { path: 'exam_type_id', select: 'name' },
      { path: 'exam_part_id', select: 'name' },
    ])
    .sort({ name: 1 })
    .lean();
  return rows.map((r) => ({
    id: String(r._id),
    name: r.name,
    group: [r.exam_type_id?.name, r.exam_part_id?.name].filter(Boolean).join(' · '),
    exam_part_id: r.exam_part_id ? String(r.exam_part_id._id) : '',
  }));
}

/* ------------------------------- entitlements ------------------------------- */

function opensFor(kind: AccessPackageKind): string[] {
  if (kind === 'exam_prep') return ['Books & Tools', 'Question Bank', 'Exam Programs', 'Exam Papers', 'Exams of the Week', 'User Questions', 'Answer PDFs'];
  if (kind === 'basic') return ['Circulars & Policy library', 'iBAS++ workspace', 'Toolkit', 'Pension & Joining period'];
  return ['All classes in this package'];
}

function entitlementStatus(e: IUserEntitlement, now: Date): EntitlementRecord['status'] {
  if (e.is_revoked) return 'revoked';
  if (e.starts_at > now) return 'upcoming';
  if (e.ends_at <= now) return 'expired';
  return 'active';
}

export async function getMyAccess(userId: string): Promise<MyAccessSummary> {
  const now = new Date();
  const rows = await UserEntitlement.find({ user_id: userId }).sort({ ends_at: -1 }).limit(100);
  const orders = await PaymentOrder.find({ _id: { $in: rows.map((r) => r.order_id).filter(Boolean) } })
    .select('invoice_no')
    .lean();
  const invoiceById = new Map(orders.map((o) => [String(o._id), o.invoice_no]));
  const examRows = rows.filter((e) => e.kind === 'exam_prep');
  const [names, legacyPart, partRows] = await Promise.all([scopeNames(examRows), primaryPartLabel(), loadExamPrepParts()]);
  const entitlements: EntitlementRecord[] = rows.map((e) => ({
    id: String(e._id),
    kind: e.kind,
    package_id: String(e.package_id),
    package_name: e.package_name,
    ...(e.kind === 'exam_prep'
      ? { exam_part_name: e.exam_part_id ? e.exam_part_name || names.parts.get(String(e.exam_part_id)) : legacyPart }
      : {}),
    exam_subject_name: e.exam_subject_name || undefined,
    starts_at: e.starts_at.toISOString(),
    ends_at: e.ends_at.toISOString(),
    status: entitlementStatus(e, now),
    order_id: e.order_id ? String(e.order_id) : undefined,
    invoice_no: e.order_id ? invoiceById.get(String(e.order_id)) : undefined,
    opens: opensFor(e.kind),
  }));

  // Back-to-back renewals count as one continuous window.
  const until = (filter: (e: IUserEntitlement) => boolean): Date | undefined => {
    const list = rows.filter((e) => !e.is_revoked && filter(e)).sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
    let end: Date | undefined;
    for (const e of list) {
      if (e.ends_at <= now) continue;
      if (!end) {
        if (e.starts_at <= now) end = e.ends_at;
      } else if (e.starts_at <= end && e.ends_at > end) end = e.ends_at;
    }
    return end;
  };
  const livePackageIds = [...new Set(rows.filter((e) => e.kind === 'live').map((e) => String(e.package_id)))];
  const live_packages = livePackageIds.flatMap((pid) => {
    const end = until((e) => e.kind === 'live' && String(e.package_id) === pid);
    const name = rows.find((e) => String(e.package_id) === pid)?.package_name ?? 'Live package';
    return end ? [{ package_id: pid, package_name: name, until: end.toISOString() }] : [];
  });

  const scopeKeyOf = (e: IUserEntitlement) =>
    !e.exam_part_id ? 'legacy' : `${String(e.exam_part_id)}|${e.exam_subject_id ? String(e.exam_subject_id) : ''}`;
  const accessByKey = new Map<string, ExamPrepAccessItem>();
  const keep = (item: ExamPrepAccessItem) => {
    const key = `${item.exam_part_id}|${item.exam_subject_id ?? ''}`;
    const prev = accessByKey.get(key);
    if (!prev || item.until > prev.until) accessByKey.set(key, item);
  };
  for (const key of new Set(examRows.map(scopeKeyOf))) {
    const end = until((e) => e.kind === 'exam_prep' && scopeKeyOf(e) === key);
    if (!end) continue;
    if (key === 'legacy') {
      for (const p of partRows.filter((r) => r.is_primary)) {
        keep({ exam_part_id: p.id, exam_part_name: partLabel(p, partRows), until: end.toISOString() });
      }
      continue;
    }
    const [partId, subjectId] = key.split('|');
    const sample = examRows.find((e) => scopeKeyOf(e) === key)!;
    keep({
      exam_part_id: partId!,
      exam_part_name: names.parts.get(partId!) ?? sample.exam_part_name ?? 'Exam part',
      ...(subjectId
        ? { exam_subject_id: subjectId, exam_subject_name: names.subjects.get(subjectId) ?? sample.exam_subject_name }
        : {}),
      until: end.toISOString(),
    });
  }

  return {
    exam_prep_until: until((e) => e.kind === 'exam_prep')?.toISOString(),
    basic_until: until((e) => e.kind === 'basic')?.toISOString(),
    live_packages,
    exam_prep_access: [...accessByKey.values()],
    entitlements,
  };
}

type WindowPkg = {
  _id: unknown;
  kind: AccessPackageKind;
  duration_days: number;
  exam_part_id?: unknown;
  exam_subject_id?: unknown;
};

/**
 * New access starts when the user's current access to the same thing ends: the same package for
 * live classes, the same subject / whole part for Exam Preparation, the same kind otherwise.
 */
async function accessWindow(userId: string, pkg: WindowPkg, now = new Date()) {
  let scope: FilterQuery<IUserEntitlement>;
  if (pkg.kind === 'live') scope = { kind: 'live', package_id: pkg._id };
  else if (pkg.kind !== 'exam_prep') scope = { kind: pkg.kind };
  else if (pkg.exam_subject_id) scope = { kind: 'exam_prep', exam_subject_id: pkg.exam_subject_id };
  else if (pkg.exam_part_id) scope = { kind: 'exam_prep', exam_part_id: pkg.exam_part_id, exam_subject_id: null };
  else scope = { kind: 'exam_prep', exam_part_id: null };
  const filter: FilterQuery<IUserEntitlement> = {
    user_id: userId,
    is_revoked: false,
    ends_at: { $gt: now },
    ...scope,
  };
  const latest = await UserEntitlement.findOne(filter).sort({ ends_at: -1 }).select('ends_at').lean();
  const start = latest ? latest.ends_at : now;
  return { start, end: new Date(start.getTime() + pkg.duration_days * DAY_MS) };
}

/** Module codes opened by package access, for /auth/me grants (mobile reads these). */
export async function packageGrantsForMe(userId: string, extraBasic: string[]) {
  const now = new Date();
  const rows = await UserEntitlement.find({
    user_id: userId,
    is_revoked: false,
    starts_at: { $lte: now },
    ends_at: { $gt: now },
  })
    .select('kind ends_at')
    .lean();
  const until: Partial<Record<'exam_prep' | 'basic', Date>> = {};
  for (const r of rows) {
    if (r.kind === 'live') continue;
    if (!until[r.kind] || r.ends_at > until[r.kind]!) until[r.kind] = r.ends_at;
  }
  const out: Array<{ module_code: string; expires_at: string }> = [];
  if (until.exam_prep) for (const c of EXAM_PREP_MODULE_CODES) out.push({ module_code: c, expires_at: until.exam_prep.toISOString() });
  if (until.basic) {
    for (const c of new Set([...BASIC_MODULE_CODES, ...extraBasic])) out.push({ module_code: c, expires_at: until.basic.toISOString() });
  }
  return { grants: out, hasAny: rows.length > 0 };
}

/* --------------------------------- catalog --------------------------------- */

export async function getCatalog(user: AuthUser): Promise<BillingCatalog> {
  const [settings, docs, access] = await Promise.all([
    getBillingSettings(),
    AccessPackage.find({ is_deleted: false, is_active: true }).sort({ kind: 1, sort_order: 1, price: 1 }),
    getMyAccess(user.id),
  ]);
  const [names, legacyPart] = await Promise.all([scopeNames(docs), primaryPartLabel()]);
  const liveIds = docs.filter((d) => d.kind === 'live').map((d) => d._id as mongoose.Types.ObjectId);
  const [counts, upcoming] = await Promise.all([
    classCounts(liveIds),
    liveIds.length
      ? LiveStream.find({
          is_active: true,
          package_ids: { $in: liveIds },
          status: { $in: ['scheduled', 'live', 'paused'] },
          scheduled_at: { $gte: new Date(Date.now() - 6 * 3600_000) },
        })
          .select('topic scheduled_at status video_platform package_ids')
          .sort({ scheduled_at: 1 })
          .limit(200)
          .lean()
      : Promise.resolve([]),
  ]);
  const packages = docs.map((d) => {
    const rec = toPackageRecord(d, names, legacyPart);
    if (d.kind !== 'live') return rec;
    return {
      ...rec,
      class_count: counts.get(String(d._id)) ?? 0,
      upcoming_classes: upcoming
        .filter((c) => (c.package_ids ?? []).some((p) => String(p) === String(d._id)))
        .slice(0, 5)
        .map(briefClass),
    };
  });
  return {
    settings: {
      charge_type: settings.charge_type,
      charge_value: settings.charge_value,
      charge_label: settings.charge_label,
      checkout_note: settings.checkout_note,
      gateway_enabled: settings.gateway_enabled,
    },
    packages,
    access,
  };
}

/* ---------------------------------- orders ---------------------------------- */

function newInvoiceNo(now = new Date()): string {
  const bd = new Date(now.getTime() + 6 * 3600_000);
  const ymd = bd.toISOString().slice(2, 10).replace(/-/g, '');
  return `PA${ymd}-${crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase()}`;
}

function newTrxId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(9);
  return `D${[...bytes].map((b) => alphabet[b % alphabet.length]).join('')}`;
}

function maskMsisdn(m: string): string {
  return `${m.slice(0, 3)}•••••${m.slice(-3)}`;
}

function toOrderRecord(o: IPaymentOrder, user?: { _id: unknown; full_name_en?: string; full_name_bn?: string; email?: string; phone?: string } | null): PaymentOrderRecord {
  return {
    id: String(o._id),
    invoice_no: o.invoice_no,
    ...(user ? { user: { id: String(user._id), name: displayName(user), email: user.email, phone: user.phone } } : {}),
    package_id: String(o.package_id),
    kind: o.kind,
    package_name: o.package_name,
    exam_part_name: o.exam_part_name || undefined,
    exam_subject_name: o.exam_subject_name || undefined,
    ...(o.cart_id ? { cart_id: o.cart_id } : {}),
    duration_days: o.duration_days,
    price: o.price,
    charge: o.charge,
    charge_label: o.charge_label,
    total: o.total,
    currency: 'BDT',
    method: o.method,
    status: o.status,
    failure_reason: o.failure_reason || undefined,
    payer_account: o.payer_account || undefined,
    trx_id: o.trx_id || undefined,
    note: o.note || undefined,
    access_starts_at: (o.access_starts_at ?? o.created_at).toISOString(),
    access_ends_at: (o.access_ends_at ?? o.created_at).toISOString(),
    created_at: o.created_at.toISOString(),
    paid_at: o.paid_at?.toISOString(),
    expires_at: o.expires_at?.toISOString(),
  };
}

async function expireIfLapsed(o: IPaymentOrder): Promise<void> {
  if (o.status === 'pending' && o.expires_at && o.expires_at.getTime() < Date.now()) {
    o.status = 'expired';
    await o.save();
  }
}

async function loadOrder(id: string, user: AuthUser): Promise<IPaymentOrder> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Order not found');
  const o = await PaymentOrder.findById(id);
  if (!o) throw notFound('Order not found');
  if (String(o.user_id) !== user.id && !isAdminUser(user)) throw forbidden('This order belongs to another user');
  await expireIfLapsed(o);
  return o;
}

async function refreshWindow(o: IPaymentOrder): Promise<void> {
  const w = await accessWindow(String(o.user_id), {
    _id: o.package_id,
    kind: o.kind,
    duration_days: o.duration_days,
    exam_part_id: o.exam_part_id,
    exam_subject_id: o.exam_subject_id,
  });
  o.access_starts_at = w.start;
  o.access_ends_at = w.end;
}

const bdDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' });

/** Grants access for a paid order (idempotent — one entitlement per order). */
async function fulfil(o: IPaymentOrder, opts: { notify?: boolean } = {}): Promise<void> {
  if (await UserEntitlement.exists({ order_id: o._id })) return;
  if (o.kind === 'exam_prep' && o.exam_subject_id && !o.exam_part_id) {
    const subject = await ExamSubject.findById(o.exam_subject_id).select('exam_part_id').lean();
    if (subject) o.exam_part_id = subject.exam_part_id;
  }
  await refreshWindow(o);
  await UserEntitlement.create({
    user_id: o.user_id,
    kind: o.kind,
    package_id: o.package_id,
    package_name: o.package_name,
    ...(o.kind === 'exam_prep' && o.exam_part_id ? { exam_part_id: o.exam_part_id, exam_part_name: o.exam_part_name } : {}),
    exam_subject_id: o.exam_subject_id ?? null,
    exam_subject_name: o.exam_subject_name,
    order_id: o._id,
    starts_at: o.access_starts_at,
    ends_at: o.access_ends_at,
  });
  await o.save();
  if (opts.notify === false) return;
  const what = o.kind === 'live' ? `live class package "${o.package_name}"` : `${ACCESS_PACKAGE_KIND_LABELS[o.kind]} (${o.package_name})`;
  await deliverSystemNotification({
    userIds: [String(o.user_id)],
    title: o.method === 'manual' ? 'Access added to your account' : 'Payment successful',
    message: [
      `Your ${what} is active${o.access_starts_at!.getTime() > Date.now() + 60_000 ? ` from ${bdDate(o.access_starts_at!)}` : ''} until ${bdDate(o.access_ends_at!)}.`,
      o.total > 0 ? `Paid ${formatBdt(o.total)} · Invoice ${o.invoice_no}${o.trx_id ? ` · TrxID ${o.trx_id}` : ''}` : `Invoice ${o.invoice_no}`,
    ].join('\n'),
    createdBy: String(o.recorded_by ?? o.user_id),
    link: '/settings/payments',
    data: { type: 'billing', order_id: String(o._id) },
    source: 'billing',
  }).catch((err) => logger.warn({ err, order: String(o._id) }, 'Payment notification failed'));
}

async function createOrderDoc(input: {
  userId: string;
  pkg: IAccessPackage;
  settings: BillingSettingsRecord;
  method: IPaymentOrder['method'];
  price?: number;
  charge?: number;
  cartId?: string;
}) {
  const names = await scopeNames([input.pkg]);
  const partId = input.pkg.kind === 'exam_prep' ? partIdOf(input.pkg, names) : undefined;
  const price = input.price ?? input.pkg.price;
  const charge = input.charge ?? computeCharge(price, input.settings);
  const window = await accessWindow(input.userId, {
    _id: input.pkg._id,
    kind: input.pkg.kind,
    duration_days: input.pkg.duration_days,
    exam_part_id: partId,
    exam_subject_id: input.pkg.exam_subject_id,
  });
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await PaymentOrder.create({
        invoice_no: newInvoiceNo(),
        user_id: input.userId,
        package_id: input.pkg._id,
        kind: input.pkg.kind,
        package_name: input.pkg.name,
        ...(partId ? { exam_part_id: partId, exam_part_name: names.parts.get(partId) } : {}),
        ...(input.cartId ? { cart_id: input.cartId } : {}),
        exam_subject_id: input.pkg.exam_subject_id ?? null,
        exam_subject_name: input.pkg.exam_subject_id ? names.subjects.get(String(input.pkg.exam_subject_id)) : undefined,
        duration_days: input.pkg.duration_days,
        price,
        charge,
        charge_label: input.settings.charge_label,
        total: roundTaka(price + charge),
        currency: 'BDT',
        method: input.method,
        status: 'pending',
        access_starts_at: window.start,
        access_ends_at: window.end,
        expires_at: new Date(Date.now() + ORDER_TTL_MS),
      });
    } catch (err) {
      if ((err as { code?: number }).code !== 11000 || attempt === 4) throw err;
    }
  }
  throw new Error('unreachable');
}

export async function createOrder(user: AuthUser, body: unknown): Promise<PaymentOrderRecord> {
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const pkg = await loadPackage(parsed.data.package_id);
  if (!pkg.is_active) throw badRequest('This package is not available right now');
  const settings = await getBillingSettings();
  if (!settings.gateway_enabled && pkg.price > 0) {
    throw new AppError(503, 'PAYMENTS_PAUSED', 'Online payment is paused. Please try again later.');
  }
  // One open checkout per package: reuse it instead of piling up pending orders.
  const open = await PaymentOrder.findOne({
    user_id: user.id,
    package_id: pkg._id,
    status: 'pending',
    expires_at: { $gt: new Date() },
    price: pkg.price,
  });
  if (open) {
    open.charge = computeCharge(pkg.price, settings);
    open.charge_label = settings.charge_label;
    open.total = roundTaka(open.price + open.charge);
    await refreshWindow(open);
    await open.save();
    return toOrderRecord(open);
  }
  const order = await createOrderDoc({ userId: user.id, pkg, settings, method: pkg.price > 0 ? 'bkash_demo' : 'free' });
  if (order.total === 0) {
    order.status = 'paid';
    order.paid_at = new Date();
    await order.save();
    await fulfil(order);
  }
  return toOrderRecord(order);
}

export async function getOrder(id: string, user: AuthUser): Promise<PaymentOrderRecord> {
  const o = await loadOrder(id, user);
  if (o.status === 'pending') {
    await refreshWindow(o);
    await o.save();
  }
  return toOrderRecord(o);
}

export async function listMyOrders(userId: string): Promise<PaymentOrderRecord[]> {
  await PaymentOrder.updateMany({ user_id: userId, status: 'pending', expires_at: { $lt: new Date() } }, { status: 'expired' });
  const rows = await PaymentOrder.find({ user_id: userId }).sort({ created_at: -1 }).limit(200);
  const revoked = await revokedOrderIds(rows);
  return rows.map((o) => ({ ...toOrderRecord(o), ...(revoked.has(String(o._id)) ? { access_revoked: true } : {}) }));
}

async function revokedOrderIds(rows: IPaymentOrder[]): Promise<Set<string>> {
  const paid = rows.filter((o) => o.status === 'paid').map((o) => o._id);
  if (paid.length === 0) return new Set();
  const list = await UserEntitlement.find({ order_id: { $in: paid }, is_revoked: true }).select('order_id').lean();
  return new Set(list.map((e) => String(e.order_id)));
}

/**
 * Demo bKash checkout: validates wallet number, OTP and PIN formats, "debits" the wallet and
 * grants access. A real gateway would create/execute a payment and verify it server-to-server here.
 */
export async function demoPay(id: string, body: unknown, user: AuthUser): Promise<PaymentOrderRecord> {
  const o = await loadOrder(id, user);
  if (String(o.user_id) !== user.id) throw forbidden('Only the buyer can pay for this order');
  if (o.status === 'paid') return toOrderRecord(o);
  if (o.status !== 'pending') throw badRequest(o.status === 'expired' ? 'This checkout expired. Start again from Pricing.' : `This order is ${o.status}.`);
  const parsed = demoPaySchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const p = parsed.data;
  if (p.otp !== DEMO_BKASH_OTP) throw badRequest('Wrong verification code');

  o.payer_account = maskMsisdn(p.msisdn);
  o.gateway_payment_id = `DEMO-${crypto.randomUUID()}`;
  if (p.simulate_failure) {
    o.status = 'failed';
    o.failure_reason = 'Insufficient balance (demo)';
    await o.save();
    return toOrderRecord(o);
  }
  o.status = 'paid';
  o.paid_at = new Date();
  o.trx_id = newTrxId();
  await o.save();
  await fulfil(o);
  return toOrderRecord(o);
}

export async function cancelOrder(id: string, user: AuthUser): Promise<PaymentOrderRecord> {
  const o = await loadOrder(id, user);
  if (o.status !== 'pending') throw badRequest(`This order is already ${o.status}`);
  o.status = 'cancelled';
  await o.save();
  return toOrderRecord(o);
}

/* ----------------------------------- cart ----------------------------------- */

/** Same thing bought twice in one cart would overlap instead of stacking. */
function cartScopeKey(pkg: IAccessPackage, names: ScopeNames): string {
  if (pkg.kind === 'live') return `live|${String(pkg._id)}`;
  if (pkg.kind !== 'exam_prep') return pkg.kind;
  if (pkg.exam_subject_id) return `subject|${String(pkg.exam_subject_id)}`;
  const partId = partIdOf(pkg, names);
  return partId ? `part|${partId}` : 'legacy';
}

async function loadCartOrders(cartId: string, user: AuthUser): Promise<IPaymentOrder[]> {
  if (!/^[a-f\d-]{36}$/i.test(cartId)) throw notFound('Checkout not found');
  const orders = await PaymentOrder.find({ cart_id: cartId }).sort({ created_at: 1, _id: 1 });
  if (orders.length === 0) throw notFound('Checkout not found');
  if (String(orders[0]!.user_id) !== user.id && !isAdminUser(user)) throw forbidden('This checkout belongs to another user');
  for (const o of orders) await expireIfLapsed(o);
  return orders;
}

function toCartRecord(cartId: string, orders: IPaymentOrder[]): CartRecord {
  const records = orders.map((o) => toOrderRecord(o));
  const statuses = new Set(orders.map((o) => o.status));
  const status: CartRecord['status'] = statuses.has('pending')
    ? 'pending'
    : statuses.size === 1
      ? orders[0]!.status
      : statuses.has('paid')
        ? 'paid'
        : orders[0]!.status;
  const first = orders[0]!;
  const expires = orders.map((o) => o.expires_at).filter((d): d is Date => !!d);
  return {
    cart_id: cartId,
    orders: records,
    price: roundTaka(orders.reduce((s, o) => s + o.price, 0)),
    charge: roundTaka(orders.reduce((s, o) => s + o.charge, 0)),
    charge_label: first.charge_label,
    total: roundTaka(orders.reduce((s, o) => s + o.total, 0)),
    status,
    method: first.method,
    payer_account: first.payer_account || undefined,
    trx_id: first.trx_id || undefined,
    failure_reason: orders.find((o) => o.failure_reason)?.failure_reason || undefined,
    expires_at: expires.length ? new Date(Math.min(...expires.map((d) => d.getTime()))).toISOString() : undefined,
    paid_at: orders.find((o) => o.paid_at)?.paid_at?.toISOString(),
  };
}

async function notifyCartPaid(orders: IPaymentOrder[]): Promise<void> {
  const first = orders[0]!;
  const lines = orders.map((o) => {
    const scope = [o.exam_part_name, o.exam_subject_name].filter(Boolean).join(' · ');
    return `• ${o.package_name}${scope && scope !== o.package_name ? ` (${scope})` : ''} — until ${bdDate(o.access_ends_at!)}`;
  });
  const total = roundTaka(orders.reduce((s, o) => s + o.total, 0));
  await deliverSystemNotification({
    userIds: [String(first.user_id)],
    title: 'Payment successful',
    message: [
      `${orders.length} package${orders.length === 1 ? '' : 's'} added to your account:`,
      ...lines,
      total > 0 ? `Paid ${formatBdt(total)}${first.trx_id ? ` · TrxID ${first.trx_id}` : ''}` : 'Free',
    ].join('\n'),
    createdBy: String(first.user_id),
    link: '/settings/payments',
    data: { type: 'billing', order_id: String(first._id) },
    source: 'billing',
  }).catch((err) => logger.warn({ err, cart: first.cart_id }, 'Payment notification failed'));
}

/** Starts one checkout for several packages (e.g. a few Part 2 subjects). */
export async function createCart(user: AuthUser, body: unknown): Promise<CartRecord> {
  const parsed = createCartSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const ids = [...new Set(parsed.data.package_ids)];
  const pkgs = await AccessPackage.find({ _id: { $in: ids }, is_deleted: false, is_active: true });
  if (pkgs.length !== ids.length) throw badRequest('One of the packages is not available right now. Refresh and try again.');
  const ordered = ids.map((id) => pkgs.find((p) => String(p._id) === id)!);
  const names = await scopeNames(ordered);
  const keys = new Set<string>();
  for (const p of ordered) {
    const key = cartScopeKey(p, names);
    if (keys.has(key)) throw badRequest(`Pick only one package for ${p.exam_subject_id ? 'each subject' : 'the same access'}.`);
    keys.add(key);
  }
  const settings = await getBillingSettings();
  const subtotal = ordered.reduce((s, p) => s + p.price, 0);
  if (!settings.gateway_enabled && subtotal > 0) {
    throw new AppError(503, 'PAYMENTS_PAUSED', 'Online payment is paused. Please try again later.');
  }
  const cartId = crypto.randomUUID();
  const method: IPaymentOrder['method'] = subtotal > 0 ? 'bkash_demo' : 'free';
  // A fixed charge is per payment, so it lands on the first paid item only.
  let fixedCharged = false;
  const orders: IPaymentOrder[] = [];
  for (const pkg of ordered) {
    let charge = computeCharge(pkg.price, settings);
    if (settings.charge_type === 'fixed' && pkg.price > 0) {
      if (fixedCharged) charge = 0;
      fixedCharged = true;
    }
    orders.push(await createOrderDoc({ userId: user.id, pkg, settings, method, charge, cartId }));
  }
  if (subtotal === 0) {
    for (const o of orders) {
      o.status = 'paid';
      o.paid_at = new Date();
      await o.save();
      await fulfil(o, { notify: false });
    }
    await notifyCartPaid(orders);
  }
  return toCartRecord(cartId, orders);
}

export async function getCart(cartId: string, user: AuthUser): Promise<CartRecord> {
  const orders = await loadCartOrders(cartId, user);
  for (const o of orders) {
    if (o.status !== 'pending') continue;
    await refreshWindow(o);
    await o.save();
  }
  return toCartRecord(cartId, orders);
}

/** Demo bKash payment for the whole cart: one wallet debit, every package granted. */
export async function payCart(cartId: string, body: unknown, user: AuthUser): Promise<CartRecord> {
  const orders = await loadCartOrders(cartId, user);
  if (String(orders[0]!.user_id) !== user.id) throw forbidden('Only the buyer can pay for this checkout');
  const pending = orders.filter((o) => o.status === 'pending');
  if (pending.length === 0) {
    if (orders.every((o) => o.status === 'paid')) return toCartRecord(cartId, orders);
    const status = orders[0]!.status;
    throw badRequest(status === 'expired' ? 'This checkout expired. Start again from Pricing.' : `This checkout is ${status}.`);
  }
  const parsed = demoPaySchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const p = parsed.data;
  if (p.otp !== DEMO_BKASH_OTP) throw badRequest('Wrong verification code');

  const payer = maskMsisdn(p.msisdn);
  const gatewayId = `DEMO-${crypto.randomUUID()}`;
  if (p.simulate_failure) {
    for (const o of pending) {
      o.payer_account = payer;
      o.gateway_payment_id = gatewayId;
      o.status = 'failed';
      o.failure_reason = 'Insufficient balance (demo)';
      await o.save();
    }
    return toCartRecord(cartId, orders);
  }
  const trx = newTrxId();
  const paidAt = new Date();
  for (const o of pending) {
    o.payer_account = payer;
    o.gateway_payment_id = gatewayId;
    o.status = 'paid';
    o.paid_at = paidAt;
    o.trx_id = trx;
    await o.save();
    await fulfil(o, { notify: false });
  }
  await notifyCartPaid(pending);
  return toCartRecord(cartId, orders);
}

export async function cancelCart(cartId: string, user: AuthUser): Promise<CartRecord> {
  const orders = await loadCartOrders(cartId, user);
  const pending = orders.filter((o) => o.status === 'pending');
  if (pending.length === 0) throw badRequest(`This checkout is already ${orders[0]!.status}`);
  for (const o of pending) {
    o.status = 'cancelled';
    await o.save();
  }
  return toCartRecord(cartId, orders);
}

/* ---------------------------------- admin ---------------------------------- */

export async function listOrdersAdmin(query: unknown) {
  const parsed = adminOrderQuerySchema.safeParse(query);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const q = parsed.data;
  await PaymentOrder.updateMany({ status: 'pending', expires_at: { $lt: new Date() } }, { status: 'expired' });
  const filter: FilterQuery<IPaymentOrder> = {};
  if (q.status) filter.status = q.status;
  if (q.kind) filter.kind = q.kind;
  if (q.q) {
    const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({ $or: [{ full_name_en: rx }, { full_name_bn: rx }, { email: rx }, { phone: rx }] })
      .select('_id')
      .limit(200)
      .lean();
    filter.$or = [{ invoice_no: rx }, { trx_id: rx }, { package_name: rx }, { user_id: { $in: users.map((u) => u._id) } }];
  }
  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const [total, rows, revenue] = await Promise.all([
    PaymentOrder.countDocuments(filter),
    PaymentOrder.find(filter)
      .sort({ created_at: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit),
    PaymentOrder.aggregate<{ _id: string; total: number; charge: number; n: number; last30: number }>([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: '$kind',
          total: { $sum: '$total' },
          charge: { $sum: '$charge' },
          n: { $sum: 1 },
          last30: { $sum: { $cond: [{ $gte: ['$paid_at', since30] }, '$total', 0] } },
        },
      },
    ]),
  ]);
  const users = await User.find({ _id: { $in: [...new Set(rows.map((r) => String(r.user_id)))] } })
    .select('full_name_en full_name_bn email phone')
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const revoked = await revokedOrderIds(rows);
  return {
    total,
    items: rows.map((o) => ({
      ...toOrderRecord(o, byId.get(String(o.user_id)) ?? null),
      ...(revoked.has(String(o._id)) ? { access_revoked: true } : {}),
    })),
    revenue: {
      total: roundTaka(revenue.reduce((s, r) => s + r.total, 0)),
      charges: roundTaka(revenue.reduce((s, r) => s + r.charge, 0)),
      last_30_days: roundTaka(revenue.reduce((s, r) => s + r.last30, 0)),
      paid_orders: revenue.reduce((s, r) => s + r.n, 0),
      by_kind: Object.fromEntries(revenue.map((r) => [r._id, roundTaka(r.total)])),
    },
  };
}

/** Admin records a payment received outside the app (cash, WhatsApp bKash) and grants the package. */
export async function manualGrant(body: unknown, admin: AuthUser): Promise<PaymentOrderRecord> {
  const parsed = manualGrantSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const g = parsed.data;
  const user = await User.findById(g.user_id).select('full_name_en full_name_bn email phone status');
  if (!user) throw notFound('User not found');
  const pkg = await loadPackage(g.package_id);
  const settings = await getBillingSettings();
  const order = await createOrderDoc({ userId: g.user_id, pkg, settings, method: 'manual', price: roundTaka(g.amount), charge: 0 });
  order.status = 'paid';
  order.paid_at = new Date();
  order.note = g.note || undefined;
  order.recorded_by = new mongoose.Types.ObjectId(admin.id);
  order.expires_at = undefined;
  await order.save();
  await fulfil(order);
  return toOrderRecord(order, user);
}

export async function revokeEntitlementForOrder(orderId: string, note: string | undefined): Promise<void> {
  if (!mongoose.isValidObjectId(orderId)) throw notFound('Order not found');
  const e = await UserEntitlement.findOne({ order_id: orderId });
  if (!e) throw notFound('No access found for this order');
  e.is_revoked = true;
  e.revoked_note = note?.slice(0, 300) || undefined;
  await e.save();
}

/* --------------------------------- live class --------------------------------- */

/** Package briefs for classes, keyed by package id (used by live-stream listing). */
export async function livePackageBriefs(packageIds: string[]): Promise<Map<string, { id: string; name: string; price: number; duration_days: number }>> {
  const unique = [...new Set(packageIds)];
  if (unique.length === 0) return new Map();
  const docs = await AccessPackage.find({ _id: { $in: unique }, kind: 'live', is_deleted: false, is_active: true })
    .select('name price duration_days')
    .lean();
  return new Map(docs.map((d) => [String(d._id), { id: String(d._id), name: d.name, price: d.price, duration_days: d.duration_days }]));
}
