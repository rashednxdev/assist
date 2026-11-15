import mongoose from 'mongoose';
import { badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';
import { User } from './models/User.model.js';
import { Credentials } from './models/Credentials.model.js';
import { UserModuleAccess } from './models/UserModuleAccess.model.js';
import { UserAddress } from './models/UserAddress.model.js';
import { UserActivityLog } from './models/UserActivityLog.model.js';
import { UserEntitlement } from '../billing/models/UserEntitlement.model.js';
import { PaymentOrder } from '../billing/models/PaymentOrder.model.js';
import { LiveHost } from '../live-stream/models/LiveHost.model.js';
import { LiveStream } from '../live-stream/models/LiveStream.model.js';
import { LiveStreamGuest } from '../live-stream/models/LiveStreamGuest.model.js';
import { LiveStreamInvite } from '../live-stream/models/LiveStreamInvite.model.js';
import { LiveStreamGuestMessage } from '../live-stream/models/LiveStreamGuestMessage.model.js';
import { SalaryStaff } from '../salary/models/SalaryStaff.model.js';
import { SalaryUserOffice } from '../salary/models/SalaryUserOffice.model.js';
import { SalaryBillAccess } from '../salary/models/SalaryBillAccess.model.js';
import { SalaryBillUsage } from '../salary/models/SalaryBillUsage.model.js';
import { SalaryCalcUsage } from '../salary/models/SalaryCalcUsage.model.js';
import { SalaryStaffOffice } from '../salary/models/SalaryStaffOffice.model.js';
import { SalaryFaq } from '../salary/models/SalaryFaq.model.js';
import { ContactVerification } from '../contacts/models/ContactVerification.model.js';
import { AdditionalCharge } from '../contacts/models/AdditionalCharge.model.js';
import { ContactFavorite } from '../contacts/models/ContactFavorite.model.js';
import { BloodRequest } from '../blood-bank/models/BloodRequest.model.js';
import { BloodDonation } from '../blood-bank/models/BloodDonation.model.js';
import { CommunityThread } from '../community/models/CommunityThread.model.js';
import { CommunityAnswer } from '../community/models/CommunityAnswer.model.js';
import { CommunityVote } from '../community/models/CommunityVote.model.js';
import { CommunityFollow } from '../community/models/CommunityFollow.model.js';
import { CommunityReport } from '../community/models/CommunityReport.model.js';
import { ScheduleProfile } from '../schedule/models/ScheduleProfile.model.js';
import { ScheduleEvent } from '../schedule/models/ScheduleEvent.model.js';
import { DeviceToken } from '../notifications/models/DeviceToken.model.js';
import { NotificationRecipient } from '../notifications/models/NotificationRecipient.model.js';
import { AdminNotification } from '../notifications/models/AdminNotification.model.js';
import { PaperAttempt } from '../evaluation/models/PaperAttempt.model.js';
import { UserQuestionEvaluation } from '../evaluation/models/UserQuestionEvaluation.model.js';
import { SubmittedQuestion } from '../user-questions/models/SubmittedQuestion.model.js';
import { UserSubscription } from '../subscription/models/UserSubscription.model.js';

function isSystemAdmin(actor: { user_type?: string; is_super_admin?: boolean }): boolean {
  return Boolean(actor.is_super_admin || actor.user_type === 'system_admin');
}

/** Permanently remove an account and the records that belong to it, freeing email and phone. */
export async function purgeUserAccount(
  id: string,
  actor: { id: string; user_type?: string; is_super_admin?: boolean },
): Promise<{ deleted: true; email: string; phone: string }> {
  if (!isSystemAdmin(actor)) {
    throw forbidden('Only a system admin can delete an account');
  }
  if (!mongoose.isValidObjectId(id)) throw notFound('User not found');
  if (actor.id === id) throw badRequest('You cannot delete your own account');

  const user = await User.findById(id);
  if (!user) throw notFound('User not found');
  if (user.is_super_admin && !actor.is_super_admin) {
    throw forbidden('Only a super admin can delete a super admin account');
  }

  const oid = user._id;
  const email = user.email;
  const phone = user.phone;

  const threads = await CommunityThread.find({ author_id: oid }).select('_id');
  const threadIds = threads.map((t) => t._id);

  await Promise.all([
    Credentials.deleteMany({ user_id: oid }),
    UserModuleAccess.deleteMany({ user_id: oid }),
    UserAddress.deleteMany({ user_id: oid }),
    UserActivityLog.deleteMany({ user_id: oid }),
    UserEntitlement.deleteMany({ user_id: oid }),
    PaymentOrder.deleteMany({ user_id: oid }),
    UserSubscription.deleteMany({ user_id: oid }),
    LiveHost.deleteMany({ user_id: oid }),
    LiveStreamGuest.deleteMany({ user_id: oid }),
    LiveStreamInvite.deleteMany({ $or: [{ user_id: oid }, { invited_by: oid }] }),
    LiveStreamGuestMessage.deleteMany({ from_user_id: oid }),
    SalaryStaff.deleteMany({ user_id: oid }),
    SalaryStaffOffice.deleteMany({ user_id: oid }),
    SalaryUserOffice.deleteMany({ user_id: oid }),
    SalaryBillAccess.deleteMany({ user_id: oid }),
    SalaryBillUsage.deleteMany({ user_id: oid }),
    SalaryCalcUsage.deleteMany({ user_id: oid }),
    SalaryFaq.deleteMany({ asked_by: oid }),
    ContactVerification.deleteMany({ user_id: oid }),
    AdditionalCharge.deleteMany({ $or: [{ user_id: oid }, { new_holder_id: oid }] }),
    ContactFavorite.deleteMany({ user_id: oid }),
    BloodDonation.deleteMany({ user_id: oid }),
    BloodRequest.deleteMany({ $or: [{ user_id: oid }, { requester_id: oid }] }),
    CommunityAnswer.deleteMany({ $or: [{ author_id: oid }, { thread_id: { $in: threadIds } }] }),
    CommunityVote.deleteMany({ $or: [{ user_id: oid }, { thread_id: { $in: threadIds } }] }),
    CommunityFollow.deleteMany({ $or: [{ user_id: oid }, { thread_id: { $in: threadIds } }] }),
    CommunityReport.deleteMany({ reporter_id: oid }),
    CommunityThread.deleteMany({ author_id: oid }),
    ScheduleProfile.deleteMany({ user_id: oid }),
    ScheduleEvent.deleteMany({ owner_id: oid }),
    DeviceToken.deleteMany({ user_id: oid }),
    NotificationRecipient.deleteMany({ user_id: oid }),
    PaperAttempt.deleteMany({ user_id: oid }),
    UserQuestionEvaluation.deleteMany({ user_id: oid }),
    SubmittedQuestion.deleteMany({ user_id: oid }),
  ]);

  await Promise.all([
    LiveStream.updateMany({ support_user_id: oid }, { $unset: { support_user_id: 1 } }),
    ScheduleEvent.updateMany({ target_user_ids: oid }, { $pull: { target_user_ids: oid } }),
    AdminNotification.updateMany({ target_user_ids: oid }, { $pull: { target_user_ids: oid } }),
    Credentials.updateMany({ temp_password_set_by: oid }, { $unset: { temp_password_set_by: 1 } }),
  ]);

  const hosted = await LiveStream.find({ host_user_id: oid });
  for (const stream of hosted) {
    const creator = stream.created_by ? String(stream.created_by) : '';
    if (creator && creator !== id) {
      stream.host_user_id = stream.created_by;
      await stream.save();
      continue;
    }
    await Promise.all([
      LiveStreamGuest.deleteMany({ live_stream_id: stream._id }),
      LiveStreamInvite.deleteMany({ live_stream_id: stream._id }),
      LiveStreamGuestMessage.deleteMany({ live_stream_id: stream._id }),
    ]);
    await stream.deleteOne();
  }

  await user.deleteOne();
  return { deleted: true, email, phone };
}
