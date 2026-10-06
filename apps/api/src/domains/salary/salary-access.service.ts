import mongoose from 'mongoose';
import {
  SALARY_BILL_LIMIT_CODE,
  SALARY_CALCS_PER_BILL,
  SALARY_CALC_LIMIT_CODE,
  SALARY_DEFAULT_BULK_SIZE,
  SALARY_FREE_ARREARS_CALCS,
  calculateStaffArrears,
  type ConsumeSalaryBillDto,
  type ConsumeSalaryStaffBillDto,
  type RecordArrearsCalcDto,
  type SalaryArrearsCalcInfo,
  type RejectSalaryBillRequestDto,
  type RequestSalaryBillsDto,
  type SalaryAccessStatus,
  type SalaryBillAccessAdminRow,
  type SalaryBillAccessRecord,
  type SalaryBillRequestInfo,
  type SalaryBillUsageRecord,
  type SalaryBulkSizeRecord,
  type SalaryContactsRecord,
  type UpdateSalaryBillAccessDto,
  type UpdateSalaryBulkSizeDto,
  type UpdateSalaryContactsDto,
} from '@ibas/shared-types';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError, badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';
import { User } from '../users/models/User.model.js';
import { SalaryBillAccess, type ISalaryBillAccess } from './models/SalaryBillAccess.model.js';
import { SalaryBillUsage } from './models/SalaryBillUsage.model.js';
import { SalaryCalcUsage, type ISalaryCalcUsage } from './models/SalaryCalcUsage.model.js';
import { SalarySettings } from './models/SalarySettings.model.js';
import { SalaryStaff } from './models/SalaryStaff.model.js';
import { assertSalaryOfficeChosen, salaryOfficeLabels } from './salary-office.service.js';

const SETTINGS_KEY = 'global';

