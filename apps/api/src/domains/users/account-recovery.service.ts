import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {
  TEMP_PASSWORD_TTL_HOURS,
  setNewPasswordSchema,
  setTempPasswordSchema,
  type BlockedAccountReason,
  type BlockedAccountRecord,
  type TempPasswordResult,
} from '@ibas/shared-types';
import { badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';
import { hashPassword } from '../auth/auth.service.js';
import { User } from './models/User.model.js';
import { Credentials, type ICredentials } from './models/Credentials.model.js';

const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generateTempPassword(): string {
  const bytes = crypto.randomBytes(8);
  return [...bytes].map((b) => TEMP_ALPHABET[b % TEMP_ALPHABET.length]).join('');
}

/** The user signed in with an admin-issued temporary password and must choose their own. */
export function mustChangePassword(creds: Pick<ICredentials, 'temp_password_set_at'> | null | undefined): boolean {
  return !!creds?.temp_password_set_at;
}

export function isTempPasswordExpired(creds: Pick<ICredentials, 'temp_password_set_at' | 'temp_password_expires_at'>): boolean {
  return mustChangePassword(creds) && !!creds.temp_password_expires_at && creds.temp_password_expires_at < new Date();
}

export function clearTempPassword(creds: ICredentials): void {
  creds.temp_password_expires_at = undefined;
  creds.temp_password_set_at = undefined;
  creds.temp_password_set_by = undefined;
}

function isAdminAccount(u: { user_type: string; is_super_admin?: boolean }): boolean {
  return !!u.is_super_admin || u.user_type === 'admin' || u.user_type === 'system_admin';
}

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : undefined);

/** Accounts that can't sign in normally: suspended/inactive, locked by wrong passwords, or waiting on a new password. */
export async function listBlockedAccounts(filters: { q?: string }): Promise<BlockedAccountRecord[]> {
  const now = new Date();
  const blockedCreds = await Credentials.find({
    $or: [{ status: 'locked', locked_until: { $gt: now } }, { temp_password_set_at: { $ne: null } }],
  })
    .select('user_id')
    .lean();

  const query: Record<string, unknown> = {
    $or: [{ status: { $in: ['suspended', 'inactive'] } }, { _id: { $in: blockedCreds.map((c) => c.user_id) } }],
  };
  const q = filters.q?.trim();
  if (q) {
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    query.$and = [{ $or: [{ full_name_en: rx }, { full_name_bn: rx }, { email: rx }, { phone: rx }] }];
  }

  const users = await User.find(query)
    .select('full_name_en full_name_bn phone email user_type status updated_at')
    .sort({ updated_at: -1 })
    .limit(500)
    .lean();
  const creds = await Credentials.find({ user_id: { $in: users.map((u) => u._id) } })
    .select(
      'user_id status failed_attempts locked_until last_login bound_device_label temp_password_expires_at temp_password_set_at',
    )
    .lean();
  const credsByUser = new Map(creds.map((c) => [String(c.user_id), c]));

  return users.map((u) => {
    const c = credsByUser.get(String(u._id));
    const reasons: BlockedAccountReason[] = [];
    if (u.status === 'suspended') reasons.push('suspended');
    if (u.status === 'inactive') reasons.push('inactive');
    if (c?.status === 'locked' && c.locked_until && c.locked_until > now) reasons.push('locked');
    if (c?.temp_password_set_at) reasons.push('temp_password');
    return {
      id: String(u._id),
      full_name_en: u.full_name_en,
      full_name_bn: u.full_name_bn || undefined,
      phone: u.phone,
      email: u.email,
      user_type: u.user_type,
      status: u.status,
      reasons,
      failed_attempts: c?.failed_attempts ?? 0,
      locked_until: iso(c?.locked_until),
      temp_password_expires_at: iso(c?.temp_password_expires_at),
      temp_password_set_at: iso(c?.temp_password_set_at),
      last_login: iso(c?.last_login),
      bound_device_label: c?.bound_device_label || undefined,
    };
  });
}

/**
 * Issues a temporary password: reactivates the account, clears the wrong-password lock and signs
 * out every session. The user must choose a new password right after signing in with it.
 */
export async function setTempPassword(
  userId: string,
  body: unknown,
  admin: { id: string; is_super_admin: boolean },
): Promise<TempPasswordResult> {
  const dto = setTempPasswordSchema.parse(body ?? {});
  if (!mongoose.isValidObjectId(userId)) throw notFound('User not found');
  if (userId === admin.id) throw badRequest('Use Change password for your own account');
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  if (isAdminAccount(user) && !admin.is_super_admin) {
    throw forbidden('Only a super admin can reset the password of an admin account');
  }
  const creds = await Credentials.findOne({ user_id: user._id });
  if (!creds) throw notFound('Credentials not found');

  const temp = dto.password ? dto.password : generateTempPassword();
  const now = new Date();
  const expires = new Date(now.getTime() + TEMP_PASSWORD_TTL_HOURS * 3_600_000);
  creds.password_hash = await hashPassword(temp);
  creds.password_changed_at = now;
  creds.status = 'reset_required';
  creds.failed_attempts = 0;
  creds.locked_until = undefined;
  creds.reset_otp_hash = undefined;
  creds.reset_otp_expires_at = undefined;
  creds.temp_password_set_at = now;
  creds.temp_password_expires_at = expires;
  creds.temp_password_set_by = new mongoose.Types.ObjectId(admin.id);
  creds.token_version = (creds.token_version ?? 0) + 1;
  if (dto.clear_bound_device) {
    creds.bound_device_id = undefined;
    creds.bound_device_at = undefined;
    creds.bound_device_label = undefined;
  }
  await creds.save();

  if (user.status === 'suspended' || user.status === 'inactive') {
    user.status = 'active';
    await user.save();
  }

  return { user_id: String(user._id), temp_password: temp, expires_at: expires.toISOString() };
}

/** Signed in with a temporary password: replace it with the user's own. */
export async function setNewPassword(userId: string, body: unknown): Promise<{ success: true }> {
  const dto = setNewPasswordSchema.parse(body);
  const creds = await Credentials.findOne({ user_id: userId });
  if (!creds) throw notFound('Credentials not found');
  if (!mustChangePassword(creds)) throw badRequest('Use Change password to update your password');
  if (isTempPasswordExpired(creds)) throw badRequest('Your temporary password has expired. Ask an admin for a new one.');
  creds.password_hash = await hashPassword(dto.new_password);
  creds.password_changed_at = new Date();
  creds.status = 'active';
  creds.failed_attempts = 0;
  creds.locked_until = undefined;
  clearTempPassword(creds);
  await creds.save();
  return { success: true };
}
