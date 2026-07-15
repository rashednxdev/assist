import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError, unauthorized } from '../shared/errors/AppError.js';
import { assertDeviceAllowed } from '../domains/auth/auth.service.js';
import { User } from '../domains/users/models/User.model.js';
import { Credentials } from '../domains/users/models/Credentials.model.js';

export interface AuthUser {
  id: string;
  email: string;
  user_type: string;
  status: string;
  is_super_admin: boolean;
  workflow_roles: Array<{ role_code: string; is_active: boolean }>;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const authenticate: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      next(unauthorized());
      return;
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (payload.type !== 'access' || !payload.sub) {
      next(unauthorized());
      return;
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      next(unauthorized());
      return;
    }

    const credentials = await Credentials.findOne({ user_id: user._id });
    if (!credentials) {
      next(unauthorized());
      return;
    }

    const deviceId = typeof payload.did === 'string' ? payload.did : undefined;
    const tokenVersion = typeof payload.tv === 'number' ? payload.tv : 0;
    assertDeviceAllowed(user, credentials, deviceId, tokenVersion);

    req.user = {
      id: String(user._id),
      email: user.email,
      user_type: user.user_type,
      status: user.status,
      is_super_admin: user.is_super_admin,
      workflow_roles: user.workflow_roles.map((r) => ({
        role_code: r.role_code,
        is_active: r.is_active,
      })),
    };

    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(unauthorized());
  }
};
