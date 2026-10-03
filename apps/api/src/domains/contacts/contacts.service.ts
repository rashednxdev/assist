import mongoose, { type PipelineStage, type Types } from 'mongoose';
import {
  contactConsentSchema,
  contactEmployeeQuerySchema,
  contactFavoriteSchema,
  contactOfficeQuerySchema,
  contactOverviewQuerySchema,
  contactPrivacySchema,
  CONTACT_CONSENT_REQUIRED,
  CONTACT_VERIFICATION_REQUIRED,
  CONTACT_VERIFIER_GRADE_MAX,
  PROFILE_WORK_IDENTITY_REQUIRED,
  type ContactAccess,
  type ContactDepartment,
  type ContactDepartmentRef,
  type ContactVerificationInfo,
  type ContactDesignationCount,
  type ContactEmployee,
  type ContactFavorites,
  type ContactOffice,
  type ContactOfficeDetail,
  type ContactOverview,
  type ContactPhone,
  type ContactPrivacy,
  addMonths,
  BATCH_WINDOW_MONTHS,
  bcsBatchLabel,
  type BatchDirectory,
  type BatchGroup,
  type BatchMembers,
  type MyBatch,
  type ServiceInfo,
} from '@ibas/shared-types';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError, badRequest, notFound } from '../../shared/errors/AppError.js';
import { User } from '../users/models/User.model.js';
import { UserEntitlement } from '../billing/models/UserEntitlement.model.js';
import { Division } from '../setup/models/Division.model.js';
import { District } from '../setup/models/District.model.js';
import { Thana } from '../setup/models/Thana.model.js';
import { Office, type IOffice } from '../org/models/Office.model.js';
import { OfficeType } from '../org/models/OfficeType.model.js';
import { Designation } from '../org/models/Designation.model.js';
import { ancestorChain, departmentOf, officeIndex, parentPath, subtreeIds, workSnapshot, type IndexedOffice } from '../org/org.service.js';
import { isAdminUser } from '../community/community.service.js';
import { getServiceInfo } from '../org/service-info.service.js';
import { ContactFavorite } from './models/ContactFavorite.model.js';
import { canVerify, ensureVerification, isVerified, verificationInfo } from './verification.service.js';
import { activeChargesAt, activeChargesOf, pendingHandoverCount, type ChargeRow } from './charges.service.js';

const PLACEHOLDER_EMAIL_DOMAIN = '@phone.proassist.app';
const OVERVIEW_PER_TYPE = 6;
/** Only people who agreed to share their details appear in the directory. */
const LISTED = { status: 'active', directory_consent_at: { $ne: null } } as const;

function zodMessage(err: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return err.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function oid(id: string, what: string): Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) throw notFound(`${what} not found`);
  return new mongoose.Types.ObjectId(id);
}

/* ---------------------------------- viewer --------------------------------- */

interface Viewer {
  id: string;
  admin: boolean;
  honorable: boolean;
  paid: boolean;
  ready: boolean;
  consentedAt: Date | null;
  work: boolean;
  verified: boolean;
  verification: ContactVerificationInfo | null;
  canVerify: boolean;
  pendingHandovers: number;
  myOfficeId: string | null;
  myDepartment: IndexedOffice | null;
  privacy: ContactPrivacy;
  favorites: { office: Set<string>; user: Set<string> };
}

async function loadViewer(user: AuthUser): Promise<Viewer> {
  const admin = isAdminUser(user);
  const [doc, work, entitled, favs, pendingHandovers, map] = await Promise.all([
    User.findById(user.id).select('amount_received office_id directory_hide_phone directory_hide_email directory_consent_at contact_honorable').lean(),
    workSnapshot(user.id),
    admin ? Promise.resolve(null) : UserEntitlement.exists({ user_id: user.id, is_revoked: false, starts_at: { $lte: new Date() }, ends_at: { $gt: new Date() } }),
    ContactFavorite.find({ user_id: user.id }).select('target_type target_id').lean(),
    pendingHandoverCount(user.id),
    officeIndex(),
  ]);
  const own = await ensureVerification(user.id, !!work);
  const verified = isVerified(own);
  const [verification, verifier] = await Promise.all([verificationInfo(own), canVerify(user, own)]);
  const honorable = !!doc?.contact_honorable;
  const consentedAt = doc?.directory_consent_at ?? null;
  const paid = admin || honorable || Number(doc?.amount_received ?? 0) > 0 || !!entitled;
  return {
    id: user.id,
    admin,
    honorable,
    paid,
    ready: admin || honorable || (!!consentedAt && !!work && verified),
    consentedAt,
    work: !!work,
    verified,
    verification: work ? verification : null,
    canVerify: verifier,
    pendingHandovers,
    myOfficeId: doc?.office_id ? String(doc.office_id) : null,
    myDepartment: work ? departmentOf(map, String(work.office_id)) : null,
    privacy: { hide_phone: !!doc?.directory_hide_phone, hide_email: !!doc?.directory_hide_email },
    favorites: {
      office: new Set(favs.filter((f) => f.target_type === 'office').map((f) => String(f.target_id))),
      user: new Set(favs.filter((f) => f.target_type === 'user').map((f) => String(f.target_id))),
    },
  };
}

