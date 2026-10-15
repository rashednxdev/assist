import mongoose from 'mongoose';
import {
  SALARY_OFFICE_REQUIRED_CODE,
  isSalaryBillPassingType,
  salaryFreeCalcsFor,
  salaryNeedsAccountingOffice,
  type AdminSalaryAccountingOfficeDto,
  type AdminSalaryOfficeAdminDto,
  type AdminSalaryOfficeEditableDto,
  type AdminSalaryOtherOfficeDto,
  type OfficeOption,
  type SalaryJoinedOfficesRecord,
  type SalaryFreeCalcsSettingsRecord,
  type SalaryOfficeRecord,
  type SalaryOfficeSettingsRecord,
  type SalaryOtherOfficeSuggestion,
  type SalaryStaffOfficeDto,
  type SalaryUserOfficeAdminRow,
  type SaveSalaryOfficeDto,
  type SetSalaryAccountingOfficeDto,
  type UpdateSalaryFreeCalcsDto,
  type UpdateSalaryOfficeSettingsDto,
} from '@ibas/shared-types';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError, badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';
import { OfficeType } from '../org/models/OfficeType.model.js';
import { departmentOf, officeIndex, parentPath, type IndexedOffice } from '../org/org.service.js';
import { User } from '../users/models/User.model.js';
import { SalarySettings } from './models/SalarySettings.model.js';
import { SalaryStaffOffice } from './models/SalaryStaffOffice.model.js';
import { SalaryUserOffice, type ISalaryUserOffice } from './models/SalaryUserOffice.model.js';
import { salaryFreeTrStates } from './salary-free-tr.service.js';

const SETTINGS_KEY = 'global';

export function isPlatformAdmin(user: AuthUser): boolean {
  return user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin';
}

