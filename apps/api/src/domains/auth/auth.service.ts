import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { LoginDto } from '@ibas/shared-types';
import { env } from '../../config/env.js';
import { badRequest, unauthorized } from '../../shared/errors/AppError.js';
import { User } from '../users/models/User.model.js';
import { Credentials } from '../users/models/Credentials.model.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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

export async function login(dto: LoginDto, ip?: string): Promise<{ tokens: TokenPair; userId: string }> {
  const user = await User.findOne({ email: dto.email.toLowerCase() });
  if (!user) {
    throw unauthorized('Invalid email or password');
  }

  const credentials = await Credentials.findOne({ user_id: user._id });
  if (!credentials) {
    throw unauthorized('Invalid email or password');
  }

  if (credentials.status === 'locked' && credentials.locked_until && credentials.locked_until > new Date()) {
    throw unauthorized('Account temporarily locked');
  }

  const valid = await bcrypt.compare(dto.password, credentials.password_hash);
  if (!valid) {
    credentials.failed_attempts += 1;
    if (credentials.failed_attempts >= MAX_FAILED_ATTEMPTS) {
      credentials.status = 'locked';
      credentials.locked_until = new Date(Date.now() + LOCK_DURATION_MS);
    }
    await credentials.save();
    throw unauthorized('Invalid email or password');
  }

  if (user.status !== 'active' && user.status !== 'pending_verify') {
    throw unauthorized('Account is not active');
  }

  credentials.failed_attempts = 0;
  credentials.status = 'active';
  credentials.locked_until = undefined;
  credentials.last_login = new Date();
  credentials.last_ip = ip;
  await credentials.save();

  const tokens = signTokens(String(user._id));
  return { tokens, userId: String(user._id) };
}

export function signTokens(userId: string): TokenPair {
  const expiresIn = accessExpiresSeconds();
  const accessToken = jwt.sign({ sub: userId, type: 'access' }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  const refreshToken = jwt.sign({ sub: userId, type: 'refresh' }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  return { accessToken, refreshToken, expiresIn };
}

export function verifyAccessToken(token: string): { userId: string } {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (payload.type !== 'access' || !payload.sub) {
      throw badRequest('Invalid request');
    }
    return { userId: String(payload.sub) };
  } catch {
    throw unauthorized('Session expired');
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
