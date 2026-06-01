import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { forbidden, unauthorized } from '../shared/errors/AppError.js';

export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(unauthorized());
    return;
  }
  if (req.user.status !== 'active') {
    next(forbidden('Account is not active'));
    return;
  }
  if (req.user.is_super_admin || req.user.user_type === 'system_admin' || req.user.user_type === 'admin') {
    next();
    return;
  }
  next(forbidden('Admin access required'));
}