export async function salaryJoinedOffices(): Promise<SalaryJoinedOfficesRecord> {
  return { joined_offices: await SalaryUserOffice.countDocuments({}) };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getSalaryOfficeSettings(): Promise<SalaryOfficeSettingsRecord> {
  const doc = await SalarySettings.findOne({ key: SETTINGS_KEY }).select('others_allowed updated_at').lean();
  return { others_allowed: doc?.others_allowed ?? true, updated_at: doc?.updated_at?.toISOString() ?? null };
}

export async function updateSalaryOfficeSettings(
  dto: UpdateSalaryOfficeSettingsDto,
  updatedBy: string,
): Promise<SalaryOfficeSettingsRecord> {
  await SalarySettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      others_allowed: dto.others_allowed,
      updated_by: new mongoose.Types.ObjectId(updatedBy),
      updated_at: new Date(),
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return getSalaryOfficeSettings();
}

function toOption(map: Map<string, IndexedOffice>, o: IndexedOffice, types?: Map<string, string>): OfficeOption {
  return {
    id: o.id,
    name: o.name,
    short_name: o.short_name,
    office_code: o.office_code,
    ...(types ? { type_short: types.get(o.office_type_id) } : {}),
    parent_path: parentPath(map, o.parent_id),
  };
}

/** The saved bill-passing office while it is still an active CAFO, DCA, DAFO or UAO office. */
function accountingOption(
  map: Map<string, IndexedOffice>,
  types: Map<string, string>,
  id: string | null | undefined,
): OfficeOption | null {
  const node = id ? map.get(id) : undefined;
  if (!node?.is_active || !isSalaryBillPassingType(types.get(node.office_type_id))) return null;
  return toOption(map, node, types);
}

function officeName(o: OfficeOption): string {
  return o.short_name && o.short_name !== o.name ? `${o.name} (${o.short_name})` : o.name;
}

async function officeTypeShorts(): Promise<Map<string, string>> {
  const types = await OfficeType.find({}).select('short_name').lean();
  return new Map(types.map((t) => [String(t._id), t.short_name]));
}

/** Null when nothing is saved or the listed office has since been removed or deactivated. */
function toRecord(
  map: Map<string, IndexedOffice>,
  types: Map<string, string>,
  doc: ISalaryUserOffice | null,
): SalaryOfficeRecord | null {
  if (!doc) return null;
  const circleNode = doc.circle_id ? map.get(String(doc.circle_id)) : undefined;
  const circle = circleNode?.is_active ? toOption(map, circleNode) : null;
  const accounting = accountingOption(map, types, doc.accounting_office_id ? String(doc.accounting_office_id) : null);
  if (doc.office_id) {
    const node = map.get(String(doc.office_id));
    if (!node?.is_active) return null;
    const office = toOption(map, node);
    const officeType = types.get(node.office_type_id) ?? null;
    const needsAccounting = salaryNeedsAccountingOffice({ is_other: false, office_type: officeType });
    return {
      circle,
      office,
      other_office_name: '',
      other_office_name_bn: '',
      label: officeName(office),
      bill_office_name: '',
      bill_office_editable: true,
      office_type: officeType,
      accounting_office: needsAccounting ? accounting : null,
      needs_accounting_office: needsAccounting && !accounting,
      office_admin: Boolean(doc.office_admin) && isSalaryBillPassingType(officeType),
      updated_at: doc.updated_at.toISOString(),
    };
  }
  if (!doc.other_office_name) return null;
  return {
    circle,
    office: null,
    other_office_name: doc.other_office_name,
    other_office_name_bn: doc.other_office_name_bn ?? '',
    label: doc.other_office_name,
    bill_office_name: doc.other_office_name_bn ?? '',
    bill_office_editable: Boolean(doc.office_name_editable),
    office_type: null,
    accounting_office: accounting,
    needs_accounting_office: !accounting,
    office_admin: false,
    updated_at: doc.updated_at.toISOString(),
  };
}

/** An "Others" office saved before the Bangla name was asked for; the user must add it once. */
function needsBanglaName(rec: SalaryOfficeRecord | null): boolean {
  return rec != null && !rec.office && !rec.other_office_name_bn;
}

export async function getMySalaryOffice(userId: string): Promise<SalaryOfficeRecord | null> {
  const [map, types, doc] = await Promise.all([officeIndex(), officeTypeShorts(), SalaryUserOffice.findOne({ user_id: userId })]);
  return toRecord(map, types, doc);
}

/** The office is chosen once; after that only an admin can change it (or reset it so the user chooses again). */
export async function saveMySalaryOffice(user: AuthUser, dto: SaveSalaryOfficeDto): Promise<SalaryOfficeRecord> {
  const current = await getMySalaryOffice(user.id);
  if (current && !isPlatformAdmin(user)) {
    if (!needsBanglaName(current)) throw forbidden('Your office is already set. Ask the admin to change it.');
    if (dto.office_id) throw forbidden('Add the Bangla office name. Ask the admin to change the office.');
  }
  const map = await officeIndex();
  if (dto.circle_id) {
    const circle = map.get(dto.circle_id);
    if (!circle?.is_active || circle.parent_id) throw badRequest('Select a circle from the list');
  }
  const types = await officeTypeShorts();
  let needsAccounting = true;
  if (dto.office_id) {
    const office = map.get(dto.office_id);
    if (!office?.is_active) throw badRequest('Select an office from the list');
    if (departmentOf(map, office.id)?.id !== dto.circle_id) throw badRequest('This office is not in the selected circle');
    needsAccounting = salaryNeedsAccountingOffice({ is_other: false, office_type: types.get(office.office_type_id) ?? null });
  } else if (!needsBanglaName(current) && !(await getSalaryOfficeSettings()).others_allowed) {
    throw badRequest('Choose your office from the list.');
  }
  const accountingId = needsAccounting ? dto.accounting_office_id : null;
  if (needsAccounting) {
    if (!accountingOption(map, types, accountingId)) throw badRequest('Select your bill-passing office (CAFO, DCA, DAFO or UAO) from the list');
    if (accountingId === dto.office_id) throw badRequest('Your office cannot pass its own bills');
  }
  const doc = await SalaryUserOffice.findOneAndUpdate(
    { user_id: user.id },
    {
      $set: {
        circle_id: dto.circle_id ? new mongoose.Types.ObjectId(dto.circle_id) : null,
        office_id: dto.office_id ? new mongoose.Types.ObjectId(dto.office_id) : null,
        other_office_name: dto.office_id ? '' : dto.other_office_name,
        other_office_name_bn: dto.office_id ? '' : dto.other_office_name_bn,
        accounting_office_id: accountingId ? new mongoose.Types.ObjectId(accountingId) : null,
        updated_at: new Date(),
      },
      $setOnInsert: { user_id: new mongoose.Types.ObjectId(user.id) },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return toRecord(map, types, doc)!;
}

/** Bill-passing office for a saved office that has none; once set, only the admin changes it. */
export async function setMyAccountingOffice(user: AuthUser, dto: SetSalaryAccountingOfficeDto): Promise<SalaryOfficeRecord> {
  const current = await getMySalaryOffice(user.id);
  if (!current) throw badRequest('Select your office first.');
  if (!current.needs_accounting_office && !(isPlatformAdmin(user) && current.accounting_office)) {
    throw forbidden(
      current.accounting_office
        ? 'Your bill-passing office is already set. Ask the admin to change it.'
        : 'Your office does not need a bill-passing office.',
    );
  }
  const [map, types] = await Promise.all([officeIndex(), officeTypeShorts()]);
  if (!accountingOption(map, types, dto.accounting_office_id)) {
    throw badRequest('Select your bill-passing office (CAFO, DCA, DAFO or UAO) from the list');
  }
  if (dto.accounting_office_id === current.office?.id) throw badRequest('Your office cannot pass its own bills');
  const doc = await SalaryUserOffice.findOneAndUpdate(
    { user_id: user.id },
    { $set: { accounting_office_id: new mongoose.Types.ObjectId(dto.accounting_office_id), updated_at: new Date() } },
    { new: true },
  );
  return toRecord(map, types, doc)!;
}

/** Active CAFO, DCA, DAFO and UAO offices matching the typed name, short name, code or parent office. */
export async function searchBillPassingOffices(q: string): Promise<OfficeOption[]> {
  const [map, types] = await Promise.all([officeIndex(), officeTypeShorts()]);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const out: Array<OfficeOption & { score: number }> = [];
  for (const o of map.values()) {
    if (!o.is_active || !isSalaryBillPassingType(types.get(o.office_type_id))) continue;
    const option = toOption(map, o, types);
    const own = `${o.name} ${o.short_name ?? ''} ${o.office_code ?? ''}`.toLowerCase();
    const hay = `${own} ${option.parent_path.toLowerCase()}`;
    if (terms.length && !terms.every((t) => hay.includes(t))) continue;
    out.push({ ...option, score: terms.length && terms.every((t) => own.includes(t)) ? 0 : 1 });
  }
  out.sort((a, b) => a.score - b.score || a.parent_path.localeCompare(b.parent_path) || a.name.localeCompare(b.name));
  return out.slice(0, 40).map(({ score: _score, ...o }) => o);
}

/** Office admins of the user's bill-passing office, as contact numbers; empty when it has none. */
export async function salaryOfficeContacts(
  userId: string,
): Promise<{ office: string | null; contacts: Array<{ label: string; number: string; whatsapp: boolean }> }> {
  const rec = await getMySalaryOffice(userId);
  const accounting = rec?.accounting_office;
  if (!accounting) return { office: null, contacts: [] };
  const admins = await SalaryUserOffice.find({
    office_id: new mongoose.Types.ObjectId(accounting.id),
    office_admin: true,
    user_id: { $ne: new mongoose.Types.ObjectId(userId) },
  })
    .select('user_id')
    .lean();
  if (admins.length === 0) return { office: officeName(accounting), contacts: [] };
  const users = await User.find({ _id: { $in: admins.map((a) => a.user_id) }, status: 'active' })
    .select('full_name_en phone')
    .sort({ full_name_en: 1 })
    .lean();
  return {
    office: officeName(accounting),
    contacts: users
      .filter((u) => u.phone)
      .map((u) => ({ label: `${u.full_name_en} (${accounting.short_name || accounting.name})`, number: u.phone, whatsapp: false })),
  };
}

export async function assertSalaryOfficeChosen(userId: string): Promise<void> {
  const rec = await getMySalaryOffice(userId);
  if (!rec) {
    throw new AppError(403, SALARY_OFFICE_REQUIRED_CODE, 'Select your office on the salary page first.');
  }
  if (rec.needs_accounting_office) {
    throw new AppError(403, SALARY_OFFICE_REQUIRED_CODE, 'Select your bill-passing office on the salary page first.');
  }
}

/** Order among the users who chose the same listed office (1 = first); a reset office goes to the back. */
async function officeRank(doc: ISalaryUserOffice): Promise<number | null> {
  if (!doc.office_id) return null;
  return 1 + (await SalaryUserOffice.countDocuments({ office_id: doc.office_id, _id: { $lt: doc._id } }));
}

export async function getSalaryFreeCalcs(): Promise<SalaryFreeCalcsSettingsRecord> {
  const doc = await SalarySettings.findOne({ key: SETTINGS_KEY }).select('free_calcs updated_at').lean();
  return { free_calcs: doc?.free_calcs ?? null, updated_at: doc?.updated_at?.toISOString() ?? null };
}

export async function updateSalaryFreeCalcs(
  dto: UpdateSalaryFreeCalcsDto,
  updatedBy: string,
): Promise<SalaryFreeCalcsSettingsRecord> {
  await SalarySettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      free_calcs: dto.free_calcs,
      updated_by: new mongoose.Types.ObjectId(updatedBy),
      updated_at: new Date(),
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return getSalaryFreeCalcs();
}

async function freeCalcsOf(
  doc: ISalaryUserOffice | null,
  rec: SalaryOfficeRecord | null,
  flat: number | null,
): Promise<{ rank: number | null; free: number }> {
  if (!doc || !rec) return { rank: null, free: 0 };
  const rank = await officeRank(doc);
  if (flat != null) return { rank, free: flat };
  return { rank, free: salaryFreeCalcsFor({ is_other: !rec.office, office_type: rec.office_type, rank: rank ?? 1 }) };
}

/** Free arrears calculations for the user: the admin's number, else by office type and order among that office's users. */
export async function salaryFreeCalcLimit(userId: string): Promise<number> {
  const [map, types, doc, { free_calcs }] = await Promise.all([
    officeIndex(),
    officeTypeShorts(),
    SalaryUserOffice.findOne({ user_id: userId }),
    getSalaryFreeCalcs(),
  ]);
  return (await freeCalcsOf(doc, toRecord(map, types, doc), free_calcs)).free;
}

export async function salaryFreeCalcLimits(userIds: string[]): Promise<Map<string, number>> {
  const [map, types, docs, { free_calcs }] = await Promise.all([
    officeIndex(),
    officeTypeShorts(),
    SalaryUserOffice.find({ user_id: { $in: userIds } }),
    getSalaryFreeCalcs(),
  ]);
  const out = new Map<string, number>(userIds.map((id) => [id, 0]));
  await Promise.all(
    docs.map(async (doc) =>
      out.set(String(doc.user_id), (await freeCalcsOf(doc, toRecord(map, types, doc), free_calcs)).free),
    ),
  );
  return out;
}

export async function salaryOfficeLabels(userIds: string[]): Promise<Map<string, string>> {
  const [map, types, docs] = await Promise.all([
    officeIndex(),
    officeTypeShorts(),
    SalaryUserOffice.find({ user_id: { $in: userIds } }),
  ]);
  const out = new Map<string, string>();
  for (const doc of docs) {
    const rec = toRecord(map, types, doc);
    if (rec) out.set(String(doc.user_id), rec.office ? rec.office.short_name || rec.office.name : `${rec.label} (Others)`);
  }
  return out;
}

/** "Others" offices with a Bangla name matching the typed text, most joined first. */
export async function searchOtherOffices(q: string): Promise<SalaryOtherOfficeSuggestion[]> {
  const text = q.trim().replace(/\s+/g, ' ');
  if (text.length < 2) return [];
  const pattern = new RegExp(escapeRegex(text).replace(/ /g, '\\s+'), 'i');
  const rows = await SalaryUserOffice.aggregate<{ _id: { en: string; bn: string }; users: number; last: Date }>([
    {
      $match: {
        office_id: null,
        other_office_name_bn: { $nin: [null, ''] },
        $or: [{ other_office_name: pattern }, { other_office_name_bn: pattern }],
      },
    },
    {
      $group: {
        _id: { en: { $trim: { input: '$other_office_name' } }, bn: { $trim: { input: '$other_office_name_bn' } } },
        users: { $sum: 1 },
        last: { $max: '$updated_at' },
      },
    },
    { $sort: { users: -1, last: -1 } },
    { $limit: 8 },
  ]);
  return rows.map((r) => ({ other_office_name: r._id.en, other_office_name_bn: r._id.bn, users: r.users }));
}

/* ------------------------------- admin ------------------------------- */

export async function listSalaryUserOffices(filters: {
  q?: string;
  othersOnly: boolean;
  officeAdminsOnly?: boolean;
  skip: number;
  limit: number;
}): Promise<{ items: SalaryUserOfficeAdminRow[]; total: number }> {
  const query: Record<string, unknown> = {};
  if (filters.othersOnly) query.office_id = null;
  if (filters.officeAdminsOnly) query.office_admin = true;
  const q = filters.q?.trim();
  if (q) {
    const pattern = { $regex: escapeRegex(q), $options: 'i' };
    const [users, staffOffices] = await Promise.all([
      User.find({
        $or: [{ full_name_en: pattern }, { full_name_bn: pattern }, { email: pattern }, { phone: pattern }],
      })
        .select('_id')
        .limit(500),
      SalaryStaffOffice.find({ name: pattern }).select('user_id').limit(500).lean(),
    ]);
    query.$or = [
      { user_id: { $in: [...users.map((u) => u._id), ...staffOffices.map((o) => o.user_id)] } },
      { other_office_name: pattern },
      { other_office_name_bn: pattern },
    ];
  }
  const [docs, total, map, types, { free_calcs }] = await Promise.all([
    SalaryUserOffice.find(query).sort({ updated_at: -1 }).skip(filters.skip).limit(filters.limit),
    SalaryUserOffice.countDocuments(query),
    officeIndex(),
    officeTypeShorts(),
    getSalaryFreeCalcs(),
  ]);
  const userIds = docs.map((d) => d.user_id);
  const [users, freeTr, staffOffices] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('full_name_en email phone'),
    salaryFreeTrStates(userIds.map(String)),
    SalaryStaffOffice.find({ user_id: { $in: userIds } }).sort({ created_at: 1, _id: 1 }).select('user_id name').lean(),
  ]);
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const staffOfficesBy = new Map<string, Array<{ id: string; name: string }>>();
  for (const o of staffOffices) {
    const list = staffOfficesBy.get(String(o.user_id)) ?? [];
    list.push({ id: String(o._id), name: o.name });
    staffOfficesBy.set(String(o.user_id), list);
  }
  const items = await Promise.all(docs.map(async (doc): Promise<SalaryUserOfficeAdminRow> => {
    const u = byId.get(String(doc.user_id));
    const rec = toRecord(map, types, doc);
    const { rank, free } = await freeCalcsOf(doc, rec, free_calcs);
    return {
      user: {
        id: String(doc.user_id),
        full_name_en: u?.full_name_en ?? '(deleted user)',
        email: u?.email ?? '',
        phone: u?.phone ?? '',
      },
      is_other: !doc.office_id,
      label: rec?.label ?? '(office removed — user must choose again)',
      other_office_name: doc.other_office_name ?? '',
      other_office_name_bn: doc.other_office_name_bn ?? '',
      office_type: rec?.office_type ?? null,
      office_rank: rank,
      free_calcs: free,
      free_tr_form: freeTr.get(String(doc.user_id)) ?? 'none',
      office_name_editable: Boolean(doc.office_name_editable),
      staff_offices: staffOfficesBy.get(String(doc.user_id)) ?? [],
      accounting_office: rec?.accounting_office ?? null,
      needs_accounting_office: rec?.needs_accounting_office ?? false,
      office_admin: rec?.office_admin ?? false,
      can_be_office_admin: Boolean(rec?.office) && isSalaryBillPassingType(rec?.office_type),
      updated_at: doc.updated_at.toISOString(),
    };
  }));
  return { items, total };
}

export async function adminUpdateOtherOffice(userId: string, dto: AdminSalaryOtherOfficeDto): Promise<void> {
  if (!mongoose.isValidObjectId(userId)) throw notFound('Office not found');
  const doc = await SalaryUserOffice.findOne({ user_id: userId });
  if (!doc) throw notFound('This user has not chosen an office yet');
  if (doc.office_id) throw badRequest('This user chose a listed office. Reset it so the user can choose again.');
  doc.other_office_name = dto.other_office_name;
  doc.other_office_name_bn = dto.other_office_name_bn;
  doc.updated_at = new Date();
  await doc.save();
}

export async function adminSetOfficeNameEditable(userId: string, dto: AdminSalaryOfficeEditableDto): Promise<void> {
  if (!mongoose.isValidObjectId(userId)) throw notFound('Office not found');
  const res = await SalaryUserOffice.updateOne({ user_id: userId }, { $set: { office_name_editable: dto.editable } });
  if (res.matchedCount === 0) throw notFound('This user has not chosen an office yet');
}

export async function adminSetOfficeAdmin(userId: string, dto: AdminSalaryOfficeAdminDto): Promise<void> {
  if (!mongoose.isValidObjectId(userId)) throw notFound('Office not found');
  const [map, types, doc] = await Promise.all([officeIndex(), officeTypeShorts(), SalaryUserOffice.findOne({ user_id: userId })]);
  if (!doc) throw notFound('This user has not chosen an office yet');
  const rec = toRecord(map, types, doc);
  if (dto.office_admin && !(rec?.office && isSalaryBillPassingType(rec.office_type))) {
    throw badRequest('Only users of a listed CAFO, DCA, DAFO or UAO office can be office admins.');
  }
  doc.office_admin = dto.office_admin;
  await doc.save();
}

export async function adminSetAccountingOffice(userId: string, dto: AdminSalaryAccountingOfficeDto): Promise<void> {
  if (!mongoose.isValidObjectId(userId)) throw notFound('Office not found');
  const [map, types, doc] = await Promise.all([officeIndex(), officeTypeShorts(), SalaryUserOffice.findOne({ user_id: userId })]);
  if (!doc) throw notFound('This user has not chosen an office yet');
  const rec = toRecord(map, types, doc);
  if (dto.accounting_office_id) {
    if (rec && !rec.accounting_office && !rec.needs_accounting_office) {
      throw badRequest('This office is an accounts office; it does not need a bill-passing office.');
    }
    if (!accountingOption(map, types, dto.accounting_office_id)) throw badRequest('Select a CAFO, DCA, DAFO or UAO office');
    if (dto.accounting_office_id === String(doc.office_id ?? '')) throw badRequest('An office cannot pass its own bills');
  }
  doc.accounting_office_id = dto.accounting_office_id ? new mongoose.Types.ObjectId(dto.accounting_office_id) : null;
  doc.updated_at = new Date();
  await doc.save();
}

export async function adminRenameStaffOffice(officeId: string, dto: SalaryStaffOfficeDto): Promise<void> {
  if (!mongoose.isValidObjectId(officeId)) throw notFound('Office not found');
  const res = await SalaryStaffOffice.updateOne({ _id: officeId }, { $set: { name: dto.name, updated_at: new Date() } });
  if (res.matchedCount === 0) throw notFound('Office not found');
}

/** Clears the user's office so they choose it again on their next visit to /salary. */
export async function adminResetSalaryOffice(userId: string): Promise<void> {
  if (!mongoose.isValidObjectId(userId)) throw notFound('Office not found');
  const res = await SalaryUserOffice.deleteOne({ user_id: userId });
  if (res.deletedCount === 0) throw notFound('This user has not chosen an office yet');
}