function isPlatformAdmin(user: AuthUser): boolean {
  return user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin';
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requestInfo(doc: ISalaryBillAccess | null): SalaryBillRequestInfo {
  return {
    pending: Boolean(doc?.request_pending),
    requested_bulks: doc?.requested_bulks ?? null,
    requested_bills: doc?.requested_bills ?? null,
    note: doc?.request_note ?? '',
    requested_at: doc?.requested_at?.toISOString() ?? null,
  };
}

function remainingOf(doc: ISalaryBillAccess | null): number {
  return doc ? Math.max(0, doc.bill_limit - doc.bills_used) : 0;
}

function calcInfo(doc: Pick<ISalaryCalcUsage, 'free_used' | 'unprinted'> | null): SalaryArrearsCalcInfo {
  return {
    free_limit: SALARY_FREE_ARREARS_CALCS,
    free_used: Math.min(doc?.free_used ?? 0, SALARY_FREE_ARREARS_CALCS),
    per_bill: SALARY_CALCS_PER_BILL,
    unprinted: doc?.unprinted ?? 0,
  };
}

function calcLimitError(): AppError {
  return new AppError(
    403,
    SALARY_CALC_LIMIT_CODE,
    `You have used your ${SALARY_FREE_ARREARS_CALCS} free arrears calculations. Request a bulk from the admin to continue.`,
  );
}

export async function getSalaryContacts(): Promise<SalaryContactsRecord> {
  const doc = await SalarySettings.findOne({ key: SETTINGS_KEY }).lean();
  return {
    contacts: (doc?.contacts ?? []).map((c) => ({ label: c.label ?? '', number: c.number, whatsapp: Boolean(c.whatsapp) })),
    updated_at: doc?.updated_at?.toISOString() ?? null,
  };
}

export async function updateSalaryContacts(
  dto: UpdateSalaryContactsDto,
  updatedBy: string,
): Promise<SalaryContactsRecord> {
  await SalarySettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      contacts: dto.contacts,
      updated_by: new mongoose.Types.ObjectId(updatedBy),
      updated_at: new Date(),
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return getSalaryContacts();
}

export async function getSalaryBulkSize(): Promise<SalaryBulkSizeRecord> {
  const doc = await SalarySettings.findOne({ key: SETTINGS_KEY }).select('bulk_size updated_at').lean();
  return {
    bulk_size: doc?.bulk_size ?? SALARY_DEFAULT_BULK_SIZE,
    updated_at: doc?.updated_at?.toISOString() ?? null,
  };
}

export async function updateSalaryBulkSize(dto: UpdateSalaryBulkSizeDto, updatedBy: string): Promise<SalaryBulkSizeRecord> {
  await SalarySettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      bulk_size: dto.bulk_size,
      updated_by: new mongoose.Types.ObjectId(updatedBy),
      updated_at: new Date(),
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return getSalaryBulkSize();
}

export async function getMyBillAccess(user: AuthUser): Promise<SalaryBillAccessRecord> {
  const [doc, { contacts }, { bulk_size }, calcDoc] = await Promise.all([
    SalaryBillAccess.findOne({ user_id: user.id }),
    getSalaryContacts(),
    getSalaryBulkSize(),
    SalaryCalcUsage.findOne({ user_id: user.id }).select('free_used unprinted').lean(),
  ]);
  const unlimited = isPlatformAdmin(user);
  const remaining = remainingOf(doc);
  const calc = calcInfo(calcDoc);
  const status: SalaryAccessStatus = unlimited ? 'approved' : (doc?.status ?? 'none');
  return {
    status,
    unlimited,
    bill_limit: doc?.bill_limit ?? 0,
    bills_used: doc?.bills_used ?? 0,
    remaining,
    can_bill: user.status === 'active' && (unlimited || remaining > 0),
    bulk_size,
    calc,
    can_calculate: user.status === 'active' && (unlimited || calc.free_used < calc.free_limit || remaining > 0),
    request: requestInfo(doc),
    admin_note: doc?.admin_note ?? '',
    contacts,
  };
}

export async function requestBills(user: AuthUser, dto: RequestSalaryBillsDto): Promise<SalaryBillAccessRecord> {
  if (isPlatformAdmin(user)) throw badRequest('Admins can bill without approval.');
  if (user.status !== 'active') throw forbidden('Account is not active');
  await assertSalaryOfficeChosen(user.id);
  const { bulk_size } = await getSalaryBulkSize();
  await SalaryBillAccess.findOneAndUpdate(
    { user_id: user.id },
    {
      $set: {
        status: 'pending',
        request_pending: true,
        requested_bulks: dto.requested_bulks,
        requested_bills: dto.requested_bulks * bulk_size,
        request_note: dto.note,
        requested_at: new Date(),
        updated_at: new Date(),
      },
      $setOnInsert: { user_id: new mongoose.Types.ObjectId(user.id) },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return getMyBillAccess(user);
}

/** Uses one approved bill; admins are unlimited but still logged. */
export async function consumeBill(user: AuthUser, dto: ConsumeSalaryBillDto): Promise<SalaryBillAccessRecord> {
  if (user.status !== 'active') throw forbidden('Account is not active');
  const now = new Date();
  if (!isPlatformAdmin(user)) {
    await assertSalaryOfficeChosen(user.id);
    const updated = await SalaryBillAccess.findOneAndUpdate(
      { user_id: user.id, $expr: { $lt: ['$bills_used', '$bill_limit'] } },
      { $inc: { bills_used: 1 }, $set: { last_used_at: now, updated_at: now } },
      { new: true },
    );
    if (!updated) {
      throw new AppError(
        403,
        SALARY_BILL_LIMIT_CODE,
        'No approved arrears bills left. Request approval from the admin.',
      );
    }
  }
  await SalaryBillUsage.create({
    user_id: new mongoose.Types.ObjectId(user.id),
    kind: dto.kind,
    grade: dto.grade,
    old_pay: dto.old_pay,
    months: dto.months,
    net_total: dto.net_total,
    created_at: now,
  });
  if (!isPlatformAdmin(user)) {
    await SalaryCalcUsage.updateOne({ user_id: user.id, unprinted: { $gt: 0 } }, { $inc: { unprinted: -1 } });
  }
  return getMyBillAccess(user);
}

/** Office staff T.R. Form 15: uses one approved bill per saved employee, all or nothing. */
export async function consumeStaffBill(user: AuthUser, dto: ConsumeSalaryStaffBillDto): Promise<SalaryBillAccessRecord> {
  if (user.status !== 'active') throw forbidden('Account is not active');
  const staff = await SalaryStaff.find({ user_id: user.id }).sort({ created_at: 1, _id: 1 }).lean();
  if (staff.length === 0) throw badRequest('Add at least one employee first.');
  const results = staff.map((s) => {
    try {
      return calculateStaffArrears(s, dto.months);
    } catch (err) {
      throw badRequest(`${s.name}: ${err instanceof Error ? err.message : 'Invalid details'}`);
    }
  });

  const now = new Date();
  if (!isPlatformAdmin(user)) {
    await assertSalaryOfficeChosen(user.id);
    const updated = await SalaryBillAccess.findOneAndUpdate(
      { user_id: user.id, $expr: { $lte: [{ $add: ['$bills_used', staff.length] }, '$bill_limit'] } },
      { $inc: { bills_used: staff.length }, $set: { last_used_at: now, updated_at: now } },
      { new: true },
    );
    if (!updated) {
      const remaining = remainingOf(await SalaryBillAccess.findOne({ user_id: user.id }));
      throw new AppError(
        403,
        SALARY_BILL_LIMIT_CODE,
        `This bill has ${staff.length} employees and needs ${staff.length} approved bills; you have ${remaining}. Request more from the admin.`,
      );
    }
  }
  await SalaryBillUsage.insertMany(
    staff.map((s, i) => ({
      user_id: new mongoose.Types.ObjectId(user.id),
      kind: 'staff_tr_form_15',
      grade: s.grade,
      old_pay: s.old_pay,
      months: results[i]!.rows.map((r) => r.month),
      net_total: results[i]!.total_net_arrear,
      created_at: now,
    })),
  );
  return getMyBillAccess(user);
}

/**
 * Counts one "Calculate arrears bill". The first free calculations cost nothing; after that a bill
 * must be available, and every block of not-downloaded calculations uses one bill.
 */
export async function recordArrearsCalc(user: AuthUser, dto: RecordArrearsCalcDto): Promise<SalaryBillAccessRecord> {
  if (user.status !== 'active') throw forbidden('Account is not active');
  if (isPlatformAdmin(user)) return getMyBillAccess(user);
  await assertSalaryOfficeChosen(user.id);

  const userId = new mongoose.Types.ObjectId(user.id);
  const now = new Date();
  await SalaryCalcUsage.updateOne({ user_id: userId }, { $setOnInsert: { user_id: userId } }, { upsert: true });

  const free = await SalaryCalcUsage.findOneAndUpdate(
    { user_id: userId, free_used: { $lt: SALARY_FREE_ARREARS_CALCS } },
    { $inc: { free_used: 1, total: 1 }, $set: { updated_at: now } },
    { new: true },
  );
  if (free) return getMyBillAccess(user);

  const access = await SalaryBillAccess.findOne({ user_id: userId });
  if (remainingOf(access) <= 0) throw calcLimitError();

  await SalaryCalcUsage.updateOne({ user_id: userId }, { $inc: { unprinted: 1, total: 1 }, $set: { updated_at: now } });
  const claimed = await SalaryCalcUsage.findOneAndUpdate(
    { user_id: userId, unprinted: { $gte: SALARY_CALCS_PER_BILL } },
    { $inc: { unprinted: -SALARY_CALCS_PER_BILL } },
    { new: true },
  );
  if (claimed) {
    const charged = await SalaryBillAccess.findOneAndUpdate(
      { user_id: userId, $expr: { $lt: ['$bills_used', '$bill_limit'] } },
      { $inc: { bills_used: 1 }, $set: { last_used_at: now, updated_at: now } },
      { new: true },
    );
    if (!charged) {
      await SalaryCalcUsage.updateOne({ user_id: userId }, { $inc: { unprinted: SALARY_CALCS_PER_BILL - 1, total: -1 } });
      throw calcLimitError();
    }
    await SalaryBillUsage.create({
      user_id: userId,
      kind: 'arrears_calc',
      grade: dto.grade,
      old_pay: dto.old_pay,
      months: dto.months,
      net_total: dto.net_total,
      created_at: now,
    });
  }
  return getMyBillAccess(user);
}

async function toAdminRows(docs: ISalaryBillAccess[]): Promise<SalaryBillAccessAdminRow[]> {
  const userIds = docs.map((d) => String(d.user_id));
  const [users, offices, calcs] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('full_name_en email phone'),
    salaryOfficeLabels(userIds),
    SalaryCalcUsage.find({ user_id: { $in: userIds } }).select('user_id free_used unprinted').lean(),
  ]);
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const calcById = new Map(calcs.map((c) => [String(c.user_id), c]));
  return docs.map((doc) => {
    const u = byId.get(String(doc.user_id));
    return {
      user: {
        id: String(doc.user_id),
        full_name_en: u?.full_name_en ?? '(deleted user)',
        email: u?.email ?? '',
        phone: u?.phone ?? '',
      },
      office_label: offices.get(String(doc.user_id)) ?? '',
      status: doc.status,
      bill_limit: doc.bill_limit,
      bills_used: doc.bills_used,
      remaining: remainingOf(doc),
      calc: calcInfo(calcById.get(String(doc.user_id)) ?? null),
      request: requestInfo(doc),
      admin_note: doc.admin_note ?? '',
      approved_at: doc.approved_at?.toISOString() ?? null,
      last_used_at: doc.last_used_at?.toISOString() ?? null,
      updated_at: doc.updated_at.toISOString(),
    };
  });
}

export async function listBillAccess(filters: {
  status?: string;
  q?: string;
  skip: number;
  limit: number;
}): Promise<{ items: SalaryBillAccessAdminRow[]; total: number }> {
  const query: Record<string, unknown> = {};
  if (filters.status === 'pending') query.request_pending = true;
  else if (filters.status === 'approved' || filters.status === 'rejected') query.status = filters.status;

  const q = filters.q?.trim();
  if (q) {
    const pattern = { $regex: escapeRegex(q), $options: 'i' };
    const matches = await User.find({
      $or: [{ full_name_en: pattern }, { full_name_bn: pattern }, { email: pattern }, { phone: pattern }],
    })
      .select('_id')
      .limit(500);
    query.user_id = { $in: matches.map((u) => u._id) };
  }

  const [docs, total] = await Promise.all([
    SalaryBillAccess.find(query)
      .sort({ request_pending: -1, requested_at: -1, updated_at: -1 })
      .skip(filters.skip)
      .limit(filters.limit),
    SalaryBillAccess.countDocuments(query),
  ]);
  return { items: await toAdminRows(docs), total };
}

export async function updateBillAccess(
  userId: string,
  dto: UpdateSalaryBillAccessDto,
  adminId: string,
): Promise<SalaryBillAccessAdminRow> {
  if (!mongoose.isValidObjectId(userId)) throw notFound('User not found');
  const user = await User.findById(userId).select('_id');
  if (!user) throw notFound('User not found');

  const now = new Date();
  const set: Record<string, unknown> = {
    bill_limit: dto.bill_limit,
    status: dto.bill_limit > 0 ? 'approved' : 'rejected',
    request_pending: false,
    approved_by: new mongoose.Types.ObjectId(adminId),
    approved_at: now,
    updated_at: now,
  };
  if (dto.bills_used != null) set.bills_used = dto.bills_used;
  if (dto.admin_note != null) set.admin_note = dto.admin_note;

  const doc = await SalaryBillAccess.findOneAndUpdate(
    { user_id: userId },
    { $set: set, $setOnInsert: { user_id: user._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const [row] = await toAdminRows([doc]);
  return row!;
}

export async function rejectBillRequest(
  userId: string,
  dto: RejectSalaryBillRequestDto,
  adminId: string,
): Promise<SalaryBillAccessAdminRow> {
  if (!mongoose.isValidObjectId(userId)) throw notFound('Request not found');
  const doc = await SalaryBillAccess.findOne({ user_id: userId });
  if (!doc || !doc.request_pending) throw notFound('No pending request for this user');
  doc.request_pending = false;
  doc.status = remainingOf(doc) > 0 ? 'approved' : 'rejected';
  doc.admin_note = dto.admin_note;
  doc.approved_by = new mongoose.Types.ObjectId(adminId);
  doc.updated_at = new Date();
  await doc.save();
  const [row] = await toAdminRows([doc]);
  return row!;
}

export async function listBillUsage(userId: string, limit = 30): Promise<SalaryBillUsageRecord[]> {
  if (!mongoose.isValidObjectId(userId)) return [];
  const docs = await SalaryBillUsage.find({ user_id: userId }).sort({ created_at: -1 }).limit(limit);
  return docs.map((d) => ({
    id: String(d._id),
    kind: d.kind,
    grade: d.grade,
    old_pay: d.old_pay,
    months: d.months,
    net_total: d.net_total,
    created_at: d.created_at.toISOString(),
  }));
}
