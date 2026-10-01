import mongoose, { type Types } from 'mongoose';
import {
  ADDITIONAL_CHARGE_GRADE_MAX,
  ADDITIONAL_CHARGE_MAX,
  additionalChargeInputSchema,
  chargeHandoverSchema,
  type AdditionalChargeRecord,
  type ContactPersonRef,
  type MyAdditionalCharges,
} from '@ibas/shared-types';
import type { AuthUser } from '../../middleware/auth.js';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/logger.js';
import { User } from '../users/models/User.model.js';
import { Office } from '../org/models/Office.model.js';
import { Designation } from '../org/models/Designation.model.js';
import { officeIndex, parentPath } from '../org/org.service.js';
import { deliverSystemNotification } from '../notifications/notifications.service.js';
import { AdditionalCharge, type IAdditionalCharge } from './models/AdditionalCharge.model.js';

function zodMessage(err: { issues: Array<{ message: string }> }): string {
  return err.issues.map((i) => i.message).join('; ');
}

const inGradeRange = (g?: number | null) => !!g && g >= 1 && g <= ADDITIONAL_CHARGE_GRADE_MAX;

async function ownPost(userId: string) {
  const u = await User.findById(userId).select('office_id designation_id full_name_en full_name_bn').lean();
  if (!u?.office_id || !u.designation_id) return null;
  const d = await Designation.findById(u.designation_id).select('name grade').lean();
  return { officeId: String(u.office_id), designationId: String(u.designation_id), grade: d?.grade ?? null, designationName: d?.name, name: u.full_name_en?.trim() || u.full_name_bn?.trim() || 'A colleague' };
}

async function eligibility(userId: string): Promise<{ eligible: boolean; reason?: string; post: Awaited<ReturnType<typeof ownPost>> }> {
  const post = await ownPost(userId);
  if (!post) return { eligible: false, reason: 'Add your office and designation first.', post };
  if (!inGradeRange(post.grade)) {
    return { eligible: false, reason: `Additional charge is for officers of grade 1–${ADDITIONAL_CHARGE_GRADE_MAX}.`, post };
  }
  return { eligible: true, post };
}

async function toRecords(docs: IAdditionalCharge[]): Promise<AdditionalChargeRecord[]> {
  if (docs.length === 0) return [];
  const holderIds = docs.map((d) => d.handover?.new_holder_id).filter(Boolean) as Types.ObjectId[];
  const [map, designations, holders] = await Promise.all([
    officeIndex(),
    Designation.find({ _id: { $in: docs.map((d) => d.designation_id) } }).select('name short_name grade').lean(),
    holderIds.length ? User.find({ _id: { $in: holderIds } }).select('full_name_en full_name_bn').lean() : Promise.resolve([]),
  ]);
  const dm = new Map(designations.map((d) => [String(d._id), d]));
  const hm = new Map(holders.map((h) => [String(h._id), h.full_name_en?.trim() || h.full_name_bn?.trim() || 'A colleague']));
  return docs.map((c) => {
    const o = map.get(String(c.office_id));
    const d = dm.get(String(c.designation_id));
    const holderId = c.handover ? String(c.handover.new_holder_id) : null;
    const holder: ContactPersonRef | null = holderId ? { id: holderId, name: hm.get(holderId) ?? 'A colleague', designation: d?.name, office: o?.short_name || o?.name } : null;
    return {
      id: String(c._id),
      office: { id: String(c.office_id), name: o?.name ?? 'Office', short_name: o?.short_name, parent_path: o ? parentPath(map, o.parent_id) : '' },
      designation: { id: String(c.designation_id), name: d?.name ?? 'Post', short_name: d?.short_name ?? '', grade: d?.grade ?? null },
      started_at: c.started_at.toISOString(),
      handover: c.handover && holder ? { requested_at: c.handover.requested_at.toISOString(), new_holder: holder } : null,
    };
  });
}

export async function myCharges(user: AuthUser): Promise<MyAdditionalCharges> {
  const [{ eligible, reason }, docs] = await Promise.all([
    eligibility(user.id),
    AdditionalCharge.find({ user_id: user.id, status: 'active' }).sort({ started_at: -1 }),
  ]);
  return { eligible, reason, items: await toRecords(docs) };
}

