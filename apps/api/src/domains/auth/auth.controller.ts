import type { Response } from 'express';
import { loginOtpResendSchema, loginOtpSchema, loginSchema } from '@ibas/shared-types';
import { LEARNING_PRIVILEGE_MODULE_CODES, moduleAccessGroup } from '@ibas/shared-constants';
import type { AuthRequest } from '../../middleware/auth.js';
import { completeLoginOtp, login, refreshExpiresMs, resendLoginOtp, type LoginSession } from './auth.service.js';
import { User } from '../users/models/User.model.js';
import { Credentials } from '../users/models/Credentials.model.js';
import * as usersService from '../users/users.service.js';
import { listModuleAccessForSession } from '../users/module-access.service.js';
import { listStoppedModules } from '../setup/setup.service.js';
import { serializeExamSubjectAccess } from '../users/subject-access.service.js';
import { getAppSettings } from '../app-settings/app-settings.service.js';
import { badRequest } from '../../shared/errors/AppError.js';
import { Module } from '../setup/models/Module.model.js';
import { packageGrantsForMe } from '../billing/billing.service.js';
import { areaModuleCodes } from '../billing/entitlements.service.js';

async function respondWithSession(
  res: Response,
  session: LoginSession,
  client?: { app_version?: string; client_platform?: 'mobile' | 'web' },
): Promise<void> {
  if (client?.app_version && client.client_platform === 'mobile') {
    await usersService.reportClientVersion(session.userId, client.app_version, client.client_platform);
  }
  const user = await User.findById(session.userId).select('-__v');
  if (!user) {
    throw badRequest('Invalid request');
  }

  res.cookie('refreshToken', session.tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: refreshExpiresMs(),
    path: '/',
  });

  res.json({
    data: {
      otp_required: false,
      accessToken: session.tokens.accessToken,
      expiresIn: session.tokens.expiresIn,
      must_change_password: session.mustChangePassword,
      user: {
        id: String(user._id),
        email: user.email,
        phone: user.phone,
        full_name_bn: user.full_name_bn,
        full_name_en: user.full_name_en,
        user_type: user.user_type,
        status: user.status,
        is_super_admin: user.is_super_admin,
        is_verified: user.is_verified,
        email_verified: user.email_verified,
        phone_verified: user.phone_verified,
        must_change_password: session.mustChangePassword,
        workflow_roles: user.workflow_roles.map((r) => ({
          role_code: r.role_code,
          is_active: r.is_active,
          self_assigned: !!r.self_assigned,
        })),
      },
    },
  });
}

export async function loginHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = loginSchema.parse(req.body);
  const result = await login(dto, req.ip);
  if (result.kind === 'otp') {
    res.json({
      data: {
        otp_required: true,
        challenge: result.challenge,
        phone_hint: result.phoneHint,
        expires_in: result.expiresIn,
      },
    });
    return;
  }
  await respondWithSession(res, result, dto);
}

export async function loginOtpHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = loginOtpSchema.parse(req.body);
  const session = await completeLoginOtp(dto, req.ip);
  await respondWithSession(res, session, dto);
}

export async function loginOtpResendHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = loginOtpResendSchema.parse(req.body);
  const result = await resendLoginOtp(dto.challenge);
  res.json({
    data: {
      challenge: result.challenge,
      phone_hint: result.phoneHint,
      expires_in: result.expiresIn,
    },
  });
}

export async function logoutHandler(_req: AuthRequest, res: Response): Promise<void> {
  res.clearCookie('refreshToken', { path: '/' });
  res.json({ data: { success: true } });
}

