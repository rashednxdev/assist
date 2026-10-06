import { z } from 'zod';
import type { OfficeOption } from './org.js';
import { NPS_2015, type PayGrade } from './salary-2026.js';

/** Each T.R. Form download (or legacy arrears bill PDF) uses one approved bill. */
export const SALARY_PRINT_KINDS = ['arrears_pdf', 'tr_form_13', 'tr_form_15'] as const;
export type SalaryPrintKind = (typeof SALARY_PRINT_KINDS)[number];

/**
 * `arrears_calc` is one bill charged for a block of calculations that were not downloaded.
 * `staff_tr_form_15` is one bill per employee in an office staff T.R. Form 15.
 */
export const SALARY_BILL_KINDS = [...SALARY_PRINT_KINDS, 'arrears_calc', 'staff_tr_form_15'] as const;
export type SalaryBillKind = (typeof SALARY_BILL_KINDS)[number];

/** Arrears calculations every user gets without an approved bill. */
export const SALARY_FREE_ARREARS_CALCS = 5;
/** After the free ones, this many calculations without a download use one bill. */
export const SALARY_CALCS_PER_BILL = 5;
export const SALARY_CALC_LIMIT_CODE = 'SALARY_CALC_LIMIT';

/** T.R. Form 13 for substantive grades 1–10, T.R. Form 15 for 11–20. */
export function salaryTrFormNo(substantiveGrade: number): 13 | 15 {
  return substantiveGrade >= 11 ? 15 : 13;
}

export const SALARY_ACCESS_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const;
export type SalaryAccessStatus = (typeof SALARY_ACCESS_STATUSES)[number];

export const SALARY_BILL_LIMIT_CODE = 'SALARY_BILL_LIMIT';
export const SALARY_OFFICE_REQUIRED_CODE = 'SALARY_OFFICE_REQUIRED';

const officeId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid office');

/** A listed office inside its circle, or "Others" with the office name typed in. */
export const saveSalaryOfficeSchema = z
  .object({
    circle_id: officeId.nullable().default(null),
    office_id: officeId.nullable().default(null),
    other_office_name: z.string().trim().max(200, 'Office name is too long').default(''),
  })
  .superRefine((v, ctx) => {
    if (v.office_id) {
      if (!v.circle_id) ctx.addIssue({ code: 'custom', path: ['circle_id'], message: 'Select your circle' });
      if (v.other_office_name) {
        ctx.addIssue({ code: 'custom', path: ['other_office_name'], message: 'Choose a listed office or Others, not both' });
      }
    } else if (v.other_office_name.length < 3) {
      ctx.addIssue({ code: 'custom', path: ['other_office_name'], message: 'Type your office name (3+ characters)' });
    }
  });
export type SaveSalaryOfficeDto = z.infer<typeof saveSalaryOfficeSchema>;

export const updateSalaryOfficeSettingsSchema = z.object({
  others_allowed: z.boolean(),
});
export type UpdateSalaryOfficeSettingsDto = z.infer<typeof updateSalaryOfficeSettingsSchema>;

/** Whether users may choose "Others" and type an office name instead of a listed office. */
export interface SalaryOfficeSettingsRecord {
  others_allowed: boolean;
  updated_at: string | null;
}

export interface SalaryOfficeRecord {
  circle: OfficeOption | null;
  /** Null when the user chose Others. */
  office: OfficeOption | null;
  other_office_name: string;
  /** Display name: the listed office or the typed name. */
  label: string;
  updated_at: string;
}

export const salaryContactSchema = z.object({
  label: z.string().trim().max(80).default(''),
  number: z
    .string()
    .trim()
    .min(5, 'Contact number is too short')
    .max(30, 'Contact number is too long')
    .regex(/^\+?[\d\s-]+$/, 'Contact number may contain digits, spaces, dashes and a leading +'),
  whatsapp: z.boolean().default(false),
});
export type SalaryContactNumber = z.infer<typeof salaryContactSchema>;

export const updateSalaryContactsSchema = z.object({
  contacts: z.array(salaryContactSchema).max(20),
});
export type UpdateSalaryContactsDto = z.infer<typeof updateSalaryContactsSchema>;

/** Bills are requested and approved in bulks set by the admin. */
export const SALARY_DEFAULT_BULK_SIZE = 50;
export const SALARY_MAX_BULKS_PER_REQUEST = 20;

export const updateSalaryBulkSizeSchema = z.object({
  bulk_size: z.number().int().min(1, 'A bulk needs at least 1 bill').max(1000, 'A bulk can have at most 1000 bills'),
});
export type UpdateSalaryBulkSizeDto = z.infer<typeof updateSalaryBulkSizeSchema>;

export interface SalaryBulkSizeRecord {
  bulk_size: number;
  updated_at: string | null;
}

