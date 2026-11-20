import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { LoginCodeDto, LoginDto, LoginOtpDto } from '@ibas/shared-types';
import { env } from '../../config/env.js';
import { AppError, badRequest, forbidden, unauthorized } from '../../shared/errors/AppError.js';
import { sendSms } from '../../shared/sms.js';
import { User } from '../users/models/User.model.js';
import { Credentials, type ICredentials } from '../users/models/Credentials.model.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const LOGIN_OTP_TTL_MS = 5 * 60 * 1000;
const LOGIN_OTP_COOLDOWN_MS = 60 * 1000;
const LOGIN_OTP_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_OTP_MAX_SENDS = 5;
const LOGIN_OTP_MAX_ATTEMPTS = 5;

/** Temporary: web sign-ins neither count against nor bind the one-device limit. Set false to enforce again. */
export const WEB_LOGIN_IGNORES_DEVICE_LIMIT = true;

export type SessionPlatform = 'web' | 'mobile';

function isWebLogin(dto: Pick<LoginDto, 'client_platform' | 'device_label'>): boolean {
  return dto.client_platform === 'web' || Boolean(dto.device_label?.startsWith('web:'));
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginSession {
  kind: 'session';
  tokens: TokenPair;
  userId: string;
  mustChangePassword: boolean;
}

export interface LoginOtpChallenge {
  kind: 'otp';
  challenge: string;
  phoneHint: string;
  expiresIn: number;
}

export interface AccessTokenClaims {
  userId: string;
  deviceId?: string;
  tokenVersion: number;
}

function expiresInToSeconds(value: string, fallbackSeconds: number): number {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return fallbackSeconds;
  const amount = Number(match[1]);
  const unit = match[2];
  if (!unit) return fallbackSeconds;
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * (multipliers[unit] ?? 60);
}

function accessExpiresSeconds(): number {
  return expiresInToSeconds(env.JWT_ACCESS_EXPIRES_IN, 900);
}

export function refreshExpiresMs(): number {
  return expiresInToSeconds(env.JWT_REFRESH_EXPIRES_IN, 7 * 86400) * 1000;
}

function isAdminUser(user: { user_type: string; is_super_admin: boolean }): boolean {
  return user.is_super_admin || user.user_type === 'admin' || user.user_type === 'system_admin';
}

/** Whether this account is exempt from one-device binding (admins) or has been granted multi-device. */
export function allowsAnyDevice(
  user: { user_type: string; is_super_admin: boolean },
  credentials: Pick<ICredentials, 'allow_multi_device'>,
): boolean {
  return isAdminUser(user) || Boolean(credentials.allow_multi_device);
}

export function assertDeviceAllowed(
  user: { user_type: string; is_super_admin: boolean },
  credentials: Pick<ICredentials, 'bound_device_id' | 'allow_multi_device' | 'token_version'>,
  deviceId: string | undefined,
  tokenVersion?: number,
  platform?: SessionPlatform,
): void {
  if (allowsAnyDevice(user, credentials) || (platform === 'web' && WEB_LOGIN_IGNORES_DEVICE_LIMIT)) {
    if (tokenVersion !== undefined && credentials.token_version !== tokenVersion) {
      throw unauthorized('Session expired. Please sign in again.');
    }
    return;
  }

  if (tokenVersion !== undefined && credentials.token_version !== tokenVersion) {
    throw unauthorized('Session expired. Please sign in again.');
  }

  if (!credentials.bound_device_id) {
    return;
  }

  if (!deviceId || deviceId !== credentials.bound_device_id) {
    throw forbidden(
      'This account is registered to another device. Ask an admin to allow another device or clear the bound device.',
    );
  }
}

export async function bindDeviceIfNeeded(
  credentials: ICredentials,
  deviceId: string,
  deviceLabel?: string,
): Promise<void> {
  if (!credentials.bound_device_id) {
    credentials.bound_device_id = deviceId;
    credentials.bound_device_at = new Date();
    if (deviceLabel) credentials.bound_device_label = deviceLabel.slice(0, 120);
  }
}

function hasLoginMobile(phone: string | undefined | null): phone is string {
  return !!phone && /^01[3-9]\d{8}$/.test(phone);
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}${'*'.repeat(Math.max(1, phone.length - 5))}${phone.slice(-2)}`;
}

function signLoginChallenge(
  userId: string,
  deviceId: string,
  platform: SessionPlatform,
  challengeId: string,
  expiresAt: Date,
): string {
  const expiresIn = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return jwt.sign(
    { sub: userId, type: 'login_otp', did: deviceId, plat: platform, cid: challengeId },
    env.JWT_SECRET,
    { expiresIn },
  );
}

function readLoginChallenge(token: string): {
  userId: string;
  deviceId: string;
  platform: SessionPlatform;
  challengeId: string;
} {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (payload.type !== 'login_otp' || !payload.sub || typeof payload.did !== 'string' || typeof payload.cid !== 'string') {
      throw unauthorized('This verification step has expired. Sign in again.');
    }
    return {
      userId: String(payload.sub),
      deviceId: payload.did,
      platform: payload.plat === 'mobile' ? 'mobile' : 'web',
      challengeId: payload.cid,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw unauthorized('This verification step has expired. Sign in again.');
  }
}

function clearLoginOtp(credentials: ICredentials): void {
  credentials.login_otp_hash = undefined;
  credentials.login_otp_expires_at = undefined;
  credentials.login_otp_attempts = 0;
  credentials.login_challenge_id = undefined;
}

/** Sends a fresh code, or reuses one sent in the last minute so a retry does not spend another SMS. */
async function sendLoginCode(
  user: { _id: unknown; phone?: string | null },
  credentials: ICredentials,
  deviceId: string,
  platform: SessionPlatform,
): Promise<LoginOtpChallenge> {
  const phone = user.phone;
  if (!hasLoginMobile(phone)) {
    throw badRequest('This account has no mobile number for the verification code.');
  }

  const now = Date.now();
  const reusable =
    credentials.login_otp_hash &&
    credentials.login_challenge_id &&
    credentials.login_otp_expires_at &&
    credentials.login_otp_expires_at.getTime() > now + 1000 &&
    credentials.login_otp_sent_at &&
    now - credentials.login_otp_sent_at.getTime() < LOGIN_OTP_COOLDOWN_MS;

  if (reusable && credentials.login_challenge_id && credentials.login_otp_expires_at) {
    const expiresIn = Math.floor((credentials.login_otp_expires_at.getTime() - now) / 1000);
    return {
      kind: 'otp',
      challenge: signLoginChallenge(String(user._id), deviceId, platform, credentials.login_challenge_id, credentials.login_otp_expires_at),
      phoneHint: maskPhone(phone),
      expiresIn,
    };
  }

  if (!credentials.login_otp_window_start || now - credentials.login_otp_window_start.getTime() > LOGIN_OTP_WINDOW_MS) {
    credentials.login_otp_window_start = new Date(now);
    credentials.login_otp_window_count = 0;
  }
  if ((credentials.login_otp_window_count ?? 0) >= LOGIN_OTP_MAX_SENDS) {
    throw badRequest('Too many verification codes were sent. Wait a few minutes and try again.');
  }

  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(now + LOGIN_OTP_TTL_MS);
  const challengeId = crypto.randomUUID();
  credentials.login_otp_hash = await bcrypt.hash(code, 10);
  credentials.login_otp_expires_at = expiresAt;
  credentials.login_otp_attempts = 0;
  credentials.login_otp_sent_at = new Date(now);
  credentials.login_challenge_id = challengeId;
  credentials.login_otp_window_count = (credentials.login_otp_window_count ?? 0) + 1;
  await credentials.save();

  try {
    await sendSms(phone, `Your ProAssist login code is ${code}. It expires in 5 minutes. Do not share it.`);
  } catch (err) {
    clearLoginOtp(credentials);
    credentials.login_otp_window_count = Math.max(0, (credentials.login_otp_window_count ?? 1) - 1);
    await credentials.save();
    throw err;
  }

  return {
    kind: 'otp',
    challenge: signLoginChallenge(String(user._id), deviceId, platform, challengeId, expiresAt),
    phoneHint: maskPhone(phone),
    expiresIn: Math.floor(LOGIN_OTP_TTL_MS / 1000),
  };
}

async function issueSession(
  user: { _id: unknown; user_type: string; is_super_admin: boolean; status: string },
  credentials: ICredentials,
  dto: Pick<LoginDto, 'device_id' | 'device_label' | 'client_platform'>,
  platform: SessionPlatform,
  ip?: string,
): Promise<LoginSession> {
  if (user.status !== 'active' && user.status !== 'pending_verify') {
    throw unauthorized('Account is not active. Ask an admin to set a temporary password.');
  }
  const mustChangePassword = !!credentials.temp_password_set_at;
  if (mustChangePassword && credentials.temp_password_expires_at && credentials.temp_password_expires_at < new Date()) {
    throw unauthorized('Your temporary password has expired. Ask an admin for a new one.');
  }

  const skipDeviceLimit = platform === 'web' && WEB_LOGIN_IGNORES_DEVICE_LIMIT;
  assertDeviceAllowed(user, credentials, dto.device_id, undefined, platform);

  clearLoginOtp(credentials);
  credentials.failed_attempts = 0;
  credentials.status = mustChangePassword ? 'reset_required' : 'active';
  credentials.locked_until = undefined;
  credentials.last_login = new Date();
  credentials.last_ip = ip;
  if (!skipDeviceLimit) await bindDeviceIfNeeded(credentials, dto.device_id, dto.device_label);
  await credentials.save();

  return {
    kind: 'session',
    tokens: signTokens(String(user._id), dto.device_id, credentials.token_version, skipDeviceLimit ? 'web' : undefined),
    userId: String(user._id),
    mustChangePassword,
  };
}

export async function login(dto: LoginDto, ip?: string): Promise<LoginSession | LoginOtpChallenge> {
  const raw = dto.email.trim();
  const isPhone = /^01[3-9]\d{8}$/.test(raw);
  const user = isPhone
    ? await User.findOne({ phone: raw })
    : await User.findOne({ email: raw.toLowerCase() });
  if (!user) {
    throw unauthorized('Invalid mobile/email or password');
  }

  const credentials = await Credentials.findOne({ user_id: user._id });
  if (!credentials) {
    throw unauthorized('Invalid mobile/email or password');
  }

  if (credentials.status === 'locked' && credentials.locked_until && credentials.locked_until > new Date()) {
    throw unauthorized('Account temporarily locked after too many wrong passwords. Try again later or ask an admin.');
  }

  const valid = await bcrypt.compare(dto.password, credentials.password_hash);
  if (!valid) {
    credentials.failed_attempts += 1;
    if (credentials.failed_attempts >= MAX_FAILED_ATTEMPTS) {
      credentials.status = 'locked';
      credentials.locked_until = new Date(Date.now() + LOCK_DURATION_MS);
    }
    await credentials.save();
    throw unauthorized('Invalid mobile/email or password');
  }

  if (user.status === 'pending_verify') {
    throw unauthorized('Finish registration by entering the code sent to your mobile.');
  }
  if (user.status !== 'active') {
    throw unauthorized('Account is not active. Ask an admin to set a temporary password.');
  }

  const mustChangePassword = !!credentials.temp_password_set_at;
  if (mustChangePassword && credentials.temp_password_expires_at && credentials.temp_password_expires_at < new Date()) {
    throw unauthorized('Your temporary password has expired. Ask an admin for a new one.');
  }

  const platform: SessionPlatform = isWebLogin(dto) ? 'web' : 'mobile';
  return issueSession(user, credentials, dto, platform, ip);
}

/** Web sign-in step 1: text a 6-digit code to the account's mobile. No password. */
export async function requestLoginCode(dto: LoginCodeDto): Promise<LoginOtpChallenge> {
  const user = await User.findOne({ phone: dto.phone });
  const credentials = user ? await Credentials.findOne({ user_id: user._id }) : null;
  if (!user || !credentials || !hasLoginMobile(user.phone)) {
    throw unauthorized('এই নম্বরে কোনো অ্যাকাউন্ট নেই।');
  }
  if (credentials.status === 'locked' && credentials.locked_until && credentials.locked_until > new Date()) {
    throw unauthorized('অনেকবার ভুল হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।');
  }
  if (user.status === 'pending_verify') {
    throw unauthorized('রেজিস্ট্রেশনের কোড দিয়ে অ্যাকাউন্ট চালু করুন।');
  }
  if (user.status !== 'active') {
    throw unauthorized('অ্যাকাউন্ট চালু নেই। অ্যাডমিনের কাছে যোগাযোগ করুন।');
  }
  const platform: SessionPlatform = dto.client_platform === 'mobile' ? 'mobile' : 'web';
  return sendLoginCode(user, credentials, dto.device_id, platform);
}

export async function completeLoginOtp(dto: LoginOtpDto, ip?: string): Promise<LoginSession> {
  const claims = readLoginChallenge(dto.challenge);
  if (claims.deviceId !== dto.device_id) {
    throw unauthorized('This verification step has expired. Sign in again.');
  }

  const user = await User.findById(claims.userId);
  const credentials = user ? await Credentials.findOne({ user_id: user._id }) : null;
  if (!user || !credentials || credentials.login_challenge_id !== claims.challengeId) {
    throw unauthorized('This verification step has expired. Sign in again.');
  }
  if (!credentials.login_otp_hash || !credentials.login_otp_expires_at || credentials.login_otp_expires_at < new Date()) {
    throw unauthorized('This code has expired. Sign in again.');
  }
  if ((credentials.login_otp_attempts ?? 0) >= LOGIN_OTP_MAX_ATTEMPTS) {
    clearLoginOtp(credentials);
    await credentials.save();
    throw unauthorized('Too many wrong codes. Sign in again.');
  }

  const matches = await bcrypt.compare(dto.code, credentials.login_otp_hash);
  if (!matches) {
    credentials.login_otp_attempts = (credentials.login_otp_attempts ?? 0) + 1;
    const lockedOut = credentials.login_otp_attempts >= LOGIN_OTP_MAX_ATTEMPTS;
    if (lockedOut) clearLoginOtp(credentials);
    await credentials.save();
    throw unauthorized(lockedOut ? 'Too many wrong codes. Sign in again.' : 'That code is not correct.');
  }

  return issueSession(
    user,
    credentials,
    { device_id: dto.device_id, device_label: dto.device_label, client_platform: claims.platform },
    claims.platform,
    ip,
  );
}

export async function resendLoginOtp(challenge: string): Promise<LoginOtpChallenge> {
  const claims = readLoginChallenge(challenge);
  const user = await User.findById(claims.userId);
  const credentials = user ? await Credentials.findOne({ user_id: user._id }) : null;
  if (!user || !credentials || credentials.login_challenge_id !== claims.challengeId) {
    throw unauthorized('This verification step has expired. Sign in again.');
  }
  if (credentials.login_otp_sent_at) {
    const waitMs = LOGIN_OTP_COOLDOWN_MS - (Date.now() - credentials.login_otp_sent_at.getTime());
    if (waitMs > 0) {
      throw badRequest(`Wait ${Math.ceil(waitMs / 1000)} seconds before requesting another code.`);
    }
  }
  return sendLoginCode(user, credentials, claims.deviceId, claims.platform);
}

export function signTokens(
  userId: string,
  deviceId?: string,
  tokenVersion = 0,
  platform?: SessionPlatform,
): TokenPair {
  const expiresIn = accessExpiresSeconds();
  const accessToken = jwt.sign(
    { sub: userId, type: 'access', did: deviceId, tv: tokenVersion, plat: platform },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );
  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh', did: deviceId, tv: tokenVersion, plat: platform },
    env.JWT_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );
  return { accessToken, refreshToken, expiresIn };
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (payload.type !== 'access' || !payload.sub) {
      throw badRequest('Invalid request');
    }
    return {
      userId: String(payload.sub),
      deviceId: typeof payload.did === 'string' ? payload.did : undefined,
      tokenVersion: typeof payload.tv === 'number' ? payload.tv : 0,
    };
  } catch {
    throw unauthorized('Session expired');
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