export async function meHandler(req: AuthRequest, res: Response): Promise<void> {
  const user = await User.findById(req.user!.id).select('-__v');
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const grants: Array<Awaited<ReturnType<typeof listModuleAccessForSession>>[number] & {
    source?: 'grant' | 'package';
    expires_at?: string;
  }> = await listModuleAccessForSession(String(user._id));
  const module_stops = (await listStoppedModules()).map((m) => ({
    module_code: m.code,
    stopped_reason: m.stopped_reason,
  }));
  const subjectAccess = await serializeExamSubjectAccess(user);
  const isAdmin =
    user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin';
  const legacy_paid = Number(user.amount_received ?? 0) > 0;

  // Package access is exposed as read grants so older clients (mobile) unlock modules unchanged.
  const extraBasic = await areaModuleCodes();
  const pkg = await packageGrantsForMe(String(user._id), extraBasic);
  if (pkg.grants.length > 0) {
    const names = new Map(
      (await Module.find({ code: { $in: pkg.grants.map((g) => g.module_code) } }).select('code name_en').lean()).map(
        (m) => [m.code, m.name_en],
      ),
    );
    for (const g of pkg.grants) {
      const existing = grants.find((x) => x.module_code === g.module_code);
      if (existing) {
        if (!existing.can_read || !legacy_paid) {
          existing.can_read = true;
          existing.source = 'package';
          existing.expires_at = g.expires_at;
        }
        continue;
      }
      grants.push({
        module_code: g.module_code,
        module_name_en: names.get(g.module_code) ?? g.module_code,
        can_read: true,
        can_create: false,
        can_update: false,
        can_delete: false,
        can_grade: false,
        can_publish: false,
        bypass_stop: false,
        source: 'package',
        expires_at: g.expires_at,
      });
    }
  }
  const isHost = user.user_type === 'host';
  const has_paid = isAdmin || isHost || legacy_paid || pkg.hasAny;
  // Manual grants need the admin paid mark; without it, sellable modules open only through a package.
  if (has_paid && !isAdmin && !isHost && !legacy_paid) {
    for (const g of grants) {
      if (g.source !== 'package' && moduleAccessGroup(g.module_code, extraBasic)) g.can_read = false;
    }
  }
  if (isHost) {
    const names = new Map(
      (await Module.find({ code: { $in: [...LEARNING_PRIVILEGE_MODULE_CODES] } }).select('code name_en').lean()).map(
        (m) => [m.code, m.name_en],
      ),
    );
    for (const code of LEARNING_PRIVILEGE_MODULE_CODES) {
      const existing = grants.find((g) => g.module_code === code);
      if (existing) {
        existing.can_read = true;
        existing.can_create = true;
        existing.can_update = true;
        if (code === 'LIVE_STREAM') existing.can_publish = true;
        if (existing.source === 'package') existing.source = 'grant';
        continue;
      }
      grants.push({
        module_code: code,
        module_name_en: names.get(code) ?? code,
        can_read: true,
        can_create: true,
        can_update: true,
        can_delete: false,
        can_grade: false,
        can_publish: code === 'LIVE_STREAM',
        bypass_stop: false,
        source: 'grant',
      });
    }
  }
  const module_access = grants;
  const appSettings = await getAppSettings();
  const creds = await Credentials.findOne({ user_id: user._id }).select('temp_password_set_at').lean();

  res.json({
    data: {
      id: String(user._id),
      email: user.email,
      phone: user.phone,
      full_name_bn: user.full_name_bn,
      full_name_en: user.full_name_en,
      user_type: user.user_type,
      status: user.status,
      is_super_admin: user.is_super_admin,
      is_verified: user.is_verified,
      email_verified: user.email_verified,
      phone_verified: user.phone_verified,
      /** Signed in with an admin-issued temporary password; clients must ask for a new one first. */
      must_change_password: !!creds?.temp_password_set_at,
      workflow_roles: user.workflow_roles.map((r) => ({
        role_code: r.role_code,
        is_active: r.is_active,
        self_assigned: !!r.self_assigned,
      })),
      module_access,
      module_stops,
      has_paid,
      /** Marked paid by an admin (old manual process); their granted modules stay open. */
      legacy_paid: isAdmin || legacy_paid,
      unpaid_message: appSettings.unpaid_message,
      all_exam_subjects: subjectAccess.all_exam_subjects,
      exam_subject_ids: subjectAccess.exam_subject_ids,
      exam_subjects: subjectAccess.exam_subjects,
    },
  });
}