export const requestSalaryBillsSchema = z.object({
  requested_bulks: z.number().int().min(1).max(SALARY_MAX_BULKS_PER_REQUEST),
  note: z.string().trim().max(500).default(''),
});
export type RequestSalaryBillsDto = z.infer<typeof requestSalaryBillsSchema>;

export const updateSalaryBillAccessSchema = z.object({
  bill_limit: z.number().int().min(0).max(100000),
  bills_used: z.number().int().min(0).max(100000).optional(),
  admin_note: z.string().trim().max(500).optional(),
});
export type UpdateSalaryBillAccessDto = z.infer<typeof updateSalaryBillAccessSchema>;

export const rejectSalaryBillRequestSchema = z.object({
  admin_note: z.string().trim().max(500).default(''),
});
export type RejectSalaryBillRequestDto = z.infer<typeof rejectSalaryBillRequestSchema>;

export const recordArrearsCalcSchema = z.object({
  grade: z.number().int().min(1).max(20),
  old_pay: z.number().int().min(1),
  months: z.array(z.string().regex(/^\d{4}-\d{2}$/)).min(1).max(60),
  net_total: z.number().finite(),
});
export type RecordArrearsCalcDto = z.infer<typeof recordArrearsCalcSchema>;

export const consumeSalaryBillSchema = recordArrearsCalcSchema.extend({
  kind: z.enum(SALARY_PRINT_KINDS),
});
export type ConsumeSalaryBillDto = z.infer<typeof consumeSalaryBillSchema>;

export interface SalaryArrearsCalcInfo {
  free_limit: number;
  free_used: number;
  per_bill: number;
  /** Calculations counted toward the next bill (not downloaded). */
  unprinted: number;
}

export interface SalaryBillRequestInfo {
  pending: boolean;
  /** Null for requests sent before bulks existed. */
  requested_bulks: number | null;
  requested_bills: number | null;
  note: string;
  requested_at: string | null;
}

/** What the signed-in user sees on /salary. */
export interface SalaryBillAccessRecord {
  status: SalaryAccessStatus;
  /** Admins bill without a limit. */
  unlimited: boolean;
  bill_limit: number;
  bills_used: number;
  remaining: number;
  can_bill: boolean;
  /** Bills in one bulk. */
  bulk_size: number;
  calc: SalaryArrearsCalcInfo;
  /** Whether the next arrears calculation is allowed. */
  can_calculate: boolean;
  request: SalaryBillRequestInfo;
  admin_note: string;
  contacts: SalaryContactNumber[];
}

export interface SalaryBillAccessAdminRow {
  user: { id: string; full_name_en: string; email: string; phone: string };
  /** Office chosen on /salary; empty until the user picks one. */
  office_label: string;
  status: SalaryAccessStatus;
  bill_limit: number;
  bills_used: number;
  remaining: number;
  calc: SalaryArrearsCalcInfo;
  request: SalaryBillRequestInfo;
  admin_note: string;
  approved_at: string | null;
  last_used_at: string | null;
  updated_at: string;
}

export interface SalaryBillUsageRecord {
  id: string;
  kind: SalaryBillKind;
  grade: number;
  old_pay: number;
  months: string[];
  net_total: number;
  created_at: string;
}

export interface SalaryContactsRecord {
  contacts: SalaryContactNumber[];
  updated_at: string | null;
}

/** Employees one user can keep in the office staff arrear bill. */
export const SALARY_MAX_STAFF = 200;

const arrearMonth = z.string().regex(/^\d{4}-\d{2}$/);

/** One office staff employee; only these details are stored, the arrears are always recalculated. */
export const salaryStaffSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter the employee name').max(120, 'Name is too long'),
    post: z.string().trim().min(2, 'Enter the post').max(120, 'Post is too long'),
    nid: z
      .string()
      .trim()
      .regex(/^(\d{10}|\d{13}|\d{17})?$/, 'NID must be 10, 13 or 17 digits')
      .default(''),
    grade: z.number().int().min(1).max(20),
    old_pay: z.number().int().min(1),
    housing_status: z.enum(['hra_eligible', 'govt_accommodation']),
    hra_area: z.enum(['dhaka', 'major_city', 'other']),
  })
  .superRefine((v, ctx) => {
    if (!NPS_2015[v.grade as PayGrade]?.includes(v.old_pay)) {
      ctx.addIssue({ code: 'custom', path: ['old_pay'], message: 'Choose a basic from the grade scale' });
    }
  });
export type SalaryStaffDto = z.infer<typeof salaryStaffSchema>;

export interface SalaryStaffRecord extends SalaryStaffDto {
  id: string;
  created_at: string;
  updated_at: string;
}

export const consumeSalaryStaffBillSchema = z.object({
  months: z.array(arrearMonth).min(1).max(60),
});
export type ConsumeSalaryStaffBillDto = z.infer<typeof consumeSalaryStaffBillSchema>;
