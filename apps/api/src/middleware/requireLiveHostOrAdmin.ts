import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { LiveStream } from '../domains/live-stream/models/LiveStream.model.js';
import { forbidden, notFound, unauthorized } from '../shared/errors/AppError.js';

function isPlatformAdmin(user: { is_super_admin?: boolean; user_type?: string }) {
  return Boolean(
    user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin',
  );
}

/** Platform admins or the assigned session host (`host_user_id`). */
export async function requireLiveHostOrAdmin(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (req.user.status !== 'active') {
      next(forbidden('Account is not active'));
      return;
    }
    if (isPlatformAdmin(req.user)) {
      next();
      return;
    }
    const id = String(req.params.id ?? '');
    if (!id) {
      next(forbidden('Live session required'));
      return;
    }
    const doc = await LiveStream.findOne({ _id: id, is_active: true }).select('host_user_id').lean();
    if (!doc) {
      next(notFound('Live session not found'));
      return;
    }
    if (String(doc.host_user_id) === req.user.id) {
      next();
      return;
    }
    next(forbidden('Host access required'));
  } catch (err) {
    next(err);
  }
}