export async function addCharge(user: AuthUser, body: unknown): Promise<MyAdditionalCharges> {
  const parsed = additionalChargeInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const { eligible, reason, post } = await eligibility(user.id);
  if (!eligible || !post) throw badRequest(reason ?? 'You cannot add an additional charge');
  const [office, designation, count] = await Promise.all([
    Office.findOne({ _id: parsed.data.office_id, is_active: true }).select('_id').lean(),
    Designation.findOne({ _id: parsed.data.designation_id, is_active: true }).select('_id grade').lean(),
    AdditionalCharge.countDocuments({ user_id: user.id, status: 'active' }),
  ]);
  if (!office) throw badRequest('Choose a valid office');
  if (!designation) throw badRequest('Choose a valid post');
  if (!inGradeRange(designation.grade)) throw badRequest(`Additional charge can only be on a grade 1–${ADDITIONAL_CHARGE_GRADE_MAX} post`);
  if (post.officeId === parsed.data.office_id && post.designationId === parsed.data.designation_id) {
    throw badRequest('This is already your own posting');
  }
  if (count >= ADDITIONAL_CHARGE_MAX) throw badRequest(`You can hold at most ${ADDITIONAL_CHARGE_MAX} additional charges`);
  try {
    await AdditionalCharge.create({ user_id: user.id, office_id: office._id, designation_id: designation._id, status: 'active', started_at: new Date() });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw badRequest('You already hold this additional charge');
    throw err;
  }
  return myCharges(user);
}

async function ownActive(user: AuthUser, id: string): Promise<IAdditionalCharge> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Additional charge not found');
  const doc = await AdditionalCharge.findOne({ _id: id, user_id: user.id, status: 'active' });
  if (!doc) throw notFound('Additional charge not found');
  return doc;
}

export async function removeCharge(user: AuthUser, id: string): Promise<MyAdditionalCharges> {
  const doc = await ownActive(user, id);
  doc.set({ status: 'ended', ended_at: new Date(), end_reason: 'removed', handover: null });
  await doc.save();
  return myCharges(user);
}

export async function answerHandover(user: AuthUser, id: string, body: unknown): Promise<MyAdditionalCharges> {
  const parsed = chargeHandoverSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const doc = await ownActive(user, id);
  if (!doc.handover) throw badRequest('Nothing to confirm for this charge');
  const newHolder = doc.handover.new_holder_id;
  if (parsed.data.handed_over) {
    doc.set({ status: 'ended', ended_at: new Date(), end_reason: 'handed_over', handed_over_to: newHolder, handover: null });
  } else {
    doc.set({ handover: null, kept_for: [...(doc.kept_for ?? []), newHolder] });
  }
  await doc.save();
  return myCharges(user);
}

export async function pendingHandoverCount(userId: string): Promise<number> {
  return AdditionalCharge.countDocuments({ user_id: userId, status: 'active', handover: { $ne: null } });
}

/**
 * After someone takes a post substantively: their own additional charge on it ends, and anyone else
 * holding it as additional charge is asked whether they handed over.
 */
export async function onSubstantivePosting(userId: string, officeId: string, designationId: string): Promise<void> {
  const now = new Date();
  await AdditionalCharge.updateMany(
    { user_id: userId, office_id: officeId, designation_id: designationId, status: 'active' },
    { $set: { status: 'ended', ended_at: now, end_reason: 'removed', handover: null } },
  );
  const uid = new mongoose.Types.ObjectId(userId);
  const holders = await AdditionalCharge.find({
    office_id: officeId,
    designation_id: designationId,
    status: 'active',
    user_id: { $ne: uid },
    handover: null,
    kept_for: { $ne: uid },
  }).select('_id user_id');
  if (holders.length === 0) return;
  await AdditionalCharge.updateMany({ _id: { $in: holders.map((h) => h._id) } }, { $set: { handover: { new_holder_id: uid, requested_at: now } } });

  const [post, office] = await Promise.all([ownPost(userId), Office.findById(officeId).select('name short_name').lean()]);
  void deliverSystemNotification({
    userIds: holders.map((h) => String(h.user_id)),
    title: 'Did you hand over charge?',
    message: `${post?.name ?? 'A colleague'} has joined as ${post?.designationName ?? 'the post'} at ${office?.short_name || office?.name || 'the office'}, where you hold additional charge. Please confirm whether you handed over charge or are still holding it.`,
    createdBy: userId,
    link: '/settings/profile',
    source: 'community',
    data: { type: 'charge_handover' },
  }).catch((err) => logger.warn({ err }, 'Charge handover notification failed'));
}

/* --------------------------------- directory --------------------------------- */

export interface ChargeRow {
  user_id: Types.ObjectId;
  office_id: Types.ObjectId;
  designation_id: Types.ObjectId;
}

export async function activeChargesAt(officeIds: Types.ObjectId[], designationId?: Types.ObjectId): Promise<ChargeRow[]> {
  return AdditionalCharge.find({ status: 'active', office_id: { $in: officeIds }, ...(designationId ? { designation_id: designationId } : {}) })
    .select('user_id office_id designation_id')
    .lean();
}

export async function activeChargesOf(userIds: Types.ObjectId[]): Promise<ChargeRow[]> {
  if (userIds.length === 0) return [];
  return AdditionalCharge.find({ status: 'active', user_id: { $in: userIds } }).select('user_id office_id designation_id').lean();
}
