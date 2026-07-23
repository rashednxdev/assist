import type { Response, NextFunction, RequestHandler } from 'express';
import type { AuthRequest } from './auth.js';
import { forbidden, unauthorized } from '../shared/errors/AppError.js';
import { hasModulePermission } from '../domains/users/module-access.service.js';

type ModulePermission = 'can_read' | 'can_create' | 'can_update' | 'can_delete' | 'can_grade' | 'can_publish';

/** Admins bypass module grants entirely — mirrors requireAdmin's/requireModuleAccess's own check. */
function isAdmin(user: AuthRequest['user']): boolean {
  return !!user && (user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin');
}

/**
 * Gate a route behind ANY of the given module/permission checks (admins always bypass).
 * Use this over requireModuleAccess when a route should also accept a non-read permission
 * (e.g. can_update) or when more than one module code can independently satisfy the route.
 */
export function requireModulePermission(
  checks: Array<{ moduleCode: string; permission: ModulePermission }>,
): RequestHandler {
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

    for (const { moduleCode, permission } of checks) {
      if (await hasModulePermission(req.user.id, moduleCode, permission)) {
        next();
        return;
      }
    }
    next(forbidden('You do not have access to this action. Ask an admin to grant access.'));
  };
}
