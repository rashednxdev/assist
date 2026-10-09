import mongoose from 'mongoose';
import {
  SALARY_MAX_STAFF,
  SALARY_MAX_STAFF_OFFICES,
  type SalaryStaffDto,
  type SalaryStaffOfficeDto,
  type SalaryStaffOfficeRecord,
  type SalaryStaffRecord,
} from '@ibas/shared-types';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { SalaryStaff, type ISalaryStaff } from './models/SalaryStaff.model.js';
import { SalaryStaffOffice, type ISalaryStaffOffice } from './models/SalaryStaffOffice.model.js';

function toRecord(doc: ISalaryStaff): SalaryStaffRecord {
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

async function assertOwnStaffOffice(userId: string, staffOfficeId: string | null): Promise<void> {
  if (!staffOfficeId) return;
  const exists = await SalaryStaffOffice.exists({ _id: staffOfficeId, user_id: userId });
  if (!exists) throw badRequest('This office was removed from your staff bill. Choose an office again.');
}

export async function listMyStaff(userId: string): Promise<SalaryStaffRecord[]> {
  const docs = await SalaryStaff.find({ user_id: userId }).sort({ created_at: 1, _id: 1 });
  return docs.map(toRecord);
}

export async function createMyStaff(userId: string, dto: SalaryStaffDto): Promise<SalaryStaffRecord> {
  const count = await SalaryStaff.countDocuments({ user_id: userId });
  if (count >= SALARY_MAX_STAFF) throw badRequest(`You can add up to ${SALARY_MAX_STAFF} employees.`);
  await assertOwnStaffOffice(userId, dto.staff_office_id);
  const now = new Date();
  const doc = await SalaryStaff.create({
    ...dto,
    user_id: new mongoose.Types.ObjectId(userId),
    created_at: now,
    updated_at: now,
  });
  return toRecord(doc);
}

export async function updateMyStaff(userId: string, staffId: string, dto: SalaryStaffDto): Promise<SalaryStaffRecord> {
  if (!mongoose.isValidObjectId(staffId)) throw notFound('Employee not found');
  await assertOwnStaffOffice(userId, dto.staff_office_id);
  const doc = await SalaryStaff.findOneAndUpdate(
    { _id: staffId, user_id: userId },
    { $set: { ...dto, updated_at: new Date() } },
    { new: true },
  );
  if (!doc) throw notFound('Employee not found');
  return toRecord(doc);
}

export async function deleteMyStaff(userId: string, staffId: string): Promise<void> {
  if (!mongoose.isValidObjectId(staffId)) throw notFound('Employee not found');
  const res = await SalaryStaff.deleteOne({ _id: staffId, user_id: userId });
  if (res.deletedCount === 0) throw notFound('Employee not found');
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

export async function updateMyStaffOffice(
  userId: string,
  officeId: string,
  dto: SalaryStaffOfficeDto,
): Promise<SalaryStaffOfficeRecord> {
  if (!mongoose.isValidObjectId(officeId)) throw notFound('Office not found');
  const doc = await SalaryStaffOffice.findOneAndUpdate(
    { _id: officeId, user_id: userId },
    { $set: { name: dto.name, updated_at: new Date() } },
    { new: true },
  );
  if (!doc) throw notFound('Office not found');
  return toOfficeRecord(doc);
}

/** Removes the office and the employees saved under it. */
export async function deleteMyStaffOffice(userId: string, officeId: string): Promise<void> {
  if (!mongoose.isValidObjectId(officeId)) throw notFound('Office not found');
  const res = await SalaryStaffOffice.deleteOne({ _id: officeId, user_id: userId });
  if (res.deletedCount === 0) throw notFound('Office not found');
  await SalaryStaff.deleteMany({ user_id: userId, staff_office_id: officeId });
}
