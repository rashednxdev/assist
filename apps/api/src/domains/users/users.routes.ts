import { Router, type Response, type NextFunction } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { requireModulePermission } from '../../middleware/requireModulePermission.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { forbidden } from '../../shared/errors/AppError.js';
import {
  listUsersHandler,
  getUserHandler,
  createUserHandler,
  updateUserHandler,
  deactivateUserHandler,
  assignWorkflowRoleHandler,
  removeWorkflowRoleHandler,
  listModuleAccessHandler,
  upsertModuleAccessHandler,
  revokeModuleAccessHandler,
  listAddressesHandler,
  createAddressHandler,
  listActivityHandler,
  listExamSubjectOptionsHandler,
} from './users.controller.js';
import * as verification from '../contacts/verification.service.js';
import * as recovery from './account-recovery.service.js';
import { logUserActivity } from './models/UserActivityLog.model.js';

export const usersRouter = Router();

/** Applicants never manage users, even if a USER grant was assigned by mistake. */
function rejectApplicants(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (req.user?.user_type === 'applicant') {
    next(forbidden('Users module is not available for applicant accounts'));
    return;
  }
  next();
}

/** Admins bypass; otherwise active USER module grant (read for views, create/update for writes). */
const userRead = requireModulePermission([
  { moduleCode: 'USER', permission: 'can_read' },
  { moduleCode: 'USER', permission: 'can_create' },
  { moduleCode: 'USER', permission: 'can_update' },
]);
const userWrite = requireModulePermission([
  { moduleCode: 'USER', permission: 'can_create' },
  { moduleCode: 'USER', permission: 'can_update' },
]);

usersRouter.use(authenticate, rejectApplicants);

usersRouter.get('/exam-subject-options', userRead, asyncHandler(listExamSubjectOptionsHandler));
usersRouter.get(
  '/contact-verifications',
  userRead,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { items, ...meta } = await verification.adminListVerifications(req.query);
    res.json({ data: items, meta });
  }),
);
usersRouter.get(
  '/blocked',
  userRead,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json({ data: await recovery.listBlockedAccounts({ q }) });
  }),
);
usersRouter.get('/', userRead, asyncHandler(listUsersHandler));
usersRouter.post('/', userWrite, asyncHandler(createUserHandler));
usersRouter.get('/:id', userRead, asyncHandler(getUserHandler));
usersRouter.patch('/:id', userWrite, asyncHandler(updateUserHandler));
usersRouter.delete('/:id', userWrite, asyncHandler(deactivateUserHandler));

usersRouter.get('/:id/module-access', userRead, asyncHandler(listModuleAccessHandler));
usersRouter.post('/:id/module-access', userWrite, asyncHandler(upsertModuleAccessHandler));
usersRouter.delete('/:id/module-access/:moduleId', userWrite, asyncHandler(revokeModuleAccessHandler));

usersRouter.get('/:id/addresses', userRead, asyncHandler(listAddressesHandler));
usersRouter.post('/:id/addresses', userWrite, asyncHandler(createAddressHandler));
usersRouter.get('/:id/activity', userRead, asyncHandler(listActivityHandler));

usersRouter.get(
  '/:id/contact-verification',
  userRead,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await verification.adminUserVerification(String(req.params.id)) });
  }),
);
usersRouter.post(
  '/:id/contact-verification/revoke',
  userWrite,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await verification.adminRevokeVerification(String(req.params.id)) });
  }),
);

usersRouter.post(
  '/:id/temp-password',
  userWrite,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await recovery.setTempPassword(String(req.params.id), req.body, {
      id: req.user!.id,
      is_super_admin: req.user!.is_super_admin,
    });
    await logUserActivity({
      userId: result.user_id,
      action: 'USER_TEMP_PASSWORD',
      description: 'Temporary password set by admin; account reactivated and sessions signed out',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { by: req.user!.id, expires_at: result.expires_at },
    });
    res.json({ data: result });
  }),
);

usersRouter.post('/:id/workflow-roles', userWrite, asyncHandler(assignWorkflowRoleHandler));
usersRouter.delete('/:id/workflow-roles/:roleCode', userWrite, asyncHandler(removeWorkflowRoleHandler));
