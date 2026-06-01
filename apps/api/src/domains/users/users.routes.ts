import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
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

usersRouter.use(authenticate, requireAdmin);

usersRouter.get('/', asyncHandler(listUsersHandler));
usersRouter.post('/', asyncHandler(createUserHandler));
usersRouter.get('/:id', asyncHandler(getUserHandler));
usersRouter.patch('/:id', asyncHandler(updateUserHandler));
usersRouter.delete('/:id', asyncHandler(deactivateUserHandler));

usersRouter.get('/:id/module-access', asyncHandler(listModuleAccessHandler));
usersRouter.post('/:id/module-access', asyncHandler(upsertModuleAccessHandler));
usersRouter.delete('/:id/module-access/:moduleId', asyncHandler(revokeModuleAccessHandler));

usersRouter.get('/:id/addresses', asyncHandler(listAddressesHandler));
usersRouter.post('/:id/addresses', asyncHandler(createAddressHandler));
usersRouter.get('/:id/activity', asyncHandler(listActivityHandler));

usersRouter.post('/:id/workflow-roles', asyncHandler(assignWorkflowRoleHandler));
usersRouter.delete('/:id/workflow-roles/:roleCode', asyncHandler(removeWorkflowRoleHandler));
