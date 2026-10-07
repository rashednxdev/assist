import mongoose from 'mongoose';
import {
  SALARY_OFFICE_REQUIRED_CODE,
  salaryFreeCalcsFor,
  type AdminSalaryOtherOfficeDto,
  type OfficeOption,
  type SalaryOfficeRecord,
  type SalaryOfficeSettingsRecord,
  type SalaryOtherOfficeSuggestion,
  type SalaryUserOfficeAdminRow,
  type SaveSalaryOfficeDto,
  type UpdateSalaryOfficeSettingsDto,
} from '@ibas/shared-types';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError, badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';
import { OfficeType } from '../org/models/OfficeType.model.js';
import { departmentOf, officeIndex, parentPath, type IndexedOffice } from '../org/org.service.js';
import { User } from '../users/models/User.model.js';
import { SalarySettings } from './models/SalarySettings.model.js';
import { SalaryUserOffice, type ISalaryUserOffice } from './models/SalaryUserOffice.model.js';
import { salaryFreeTrStates } from './salary-free-tr.service.js';

const SETTINGS_KEY = 'global';

export function isPlatformAdmin(user: AuthUser): boolean {
  return user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin';
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

function toOption(map: Map<string, IndexedOffice>, o: IndexedOffice): OfficeOption {
  return {
    id: o.id,
    name: o.name,
    short_name: o.short_name,
    office_code: o.office_code,
    parent_path: parentPath(map, o.parent_id),
  };
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
  if (doc.office_id) {
    const node = map.get(String(doc.office_id));
    if (!node?.is_active) return null;
    const office = toOption(map, node);
    return {
      circle,
      office,
      other_office_name: '',
      other_office_name_bn: '',
      label: officeName(office),
      bill_office_name: '',
      office_type: types.get(node.office_type_id) ?? null,
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
    office_type: null,
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
  if (dto.office_id) {
    const office = map.get(dto.office_id);
    if (!office?.is_active) throw badRequest('Select an office from the list');
    if (departmentOf(map, office.id)?.id !== dto.circle_id) throw badRequest('This office is not in the selected circle');
  } else if (!needsBanglaName(current) && !(await getSalaryOfficeSettings()).others_allowed) {
    throw badRequest('Choose your office from the list.');
  }
  const doc = await SalaryUserOffice.findOneAndUpdate(
    { user_id: user.id },
    {
      $set: {
        circle_id: dto.circle_id ? new mongoose.Types.ObjectId(dto.circle_id) : null,
        office_id: dto.office_id ? new mongoose.Types.ObjectId(dto.office_id) : null,
        other_office_name: dto.office_id ? '' : dto.other_office_name,
        other_office_name_bn: dto.office_id ? '' : dto.other_office_name_bn,
        updated_at: new Date(),
      },
      $setOnInsert: { user_id: new mongoose.Types.ObjectId(user.id) },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return toRecord(map, await officeTypeShorts(), doc)!;
}

export async function assertSalaryOfficeChosen(userId: string): Promise<void> {
  if (!(await getMySalaryOffice(userId))) {
    throw new AppError(403, SALARY_OFFICE_REQUIRED_CODE, 'Select your office on the salary page first.');
  }
}

/** Order among the users who chose the same listed office (1 = first); a reset office goes to the back. */
async function officeRank(doc: ISalaryUserOffice): Promise<number | null> {
  if (!doc.office_id) return null;
  return 1 + (await SalaryUserOffice.countDocuments({ office_id: doc.office_id, _id: { $lt: doc._id } }));
}

async function freeCalcsOf(
  doc: ISalaryUserOffice | null,
  rec: SalaryOfficeRecord | null,
): Promise<{ rank: number | null; free: number }> {
  if (!doc || !rec) return { rank: null, free: 0 };
  const rank = await officeRank(doc);
  return { rank, free: salaryFreeCalcsFor({ is_other: !rec.office, office_type: rec.office_type, rank: rank ?? 1 }) };
}

/** Free arrears calculations for the user, by their office type and how many users chose that office before them. */
export async function salaryFreeCalcLimit(userId: string): Promise<number> {
  const [map, types, doc] = await Promise.all([officeIndex(), officeTypeShorts(), SalaryUserOffice.findOne({ user_id: userId })]);
  return (await freeCalcsOf(doc, toRecord(map, types, doc))).free;
}

export async function salaryFreeCalcLimits(userIds: string[]): Promise<Map<string, number>> {
  const [map, types, docs] = await Promise.all([
    officeIndex(),
    officeTypeShorts(),
    SalaryUserOffice.find({ user_id: { $in: userIds } }),
  ]);
  const out = new Map<string, number>(userIds.map((id) => [id, 0]));
  await Promise.all(
    docs.map(async (doc) => out.set(String(doc.user_id), (await freeCalcsOf(doc, toRecord(map, types, doc))).free)),
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
    if (rec) out.set(String(doc.user_id), rec.office ? rec.label : `${rec.label} (Others)`);
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
  skip: number;
  limit: number;
}): Promise<{ items: SalaryUserOfficeAdminRow[]; total: number }> {
  const query: Record<string, unknown> = {};
  if (filters.othersOnly) query.office_id = null;
  const q = filters.q?.trim();
  if (q) {
    const pattern = { $regex: escapeRegex(q), $options: 'i' };
    const users = await User.find({
      $or: [{ full_name_en: pattern }, { full_name_bn: pattern }, { email: pattern }, { phone: pattern }],
    })
      .select('_id')
      .limit(500);
    query.$or = [
      { user_id: { $in: users.map((u) => u._id) } },
      { other_office_name: pattern },
      { other_office_name_bn: pattern },
    ];
  }
  const [docs, total, map, types] = await Promise.all([
    SalaryUserOffice.find(query).sort({ updated_at: -1 }).skip(filters.skip).limit(filters.limit),
    SalaryUserOffice.countDocuments(query),
    officeIndex(),
    officeTypeShorts(),
  ]);
  const [users, freeTr] = await Promise.all([
    User.find({ _id: { $in: docs.map((d) => d.user_id) } }).select('full_name_en email phone'),
    salaryFreeTrStates(docs.map((d) => String(d.user_id))),
  ]);
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const items = await Promise.all(docs.map(async (doc): Promise<SalaryUserOfficeAdminRow> => {
    const u = byId.get(String(doc.user_id));
    const rec = toRecord(map, types, doc);
    const { rank, free } = await freeCalcsOf(doc, rec);
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

/** Clears the user's office so they choose it again on their next visit to /salary. */
export async function adminResetSalaryOffice(userId: string): Promise<void> {
  if (!mongoose.isValidObjectId(userId)) throw notFound('Office not found');
  const res = await SalaryUserOffice.deleteOne({ user_id: userId });
  if (res.deletedCount === 0) throw notFound('This user has not chosen an office yet');
}