function departmentRef(d: IndexedOffice | null): ContactDepartmentRef | null {
  return d ? { id: d.id, name: d.name, short_name: d.short_name } : null;
}

function toAccess(v: Viewer): ContactAccess {
  return {
    ready: v.ready,
    consented: !!v.consentedAt,
    consented_at: v.consentedAt ? v.consentedAt.toISOString() : undefined,
    honorable: v.honorable,
    my_department: departmentRef(v.myDepartment),
    work: v.work,
    verified: v.verified,
    verification: v.verification,
    can_verify: v.canVerify,
    pending_handovers: v.pendingHandovers,
    can_dial: v.paid,
    is_admin: v.admin,
    my_office_id: v.myOfficeId,
    privacy: v.privacy,
  };
}

async function readyViewer(user: AuthUser): Promise<Viewer> {
  const v = await loadViewer(user);
  if (!v.ready) {
    if (!v.consentedAt) {
      throw new AppError(403, CONTACT_CONSENT_REQUIRED, 'Agree to share your details with directory users to open the contact directory.');
    }
    if (!v.work) throw new AppError(403, PROFILE_WORK_IDENTITY_REQUIRED, 'Add your office and designation to open the contact directory.');
    throw new AppError(
      403,
      CONTACT_VERIFICATION_REQUIRED,
      `Share your 8-digit code with a verified colleague of grade 1–${CONTACT_VERIFIER_GRADE_MAX} to open the contact directory.`,
    );
  }
  return v;
}

export async function getAccess(user: AuthUser): Promise<ContactAccess> {
  return toAccess(await loadViewer(user));
}

/** Accepting keeps the first consent date; withdrawing takes the user out of the directory. */
export async function setConsent(user: AuthUser, body: unknown): Promise<ContactAccess> {
  const parsed = contactConsentSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  if (parsed.data.accept) {
    await User.updateOne({ _id: user.id, directory_consent_at: null }, { $set: { directory_consent_at: new Date() } });
  } else {
    await User.updateOne({ _id: user.id }, { $set: { directory_consent_at: null } });
  }
  return getAccess(user);
}

/** A requested department, else the viewer's own; admins and honorable users default to every department. */
function scopeDepartment(v: Viewer, map: Map<string, IndexedOffice>, requested?: string): IndexedOffice | null {
  if (requested) {
    const d = map.get(requested);
    if (!d || !d.is_active || d.parent_id) throw notFound('Department not found');
    return d;
  }
  if (v.admin || v.honorable) return null;
  return v.myDepartment;
}

/* ---------------------------------- phones --------------------------------- */

/** First dialable number in a field like "02-9512345, Ext. 210". */
function dialable(raw: string): string | undefined {
  const first = raw.split(/,|;|\/|ext\.?|x/i)[0] ?? '';
  const plus = first.trim().startsWith('+');
  const digits = first.replace(/\D/g, '');
  return digits.length >= 3 ? `${plus ? '+' : ''}${digits}` : undefined;
}

function maskNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 4) return '••••';
  return `${digits.slice(0, 3)}${'•'.repeat(Math.max(3, digits.length - 5))}${digits.slice(-2)}`;
}

function phoneOut(raw: string | undefined | null, paid: boolean): ContactPhone | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  return paid ? { display: v, dial: dialable(v) } : { display: maskNumber(v) };
}

/* ---------------------------------- offices --------------------------------- */

interface OfficeStats {
  map: Map<string, IndexedOffice>;
  direct: Map<string, number>;
  total: Map<string, number>;
  subCount: Map<string, number>;
}

async function officeStats(): Promise<OfficeStats> {
  const map = await officeIndex();
  const activeIds = [...map.values()].filter((o) => o.is_active).map((o) => new mongoose.Types.ObjectId(o.id));
  const rows = await User.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { ...LISTED, office_id: { $in: activeIds } } },
    { $group: { _id: '$office_id', n: { $sum: 1 } } },
  ]);
  const direct = new Map(rows.map((r) => [String(r._id), r.n]));
  const kids = new Map<string, string[]>();
  for (const o of map.values()) {
    if (!o.is_active || !o.parent_id) continue;
    kids.set(o.parent_id, [...(kids.get(o.parent_id) ?? []), o.id]);
  }
  const total = new Map<string, number>();
  const visiting = new Set<string>();
  const sum = (id: string): number => {
    const known = total.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const n = (direct.get(id) ?? 0) + (kids.get(id) ?? []).reduce((acc, k) => acc + sum(k), 0);
    visiting.delete(id);
    total.set(id, n);
    return n;
  };
  for (const o of map.values()) if (o.is_active) sum(o.id);
  const subCount = new Map([...kids.entries()].map(([k, v]) => [k, v.length]));
  return { map, direct, total, subCount };
}

