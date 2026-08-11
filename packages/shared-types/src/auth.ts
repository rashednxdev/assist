import { z } from 'zod';

export const authTokensSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
});

export type AuthTokens = z.infer<typeof authTokensSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  full_name_en: z.string(),
  full_name_bn: z.string().optional(),
  phone: z.string().optional(),
  user_type: z.string(),
  is_super_admin: z.boolean(),
  is_verified: z.boolean().optional(),
  email_verified: z.boolean().optional(),
  phone_verified: z.boolean().optional(),
  workflow_roles: z.array(
    z.object({
      role_code: z.string(),
      is_active: z.boolean(),
    }),
  ),
});

export type AuthUser = z.infer<typeof authUserSchema>;

/** Active module grants returned on GET /auth/me for navigation and UI gating. */
export const moduleAccessGrantSchema = z.object({
  module_code: z.string(),
  module_name_en: z.string(),
  can_read: z.boolean(),
  can_create: z.boolean(),
  can_update: z.boolean(),
  can_delete: z.boolean(),
  can_grade: z.boolean(),
  can_publish: z.boolean(),
  /** Keep access while the module is centrally stopped. */
  bypass_stop: z.boolean().optional(),
});

export type ModuleAccessGrant = z.infer<typeof moduleAccessGrantSchema>;

/** A module globally stopped for everyone (not a per-user denial) — returned on GET /auth/me
 * regardless of whether the user holds a grant for it, so mobile can show the admin's reason. */
export const moduleStopSchema = z.object({
  module_code: z.string(),
  stopped_reason: z.string().optional(),
});

export type ModuleStop = z.infer<typeof moduleStopSchema>;

export const registerSchema = z
  .object({
    full_name_en: z.string().min(2),
    full_name_bn: z.string().optional(),
    /** Required — the only channel a forgotten password can be reset through. */
    email: z.string().email(),
    phone: z.string().regex(/^01[3-9]\d{8}$/, 'Enter a valid Bangladesh mobile number'),
    password: z.string().min(8),
    confirm_password: z.string().min(8),
    user_type: z.enum(['applicant', 'officer']).default('applicant'),
    accept_terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
    /** Binds the account to this device on first registration. */
    device_id: z.string().min(8).max(128),
    device_label: z.string().max(120).optional(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export type RegisterDto = z.infer<typeof registerSchema>;

export const otpVerifySchema = z.object({
  channel: z.enum(['email', 'phone']),
  code: z.string().length(6),
});

export type OtpVerifyDto = z.infer<typeof otpVerifySchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1),
    new_password: z.string().min(8),
    confirm_password: z.string().min(8),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

/** Step 1 of "forgot password": look up the account by phone, email a reset code to it. */
export const forgotPasswordSchema = z.object({
  phone: z.string().regex(/^01[3-9]\d{8}$/, 'Enter a valid Bangladesh mobile number'),
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

/** Step 2: the code from that email, plus a new password. */
export const resetPasswordSchema = z
  .object({
    phone: z.string().regex(/^01[3-9]\d{8}$/, 'Enter a valid Bangladesh mobile number'),
    code: z.string().length(6),
    new_password: z.string().min(8),
    confirm_password: z.string().min(8),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

export const updateMyProfileSchema = z.object({
  full_name_en: z.string().min(2).optional(),
  full_name_bn: z.string().optional(),
  phone: z.string().regex(/^01[3-9]\d{8}$/).optional(),
  nid: z.string().optional(),
  dob: z.coerce.date().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  employee_id: z.string().optional(),
});

export type UpdateMyProfileDto = z.infer<typeof updateMyProfileSchema>;
