import mongoose from 'mongoose';
import {
  SALARY_MAX_STAFF,
  SALARY_MAX_STAFF_OFFICES,
  salaryStaffNameChangeTooLarge,
  type SalaryStaffDto,
  type SalaryStaffOfficeDto,
  type SalaryStaffOfficeRecord,
  type SalaryStaffRecord,
} from '@ibas/shared-types';
import type { AuthUser } from '../../middleware/auth.js';
import { badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';
import { SalaryStaff, type ISalaryStaff } from './models/SalaryStaff.model.js';
import { SalaryStaffOffice, type ISalaryStaffOffice } from './models/SalaryStaffOffice.model.js';
import { claimBillForStaffAdd, recordStaffCalc } from './salary-access.service.js';
import { isPlatformAdmin } from './salary-office.service.js';

function toRecord(doc: ISalaryStaff): SalaryStaffRecord {
  const ex = doc.exceptional;
  return {
    id: String(doc._id),
    name: doc.name,
    post: doc.post,
    nid: doc.nid ?? '',
    grade: doc.grade,
    old_pay: doc.old_pay,
    housing_status: doc.housing_status,
    hra_area: doc.hra_area,
    excess_rr: Boolean(doc.excess_rr),
    excess_puja: Boolean(doc.excess_puja),
    staff_office_id: doc.staff_office_id ? String(doc.staff_office_id) : null,
    joining_date: doc.joining_date ?? null,
    exceptional: {
      increment_exempt: Boolean(ex?.increment_exempt),
      pay_change: ex?.pay_change
        ? {
            effective_date: ex.pay_change.effective_date,
            grade: ex.pay_change.grade,
            old_pay: ex.pay_change.old_pay,
            substantive_grade: ex.pay_change.substantive_grade ?? null,
          }
        : null,
      arrear_start_date: ex?.arrear_start_date ?? null,
    },
    trashed: Boolean(doc.trashed_at),
    created_at: doc.created_at.toISOString(),
    updated_at: doc.updated_at.toISOString(),
  };
}

function toOfficeRecord(doc: ISalaryStaffOffice): SalaryStaffOfficeRecord {
  return {
    id: String(doc._id),
    name: doc.name,
    created_at: doc.created_at.toISOString(),
    updated_at: doc.updated_at.toISOString(),
  };
}

/** The details that change an employee's arrears; editing only these counts as a new calculation. */
function payKey(
  s: Pick<
    SalaryStaffDto,
    'grade' | 'old_pay' | 'housing_status' | 'hra_area' | 'excess_rr' | 'excess_puja' | 'joining_date' | 'exceptional'
  >,
): string {
  return JSON.stringify([
    s.grade,
    s.old_pay,
    s.housing_status,
    s.hra_area,
    Boolean(s.excess_rr),
    Boolean(s.excess_puja),
    s.joining_date ?? null,
    s.exceptional ?? null,
  ]);
}

async function assertOwnStaffOffice(userId: string, staffOfficeId: string | null): Promise<void> {
  if (!staffOfficeId) return;
  const exists = await SalaryStaffOffice.exists({ _id: staffOfficeId, user_id: userId });
  if (!exists) throw badRequest('This office was removed from your staff bill. Choose an office again.');
}

export async function listMyStaff(userId: string): Promise<SalaryStaffRecord[]> {
  const docs = await SalaryStaff.find({ user_id: userId }).sort({ created_at: 1, _id: 1 });
  return docs.map(toRecord);
}

export async function createMyStaff(user: AuthUser, dto: SalaryStaffDto): Promise<SalaryStaffRecord> {
  const count = await SalaryStaff.countDocuments({ user_id: user.id });
  if (count >= SALARY_MAX_STAFF) throw badRequest(`You can add up to ${SALARY_MAX_STAFF} employees.`);
  await assertOwnStaffOffice(user.id, dto.staff_office_id);
  /** One approved bill per employee added; print does not charge again. */
  await claimBillForStaffAdd(user);
  const now = new Date();
  const doc = await SalaryStaff.create({
    ...dto,
    user_id: new mongoose.Types.ObjectId(user.id),
    trashed_at: null,
    created_at: now,
    updated_at: now,
  });
  return toRecord(doc);
}

export async function updateMyStaff(user: AuthUser, staffId: string, dto: SalaryStaffDto): Promise<SalaryStaffRecord> {
  if (!mongoose.isValidObjectId(staffId)) throw notFound('Employee not found');
  await assertOwnStaffOffice(user.id, dto.staff_office_id);
  const current = await SalaryStaff.findOne({ _id: staffId, user_id: user.id, trashed_at: null });
  if (!current) throw notFound('Employee not found');
  if (salaryStaffNameChangeTooLarge(current.name, dto.name)) {
    throw badRequest('That name change is too large. Trash this employee and add a new one instead.');
  }
  if (payKey(current) !== payKey(dto)) await recordStaffCalc(user);
  const doc = await SalaryStaff.findOneAndUpdate(
    { _id: staffId, user_id: user.id, trashed_at: null },
    { $set: { ...dto, updated_at: new Date() } },
    { new: true },
  );
  if (!doc) throw notFound('Employee not found');
  return toRecord(doc);
}

/** Soft-removes the employee; the bill already used for them is not returned. */
export async function trashMyStaff(userId: string, staffId: string): Promise<void> {
  if (!mongoose.isValidObjectId(staffId)) throw notFound('Employee not found');
  const now = new Date();
  const doc = await SalaryStaff.findOneAndUpdate(
    { _id: staffId, user_id: userId, trashed_at: null },
    { $set: { trashed_at: now, updated_at: now } },
    { new: true },
  );
  if (!doc) throw notFound('Employee not found');
}

/** @deprecated Prefer trashMyStaff; kept for the same DELETE route. */
export async function deleteMyStaff(userId: string, staffId: string): Promise<void> {
  return trashMyStaff(userId, staffId);
}

export async function listMyStaffOffices(userId: string): Promise<SalaryStaffOfficeRecord[]> {
  const docs = await SalaryStaffOffice.find({ user_id: userId }).sort({ created_at: 1, _id: 1 });
  return docs.map(toOfficeRecord);
}

export async function createMyStaffOffice(userId: string, dto: SalaryStaffOfficeDto): Promise<SalaryStaffOfficeRecord> {
  const count = await SalaryStaffOffice.countDocuments({ user_id: userId });
  if (count >= SALARY_MAX_STAFF_OFFICES) throw badRequest(`You can add up to ${SALARY_MAX_STAFF_OFFICES} offices.`);
  const now = new Date();
  const doc = await SalaryStaffOffice.create({
    user_id: new mongoose.Types.ObjectId(userId),
    name: dto.name,
    created_at: now,
    updated_at: now,
  });
  return toOfficeRecord(doc);
}

/** Once added, only an admin can rename a staff bill office. */
export async function updateMyStaffOffice(
  user: AuthUser,
  officeId: string,
  dto: SalaryStaffOfficeDto,
): Promise<SalaryStaffOfficeRecord> {
  if (!isPlatformAdmin(user)) throw forbidden('To change the office name, contact the admin.');
  if (!mongoose.isValidObjectId(officeId)) throw notFound('Office not found');
  const doc = await SalaryStaffOffice.findOneAndUpdate(
    { _id: officeId, user_id: user.id },
    { $set: { name: dto.name, updated_at: new Date() } },
    { new: true },
  );
  if (!doc) throw notFound('Office not found');
  return toOfficeRecord(doc);
}

/** Staff bill offices cannot be removed by users once saved. */
export async function deleteMyStaffOffice(_userId: string, _officeId: string): Promise<void> {
  throw forbidden('Staff bill offices cannot be removed. Contact the admin if the name is wrong.');
}