async function toContactOffices(docs: IOffice[], v: Viewer, stats: OfficeStats): Promise<ContactOffice[]> {
  const typeIds = [...new Set(docs.map((d) => String(d.office_type_id)))];
  const districtIds = [...new Set(docs.map((d) => d.district_id && String(d.district_id)).filter(Boolean))] as string[];
  const thanaIds = [...new Set(docs.map((d) => d.thana_id && String(d.thana_id)).filter(Boolean))] as string[];
  const divisionIds = [...new Set(docs.map((d) => stats.map.get(String(d._id))?.division_id).filter(Boolean))] as string[];
  const [types, divisions, districts, thanas] = await Promise.all([
    OfficeType.find({ _id: { $in: typeIds } }).select('name short_name').lean(),
    divisionIds.length ? Division.find({ _id: { $in: divisionIds } }).select('name_en').lean() : [],
    districtIds.length ? District.find({ _id: { $in: districtIds } }).select('name_en').lean() : [],
    thanaIds.length ? Thana.find({ _id: { $in: thanaIds } }).select('name_en').lean() : [],
  ]);
  const typeMap = new Map(types.map((t) => [String(t._id), t]));
  const divMap = new Map(divisions.map((d) => [String(d._id), d.name_en]));
  const distMap = new Map(districts.map((d) => [String(d._id), d.name_en]));
  const thanaMap = new Map(thanas.map((t) => [String(t._id), t.name_en]));
  return docs.map((d) => {
    const id = String(d._id);
    const t = typeMap.get(String(d.office_type_id));
    const parentId = d.parent_id ? String(d.parent_id) : null;
    const divisionId = stats.map.get(id)?.division_id;
    return {
      id,
      name: d.name,
      name_bn: d.name_bn || undefined,
      short_name: d.short_name || undefined,
      office_code: d.office_code || undefined,
      office_type: t ? { id: String(t._id), name: t.name, short_name: t.short_name } : null,
      parent_id: parentId,
      parent_path: parentPath(stats.map, parentId),
      email: d.email || undefined,
      web_address: d.web_address || undefined,
      address: d.address || undefined,
      division_name: divisionId ? divMap.get(divisionId) : undefined,
      district_name: d.district_id ? distMap.get(String(d.district_id)) : undefined,
      thana_name: d.thana_id ? thanaMap.get(String(d.thana_id)) : undefined,
      telephone: phoneOut(d.telephone, v.paid),
      mobile: phoneOut(d.mobile, v.paid),
      pabx: phoneOut(d.pabx, v.paid),
      fax: phoneOut(d.fax, v.paid),
      sub_office_count: stats.subCount.get(id) ?? 0,
      employee_count: stats.direct.get(id) ?? 0,
      employee_total: stats.total.get(id) ?? 0,
      is_favorite: v.favorites.office.has(id),
      is_my_office: v.myOfficeId === id,
    };
  });
}

const toOids = (ids: Iterable<string>) => [...ids].map((id) => new mongoose.Types.ObjectId(id));

export async function getOverview(user: AuthUser, query: unknown = {}): Promise<ContactOverview> {
  const v = await readyViewer(user);
  const parsed = contactOverviewQuerySchema.safeParse(query);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const [stats, types] = await Promise.all([officeStats(), OfficeType.find({ is_active: true }).sort({ serial_no: 1, name: 1 }).lean()]);
  const dept = scopeDepartment(v, stats.map, parsed.data.department_id || undefined);
  const inScope = dept ? new Set(subtreeIds(stats.map, dept.id)) : null;
  const active = [...stats.map.values()].filter((o) => o.is_active && (!inScope || inScope.has(o.id)));
  const byType = new Map<string, number>();
  for (const o of active) byType.set(o.office_type_id, (byType.get(o.office_type_id) ?? 0) + 1);
  const scopeFilter = inScope ? { _id: { $in: toOids(inScope) } } : {};

  const groups = await Promise.all(
    types
      .filter((t) => (byType.get(String(t._id)) ?? 0) > 0)
      .map(async (t) => {
        const docs = await Office.find({ is_active: true, office_type_id: t._id, ...scopeFilter })
          .sort({ serial_no: 1, name: 1 })
          .limit(OVERVIEW_PER_TYPE);
        return {
          type: { id: String(t._id), name: t.name, short_name: t.short_name },
          office_count: byType.get(String(t._id)) ?? 0,
          offices: await toContactOffices(docs, v, stats),
        };
      }),
  );
  const employees = active.reduce((sum, o) => sum + (stats.direct.get(o.id) ?? 0), 0);
  return {
    access: toAccess(v),
    department: departmentRef(dept),
    totals: { offices: active.length, employees, office_types: groups.length },
    groups,
  };
}

