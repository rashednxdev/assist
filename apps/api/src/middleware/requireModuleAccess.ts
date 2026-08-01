import type { Response, NextFunction, RequestHandler } from 'express';
import type { AuthRequest } from './auth.js';
import { forbidden, unauthorized } from '../shared/errors/AppError.js';
import { UserModuleAccess } from '../domains/users/models/UserModuleAccess.model.js';

/** Admins bypass module grants entirely — mirrors requireAdmin's own check. */
function isAdmin(user: AuthRequest['user']): boolean {
  return !!user && (user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin');
}

/** Gate a read route behind an active, granted UserModuleAccess row for the given module code. */
export function requireModuleAccess(moduleCode: string): RequestHandler {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (req.user.status !== 'active') {
      next(forbidden('Account is not active'));
      return;
    }
    if (isAdmin(req.user)) {
      next();
      return;
    }

    const grant = await UserModuleAccess.findOne({
      user_id: req.user.id,
      module_code: moduleCode,
      is_active: true,
      can_read: true,
    });
    if (!grant) {
      next(forbidden('You do not have access to this module. Ask an admin to grant access.'));
      return;
    }
    next();
  };
}

/** Like requireModuleAccess, but passes if the user has an active grant on any of the given
 * codes — for routes serving content shared across modules (e.g. a paper viewable either as a
 * Practice Paper or an Exam of the Week). */
export function requireModuleAccessAny(...moduleCodes: string[]): RequestHandler {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (req.user.status !== 'active') {
      next(forbidden('Account is not active'));
      return;
    }
    if (isAdmin(req.user)) {
      next();
      return;
    }

    const grant = await UserModuleAccess.findOne({
      user_id: req.user.id,
      module_code: { $in: moduleCodes },
      is_active: true,
      can_read: true,
    });
    if (!grant) {
      next(forbidden('You do not have access to this module. Ask an admin to grant access.'));
      return;
    }
    next();
  };
}
