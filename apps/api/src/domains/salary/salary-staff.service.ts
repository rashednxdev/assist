import mongoose from 'mongoose';
import { SALARY_MAX_STAFF, type SalaryStaffDto, type SalaryStaffRecord } from '@ibas/shared-types';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { SalaryStaff, type ISalaryStaff } from './models/SalaryStaff.model.js';

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
    created_at: doc.created_at.toISOString(),
    updated_at: doc.updated_at.toISOString(),
  };
}

export async function listMyStaff(userId: string): Promise<SalaryStaffRecord[]> {
  const docs = await SalaryStaff.find({ user_id: userId }).sort({ created_at: 1, _id: 1 });
  return docs.map(toRecord);
}

export async function createMyStaff(userId: string, dto: SalaryStaffDto): Promise<SalaryStaffRecord> {
  const count = await SalaryStaff.countDocuments({ user_id: userId });
  if (count >= SALARY_MAX_STAFF) throw badRequest(`You can add up to ${SALARY_MAX_STAFF} employees.`);
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