/** Top-level offices with their whole-department counts; the viewer's own comes first. */
export async function listDepartments(user: AuthUser): Promise<ContactDepartment[]> {
  const v = await readyViewer(user);
  const [stats, docs] = await Promise.all([officeStats(), Office.find({ is_active: true, parent_id: null }).sort({ serial_no: 1, name: 1 })]);
  const cards = await toContactOffices(docs, v, stats);
  return cards
    .map((c) => ({ ...c, office_count: subtreeIds(stats.map, c.id).length, is_my_department: v.myDepartment?.id === c.id }))
    .sort((a, b) => Number(b.is_my_department) - Number(a.is_my_department));
}

export async function listOffices(user: AuthUser, query: unknown) {
  const v = await readyViewer(user);
  const parsed = contactOfficeQuerySchema.safeParse(query);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const q = parsed.data;
  const stats = await officeStats();
  const filter: Record<string, unknown> = { is_active: true };
  if (q.type_id) filter.office_type_id = new mongoose.Types.ObjectId(q.type_id);
  if (q.parent_id) {
    filter.parent_id = new mongoose.Types.ObjectId(q.parent_id);
  } else {
    const dept = scopeDepartment(v, stats.map, q.department_id || undefined);
    if (dept) filter._id = { $in: toOids(subtreeIds(stats.map, dept.id)) };
  }
  if (q.q) {
    const rx = new RegExp(escapeRx(q.q), 'i');
    filter.$or = [{ name: rx }, { name_bn: rx }, { short_name: rx }, { office_code: rx }, { email: rx }, { address: rx }];
  }
  const [total, docs] = await Promise.all([
    Office.countDocuments(filter),
    Office.find(filter)
      .sort({ serial_no: 1, name: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit),
  ]);
  return { items: await toContactOffices(docs, v, stats), total, page: q.page, limit: q.limit };
}

export async function getOffice(user: AuthUser, id: string): Promise<ContactOfficeDetail> {
  const v = await readyViewer(user);
  const doc = await Office.findById(oid(id, 'Office'));
  if (!doc || (!doc.is_active && !v.admin)) throw notFound('Office not found');
  const stats = await officeStats();
  const [card] = await toContactOffices([doc], v, stats);
  const chain = ancestorChain(stats.map, doc.parent_id ? String(doc.parent_id) : null);
  return {
    ...card!,
    description: doc.description || undefined,
    breadcrumb: chain.map((n) => ({ id: n.id, name: n.name, short_name: n.short_name })),
  };
}

/* --------------------------------- employees -------------------------------- */

interface EmployeeRow {
  _id: Types.ObjectId;
  full_name_en?: string;
  full_name_bn?: string;
  email?: string;
  phone?: string;
  office_id?: Types.ObjectId | null;
  designation_id?: Types.ObjectId | null;
  directory_hide_phone?: boolean;
  directory_hide_email?: boolean;
  work_section?: string;
  work_telephone?: string;
  work_pabx?: string;
  d?: { _id: Types.ObjectId; name: string; short_name: string; grade?: number | null } | null;
}

/** The office scope being browsed, so additional-charge holders can be labelled as such. */
interface ListScope {
  officeIds: Set<string>;
  designationId?: string;
  charges: ChargeRow[];
}

interface EmployeeExtras {
  charges: Map<string, ContactEmployee['additional_charges']>;
  designations: Map<string, { id: string; name: string; short_name: string }>;
  scope?: ListScope;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?'
  );
}

function inScope(r: EmployeeRow, scope: ListScope): boolean {
  if (!r.office_id || !scope.officeIds.has(String(r.office_id))) return false;
  return !scope.designationId || String(r.designation_id) === scope.designationId;
}

