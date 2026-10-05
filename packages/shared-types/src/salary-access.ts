import { z } from 'zod';

/** Each arrears bill PDF download or T.R. Form 13 print uses one approved bill. */
export const SALARY_BILL_KINDS = ['arrears_pdf', 'tr_form_13'] as const;
export type SalaryBillKind = (typeof SALARY_BILL_KINDS)[number];

export const SALARY_ACCESS_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const;
export type SalaryAccessStatus = (typeof SALARY_ACCESS_STATUSES)[number];

export const SALARY_BILL_LIMIT_CODE = 'SALARY_BILL_LIMIT';

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
