import mongoose from 'mongoose';
import {
  SALARY_BILL_LIMIT_CODE,
  SALARY_CALCS_PER_BILL,
  SALARY_CALC_LIMIT_CODE,
  SALARY_DEFAULT_BULK_SIZE,
  SALARY_FREE_ARREARS_CALCS,
  SALARY_PRINT_REPORT_MAX_DAYS,
  calculateStaffArrears,
  salaryCanSeeDownloads,
  salaryPrintReportQuerySchema,
  type SalaryPrintDayRow,
  type SalaryPrintReport,
  type ConsumeSalaryBillDto,
  type ConsumeSalaryStaffBillDto,
  type RecordArrearsCalcDto,
  type SalaryArrearsCalcInfo,
  type RejectSalaryBillRequestDto,
  type RequestSalaryBillsDto,
  type SalaryAccessStatus,
  type SalaryBillAccessAdminRow,
  type SalaryBillAccessRecord,
  type SalaryBillAccessStats,
  type SalaryBillKind,
  type SalaryBillRequestInfo,
  type SalaryPrintStats,
  type UpdateSalaryAdminNoteDto,
  type RecordSalaryPaymentDto,
  type SalaryAccessBilling,
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
import { SalaryStaffOffice } from './models/SalaryStaffOffice.model.js';
import {
  assertSalaryOfficeChosen,
  isPlatformAdmin,
  salaryFreeCalcLimit,
  salaryFreeCalcLimits,
  salaryOfficeContacts,
  salaryOfficeLabels,
} from './salary-office.service.js';
import { claimSalaryFreeTrForm, salaryFreeTrStates, salaryFreeTrUsage } from './salary-free-tr.service.js';

const SETTINGS_KEY = 'global';

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

function calcInfo(doc: Pick<ISalaryCalcUsage, 'free_used' | 'unprinted'> | null, freeLimit: number): SalaryArrearsCalcInfo {
  return {
    free_limit: freeLimit,
    free_used: Math.min(doc?.free_used ?? 0, freeLimit),
    per_bill: SALARY_CALCS_PER_BILL,
    unprinted: doc?.unprinted ?? 0,
  };
}

function calcLimitError(freeLimit: number): AppError {
  return new AppError(
    403,
    SALARY_CALC_LIMIT_CODE,
    freeLimit > 0
      ? `You have used your ${freeLimit} free arrears calculations. Request a bulk from the admin to continue.`
      : 'Your office has no free arrears calculations left. Request a bulk from the admin to calculate.',
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
  const doc = await SalarySettings.findOne({ key: SETTINGS_KEY }).select('bulk_size bulk_price updated_at').lean();
  return {
    bulk_size: doc?.bulk_size ?? SALARY_DEFAULT_BULK_SIZE,
    bulk_price: doc?.bulk_price ?? 0,
    updated_at: doc?.updated_at?.toISOString() ?? null,
  };
}

export async function updateSalaryBulkSize(dto: UpdateSalaryBulkSizeDto, updatedBy: string): Promise<SalaryBulkSizeRecord> {
  const set: Record<string, unknown> = {
    bulk_size: dto.bulk_size,
    updated_by: new mongoose.Types.ObjectId(updatedBy),
    updated_at: new Date(),
  };
  if (dto.bulk_price != null) set.bulk_price = dto.bulk_price;
  await SalarySettings.findOneAndUpdate({ key: SETTINGS_KEY }, { $set: set }, { upsert: true, setDefaultsOnInsert: true });
  return getSalaryBulkSize();
}

export async function getMyBillAccess(user: AuthUser): Promise<SalaryBillAccessRecord> {
  const [doc, { contacts }, officeContacts, { bulk_size }, calcDoc, freeLimit, freeTr] = await Promise.all([
    SalaryBillAccess.findOne({ user_id: user.id }),
    getSalaryContacts(),
    salaryOfficeContacts(user.id),
    getSalaryBulkSize(),
    SalaryCalcUsage.findOne({ user_id: user.id }).select('free_used unprinted').lean(),
    salaryFreeCalcLimit(user.id),
    salaryFreeTrUsage(user.id),
  ]);
  const byOffice = officeContacts.contacts.length > 0;
  const unlimited = isPlatformAdmin(user);
  const remaining = remainingOf(doc);
  const calc = calcInfo(calcDoc, freeLimit);
  const status: SalaryAccessStatus = unlimited ? 'approved' : (doc?.status ?? 'none');
  return {
    status,
    unlimited,
    bill_limit: doc?.bill_limit ?? 0,
    bills_used: doc?.bills_used ?? 0,
    remaining,
    can_bill: user.status === 'active' && (unlimited || remaining > 0 || freeTr.state === 'available'),
    free_tr_form: freeTr.state,
    free_tr_left: freeTr.left,
    bulk_size,
    calc,
    can_calculate:
      user.status === 'active' &&
      (unlimited || calc.free_used < calc.free_limit || remaining > 0 || freeTr.state === 'available'),
    request: requestInfo(doc),
    contacts: byOffice ? officeContacts.contacts : contacts,
    contacts_source: byOffice ? 'office' : 'admin',
    contact_office: byOffice ? officeContacts.office : null,
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

/**
 * Uses one approved bill, or a free single T.R. Form for a T.R. Form download when no
 * approved bill is left; admins are unlimited but still logged.
 */
export async function consumeBill(user: AuthUser, dto: ConsumeSalaryBillDto): Promise<SalaryBillAccessRecord> {
  if (user.status !== 'active') throw forbidden('Account is not active');
  const now = new Date();
  let free = false;
  if (!isPlatformAdmin(user)) {
    await assertSalaryOfficeChosen(user.id);
    const isTrForm = dto.kind === 'tr_form_13' || dto.kind === 'tr_form_15';
    const approved = await SalaryBillAccess.findOneAndUpdate(
      { user_id: user.id, $expr: { $lt: ['$bills_used', '$bill_limit'] } },
      { $inc: { bills_used: 1 }, $set: { last_used_at: now, updated_at: now } },
      { new: true },
    );
    free = !approved && isTrForm && (await claimSalaryFreeTrForm(user.id));
    if (!approved && !free) {
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
    free,
    created_at: now,
  });
  if (!isPlatformAdmin(user)) {
    await SalaryCalcUsage.updateOne({ user_id: user.id, unprinted: { $gt: 0 } }, { $inc: { unprinted: -1 } });
  }
  return getMyBillAccess(user);
}

/**
 * Logs a staff T.R. Form 15 download. Bills are charged when employees are added, so printing is
 * allowed any time.
 */
export async function consumeStaffBill(user: AuthUser, dto: ConsumeSalaryStaffBillDto): Promise<SalaryBillAccessRecord> {
  if (user.status !== 'active') throw forbidden('Account is not active');
  if (!isPlatformAdmin(user)) await assertSalaryOfficeChosen(user.id);
  const officeIds =
    dto.staff_office_ids ??
    (dto.staff_office_id !== undefined ? [dto.staff_office_id] : [null]);
  const unique = [...new Set(officeIds.map((id) => id ?? null))];
  for (const id of unique) {
    if (id) {
      const exists = await SalaryStaffOffice.exists({ _id: id, user_id: user.id });
      if (!exists) throw badRequest('Choose offices from your staff bill list.');
    }
  }
  const officeFilter = unique.map((id) => (id ? new mongoose.Types.ObjectId(id) : null));
  const staff = await SalaryStaff.find({
    user_id: user.id,
    trashed_at: null,
    staff_office_id: { $in: officeFilter },
  })
    .sort({ created_at: 1, _id: 1 })
    .lean();
  if (staff.length === 0) throw badRequest('Add at least one employee first.');
  const results = staff.map((s) => {
    try {
      return calculateStaffArrears(s, dto.months);
    } catch (err) {
      throw badRequest(`${s.name}: ${err instanceof Error ? err.message : 'Invalid details'}`);
    }
  });

  const now = new Date();
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
  await SalaryBillAccess.updateOne(
    { user_id: user.id },
    { $set: { last_used_at: now, updated_at: now } },
  );
  return getMyBillAccess(user);
}

/** Uses one approved bill when adding a staff employee; free-calc users use `recordStaffCalc` instead. */
export async function claimBillForStaffAdd(user: AuthUser): Promise<void> {
  if (isPlatformAdmin(user)) return;
  await assertSalaryOfficeChosen(user.id);
  const access = await SalaryBillAccess.findOne({ user_id: user.id });
  if (!access || access.bill_limit <= 0) {
    await recordStaffCalc(user);
    return;
  }
  const now = new Date();
  const updated = await SalaryBillAccess.findOneAndUpdate(
    { user_id: user.id, $expr: { $lt: ['$bills_used', '$bill_limit'] } },
    { $inc: { bills_used: 1 }, $set: { updated_at: now } },
    { new: true },
  );
  if (!updated) {
    throw new AppError(
      403,
      SALARY_BILL_LIMIT_CODE,
      `You have used all ${access.bill_limit} approved bills for staff employees. Request more from the admin.`,
    );
  }
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
  const freeLimit = await salaryFreeCalcLimit(user.id);
  await SalaryCalcUsage.updateOne({ user_id: userId }, { $setOnInsert: { user_id: userId } }, { upsert: true });

  const free = await SalaryCalcUsage.findOneAndUpdate(
    { user_id: userId, free_used: { $lt: freeLimit } },
    { $inc: { free_used: 1, total: 1 }, $set: { updated_at: now } },
    { new: true },
  );
  if (free) return getMyBillAccess(user);

  const access = await SalaryBillAccess.findOne({ user_id: userId });
  const hasBills = remainingOf(access) > 0;
  if (!hasBills && (await salaryFreeTrUsage(user.id)).state !== 'available') throw calcLimitError(freeLimit);

  await SalaryCalcUsage.updateOne({ user_id: userId }, { $inc: { unprinted: 1, total: 1 }, $set: { updated_at: now } });
  const claimed = await SalaryCalcUsage.findOneAndUpdate(
    { user_id: userId, unprinted: { $gte: SALARY_CALCS_PER_BILL } },
    { $inc: { unprinted: -SALARY_CALCS_PER_BILL } },
    { new: true },
  );
  if (claimed) {
    const charged = hasBills
      ? await SalaryBillAccess.findOneAndUpdate(
          { user_id: userId, $expr: { $lt: ['$bills_used', '$bill_limit'] } },
          { $inc: { bills_used: 1 }, $set: { last_used_at: now, updated_at: now } },
          { new: true },
        )
      : await claimSalaryFreeTrForm(user.id);
    if (!charged) {
      await SalaryCalcUsage.updateOne({ user_id: userId }, { $inc: { unprinted: SALARY_CALCS_PER_BILL - 1, total: -1 } });
      throw calcLimitError(freeLimit);
    }
    if (!hasBills) return getMyBillAccess(user);
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

/**
 * Adding a staff bill employee, or changing their pay details, counts as one arrears calculation:
 * a free one first, otherwise the user needs an approved bill left.
 */
export async function recordStaffCalc(user: AuthUser): Promise<void> {
  if (user.status !== 'active') throw forbidden('Account is not active');
  if (isPlatformAdmin(user)) return;
  await assertSalaryOfficeChosen(user.id);

  const userId = new mongoose.Types.ObjectId(user.id);
  const now = new Date();
  const freeLimit = await salaryFreeCalcLimit(user.id);
  await SalaryCalcUsage.updateOne({ user_id: userId }, { $setOnInsert: { user_id: userId } }, { upsert: true });
  const free = await SalaryCalcUsage.findOneAndUpdate(
    { user_id: userId, free_used: { $lt: freeLimit } },
    { $inc: { free_used: 1, total: 1 }, $set: { updated_at: now } },
  );
  if (free) return;
  if (remainingOf(await SalaryBillAccess.findOne({ user_id: userId })) <= 0) throw calcLimitError(freeLimit);
  await SalaryCalcUsage.updateOne({ user_id: userId }, { $inc: { total: 1 }, $set: { updated_at: now } });
}

function billingOf(doc: ISalaryBillAccess, bulkPrice: number): SalaryAccessBilling {
  const charged = Math.max(0, doc.charged_total ?? 0);
  const payments = [...(doc.payments ?? [])]
    .map((p) => ({
      id: String(p._id),
      amount: p.amount,
      received_at: p.received_at,
      note: p.note ?? '',
    }))
    .sort((a, b) => b.received_at.localeCompare(a.received_at) || b.id.localeCompare(a.id));
  const received = payments.reduce((sum, p) => sum + p.amount, 0);
  const bulks = doc.request_pending ? (doc.requested_bulks ?? 0) : 0;
  const suggested = doc.request_pending && bulkPrice > 0 && bulks > 0 ? bulks * bulkPrice : null;
  return {
    charged_total: charged,
    received_total: received,
    due: Math.max(0, charged - received),
    suggested_charge: suggested,
    payments,
  };
}

async function toAdminRows(docs: ISalaryBillAccess[]): Promise<SalaryBillAccessAdminRow[]> {
  const userIds = docs.map((d) => String(d.user_id));
  const [users, offices, calcs, freeLimits, freeTr, { bulk_price }] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('full_name_en email phone'),
    salaryOfficeLabels(userIds),
    SalaryCalcUsage.find({ user_id: { $in: userIds } }).select('user_id free_used unprinted').lean(),
    salaryFreeCalcLimits(userIds),
    salaryFreeTrStates(userIds),
    getSalaryBulkSize(),
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
      calc: calcInfo(calcById.get(String(doc.user_id)) ?? null, freeLimits.get(String(doc.user_id)) ?? SALARY_FREE_ARREARS_CALCS),
      free_tr_form: freeTr.get(String(doc.user_id)) ?? 'none',
      request: requestInfo(doc),
      admin_note: doc.admin_note ?? '',
      billing: billingOf(doc, bulk_price),
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
  if (filters.status === 'active') query.$or = [{ request_pending: true }, { status: 'approved' }];
  else if (filters.status === 'pending') query.request_pending = true;
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

  const update: Record<string, unknown> = { $set: set, $setOnInsert: { user_id: user._id } };
  if (dto.charge_amount != null && dto.charge_amount > 0) {
    update.$inc = { charged_total: dto.charge_amount };
  }

  const doc = await SalaryBillAccess.findOneAndUpdate({ user_id: userId }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
  const [row] = await toAdminRows([doc]);
  return row!;
}

function dhakaTodayKey(): string {
  return new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Adds a received payment for a user (admin-only money ledger). */
export async function recordSalaryPayment(
  userId: string,
  dto: RecordSalaryPaymentDto,
): Promise<SalaryBillAccessAdminRow> {
  if (!mongoose.isValidObjectId(userId)) throw notFound('User not found');
  const receivedAt = dto.received_at ?? dhakaTodayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedAt)) throw badRequest('Use a YYYY-MM-DD date');
  const doc = await SalaryBillAccess.findOneAndUpdate(
    { user_id: userId },
    {
      $push: { payments: { amount: dto.amount, received_at: receivedAt, note: dto.note } },
      $set: { updated_at: new Date() },
    },
    { new: true },
  );
  if (!doc) throw notFound('No bill access record for this user. Approve bills first.');
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
  if (dto.admin_note !== undefined) doc.admin_note = dto.admin_note;
  doc.approved_by = new mongoose.Types.ObjectId(adminId);
  doc.updated_at = new Date();
  await doc.save();
  const [row] = await toAdminRows([doc]);
  return row!;
}

export async function updateBillAccessNote(userId: string, dto: UpdateSalaryAdminNoteDto): Promise<SalaryBillAccessAdminRow> {
  if (!mongoose.isValidObjectId(userId)) throw notFound('User not found');
  const doc = await SalaryBillAccess.findOneAndUpdate(
    { user_id: userId },
    { $set: { admin_note: dto.admin_note } },
    { new: true },
  );
  if (!doc) throw notFound('No bill access record for this user');
  const [row] = await toAdminRows([doc]);
  return row!;
}

const PRINT_KINDS: SalaryBillKind[] = ['tr_form_13', 'tr_form_15', 'arrears_pdf', 'staff_tr_form_15'];
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function dhakaDayStart(now: Date): Date {
  return new Date(Math.floor((now.getTime() + DHAKA_OFFSET_MS) / DAY_MS) * DAY_MS - DHAKA_OFFSET_MS);
}

function printStats(total: number, free: number): SalaryPrintStats {
  return { total, free, approved: Math.max(0, total - free) };
}

/**
 * Print counts split into free and approved. Records made before `free` was stored are matched to
 * each user's free downloads used: the earliest T.R. Form downloads of that user count as free.
 */
export async function getBillAccessStats(): Promise<SalaryBillAccessStats> {
  const today = dhakaDayStart(new Date());
  const [counts, flaggedFree, freeUsers, pending, approvedUsers] = await Promise.all([
    SalaryBillUsage.aggregate<{ total: number; today: number }>([
      { $match: { kind: { $in: PRINT_KINDS } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          today: { $sum: { $cond: [{ $gte: ['$created_at', today] }, 1, 0] } },
        },
      },
    ]),
    SalaryBillUsage.find({ free: true }).select('user_id created_at').lean(),
    SalaryCalcUsage.find({ $or: [{ free_tr_used: true }, { free_tr_count: { $gt: 0 } }] })
      .select('user_id free_tr_used free_tr_count')
      .lean(),
    SalaryBillAccess.countDocuments({ request_pending: true }),
    SalaryBillAccess.countDocuments({ status: 'approved' }),
  ]);

  let freeTotal = flaggedFree.length;
  let freeToday = flaggedFree.filter((d) => d.created_at >= today).length;
  const flaggedBy = new Map<string, number>();
  for (const d of flaggedFree) flaggedBy.set(String(d.user_id), (flaggedBy.get(String(d.user_id)) ?? 0) + 1);
  const legacyLeft = new Map<string, number>();
  for (const u of freeUsers) {
    const used = Math.max(u.free_tr_count ?? 0, u.free_tr_used ? 1 : 0) - (flaggedBy.get(String(u.user_id)) ?? 0);
    if (used > 0) legacyLeft.set(String(u.user_id), used);
  }
  if (legacyLeft.size > 0) {
    const legacy = await SalaryBillUsage.find({
      user_id: { $in: [...legacyLeft.keys()].map((id) => new mongoose.Types.ObjectId(id)) },
      kind: { $in: ['tr_form_13', 'tr_form_15'] },
      free: { $exists: false },
    })
      .sort({ created_at: 1 })
      .select('user_id created_at')
      .lean();
    for (const d of legacy) {
      const id = String(d.user_id);
      const left = legacyLeft.get(id) ?? 0;
      if (left <= 0) continue;
      legacyLeft.set(id, left - 1);
      freeTotal += 1;
      if (d.created_at >= today) freeToday += 1;
    }
  }

  const c = counts[0] ?? { total: 0, today: 0 };
  return {
    all_time: printStats(c.total, freeTotal),
    today: printStats(c.today, freeToday),
    pending_requests: pending,
    approved_users: approvedUsers,
  };
}

function dhakaDateKey(at: Date): string {
  return new Date(at.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

function dhakaDateStart(key: string): Date {
  return new Date(Date.parse(`${key}T00:00:00Z`) - DHAKA_OFFSET_MS);
}

/** Downloads per Bangladesh date in the range, for one user or (without `userId`) everyone. */
export async function salaryPrintReport(query: unknown, userId?: string): Promise<SalaryPrintReport> {
  const parsed = salaryPrintReportQuerySchema.safeParse(query);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
  const to = parsed.data.to ?? dhakaDateKey(new Date());
  const from = parsed.data.from ?? dhakaDateKey(new Date(dhakaDateStart(to).getTime() - 29 * DAY_MS));
  const start = dhakaDateStart(from);
  const end = new Date(dhakaDateStart(to).getTime() + DAY_MS);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw badRequest('Invalid date');
  if (start >= end) throw badRequest('The start date must not be after the end date');
  if ((end.getTime() - start.getTime()) / DAY_MS > SALARY_PRINT_REPORT_MAX_DAYS) {
    throw badRequest(`Choose at most ${SALARY_PRINT_REPORT_MAX_DAYS} days`);
  }

  const base: Record<string, unknown> = { kind: { $in: PRINT_KINDS } };
  if (userId) base.user_id = new mongoose.Types.ObjectId(userId);
  const [groups, allTime] = await Promise.all([
    SalaryBillUsage.aggregate<{ _id: { day: string; kind: SalaryBillKind }; n: number; users: mongoose.Types.ObjectId[] }>([
      { $match: { ...base, created_at: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$created_at', timezone: '+06:00' } }, kind: '$kind' },
          n: { $sum: 1 },
          users: { $addToSet: '$user_id' },
        },
      },
    ]),
    SalaryBillUsage.countDocuments(base),
  ]);

  const byDay = new Map<string, { row: SalaryPrintDayRow; users: Set<string> }>();
  for (const g of groups) {
    let day = byDay.get(g._id.day);
    if (!day) {
      day = {
        row: { date: g._id.day, total: 0, tr_form_13: 0, tr_form_15: 0, staff_tr_form_15: 0, arrears_pdf: 0, users: 0 },
        users: new Set(),
      };
      byDay.set(g._id.day, day);
    }
    day.row.total += g.n;
    if (g._id.kind === 'tr_form_13' || g._id.kind === 'tr_form_15' || g._id.kind === 'staff_tr_form_15' || g._id.kind === 'arrears_pdf') {
      day.row[g._id.kind] += g.n;
    }
    for (const u of g.users) day.users.add(String(u));
  }
  const days = [...byDay.values()]
    .map(({ row, users }) => ({ ...row, users: users.size }))
    .sort((a, b) => b.date.localeCompare(a.date));
  return { from, to, total: days.reduce((sum, d) => sum + d.total, 0), all_time: allTime, days };
}

export async function myPrintReport(user: AuthUser, query: unknown): Promise<SalaryPrintReport> {
  if (!isPlatformAdmin(user)) {
    const doc = await SalaryBillAccess.findOne({ user_id: user.id }).select('bill_limit').lean();
    if (!salaryCanSeeDownloads({ unlimited: false, bill_limit: doc?.bill_limit ?? 0 })) {
      throw forbidden('The download report is available after the admin approves your bills.');
    }
  }
  return salaryPrintReport(query, user.id);
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