function toEmployee(r: EmployeeRow, v: Viewer, map: Map<string, IndexedOffice>, extras: EmployeeExtras): ContactEmployee {
  const id = String(r._id);
  const me = id === v.id;
  const name = r.full_name_en?.trim() || r.full_name_bn?.trim() || 'Member';
  const office = r.office_id ? map.get(String(r.office_id)) : undefined;
  const hidePhone = !!r.directory_hide_phone && !me && !v.admin;
  const hideEmail = !!r.directory_hide_email && !me && !v.admin;
  const email = r.email && !r.email.endsWith(PLACEHOLDER_EMAIL_DOMAIN) ? r.email : undefined;
  const scope = extras.scope;
  const listedCharge = scope && !inScope(r, scope) ? scope.charges.find((c) => String(c.user_id) === id) : undefined;
  const listedDesignation = listedCharge ? extras.designations.get(String(listedCharge.designation_id)) : undefined;
  return {
    id,
    name,
    name_bn: r.full_name_bn?.trim() || undefined,
    initials: initialsOf(name),
    designation: r.d ? { id: String(r.d._id), name: r.d.name, short_name: r.d.short_name, grade: r.d.grade ?? null } : null,
    office: office ? { id: office.id, name: office.name, short_name: office.short_name, parent_path: parentPath(map, office.parent_id) } : null,
    section: r.work_section?.trim() || undefined,
    mobile: hidePhone ? undefined : phoneOut(r.phone, v.paid || me),
    telephone: phoneOut(r.work_telephone, v.paid || me),
    pabx: phoneOut(r.work_pabx, v.paid || me),
    email: hideEmail ? undefined : email,
    phone_hidden: hidePhone,
    additional_charges: extras.charges.get(id) ?? [],
    listed_as_additional: listedDesignation ? { designation: listedDesignation } : undefined,
    is_favorite: v.favorites.user.has(id),
    is_me: me,
  };
}

async function toEmployees(rows: EmployeeRow[], v: Viewer, map: Map<string, IndexedOffice>, scope?: ListScope): Promise<ContactEmployee[]> {
  const charges = await activeChargesOf(rows.map((r) => r._id));
  const designationIds = [...new Set([...charges, ...(scope?.charges ?? [])].map((c) => String(c.designation_id)))];
  const designations = designationIds.length ? await Designation.find({ _id: { $in: designationIds } }).select('name short_name').lean() : [];
  const dm = new Map(designations.map((d) => [String(d._id), { id: String(d._id), name: d.name, short_name: d.short_name }]));
  const byUser = new Map<string, ContactEmployee['additional_charges']>();
  for (const c of charges) {
    const o = map.get(String(c.office_id));
    const d = dm.get(String(c.designation_id));
    if (!o || !d) continue;
    const key = String(c.user_id);
    byUser.set(key, [...(byUser.get(key) ?? []), { designation: d, office: { id: o.id, name: o.name, short_name: o.short_name } }]);
  }
  return rows.map((r) => toEmployee(r, v, map, { charges: byUser, designations: dm, scope }));
}

const EMPLOYEE_FIELDS = {
  full_name_en: 1,
  full_name_bn: 1,
  email: 1,
  phone: 1,
  office_id: 1,
  designation_id: 1,
  directory_hide_phone: 1,
  directory_hide_email: 1,
  work_section: 1,
  work_telephone: 1,
  work_pabx: 1,
} as const;

/** Sorts by grade; people listed for an additional charge sort by that post's grade. */
function designationLookup(scope?: ListScope): PipelineStage[] {
  const chargeFor = (scope?.charges ?? []).map((c) => ({ u: c.user_id, d: c.designation_id }));
  const stages: PipelineStage[] = [
    { $lookup: { from: 'designations', localField: 'designation_id', foreignField: '_id', as: 'd' } },
    { $set: { d: { $arrayElemAt: ['$d', 0] } } },
  ];
  if (chargeFor.length && scope) {
    const officeOids = [...scope.officeIds].map((id) => new mongoose.Types.ObjectId(id));
    const primaryInScope: Record<string, unknown>[] = [{ $in: ['$office_id', officeOids] }];
    if (scope.designationId) primaryInScope.push({ $eq: ['$designation_id', new mongoose.Types.ObjectId(scope.designationId)] });
    stages.push(
      {
        $set: {
          _cd: {
            $cond: [
              { $and: primaryInScope },
              null,
              { $let: { vars: { m: { $arrayElemAt: [{ $filter: { input: chargeFor, cond: { $eq: ['$$this.u', '$_id'] } } }, 0] } }, in: '$$m.d' } },
            ],
          },
        },
      },
      { $lookup: { from: 'designations', localField: '_cd', foreignField: '_id', as: 'cd' } },
      { $set: { cd: { $arrayElemAt: ['$cd', 0] } } },
    );
  }
  stages.push({
    $set: {
      _g: { $ifNull: ['$cd.grade', { $ifNull: ['$d.grade', 99] }] },
      _s: { $ifNull: ['$cd.serial_no', { $ifNull: ['$d.serial_no', 99_999] }] },
      _n: { $toLower: { $ifNull: ['$full_name_en', ''] } },
    },
  });
  return stages;
}

/**
 * Match stage for active people in the chosen office scope (or every active office). When a specific
 * office is browsed, people holding an additional charge there are included too.
 */
