import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import type {
  RegisterDto,
  OtpVerifyDto,
  ChangePasswordDto,
  UpdateMyProfileDto,
  CreateUserAddressDto,
  SubscribePlanDto,
  ForgotPasswordDto,
  VerifyResetOtpDto,
  ResetPasswordDto,
} from '@ibas/shared-types';
import { User } from '../users/models/User.model.js';
import { Credentials } from '../users/models/Credentials.model.js';
import { UserAddress } from '../users/models/UserAddress.model.js';
import { District } from '../setup/models/District.model.js';
import { SubscriptionPlan } from '../subscription/models/SubscriptionPlan.model.js';
import { UserSubscription } from '../subscription/models/UserSubscription.model.js';
import { BookInfo } from '../books/models/BookInfo.model.js';
import { Question } from '../questions/models/Question.model.js';
import { ExamName } from '../exams/models/ExamName.model.js';
import { PaperDetail } from '../papers/models/PaperDetail.model.js';
import { hashPassword, signTokens } from '../auth/auth.service.js';
import { clearTempPassword } from '../users/account-recovery.service.js';
import { badRequest, notFound, unauthorized } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/logger.js';
import { sendSms } from '../../shared/sms.js';

const REGISTER_OTP_SMS = (code: string) =>
  `Welcome to ProAssist! Your registration OTP is ${code} (valid for 15 mins). Do not share this code with anyone.`;

const OTP_TTL_MS = 15 * 60 * 1000;
const RESET_OTP_TTL_MS = 15 * 60 * 1000;
const RESET_COOLDOWN_MS = 60 * 1000;
const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_MAX_SENDS = 5;
const RESET_MAX_ATTEMPTS = 5;
/** Domain used for the auto-generated placeholder email of legacy phone-only signups (pre-dating required email). */
const PLACEHOLDER_EMAIL_DOMAIN = '@phone.proassist.app';

