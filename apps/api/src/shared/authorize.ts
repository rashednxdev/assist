import type { Request, Response, NextFunction } from 'express';
import type { UserType } from '@ibas/shared-constants';
import { forbidden, unauthorized } from './errors/AppError.js';
import type { AuthRequest } from '../middleware/auth.js';

type AuthorizeAction =
  | 'auth:session'
  | 'users:read'
  | 'users:manage'
  | 'module:access';

interface AuthorizeContext {
  user?: AuthRequest['user'];
  moduleCode?: string;
}

export function authorize(action: AuthorizeAction, context: AuthorizeContext = {}) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    const user = context.user;
    if (!user) {
      next(unauthorized());
      return;
    }

    if (user.status !== 'active') {
      next(forbidden('Account is not active'));
      return;
    }

    switch (action) {
      case 'auth:session':
        next();
        return;
      case 'users:read':
      case 'users:manage':
        if (user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin') {
          next();
          return;
        }
        next(forbidden());
        return;
      default:
        next();
    }
  };
}

export function hasWorkflowRole(user: AuthRequest['user'], roleCode: string): boolean {
  if (!user) return false;
  return user.workflow_roles.some((r) => r.is_active && r.role_code === roleCode);
}

export function isAdminUser(userType: UserType): boolean {
  return userType === 'system_admin' || userType === 'admin';
}
