import { z } from 'zod';
import { USER_STATUSES, USER_TYPES } from '@ibas/shared-constants';

export const createUserSchema = z.object({
  full_name_en: z.string().min(1),
  full_name_bn: z.string().optional(),
  email: z.string().email(),
  phone: z.string().min(11),
  password: z.string().min(8),
  user_type: z.enum(USER_TYPES),
  employee_id: z.string().optional(),
  nid: z.string().optional(),
  is_super_admin: z.boolean().optional().default(false),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .partial()
  .extend({
    status: z.enum(USER_STATUSES).optional(),
    is_verified: z.boolean().optional(),
    /** Allow login from more than one device. */
    allow_multi_device: z.boolean().optional(),
    /** Clear the bound device so the next login can bind a new one. */
    clear_bound_device: z.boolean().optional(),
    /** Invalidate all existing sessions (force the user to sign in again). */
    force_logout: z.boolean().optional(),
  });

export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export const assignWorkflowRoleSchema = z.object({
  role_code: z.string().min(1),
});

export type AssignWorkflowRoleDto = z.infer<typeof assignWorkflowRoleSchema>;
