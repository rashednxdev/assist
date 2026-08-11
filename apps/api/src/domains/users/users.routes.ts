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
} from './users.controller.js';

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

usersRouter.post('/:id/workflow-roles', userWrite, asyncHandler(assignWorkflowRoleHandler));
usersRouter.delete('/:id/workflow-roles/:roleCode', userWrite, asyncHandler(removeWorkflowRoleHandler));
