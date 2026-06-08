import type { Response } from 'express';
import { loginSchema } from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import { login, refreshExpiresMs } from './auth.service.js';
import { User } from '../users/models/User.model.js';
import { listModuleAccessForSession } from '../users/module-access.service.js';
import { badRequest } from '../../shared/errors/AppError.js';

export async function loginHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = loginSchema.parse(req.body);
  const { tokens, userId } = await login(dto, req.ip);
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

  const module_access = await listModuleAccessForSession(String(user._id));

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
      })),
      module_access,
    },
  });
}
