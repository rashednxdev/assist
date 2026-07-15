import type { Response } from 'express';
import {
  createUserSchema,
  updateUserSchema,
  assignWorkflowRoleSchema,
  upsertModuleAccessSchema,
  createUserAddressSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import { parsePagination } from '../../shared/pagination.js';
import * as usersService from './users.service.js';
import * as moduleAccessService from './module-access.service.js';
import * as userProfileService from './user-profile.service.js';
import { logUserActivity } from './models/UserActivityLog.model.js';

export async function listUsersHandler(req: AuthRequest, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req);
  const { items, total } = await usersService.listUsers({
    user_type: req.query.user_type as string | undefined,
    status: req.query.status as string | undefined,
    skip,
    limit,
  });
  res.json({ data: items, meta: { page, limit, total } });
}

export async function getUserHandler(req: AuthRequest, res: Response): Promise<void> {
  const user = await usersService.getUserById(String(req.params.id));
  res.json({ data: user });
}

export async function createUserHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createUserSchema.parse(req.body);
  const user = await usersService.createUser(dto, req.user!.id, req.user!.is_super_admin);
  await logUserActivity({
    userId: user.id,
    action: 'USER_CREATE',
    description: `User created by admin`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(201).json({ data: user });
}

export async function updateUserHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateUserSchema.parse(req.body);
  const user = await usersService.updateUser(String(req.params.id), dto);
  await logUserActivity({
    userId: user.id,
    action: 'USER_UPDATE',
    description: [
      'Profile updated',
      dto.allow_multi_device === true ? 'multi-device allowed' : '',
      dto.allow_multi_device === false ? 'multi-device revoked' : '',
      dto.clear_bound_device ? 'bound device cleared' : '',
      dto.force_logout ? 'sessions force-logged-out' : '',
    ]
      .filter(Boolean)
      .join('; '),
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json({ data: user });
}

export async function deactivateUserHandler(req: AuthRequest, res: Response): Promise<void> {
  const user = await usersService.deactivateUser(String(req.params.id));
  await logUserActivity({
    userId: user.id,
    action: 'USER_DEACTIVATE',
    description: 'User deactivated',
    ip: req.ip,
  });
  res.json({ data: user });
}

export async function assignWorkflowRoleHandler(req: AuthRequest, res: Response): Promise<void> {
  const { role_code } = assignWorkflowRoleSchema.parse(req.body);
  const user = await usersService.assignWorkflowRole(String(req.params.id), role_code, req.user!.id);
  res.json({ data: user });
}

export async function removeWorkflowRoleHandler(req: AuthRequest, res: Response): Promise<void> {
  const user = await usersService.removeWorkflowRole(String(req.params.id), String(req.params.roleCode));
  res.json({ data: user });
}

export async function listModuleAccessHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await moduleAccessService.listModuleAccess(String(req.params.id));
  res.json({ data });
}

export async function upsertModuleAccessHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = upsertModuleAccessSchema.parse(req.body);
  const data = await moduleAccessService.upsertModuleAccess(String(req.params.id), dto, req.user!.id);
  res.json({ data });
}

export async function revokeModuleAccessHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await moduleAccessService.revokeModuleAccess(String(req.params.id), String(req.params.moduleId));
  res.json({ data });
}

export async function listAddressesHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await userProfileService.listUserAddresses(String(req.params.id));
  res.json({ data });
}

export async function createAddressHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createUserAddressSchema.parse(req.body);
  const data = await userProfileService.createUserAddress(String(req.params.id), dto);
  res.status(201).json({ data });
}

export async function listActivityHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await userProfileService.listUserActivity(String(req.params.id));
  res.json({ data });
}
