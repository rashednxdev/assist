import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const optionalText = (max: number) => z.string().trim().max(max).optional().default('');
const optionalId = mongoId.optional().nullable().or(z.literal('').transform(() => null));

/* ------------------------------- office types ------------------------------- */

export const officeTypeInputSchema = z.object({
  name: z.string().trim().min(2, 'Name needs 2+ characters').max(120),
  name_bn: optionalText(120),
  short_name: z.string().trim().min(1, 'Short name is required').max(30),
  serial_no: z.coerce.number().int().min(0).max(100_000).default(0),
  is_active: z.boolean().default(true),
});
export type OfficeTypeInput = z.input<typeof officeTypeInputSchema>;

export interface OfficeTypeRecord {
  id: string;
  name: string;
  name_bn?: string;
  short_name: string;
  serial_no: number;
  is_active: boolean;
  office_count: number;
}

/* ------------------------------- designations ------------------------------- */

/** Bangladesh national pay scale grades 1 (highest) to 20. */
export const PAY_GRADE_MIN = 1;
export const PAY_GRADE_MAX = 20;

export const designationInputSchema = z.object({
  name: z.string().trim().min(2, 'Name needs 2+ characters').max(150),
  name_bn: optionalText(150),
  short_name: z.string().trim().min(1, 'Short name is required').max(30),
  grade: z.coerce
    .number()
    .int()
    .min(PAY_GRADE_MIN, `Grade must be ${PAY_GRADE_MIN}–${PAY_GRADE_MAX}`)
    .max(PAY_GRADE_MAX, `Grade must be ${PAY_GRADE_MIN}–${PAY_GRADE_MAX}`)
    .nullable()
    .optional()
    .default(null),
  serial_no: z.coerce.number().int().min(0).max(100_000).default(0),
  is_active: z.boolean().default(true),
});
export type DesignationInput = z.input<typeof designationInputSchema>;

export interface DesignationRecord {
  id: string;
  name: string;
  name_bn?: string;
  short_name: string;
  grade: number | null;
  serial_no: number;
  is_active: boolean;
  user_count: number;
}

/* ---------------------------------- offices --------------------------------- */

const phone = (label: string) =>
  z
    .string()
    .trim()
    .max(40)
    .regex(/^(?:[\d+\-\s(),./#]|ext\.?|x)*$/i, `${label} can only contain digits, spaces, + - ( ) , / and "Ext."`)
    .optional()
    .default('');

export const officeInputSchema = z.object({
  name: z.string().trim().min(2, 'Office name needs 2+ characters').max(200),
  name_bn: optionalText(200),
  short_name: optionalText(40),
  office_code: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Za-z0-9._\-/]*$/, 'Office code can use letters, digits and . _ - /')
    .optional()
    .default(''),
  office_type_id: mongoId,
  /** Empty for a top-level office; otherwise the office this one sits under. */
  parent_id: optionalId,
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(120).optional().or(z.literal('')).default(''),
  mobile: phone('Mobile'),
  telephone: phone('Telephone'),
  pabx: phone('PABX'),
  fax: phone('Fax'),
  address: optionalText(500),
  division_id: optionalId,
  district_id: optionalId,
  thana_id: optionalId,
  web_address: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default('')
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
    .refine((v) => !v || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), 'Enter a valid web address'),
  description: optionalText(1000),
  serial_no: z.coerce.number().int().min(0).max(100_000).default(0),
  is_active: z.boolean().default(true),
});
export type OfficeInput = z.input<typeof officeInputSchema>;

export interface OfficeRecord {
  id: string;
  name: string;
  name_bn?: string;
  short_name?: string;
  office_code?: string;
  office_type: { id: string; name: string; short_name: string } | null;
  parent_id: string | null;
  /** "Top office › Middle office" — ancestors only. */
  parent_path: string;
  email?: string;
  mobile?: string;
  telephone?: string;
  pabx?: string;
  fax?: string;
  address?: string;
  division_id: string | null;
  district_id: string | null;
  thana_id: string | null;
  division_name?: string;
  district_name?: string;
  thana_name?: string;
  web_address?: string;
  description?: string;
  serial_no: number;
  is_active: boolean;
  child_count: number;
  user_count: number;
}

/** Light office row for pickers. */
export interface OfficeOption {
  id: string;
  name: string;
  short_name?: string;
  office_code?: string;
  type_short?: string;
  parent_path: string;
}

export const officeQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  office_type_id: mongoId.optional().or(z.literal('')),
  parent_id: z.string().optional(),
  include_inactive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(30),
});

/* ------------------------------- user identity ------------------------------ */

/** What a user shows next to their name: designation and office. */
export interface WorkIdentity {
  office_id: string | null;
  designation_id: string | null;
  office?: OfficeOption | null;
  designation?: { id: string; name: string; short_name: string; grade: number | null } | null;
  /** Posting details: section / branch, desk telephone and PABX. */
  section?: string;
  telephone?: string;
  pabx?: string;
}

const postingPhone = z
  .string()
  .trim()
  .max(40)
  .regex(/^[\d\s+\-(),./extEXT]*$/, 'Use digits, spaces, + - ( ) , . / or "ext"');

/** Omitted posting fields stay as they are; an empty string clears one. */
export const updateWorkIdentitySchema = z.object({
  office_id: mongoId,
  designation_id: mongoId,
  section: z.string().trim().max(120).optional(),
  telephone: postingPhone.optional(),
  pabx: postingPhone.optional(),
});
export type UpdateWorkIdentityInput = z.infer<typeof updateWorkIdentitySchema>;

export const PROFILE_WORK_IDENTITY_REQUIRED = 'WORK_IDENTITY_REQUIRED';
