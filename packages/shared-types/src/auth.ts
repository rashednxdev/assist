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

export const registerSchema = z
  .object({
    full_name_en: z.string().min(2),
    full_name_bn: z.string().optional(),
    email: z.string().email(),
    phone: z.string().regex(/^01[3-9]\d{8}$/, 'Enter a valid Bangladesh mobile number'),
    password: z.string().min(8),
    confirm_password: z.string().min(8),
    user_type: z.enum(['applicant', 'officer']).default('applicant'),
    accept_terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
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