async function employeeMatch(
  map: Map<string, IndexedOffice>,
  opts: { office_id?: string; include_sub?: boolean; department_id?: string; designation_id?: string; q?: string; viewerPaid: boolean },
): Promise<{ match: Record<string, unknown>; scope?: ListScope }> {
  let officeIds: string[];
  if (opts.office_id) {
    const o = map.get(opts.office_id);
    if (!o || !o.is_active) throw notFound('Office not found');
    officeIds = opts.include_sub ? subtreeIds(map, opts.office_id) : [opts.office_id];
  } else if (opts.department_id) {
    officeIds = subtreeIds(map, opts.department_id);
  } else {
    officeIds = [...map.values()].filter((o) => o.is_active).map((o) => o.id);
  }
  const officeOids = officeIds.map((id) => new mongoose.Types.ObjectId(id));
  const designationOid = opts.designation_id ? new mongoose.Types.ObjectId(opts.designation_id) : undefined;
  const primary: Record<string, unknown> = { office_id: { $in: officeOids } };
  if (designationOid) primary.designation_id = designationOid;

  const and: Record<string, unknown>[] = [];
  let scope: ListScope | undefined;
  const charges = opts.office_id ? await activeChargesAt(officeOids, designationOid) : [];
  if (charges.length) {
    scope = { officeIds: new Set(officeIds), designationId: opts.designation_id, charges };
    and.push({ $or: [primary, { _id: { $in: [...new Set(charges.map((c) => String(c.user_id)))].map((id) => new mongoose.Types.ObjectId(id)) } }] });
  } else {
    and.push(primary);
  }
  if (opts.q) {
    const rx = new RegExp(escapeRx(opts.q), 'i');
    const [desig, offices] = await Promise.all([
      Designation.find({ $or: [{ name: rx }, { short_name: rx }, { name_bn: rx }] }).select('_id').lean(),
      Promise.resolve([...map.values()].filter((o) => rx.test(o.name) || (o.short_name && rx.test(o.short_name))).map((o) => o.id)),
    ]);
    const or: Record<string, unknown>[] = [{ full_name_en: rx }, { full_name_bn: rx }, { email: rx }, { work_section: rx }];
    if (opts.viewerPaid && /\d{3,}/.test(opts.q)) or.push({ phone: new RegExp(escapeRx(opts.q.replace(/\D/g, ''))) });
    if (desig.length) or.push({ designation_id: { $in: desig.map((d) => d._id) } });
    if (offices.length) or.push({ office_id: { $in: offices.map((id) => new mongoose.Types.ObjectId(id)) } });
    and.push({ $or: or });
  }
  return { match: { ...LISTED, $and: and }, scope };
}

/** Department to list people from when no office is chosen. */
function employeeDepartment(v: Viewer, map: Map<string, IndexedOffice>, q: { office_id?: string; department_id?: string }): string | undefined {
  if (q.office_id) return undefined;
  return scopeDepartment(v, map, q.department_id || undefined)?.id;
}

export async function listEmployees(user: AuthUser, query: unknown) {
  const v = await readyViewer(user);
  const parsed = contactEmployeeQuerySchema.safeParse(query);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const q = parsed.data;
  const map = await officeIndex();
  const { match, scope } = await employeeMatch(map, {
    office_id: q.office_id || undefined,
    include_sub: q.include_sub,
    department_id: employeeDepartment(v, map, q),
    designation_id: q.designation_id || undefined,
    q: q.q,
    viewerPaid: v.paid,
  });
  const [res] = await User.aggregate<{ items: EmployeeRow[]; total: Array<{ n: number }> }>([
    { $match: match },
    { $project: EMPLOYEE_FIELDS },
    ...designationLookup(scope),
    { $sort: { _g: 1, _s: 1, _n: 1, _id: 1 } },
    { $facet: { items: [{ $skip: (q.page - 1) * q.limit }, { $limit: q.limit }], total: [{ $count: 'n' }] } },
  ]);
  return {
    items: await toEmployees(res?.items ?? [], v, map, scope),
    total: res?.total[0]?.n ?? 0,
    page: q.page,
    limit: q.limit,
  };
}

export async function designationCounts(user: AuthUser, query: unknown): Promise<ContactDesignationCount[]> {
  const v = await readyViewer(user);
  const parsed = contactEmployeeQuerySchema.safeParse(query);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const q = parsed.data;
  const map = await officeIndex();
  const { match, scope } = await employeeMatch(map, {
    office_id: q.office_id || undefined,
    include_sub: q.include_sub,
    department_id: employeeDepartment(v, map, q),
    q: q.q,
    viewerPaid: v.paid,
  });
  const rows = await User.find(match).select('office_id designation_id').lean();
  const counts = new Map<string, number>();
  const bump = (id: unknown) => id && counts.set(String(id), (counts.get(String(id)) ?? 0) + 1);
  for (const r of rows) {
    if (!scope || (r.office_id && scope.officeIds.has(String(r.office_id)))) {
      bump(r.designation_id);
      continue;
    }
    const posts = new Set(scope.charges.filter((c) => String(c.user_id) === String(r._id)).map((c) => String(c.designation_id)));
    posts.forEach(bump);
  }
  const designations = await Designation.find({ _id: { $in: [...counts.keys()] } })
    .select('name short_name grade serial_no')
    .lean();
  return designations
    .sort((a, b) => (a.grade ?? 99) - (b.grade ?? 99) || (a.serial_no ?? 0) - (b.serial_no ?? 0) || a.name.localeCompare(b.name))
    .map((d) => ({ id: String(d._id), name: d.name, short_name: d.short_name, grade: d.grade ?? null, count: counts.get(String(d._id)) ?? 0 }));
}

