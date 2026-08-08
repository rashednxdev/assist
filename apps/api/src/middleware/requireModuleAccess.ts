import type { Response, NextFunction, RequestHandler } from 'express';
import type { AuthRequest } from './auth.js';
import { forbidden, unauthorized } from '../shared/errors/AppError.js';
import { UserModuleAccess } from '../domains/users/models/UserModuleAccess.model.js';
import { Module } from '../domains/setup/models/Module.model.js';

/** Admins bypass module grants entirely — mirrors requireAdmin's own check. */
function isAdmin(user: AuthRequest['user']): boolean {
  return !!user && (user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin');
}

/**
 * A module globally stopped by an admin blocks everyone regardless of per-user grants. For a
 * route accepting several alternative codes (requireModuleAccessAny), only block if EVERY given
 * code is currently stopped — if at least one alternative is still active, fall through to the
 * normal per-user check for that one. A code with no matching Module doc is treated as not
 * stopped (never blocks) rather than as an error.
 */
export async function findAllStoppedModule(
  moduleCodes: string[],
): Promise<{ code: string; stopped_reason?: string } | null> {
  const modules = await Module.find(
    { code: { $in: moduleCodes } },
    'code is_active stopped_reason',
  ).lean();
  const stopped = modules.filter((m) => !m.is_active);
  const allStopped = moduleCodes.every((code) => stopped.some((m) => m.code === code));
  if (!allStopped || stopped.length === 0) return null;
  return stopped[0] ?? null;
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

    const stopped = await findAllStoppedModule([moduleCode]);
    if (stopped) {
      next(forbidden(stopped.stopped_reason || 'This module is temporarily unavailable.'));
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

    const stopped = await findAllStoppedModule(moduleCodes);
    if (stopped) {
      next(forbidden(stopped.stopped_reason || 'This module is temporarily unavailable.'));
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
