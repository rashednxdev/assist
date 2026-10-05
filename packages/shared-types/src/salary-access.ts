import { z } from 'zod';
import type { OfficeOption } from './org.js';

/** Each arrears bill PDF download or T.R. Form 13 print uses one approved bill. */
export const SALARY_BILL_KINDS = ['arrears_pdf', 'tr_form_13'] as const;
export type SalaryBillKind = (typeof SALARY_BILL_KINDS)[number];

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

export const requestSalaryBillsSchema = z.object({
  requested_bills: z.number().int().min(1).max(1000),
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

export const consumeSalaryBillSchema = z.object({
  kind: z.enum(SALARY_BILL_KINDS),
  grade: z.number().int().min(1).max(20),
  old_pay: z.number().int().min(1),
  months: z.array(z.string().regex(/^\d{4}-\d{2}$/)).min(1).max(60),
  net_total: z.number().finite(),
});
export type ConsumeSalaryBillDto = z.infer<typeof consumeSalaryBillSchema>;

export interface SalaryBillRequestInfo {
  pending: boolean;
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