/* --------------------------------- favourites -------------------------------- */

export async function toggleFavorite(user: AuthUser, body: unknown): Promise<{ favorite: boolean }> {
  await readyViewer(user);
  const parsed = contactFavoriteSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const { target_type, target_id } = parsed.data;
  const exists = target_type === 'office' ? await Office.exists({ _id: target_id, is_active: true }) : await User.exists({ _id: target_id, ...LISTED });
  if (!exists) throw notFound(target_type === 'office' ? 'Office not found' : 'Person not found');
  const removed = await ContactFavorite.findOneAndDelete({ user_id: user.id, target_type, target_id });
  if (removed) return { favorite: false };
  await ContactFavorite.create({ user_id: user.id, target_type, target_id });
  return { favorite: true };
}

export async function listFavorites(user: AuthUser): Promise<ContactFavorites> {
  const v = await readyViewer(user);
  const officeIds = [...v.favorites.office].map((id) => new mongoose.Types.ObjectId(id));
  const userIds = [...v.favorites.user].map((id) => new mongoose.Types.ObjectId(id));
  const [stats, officeDocs, map] = await Promise.all([
    officeStats(),
    officeIds.length ? Office.find({ _id: { $in: officeIds }, is_active: true }).sort({ name: 1 }) : Promise.resolve([]),
    officeIndex(),
  ]);
  const rows = userIds.length
    ? await User.aggregate<EmployeeRow>([
        { $match: { _id: { $in: userIds }, ...LISTED } },
        { $project: EMPLOYEE_FIELDS },
        ...designationLookup(),
        { $sort: { _g: 1, _s: 1, _n: 1 } },
      ])
    : [];
  return { offices: await toContactOffices(officeDocs, v, stats), employees: await toEmployees(rows, v, map) };
}

/* ---------------------------------- privacy --------------------------------- */

export async function setPrivacy(user: AuthUser, body: unknown): Promise<ContactPrivacy> {
  const parsed = contactPrivacySchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  await User.updateOne(
    { _id: user.id },
    { $set: { directory_hide_phone: parsed.data.hide_phone, directory_hide_email: parsed.data.hide_email } },
  );
  return parsed.data;
}

/* --------------------------------- batchmates -------------------------------- */

const MAX_BATCH_MEMBERS = 500;

