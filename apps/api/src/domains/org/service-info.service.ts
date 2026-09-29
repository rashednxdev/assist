import mongoose from 'mongoose';
import { CADRE_GRADE_MAX, cadreAllowedForGrade, serviceInfoInputSchema, type ServiceInfo } from '@ibas/shared-types';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { User } from '../users/models/User.model.js';
import { Designation } from './models/Designation.model.js';

function designationOut(d: { _id: unknown; name: string; short_name: string; grade?: number | null } | null | undefined) {
  return d ? { id: String(d._id), name: d.name, short_name: d.short_name, grade: d.grade ?? null } : null;
}

export async function getServiceInfo(userId: string): Promise<ServiceInfo> {
  const u = await User.findById(userId).select('service_type bcs_batch joining_date joining_designation_id designation_id').lean();
  if (!u) throw notFound('User not found');
  const ids = [u.designation_id, u.joining_designation_id].filter(Boolean);
  const designations = ids.length ? await Designation.find({ _id: { $in: ids } }).select('name short_name grade').lean() : [];
  const dm = new Map(designations.map((d) => [String(d._id), d]));
  const current = designationOut(u.designation_id ? dm.get(String(u.designation_id)) : null);
  const joining = designationOut(u.joining_designation_id ? dm.get(String(u.joining_designation_id)) : null);
  const type = u.service_type ?? null;
  const complete =
    (type === 'cadre' && !!u.bcs_batch && !!u.joining_date) || (type === 'non_cadre' && !!joining && !!u.joining_date);
  return {
    service_type: type,
    bcs_batch: u.bcs_batch ?? null,
    joining_date: u.joining_date ? u.joining_date.toISOString() : null,
    joining_designation: joining,
    current_designation: current,
    cadre_allowed: cadreAllowedForGrade(current?.grade),
    complete,
  };
}

export async function setServiceInfo(userId: string, body: unknown): Promise<ServiceInfo> {
  const parsed = serviceInfoInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
  const p = parsed.data;
  const u = await User.findById(userId).select('designation_id').lean();
  if (!u) throw notFound('User not found');

  if (p.service_type === 'cadre') {
    const current = u.designation_id ? await Designation.findById(u.designation_id).select('grade').lean() : null;
    if (!cadreAllowedForGrade(current?.grade)) {
      throw badRequest(`Your designation is grade ${current!.grade}. BCS cadre posts are grades 1–${CADRE_GRADE_MAX}.`);
    }
    await User.updateOne(
      { _id: userId },
      { $set: { service_type: 'cadre', bcs_batch: p.bcs_batch, joining_date: p.joining_date, joining_designation_id: null } },
    );
  } else {
    const post = await Designation.findOne({ _id: p.joining_designation_id, is_active: true }).select('_id').lean();
    if (!post) throw badRequest('Choose your joining post from the list');
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          service_type: 'non_cadre',
          bcs_batch: null,
          joining_date: p.joining_date,
          joining_designation_id: new mongoose.Types.ObjectId(p.joining_designation_id),
        },
      },
    );
  }
  return getServiceInfo(userId);
}
