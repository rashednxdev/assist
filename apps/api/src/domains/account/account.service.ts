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
} from '@ibas/shared-types';
import { User } from '../users/models/User.model.js';
import { Credentials } from '../users/models/Credentials.model.js';
import { UserAddress } from '../users/models/UserAddress.model.js';
import { SubscriptionPlan } from '../subscription/models/SubscriptionPlan.model.js';
import { UserSubscription } from '../subscription/models/UserSubscription.model.js';
import { hashPassword, signTokens } from '../auth/auth.service.js';
import { badRequest, notFound, unauthorized } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/logger.js';

const OTP_TTL_MS = 15 * 60 * 1000;

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
    user_type: user.user_type,
    status: user.status,
    is_verified: user.is_verified,
    email_verified: user.email_verified,
    phone_verified: user.phone_verified,
    is_super_admin: user.is_super_admin,
    workflow_roles: user.workflow_roles.map((r) => ({
      role_code: r.role_code,
      is_active: r.is_active,
    })),
  };
}

async function issueDemoOtps(user: InstanceType<typeof User>, creds: InstanceType<typeof Credentials>) {
  const emailOtp = generateOtp();
  const phoneOtp = generateOtp();
  const expires = new Date(Date.now() + OTP_TTL_MS);

  creds.email_otp_hash = await hashOtp(emailOtp);
  creds.email_otp_expires_at = expires;
  creds.phone_otp_hash = await hashOtp(phoneOtp);
  creds.phone_otp_expires_at = expires;
  await creds.save();

  logger.info(
    { email: user.email, phone: user.phone, emailOtp, phoneOtp },
    'Demo verification codes (development)',
  );

  return { emailOtp, phoneOtp, expiresInMinutes: 15 };
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

/** Exam candidates browse rules, exams, questions, and preview guided processes. */
const APPLICANT_LEARNING_MODULE_CODES = ['BOOKS', 'QUESTIONS', 'EXAM', 'PAPER', 'WORKFLOW'] as const;

async function assignDefaultLearningAccess(user: InstanceType<typeof User>) {
  if (user.user_type !== 'applicant') return;

  const { Module } = await import('../setup/models/Module.model.js');
  const { UserModuleAccess } = await import('../users/models/UserModuleAccess.model.js');

  for (const code of APPLICANT_LEARNING_MODULE_CODES) {
    const mod = await Module.findOne({ code, is_active: true });
    if (!mod) continue;

    const existing = await UserModuleAccess.findOne({ user_id: user._id, module_id: mod._id, is_active: true });
    if (existing?.can_read) continue;

    await UserModuleAccess.findOneAndUpdate(
      { user_id: user._id, module_id: mod._id },
      {
        user_id: user._id,
        module_id: mod._id,
        module_code: mod.code,
        permissions: ['read'],
        can_read: true,
        can_create: false,
        can_update: false,
        can_delete: false,
        can_grade: false,
        can_publish: false,
        task_restrictions: [],
        granted_by: user._id,
        granted_at: new Date(),
        is_active: true,
      },
      { upsert: true },
    );
  }

  logger.info({ userId: user._id }, 'Assigned default learning module read access to applicant');
}

async function activateIfFullyVerified(user: InstanceType<typeof User>) {
  if (user.email_verified && user.phone_verified) {
    user.is_verified = true;
    user.status = 'active';
    await user.save();
    await assignDefaultWorkflowRoles(user);
    await assignDefaultLearningAccess(user);
    return true;
  }
  return false;
}

export async function registerUser(dto: RegisterDto) {
  const email = dto.email.toLowerCase();
  const exists = await User.findOne({ $or: [{ email }, { phone: dto.phone }] });
  if (exists) throw badRequest('Email or phone number is already registered');

  const user = await User.create({
    full_name_en: dto.full_name_en,
    full_name_bn: dto.full_name_bn,
    email,
    phone: dto.phone,
    user_type: dto.user_type,
    workflow_roles: [],
    status: 'pending_verify',
    is_verified: false,
    email_verified: false,
    phone_verified: false,
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
  });

  const demo = await issueDemoOtps(user, creds);
  const tokens = signTokens(String(user._id));

  return { tokens, user: serializeUser(user), demo };
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

  logger.info({ userId, channel, code }, 'Demo OTP resent');
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
  if (dto.dob !== undefined) user.dob = dto.dob;
  if (dto.gender !== undefined) user.gender = dto.gender;
  if (dto.employee_id !== undefined) user.employee_id = dto.employee_id || undefined;

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
  await creds.save();
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

  const [user, addresses, subscription, workflow] = await Promise.all([
    getMyProfile(userId),
    listMyAddresses(userId),
    getMySubscription(userId),
    getMemberWorkflowSummary(userId),
  ]);

  const checks = [
    !!user.full_name_en,
    !!user.phone,
    user.email_verified && user.phone_verified,
    addresses.length > 0,
    !!subscription,
  ];
  const profile_complete_percent = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return { user, address_count: addresses.length, subscription, profile_complete_percent, workflow };
}
