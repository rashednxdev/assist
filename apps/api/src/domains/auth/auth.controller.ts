import type { Response } from 'express';
import { loginSchema } from '@ibas/shared-types';
import { moduleAccessGroup } from '@ibas/shared-constants';
import type { AuthRequest } from '../../middleware/auth.js';
import { login, refreshExpiresMs } from './auth.service.js';
import { User } from '../users/models/User.model.js';
import * as usersService from '../users/users.service.js';
import { listModuleAccessForSession } from '../users/module-access.service.js';
import { listStoppedModules } from '../setup/setup.service.js';
import { serializeExamSubjectAccess } from '../users/subject-access.service.js';
import { getAppSettings } from '../app-settings/app-settings.service.js';
import { badRequest } from '../../shared/errors/AppError.js';
import { Module } from '../setup/models/Module.model.js';
import { packageGrantsForMe } from '../billing/billing.service.js';
import { areaModuleCodes } from '../billing/entitlements.service.js';

export async function loginHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = loginSchema.parse(req.body);
  const { tokens, userId } = await login(dto, req.ip);
  if (dto.app_version && dto.client_platform === 'mobile') {
    await usersService.reportClientVersion(userId, dto.app_version, dto.client_platform);
  }
  const user = await User.findById(userId).select('-__v');
  if (!user) {
    throw badRequest('Invalid request');
  }

  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: refreshExpiresMs(),
    path: '/',
  });

  res.json({
    data: {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
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
        workflow_roles: user.workflow_roles.map((r) => ({
          role_code: r.role_code,
          is_active: r.is_active,
          self_assigned: !!r.self_assigned,
        })),
      },
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
  const has_paid = isAdmin || legacy_paid || pkg.hasAny;
  // Manual grants need the admin paid mark; without it, sellable modules open only through a package.
  if (has_paid && !isAdmin && !legacy_paid) {
    for (const g of grants) {
      if (g.source !== 'package' && moduleAccessGroup(g.module_code, extraBasic)) g.can_read = false;
    }
  }
  const module_access = grants;
  const appSettings = await getAppSettings();

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