interface Cohort {
  designationId: string;
  start: Date;
  windowEnd: Date;
  last: Date;
  userIds: Types.ObjectId[];
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const cohortKey = (c: Cohort) => `post:${c.designationId}:${ymd(c.start)}`;

/** Batches only count people the directory lists, so group sizes match what members can open. */
async function listedMatch(): Promise<Record<string, unknown>> {
  const map = await officeIndex();
  const activeIds = [...map.values()].filter((o) => o.is_active).map((o) => new mongoose.Types.ObjectId(o.id));
  return { ...LISTED, office_id: { $in: activeIds } };
}

/**
 * Non-cadre batches: per joining post, people sorted by joining date; a batch starts with the
 * earliest joiner not yet placed and takes everyone who joined within BATCH_WINDOW_MONTHS of them.
 */
async function postCohorts(designationId?: string): Promise<Cohort[]> {
  const filter: Record<string, unknown> = {
    ...(await listedMatch()),
    service_type: 'non_cadre',
    joining_designation_id: designationId ? new mongoose.Types.ObjectId(designationId) : { $ne: null },
    joining_date: { $ne: null },
  };
  const rows = await User.find(filter).select('joining_designation_id joining_date').sort({ joining_designation_id: 1, joining_date: 1, _id: 1 }).lean();
  const out: Cohort[] = [];
  let cur: Cohort | null = null;
  for (const r of rows) {
    const did = String(r.joining_designation_id);
    const d = r.joining_date!;
    if (!cur || cur.designationId !== did || d.getTime() > cur.windowEnd.getTime()) {
      cur = { designationId: did, start: d, windowEnd: addMonths(d, BATCH_WINDOW_MONTHS), last: d, userIds: [] };
      out.push(cur);
    }
    cur.userIds.push(r._id as Types.ObjectId);
    cur.last = d;
  }
  return out;
}

async function designationInfo(ids: string[]) {
  const rows = ids.length ? await Designation.find({ _id: { $in: ids } }).select('name short_name grade').lean() : [];
  return new Map(rows.map((d) => [String(d._id), { id: String(d._id), name: d.name, short_name: d.short_name, grade: d.grade ?? null }]));
}

function cohortGroup(c: Cohort, dm: Awaited<ReturnType<typeof designationInfo>>, me: string): BatchGroup {
  const d = dm.get(c.designationId);
  return {
    key: cohortKey(c),
    kind: 'non_cadre',
    title: d?.name ?? 'Unknown post',
    designation: d,
    from: c.start.toISOString(),
    to: c.last.toISOString(),
    count: c.userIds.length,
    is_mine: c.userIds.some((id) => String(id) === me),
  };
}

const cadreMatch = async (batch?: number) => ({ ...(await listedMatch()), service_type: 'cadre', bcs_batch: batch ?? { $ne: null } });

async function cadreGroups(me: ServiceInfo, batch?: number): Promise<BatchGroup[]> {
  const rows = await User.aggregate<{ _id: number; n: number; from: Date | null; to: Date | null }>([
    { $match: await cadreMatch(batch) },
    { $group: { _id: '$bcs_batch', n: { $sum: 1 }, from: { $min: '$joining_date' }, to: { $max: '$joining_date' } } },
    { $sort: { _id: -1 } },
  ]);
  return rows.map((r) => ({
    key: `cadre:${r._id}`,
    kind: 'cadre',
    title: bcsBatchLabel(r._id),
    bcs_batch: r._id,
    from: r.from ? r.from.toISOString() : null,
    to: r.to ? r.to.toISOString() : null,
    count: r.n,
    is_mine: me.service_type === 'cadre' && me.bcs_batch === r._id,
  }));
}

async function batchMembers(match: Record<string, unknown>, v: Viewer): Promise<ContactEmployee[]> {
  const map = await officeIndex();
  const rows = await User.aggregate<EmployeeRow>([
    { $match: match },
    { $project: EMPLOYEE_FIELDS },
    ...designationLookup(),
    { $sort: { _g: 1, _s: 1, _n: 1, _id: 1 } },
    { $limit: MAX_BATCH_MEMBERS },
  ]);
  return toEmployees(rows, v, map);
}

export async function getMyBatch(user: AuthUser): Promise<MyBatch> {
  const v = await readyViewer(user);
  const info = await getServiceInfo(user.id);
  if (!info.complete) return { info, group: null, members: [] };

  if (info.service_type === 'cadre') {
    const [group] = await cadreGroups(info, info.bcs_batch!);
    return { info, group: group ?? null, members: group ? await batchMembers(await cadreMatch(info.bcs_batch!), v) : [] };
  }
  const cohorts = await postCohorts(info.joining_designation!.id);
  const mine = cohorts.find((c) => c.userIds.some((id) => String(id) === user.id));
  if (!mine) return { info, group: null, members: [] };
  const dm = await designationInfo([mine.designationId]);
  return { info, group: cohortGroup(mine, dm, user.id), members: await batchMembers({ _id: { $in: mine.userIds }, ...LISTED }, v) };
}

export async function listBatches(user: AuthUser): Promise<BatchDirectory> {
  await readyViewer(user);
  const info = await getServiceInfo(user.id);
  const [cadre, cohorts] = await Promise.all([cadreGroups(info), postCohorts()]);
  const dm = await designationInfo([...new Set(cohorts.map((c) => c.designationId))]);
  const nonCadre = cohorts
    .map((c) => cohortGroup(c, dm, user.id))
    .sort((a, b) => (a.designation?.grade ?? 99) - (b.designation?.grade ?? 99) || a.title.localeCompare(b.title) || (b.from ?? '').localeCompare(a.from ?? ''));
  return { cadre, non_cadre: nonCadre };
}

export async function getBatchMembers(user: AuthUser, key: string): Promise<BatchMembers> {
  const v = await readyViewer(user);
  const info = await getServiceInfo(user.id);
  const cadre = /^cadre:(\d{1,2})$/.exec(key);
  if (cadre) {
    const batch = Number(cadre[1]);
    const [group] = await cadreGroups(info, batch);
    if (!group) throw notFound('Batch not found');
    return { group, members: await batchMembers(await cadreMatch(batch), v) };
  }
  const post = /^post:([a-f\d]{24}):(\d{4}-\d{2}-\d{2})$/i.exec(key);
  if (!post) throw notFound('Batch not found');
  const cohorts = await postCohorts(post[1]);
  const c = cohorts.find((x) => ymd(x.start) === post[2]);
  if (!c) throw notFound('This batch has changed — open it again from the list');
  const dm = await designationInfo([c.designationId]);
  return { group: cohortGroup(c, dm, user.id), members: await batchMembers({ _id: { $in: c.userIds }, ...LISTED }, v) };
}