function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}${'*'.repeat(Math.max(1, phone.length - 5))}${phone.slice(-2)}`;
}

function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

async function checkOtp(code: string, hash: string | undefined): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(code, hash);
}

function serializeUser(user: InstanceType<typeof User>) {
  return {
    id: String(user._id),
    email: user.email,
    phone: user.phone,
    full_name_en: user.full_name_en,
    full_name_bn: user.full_name_bn,
    nid: user.nid,
    employee_id: user.employee_id,
    dob: user.dob,
    gender: user.gender,
    blood_group: user.blood_group ?? null,
    father_name: user.father_name,
    mother_name: user.mother_name,
    home_district_id: user.home_district_id ? String(user.home_district_id) : null,
    joining_date: user.joining_date ?? null,
    alternate_phone: user.alternate_phone,
    emergency_contact_name: user.emergency_contact_name,
    emergency_contact_relation: user.emergency_contact_relation,
    emergency_contact_phone: user.emergency_contact_phone,
    bio: user.bio,
    user_type: user.user_type,
    status: user.status,
    is_verified: user.is_verified,
    email_verified: user.email_verified,
    phone_verified: user.phone_verified,
    is_super_admin: user.is_super_admin,
    workflow_roles: user.workflow_roles.map((r) => ({
      role_code: r.role_code,
      is_active: r.is_active,
      self_assigned: !!r.self_assigned,
    })),
  };
}

async function assignDefaultWorkflowRoles(user: InstanceType<typeof User>) {
  if (user.user_type !== 'officer') return;

  const { Role } = await import('../workflow/models/Role.model.js');
  const role = await Role.findOne({ code: 'SDO', is_active: true });
  if (!role) return;

  const has = user.workflow_roles.some((r) => r.role_code === 'SDO' && r.is_active);
  if (has) return;

  user.workflow_roles.push({
    role_id: role._id,
    role_code: 'SDO',
    is_active: true,
    assigned_at: new Date(),
    assigned_by: user._id,
  });
  await user.save();
  logger.info({ userId: user._id }, 'Assigned default SDO workflow role to officer');
}

async function activateIfFullyVerified(user: InstanceType<typeof User>) {
  if (user.email_verified && user.phone_verified) {
    user.is_verified = true;
    user.status = 'active';
    await user.save();
    await assignDefaultWorkflowRoles(user);
    return true;
  }
  return false;
}

export async function registerUser(dto: RegisterDto) {
  const phone = dto.phone.trim();
  const email = (dto.email?.trim() || `${phone}${PLACEHOLDER_EMAIL_DOMAIN}`).toLowerCase();
  const exists = await User.findOne({ $or: [{ email }, { phone }] });
  if (exists) throw badRequest('Mobile number is already registered');

  const user = await User.create({
    full_name_en: dto.full_name_en,
    full_name_bn: dto.full_name_bn,
    email,
    phone,
    user_type: dto.user_type,
    workflow_roles: [],
    // Phone-only signup: activate immediately (placeholder email is pre-verified).
    status: 'active',
    is_verified: true,
    email_verified: true,
    phone_verified: true,
    is_super_admin: false,
    created_by: new mongoose.Types.ObjectId(),
  });
  user.created_by = user._id;
  await user.save();

  const creds = await Credentials.create({
    user_id: user._id,
    password_hash: await hashPassword(dto.password),
    status: 'active',
    failed_attempts: 0,
    password_changed_at: new Date(),
    two_fa_enabled: false,
    bound_device_id: dto.device_id,
    bound_device_at: new Date(),
    bound_device_label: dto.device_label?.slice(0, 120),
    allow_multi_device: false,
    token_version: 0,
  });

  await assignDefaultWorkflowRoles(user);

  const code = generateOtp();
  creds.phone_otp_hash = await hashOtp(code);
  creds.phone_otp_expires_at = new Date(Date.now() + OTP_TTL_MS);
  await creds.save();

  if (/^01[3-9]\d{8}$/.test(phone)) {
    try {
      await sendSms(phone, REGISTER_OTP_SMS(code));
    } catch (err) {
      await Credentials.deleteOne({ _id: creds._id });
      await User.deleteOne({ _id: user._id });
      throw err;
    }
  }

  const tokens = signTokens(String(user._id), dto.device_id, 0);

  return { tokens, user: serializeUser(user) };
}

export async function resendOtp(userId: string, channel: 'email' | 'phone') {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  const creds = await Credentials.findOne({ user_id: user._id });
  if (!creds) throw notFound('Credentials not found');

  const code = generateOtp();
  const expires = new Date(Date.now() + OTP_TTL_MS);
  const hash = await hashOtp(code);

  if (channel === 'email') {
    creds.email_otp_hash = hash;
    creds.email_otp_expires_at = expires;
  } else {
    creds.phone_otp_hash = hash;
    creds.phone_otp_expires_at = expires;
  }
  await creds.save();

  if (channel === 'phone') {
    if (!/^01[3-9]\d{8}$/.test(user.phone)) {
      throw badRequest('This account has no mobile number for a text message.');
    }
    try {
      await sendSms(user.phone, REGISTER_OTP_SMS(code));
    } catch (err) {
      creds.phone_otp_hash = undefined;
      creds.phone_otp_expires_at = undefined;
      await creds.save();
      throw err;
    }
    logger.info({ userId }, 'Registration code sent by SMS');
    return { channel, sent: true, expiresInMinutes: 15 };
  }

  return { channel, demoCode: code, expiresInMinutes: 15 };
}

export async function verifyOtp(userId: string, dto: OtpVerifyDto) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  const creds = await Credentials.findOne({ user_id: user._id });
  if (!creds) throw notFound('Credentials not found');

  if (dto.channel === 'email') {
    if (user.email_verified) return { user: serializeUser(user), activated: user.status === 'active' };
    if (!creds.email_otp_expires_at || creds.email_otp_expires_at < new Date()) {
      throw badRequest('Email verification code expired. Request a new code.');
    }
    if (!(await checkOtp(dto.code, creds.email_otp_hash))) {
      throw badRequest('Invalid email verification code');
    }
    user.email_verified = true;
    creds.email_otp_hash = undefined;
    creds.email_otp_expires_at = undefined;
  } else {
    if (user.phone_verified) return { user: serializeUser(user), activated: user.status === 'active' };
    if (!creds.phone_otp_expires_at || creds.phone_otp_expires_at < new Date()) {
      throw badRequest('Phone verification code expired. Request a new code.');
    }
    if (!(await checkOtp(dto.code, creds.phone_otp_hash))) {
      throw badRequest('Invalid phone verification code');
    }
    user.phone_verified = true;
    creds.phone_otp_hash = undefined;
    creds.phone_otp_expires_at = undefined;
  }

  await creds.save();
  await user.save();
  const activated = await activateIfFullyVerified(user);
  const refreshed = await User.findById(user._id);
  if (!refreshed) throw notFound('User not found');

  return { user: serializeUser(refreshed), activated };
}

export async function getMyProfile(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  return serializeUser(user);
}

export async function updateMyProfile(userId: string, dto: UpdateMyProfileDto) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');

  if (dto.phone && dto.phone !== user.phone) {
    const clash = await User.findOne({ phone: dto.phone, _id: { $ne: user._id } });
    if (clash) throw badRequest('Phone number already in use');
    user.phone = dto.phone;
    user.phone_verified = false;
    user.is_verified = false;
    if (user.status === 'active') user.status = 'pending_verify';
  }

  if (dto.full_name_en !== undefined) user.full_name_en = dto.full_name_en;
  if (dto.full_name_bn !== undefined) user.full_name_bn = dto.full_name_bn;
  if (dto.nid !== undefined) user.nid = dto.nid || undefined;
  if (dto.dob !== undefined) user.dob = dto.dob ?? undefined;
  if (dto.gender !== undefined) user.gender = dto.gender ?? undefined;
  if (dto.employee_id !== undefined) user.employee_id = dto.employee_id || undefined;
  if (dto.blood_group !== undefined) user.blood_group = dto.blood_group;
  if (dto.home_district_id !== undefined) {
    if (dto.home_district_id && !(await District.exists({ _id: dto.home_district_id }))) throw badRequest('Unknown home district');
    user.home_district_id = dto.home_district_id ? new mongoose.Types.ObjectId(dto.home_district_id) : null;
  }
  if (dto.joining_date !== undefined) user.joining_date = dto.joining_date;
  const texts = [
    'father_name',
    'mother_name',
    'alternate_phone',
    'emergency_contact_name',
    'emergency_contact_relation',
    'emergency_contact_phone',
    'bio',
  ] as const;
  for (const key of texts) {
    if (dto[key] !== undefined) user[key] = dto[key] || undefined;
  }

  await user.save();
  return serializeUser(user);
}

export async function changeMyPassword(userId: string, dto: ChangePasswordDto) {
  const creds = await Credentials.findOne({ user_id: userId });
  if (!creds) throw notFound('Credentials not found');

  const valid = await bcrypt.compare(dto.current_password, creds.password_hash);
  if (!valid) throw unauthorized('Current password is incorrect');

  creds.password_hash = await hashPassword(dto.new_password);
  creds.password_changed_at = new Date();
  if (creds.temp_password_set_at) {
    clearTempPassword(creds);
    creds.status = 'active';
  }
  await creds.save();
  return { success: true };
}

/**
 * "Forgot password" step 1 — no auth token yet. The account is found by phone and a 6-digit
 * code is texted to that number.
 */
export async function requestPasswordReset(dto: ForgotPasswordDto) {
  const phone = dto.phone.trim();
  const user = await User.findOne({ phone });
  if (!user) throw notFound('No account found with that mobile number');

  const creds = await Credentials.findOne({ user_id: user._id });
  if (!creds) throw notFound('Credentials not found');

  const now = Date.now();
  if (
    creds.reset_otp_hash &&
    creds.reset_otp_sent_at &&
    creds.reset_otp_expires_at &&
    creds.reset_otp_expires_at.getTime() > now &&
    now - creds.reset_otp_sent_at.getTime() < RESET_COOLDOWN_MS
  ) {
    const wait = Math.ceil((RESET_COOLDOWN_MS - (now - creds.reset_otp_sent_at.getTime())) / 1000);
    throw badRequest(`Wait ${wait} seconds before requesting another code.`);
  }
  if (!creds.reset_otp_window_start || now - creds.reset_otp_window_start.getTime() > RESET_WINDOW_MS) {
    creds.reset_otp_window_start = new Date(now);
    creds.reset_otp_window_count = 0;
  }
  if ((creds.reset_otp_window_count ?? 0) >= RESET_MAX_SENDS) {
    throw badRequest('Too many reset codes were sent. Wait a few minutes and try again.');
  }

  const code = generateOtp();
  creds.reset_otp_hash = await hashOtp(code);
  creds.reset_otp_expires_at = new Date(now + RESET_OTP_TTL_MS);
  creds.reset_otp_attempts = 0;
  creds.reset_otp_sent_at = new Date(now);
  creds.reset_otp_window_count = (creds.reset_otp_window_count ?? 0) + 1;
  await creds.save();

  try {
    await sendSms(
      phone,
      `Your ProAssist password reset code is ${code} (valid for 15 mins). Thank you for using ProAssist!`,
    );
  } catch (err) {
    creds.reset_otp_hash = undefined;
    creds.reset_otp_expires_at = undefined;
    creds.reset_otp_window_count = Math.max(0, (creds.reset_otp_window_count ?? 1) - 1);
    await creds.save();
    throw err;
  }

  logger.info({ userId: user._id }, 'Password reset code sent by SMS');
  return { sent: true, phone_hint: maskPhone(phone) };
}

async function assertResetCode(phone: string, code: string) {
  const user = await User.findOne({ phone: phone.trim() });
  if (!user) throw notFound('No account found with that mobile number');

  const creds = await Credentials.findOne({ user_id: user._id });
  if (!creds) throw notFound('Credentials not found');

  if (!creds.reset_otp_expires_at || creds.reset_otp_expires_at < new Date() || !creds.reset_otp_hash) {
    throw badRequest('Reset code expired. Request a new one.');
  }
  if ((creds.reset_otp_attempts ?? 0) >= RESET_MAX_ATTEMPTS) {
    creds.reset_otp_hash = undefined;
    creds.reset_otp_expires_at = undefined;
    await creds.save();
    throw badRequest('Too many wrong codes. Request a new one.');
  }
  if (!(await checkOtp(code, creds.reset_otp_hash))) {
    creds.reset_otp_attempts = (creds.reset_otp_attempts ?? 0) + 1;
    const lockedOut = creds.reset_otp_attempts >= RESET_MAX_ATTEMPTS;
    if (lockedOut) {
      creds.reset_otp_hash = undefined;
      creds.reset_otp_expires_at = undefined;
    }
    await creds.save();
    throw badRequest(lockedOut ? 'Too many wrong codes. Request a new one.' : 'That code is not correct.');
  }
  return { user, creds };
}

/** "Forgot password" step 2 — the code is checked and kept until a new password is saved. */
export async function verifyResetOtp(dto: VerifyResetOtpDto) {
  await assertResetCode(dto.phone, dto.code);
  return { verified: true };
}

/** "Forgot password" step 3 — the checked SMS code plus a new password, still with no auth token. */
export async function resetPasswordWithOtp(dto: ResetPasswordDto) {
  const { user, creds } = await assertResetCode(dto.phone, dto.code);

  creds.password_hash = await hashPassword(dto.new_password);
  creds.password_changed_at = new Date();
  creds.reset_otp_hash = undefined;
  creds.reset_otp_expires_at = undefined;
  creds.reset_otp_attempts = 0;
  clearTempPassword(creds);
  creds.failed_attempts = 0;
  creds.status = 'active';
  creds.locked_until = undefined;
  // Invalidate any existing session (device stays bound — this just forces a fresh login there).
  creds.token_version += 1;
  await creds.save();

  logger.info({ userId: user._id }, 'Password reset via OTP');
  return { success: true };
}

export async function listMyAddresses(userId: string) {
  const items = await UserAddress.find({ user_id: userId }).sort({ created_at: -1 });
  return items.map((doc) => ({
    id: String(doc._id),
    address_type: doc.address_type,
    division_id: String(doc.division_id),
    district_id: String(doc.district_id),
    thana_id: String(doc.thana_id),
    village_or_area: doc.village_or_area,
    post_code: doc.post_code,
    full_address: doc.full_address,
    is_primary: doc.is_primary,
    created_at: doc.created_at,
  }));
}

export async function createMyAddress(userId: string, dto: CreateUserAddressDto) {
  if (dto.is_primary) {
    await UserAddress.updateMany({ user_id: userId }, { is_primary: false });
  }
  const doc = await UserAddress.create({
    user_id: new mongoose.Types.ObjectId(userId),
    address_type: dto.address_type,
    division_id: new mongoose.Types.ObjectId(dto.division_id),
    district_id: new mongoose.Types.ObjectId(dto.district_id),
    thana_id: new mongoose.Types.ObjectId(dto.thana_id),
    village_or_area: dto.village_or_area,
    post_code: dto.post_code,
    full_address: dto.full_address,
    is_primary: dto.is_primary,
  });
  return {
    id: String(doc._id),
    address_type: doc.address_type,
    division_id: String(doc.division_id),
    district_id: String(doc.district_id),
    thana_id: String(doc.thana_id),
    village_or_area: doc.village_or_area,
    post_code: doc.post_code,
    full_address: doc.full_address,
    is_primary: doc.is_primary,
    created_at: doc.created_at,
  };
}

export async function deleteMyAddress(userId: string, addressId: string) {
  const doc = await UserAddress.findOne({ _id: addressId, user_id: userId });
  if (!doc) throw notFound('Address not found');
  await doc.deleteOne();
  return { deleted: true };
}

export async function listSubscriptionPlans() {
  const plans = await SubscriptionPlan.find({ is_active: true }).sort({ sort_order: 1 });
  return plans.map((p) => ({
    id: String(p._id),
    name: p.name,
    code: p.code,
    description: p.description,
    price_bdt: p.price_bdt,
    duration_days: p.duration_days,
    features: p.features,
  }));
}

export async function getMySubscription(userId: string) {
  const sub = await UserSubscription.findOne({ user_id: userId, status: 'active' }).sort({
    expires_at: -1,
  });
  if (!sub) return null;
  if (sub.expires_at < new Date()) {
    sub.status = 'expired';
    await sub.save();
    return null;
  }
  const plan = await SubscriptionPlan.findById(sub.plan_id);
  return {
    id: String(sub._id),
    status: sub.status,
    started_at: sub.started_at,
    expires_at: sub.expires_at,
    plan: plan
      ? { id: String(plan._id), name: plan.name, code: plan.code, price_bdt: plan.price_bdt }
      : null,
  };
}

export async function subscribeToPlan(userId: string, dto: SubscribePlanDto) {
  const plan = await SubscriptionPlan.findById(dto.plan_id);
  if (!plan || !plan.is_active) throw notFound('Subscription plan not found');

  await UserSubscription.updateMany({ user_id: userId, status: 'active' }, { status: 'cancelled' });

  const started = new Date();
  const expires = new Date(started.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
  const sub = await UserSubscription.create({
    user_id: new mongoose.Types.ObjectId(userId),
    plan_id: plan._id,
    status: 'active',
    started_at: started,
    expires_at: expires,
  });

  return {
    id: String(sub._id),
    status: sub.status,
    started_at: sub.started_at,
    expires_at: sub.expires_at,
    plan: {
      id: String(plan._id),
      name: plan.name,
      code: plan.code,
      price_bdt: plan.price_bdt,
      features: plan.features,
    },
  };
}

export async function getAccountSummary(userId: string) {
  const { getMemberWorkflowSummary } = await import('../workflow/workflow.service.js');
  const { cachedLearningStats } = await import('../content-cache/content-cache.service.js');

  const cachedStats = cachedLearningStats();

  const [user, addresses, subscription, workflow, books, questions, exams, papers] = await Promise.all([
    getMyProfile(userId),
    listMyAddresses(userId),
    getMySubscription(userId),
    getMemberWorkflowSummary(userId),
    cachedStats
      ? Promise.resolve(cachedStats.books)
      : BookInfo.countDocuments({ is_active: true, is_superseded: false }),
    cachedStats
      ? Promise.resolve(cachedStats.questions)
      : Question.countDocuments({ is_active: true, is_published: true }),
    cachedStats ? Promise.resolve(cachedStats.exams) : ExamName.countDocuments({ is_active: true }),
    cachedStats
      ? Promise.resolve(cachedStats.papers)
      : PaperDetail.countDocuments({ is_active: true, is_published: true }),
  ]);

  const checks = [
    !!user.full_name_en,
    !!user.phone,
    user.email_verified && user.phone_verified,
    addresses.length > 0,
    !!subscription,
  ];
  const profile_complete_percent = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return {
    user,
    address_count: addresses.length,
    subscription,
    profile_complete_percent,
    workflow,
    learning: { books, questions, exams, papers },
  };
}
