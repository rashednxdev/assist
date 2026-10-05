import mongoose from 'mongoose';
import {
  SALARY_BILL_LIMIT_CODE,
  type ConsumeSalaryBillDto,
  type RejectSalaryBillRequestDto,
  type RequestSalaryBillsDto,
  type SalaryAccessStatus,
  type SalaryBillAccessAdminRow,
  type SalaryBillAccessRecord,
  type SalaryBillRequestInfo,
  type SalaryBillUsageRecord,
  type SalaryContactsRecord,
  type UpdateSalaryBillAccessDto,
  type UpdateSalaryContactsDto,
} from '@ibas/shared-types';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError, badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';
import { User } from '../users/models/User.model.js';
import { SalaryBillAccess, type ISalaryBillAccess } from './models/SalaryBillAccess.model.js';
import { SalaryBillUsage } from './models/SalaryBillUsage.model.js';
import { SalarySettings } from './models/SalarySettings.model.js';

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
    requested_bills: doc?.requested_bills ?? null,
    note: doc?.request_note ?? '',
    requested_at: doc?.requested_at?.toISOString() ?? null,
  };
}

function remainingOf(doc: ISalaryBillAccess | null): number {
  return doc ? Math.max(0, doc.bill_limit - doc.bills_used) : 0;
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

export async function getMyBillAccess(user: AuthUser): Promise<SalaryBillAccessRecord> {
  const [doc, { contacts }] = await Promise.all([
    SalaryBillAccess.findOne({ user_id: user.id }),
    getSalaryContacts(),
  ]);
  const unlimited = isPlatformAdmin(user);
  const remaining = remainingOf(doc);
  const status: SalaryAccessStatus = unlimited ? 'approved' : (doc?.status ?? 'none');
  return {
    status,
    unlimited,
    bill_limit: doc?.bill_limit ?? 0,
    bills_used: doc?.bills_used ?? 0,
    remaining,
    can_bill: user.status === 'active' && (unlimited || remaining > 0),
    request: requestInfo(doc),
    admin_note: doc?.admin_note ?? '',
    contacts,
  };
}

export async function requestBills(user: AuthUser, dto: RequestSalaryBillsDto): Promise<SalaryBillAccessRecord> {
  if (isPlatformAdmin(user)) throw badRequest('Admins can bill without approval.');
  if (user.status !== 'active') throw forbidden('Account is not active');
  await SalaryBillAccess.findOneAndUpdate(
    { user_id: user.id },
    {
      $set: {
        status: 'pending',
        request_pending: true,
        requested_bills: dto.requested_bills,
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
  return getMyBillAccess(user);
}

async function toAdminRows(docs: ISalaryBillAccess[]): Promise<SalaryBillAccessAdminRow[]> {
  const users = await User.find({ _id: { $in: docs.map((d) => d.user_id) } }).select('full_name_en email phone');
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return docs.map((doc) => {
    const u = byId.get(String(doc.user_id));
    return {
      user: {
        id: String(doc.user_id),
        full_name_en: u?.full_name_en ?? '(deleted user)',
        email: u?.email ?? '',
        phone: u?.phone ?? '',
      },
      status: doc.status,
      bill_limit: doc.bill_limit,
      bills_used: doc.bills_used,
      remaining: remainingOf(doc),
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
