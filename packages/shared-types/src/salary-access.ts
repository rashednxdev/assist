import { z } from 'zod';
import type { OfficeOption } from './org.js';
import {
  NPS_2015,
  asksJoiningDate,
  asksSubstantiveGrade,
  isIsoDate,
  substantiveGradeOptions,
  type PayGrade,
} from './salary-2026.js';

/** Each T.R. Form download (or legacy arrears bill PDF) uses one approved bill. */
export const SALARY_PRINT_KINDS = ['arrears_pdf', 'tr_form_13', 'tr_form_15'] as const;
export type SalaryPrintKind = (typeof SALARY_PRINT_KINDS)[number];

/**
 * `arrears_calc` is one bill charged for a block of calculations that were not downloaded.
 * `staff_tr_form_15` is one bill per employee in an office staff T.R. Form 15.
 */
export const SALARY_BILL_KINDS = [...SALARY_PRINT_KINDS, 'arrears_calc', 'staff_tr_form_15'] as const;
export type SalaryBillKind = (typeof SALARY_BILL_KINDS)[number];

/** Free arrears calculations for the first user of a listed office. */
export const SALARY_FREE_ARREARS_CALCS = 5;

/**
 * After an office's first user, this many more users of an office of that type (by type short name)
 * may each calculate one single arrear bill without an approved bill. Later users need a bill.
 */
export const SALARY_OFFICE_TYPE_EXTRA_USERS: Readonly<Record<string, number>> = {
  CGA: 5,
  CAFO: 4,
  DCA: 4,
  DAFO: 3,
  UAO: 2,
};
/** Accounts office types (by type short name); users of other offices name the office that passes their bills. */
export const SALARY_ACCOUNTS_OFFICE_TYPES = ['CGA', 'CAFO', 'DCA', 'DAFO', 'UAO'] as const;
/** Office types that can be chosen as the bill-passing (accounting) office. */
export const SALARY_BILL_PASSING_OFFICE_TYPES = ['CAFO', 'DCA', 'DAFO', 'UAO'] as const;

function typeIn(list: readonly string[], officeType: string | null | undefined): boolean {
  return list.includes((officeType ?? '').trim().toUpperCase());
}

/** Others office nature: GOB must name a bill-passing office; autonomous may skip it. */
export const SALARY_OTHER_OFFICE_KINDS = ['gob', 'autonomous'] as const;
export type SalaryOtherOfficeKind = (typeof SALARY_OTHER_OFFICE_KINDS)[number];

/**
 * Listed non-accounts offices and GOB “Others” must name a bill-passing office.
 * Autonomous “Others” do not.
 */
export function salaryNeedsAccountingOffice(office: {
  is_other: boolean;
  office_type: string | null;
  /** For Others only; null/legacy Others are treated as GOB (accounts office required). */
  other_office_kind?: SalaryOtherOfficeKind | null;
}): boolean {
  if (office.is_other) return office.other_office_kind !== 'autonomous';
  return !typeIn(SALARY_ACCOUNTS_OFFICE_TYPES, office.office_type);
}

export function isSalaryBillPassingType(officeType: string | null | undefined): boolean {
  return typeIn(SALARY_BILL_PASSING_OFFICE_TYPES, officeType);
}

/** Free calculations for each of those extra users. */
export const SALARY_EXTRA_USER_FREE_CALCS = 1;
/** Free calculations for a user who typed an "Others" office. */
export const SALARY_OTHERS_FREE_CALCS = 1;

/**
 * Free arrears calculations for a user, by their office and their order among that office's users
 * (1 = the first user to choose the office).
 */
export function salaryFreeCalcsFor(office: { is_other: boolean; office_type: string | null; rank: number } | null): number {
  if (!office) return 0;
  if (office.is_other) return SALARY_OTHERS_FREE_CALCS;
  if (office.rank <= 1) return SALARY_FREE_ARREARS_CALCS;
  const extraUsers = SALARY_OFFICE_TYPE_EXTRA_USERS[(office.office_type ?? '').trim().toUpperCase()] ?? 0;
  return office.rank - 1 <= extraUsers ? SALARY_EXTRA_USER_FREE_CALCS : 0;
}
export const SALARY_MAX_FREE_CALCS = 1000;

/** `free_calcs` null means the office rules above; a number gives every user with an office that many. */
export const updateSalaryFreeCalcsSchema = z.object({
  free_calcs: z
    .number()
    .int()
    .min(0, 'Enter 0 or more')
    .max(SALARY_MAX_FREE_CALCS, `At most ${SALARY_MAX_FREE_CALCS} free calculations`)
    .nullable(),
});
export type UpdateSalaryFreeCalcsDto = z.infer<typeof updateSalaryFreeCalcsSchema>;

/** Free arrears calculations for users without an approved bill; staff bill employees count too. */
export interface SalaryFreeCalcsSettingsRecord {
  free_calcs: number | null;
  updated_at: string | null;
}

/** After the free ones, this many calculations without a download use one bill. */
export const SALARY_CALCS_PER_BILL = 5;
export const SALARY_CALC_LIMIT_CODE = 'SALARY_CALC_LIMIT';

/** T.R. Form 13 for grades 1–10, T.R. Form 15 for 11–20. */
export function salaryTrFormNo(grade: number): 13 | 15 {
  return grade >= 11 ? 15 : 13;
}

/**
 * T.R. Form grade for an arrears result: post-promotion substantive when a pay change
 * applies, otherwise the main (pre-promotion) substantive grade.
 */
export function salaryArrearTrGrade(result: {
  substantive_grade: number;
  bill_grade: number;
  pay_change: { grade: number; substantive_grade?: number | null } | null;
  substantive_grade_after?: number | null;
}): number {
  if (result.pay_change) {
    return result.substantive_grade_after ?? result.bill_grade;
  }
  return result.substantive_grade;
}

export const SALARY_ACCESS_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const;
export type SalaryAccessStatus = (typeof SALARY_ACCESS_STATUSES)[number];

/** Admin list filters; `active` = pending requests and approved users. */
export const SALARY_ACCESS_LIST_FILTERS = ['active', 'pending', 'approved', 'rejected'] as const;
export type SalaryAccessListFilter = (typeof SALARY_ACCESS_LIST_FILTERS)[number];

export const SALARY_BILL_LIMIT_CODE = 'SALARY_BILL_LIMIT';
export const SALARY_OFFICE_REQUIRED_CODE = 'SALARY_OFFICE_REQUIRED';

const officeId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid office');

const BANGLA_SCRIPT = /[\u0980-\u09FF]/;
const LATIN_LETTER = /[A-Za-z]/;

const otherNameEn = z.string().trim().max(200, 'Office name is too long').default('');
const otherNameBn = z.string().trim().max(200, 'Office name is too long').default('');

function checkOtherNames(v: { other_office_name: string; other_office_name_bn: string }, ctx: z.RefinementCtx): void {
  if (v.other_office_name.length < 3 || !LATIN_LETTER.test(v.other_office_name)) {
    ctx.addIssue({ code: 'custom', path: ['other_office_name'], message: 'Type the full office name in English' });
  }
  if (v.other_office_name_bn.length < 3 || !BANGLA_SCRIPT.test(v.other_office_name_bn)) {
    ctx.addIssue({ code: 'custom', path: ['other_office_name_bn'], message: 'Type the full office name in Bangla' });
  }
}

/** A listed office inside its circle, or "Others" with the full office name typed in English and Bangla. */
export const saveSalaryOfficeSchema = z
  .object({
    circle_id: officeId.nullable().default(null),
    office_id: officeId.nullable().default(null),
    other_office_name: otherNameEn,
    other_office_name_bn: otherNameBn,
    /** Required for Others: সরকারি (GOB) or স্বায়ত্তশাসিত. */
    other_office_kind: z.enum(SALARY_OTHER_OFFICE_KINDS).nullable().default(null),
    /** Bill-passing office; required for GOB Others and listed non-accounts offices. */
    accounting_office_id: officeId.nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (v.office_id) {
      if (!v.circle_id) ctx.addIssue({ code: 'custom', path: ['circle_id'], message: 'Select your circle' });
      if (v.other_office_name || v.other_office_name_bn) {
        ctx.addIssue({ code: 'custom', path: ['other_office_name'], message: 'Choose a listed office or Others, not both' });
      }
      if (v.other_office_kind) {
        ctx.addIssue({ code: 'custom', path: ['other_office_kind'], message: 'Office kind applies only to Others' });
      }
    } else {
      checkOtherNames(v, ctx);
      if (!v.other_office_kind) {
        ctx.addIssue({
          code: 'custom',
          path: ['other_office_kind'],
          message: 'Choose whether the office is GOB or autonomous',
        });
      }
      if (v.other_office_kind !== 'autonomous' && !v.accounting_office_id) {
        ctx.addIssue({ code: 'custom', path: ['accounting_office_id'], message: 'Select your bill-passing office' });
      }
    }
  });
export type SaveSalaryOfficeDto = z.infer<typeof saveSalaryOfficeSchema>;

/** An "Others" office already added by another user, offered so the same office is not typed twice. */
export interface SalaryOtherOfficeSuggestion {
  other_office_name: string;
  other_office_name_bn: string;
  /** Users who joined with this office name. */
  users: number;
}

/** Shown on the sign-in screen; every user who saved a salary office counts as one office. */
export interface SalaryJoinedOfficesRecord {
  joined_offices: number;
}

/** Admin correction of a user's "Others" office name. */
export const adminSalaryOtherOfficeSchema = z
  .object({ other_office_name: otherNameEn, other_office_name_bn: otherNameBn })
  .superRefine(checkOtherNames);
export type AdminSalaryOtherOfficeDto = z.infer<typeof adminSalaryOtherOfficeSchema>;

export const adminSalaryOfficeEditableSchema = z.object({ editable: z.boolean() });
export type AdminSalaryOfficeEditableDto = z.infer<typeof adminSalaryOfficeEditableSchema>;

/** A user completing a saved office that has no bill-passing office yet. */
export const setSalaryAccountingOfficeSchema = z.object({ accounting_office_id: officeId });
export type SetSalaryAccountingOfficeDto = z.infer<typeof setSalaryAccountingOfficeSchema>;

/** Admin change of a user's bill-passing office; null clears it so the user chooses again. */
export const adminSalaryAccountingOfficeSchema = z.object({ accounting_office_id: officeId.nullable() });
export type AdminSalaryAccountingOfficeDto = z.infer<typeof adminSalaryAccountingOfficeSchema>;

/** Office admins of a bill-passing office are the contacts for the offices that chose it. */
export const adminSalaryOfficeAdminSchema = z.object({ office_admin: z.boolean() });
export type AdminSalaryOfficeAdminDto = z.infer<typeof adminSalaryOfficeAdminSchema>;

/** One user's saved salary office, for the admin list. */
export interface SalaryUserOfficeAdminRow {
  user: { id: string; full_name_en: string; email: string; phone: string };
  is_other: boolean;
  /** Listed office display name, or the English "Others" name. */
  label: string;
  other_office_name: string;
  other_office_name_bn: string;
  office_type: string | null;
  /** Order among the users of the same listed office (1 = first); null for Others. */
  office_rank: number | null;
  free_calcs: number;
  free_tr_form: SalaryFreeTrFormState;
  /** The user may edit the office name printed on the bill forms. */
  office_name_editable: boolean;
  /** Offices the user added to their staff arrear bill; only the admin can rename them. */
  staff_offices: Array<{ id: string; name: string }>;
  /** Bill-passing office chosen by the user; null when not needed or not chosen yet. */
  accounting_office: OfficeOption | null;
  needs_accounting_office: boolean;
  /** Contact person for the offices whose bills this user's office passes. */
  office_admin: boolean;
  /** Only users of a listed bill-passing office (CAFO, DCA, DAFO, UAO) can be office admins. */
  can_be_office_admin: boolean;
  updated_at: string;
}

export const updateSalaryOfficeSettingsSchema = z.object({
  others_allowed: z.boolean(),
});
export type UpdateSalaryOfficeSettingsDto = z.infer<typeof updateSalaryOfficeSettingsSchema>;

/** Whether users may choose "Others" and type an office name instead of a listed office. */
export interface SalaryOfficeSettingsRecord {
  others_allowed: boolean;
  updated_at: string | null;
}

export const SALARY_DEFAULT_FREE_TR_COUNT = 1;
export const SALARY_MAX_FREE_TR_COUNT = 100;
/** NID printed on a free T.R. Form download; users cannot change it. */
export const SALARY_FREE_TR_NID = '00011223344XXYYRR';

export const updateSalaryFreeTrFormSchema = z
  .object({
    enabled: z.boolean().optional(),
    free_count: z
      .number()
      .int()
      .min(1, 'Allow at least 1 free download')
      .max(SALARY_MAX_FREE_TR_COUNT, `At most ${SALARY_MAX_FREE_TR_COUNT} free downloads`)
      .optional(),
  })
  .refine((v) => v.enabled !== undefined || v.free_count !== undefined, 'Nothing to update');
export type UpdateSalaryFreeTrFormDto = z.infer<typeof updateSalaryFreeTrFormSchema>;

/**
 * While enabled, every user gets `free_count` free single T.R. Form 13/15 downloads; while disabled,
 * only users who registered while it was enabled keep them.
 */
export interface SalaryFreeTrFormSettingsRecord {
  enabled: boolean;
  /** Free downloads per eligible user. */
  free_count: number;
  /** When it was last turned on; null if never. */
  enabled_since: string | null;
  updated_at: string | null;
}

/** A user's free single T.R. Forms: `none` when not eligible. */
export type SalaryFreeTrFormState = 'none' | 'available' | 'used';

export interface SalaryOfficeRecord {
  circle: OfficeOption | null;
  /** Null when the user chose Others. */
  office: OfficeOption | null;
  other_office_name: string;
  other_office_name_bn: string;
  /** For Others: GOB or autonomous; null for listed offices. */
  other_office_kind: SalaryOtherOfficeKind | null;
  /** Display name: the listed office or the typed English name. */
  label: string;
  /** Default office name on the bill forms: the Bangla name for Others, otherwise empty. */
  bill_office_name: string;
  /** False while `bill_office_name` is fixed on the forms; the admin can allow the user to edit it. */
  bill_office_editable: boolean;
  /** Short name of the listed office's type (CGA, CAFO, …); null for Others. */
  office_type: string | null;
  /** The office that passes this office's bills; null for accounts offices or until chosen. */
  accounting_office: OfficeOption | null;
  /** The user must choose `accounting_office` before using /salary. */
  needs_accounting_office: boolean;
  /** The admin made this user a contact for the offices whose bills their office passes. */
  office_admin: boolean;
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
  /** Suggested Taka price for one bulk; shown to admins on pending requests. */
  bulk_price: z.number().int().min(0, 'Price cannot be negative').max(10_000_000, 'Price is too large').optional(),
});
export type UpdateSalaryBulkSizeDto = z.infer<typeof updateSalaryBulkSizeSchema>;

export interface SalaryBulkSizeRecord {
  bulk_size: number;
  /** Default Taka price per bulk for admin suggestions (0 = no suggestion). */
  bulk_price: number;
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
  /** Taka charged for this approval; added to the user's charged total (admin-only). */
  charge_amount: z.number().int().min(0).max(10_000_000).optional(),
});
export type UpdateSalaryBillAccessDto = z.infer<typeof updateSalaryBillAccessSchema>;

export const rejectSalaryBillRequestSchema = z.object({
  admin_note: z.string().trim().max(500).optional(),
});
export type RejectSalaryBillRequestDto = z.infer<typeof rejectSalaryBillRequestSchema>;

/** Note seen only by admins; never sent to the user. */
export const updateSalaryAdminNoteSchema = z.object({
  admin_note: z.string().trim().max(500),
});
export type UpdateSalaryAdminNoteDto = z.infer<typeof updateSalaryAdminNoteSchema>;

const paymentDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');

/** Record money received from a user for bill access (admin-only). */
export const recordSalaryPaymentSchema = z.object({
  amount: z.number().int().min(1, 'Enter at least 1').max(10_000_000, 'Amount is too large'),
  /** Bangladesh date the money was received; defaults to today. */
  received_at: paymentDate.optional(),
  note: z.string().trim().max(200).default(''),
});
export type RecordSalaryPaymentDto = z.infer<typeof recordSalaryPaymentSchema>;

export interface SalaryPaymentRecord {
  id: string;
  amount: number;
  /** YYYY-MM-DD (Bangladesh). */
  received_at: string;
  note: string;
}

/** Admin-only money summary for one user's bill access. */
export interface SalaryAccessBilling {
  charged_total: number;
  received_total: number;
  due: number;
  /** Suggested charge for the pending request (`requested_bulks × bulk_price`), or null. */
  suggested_charge: number | null;
  payments: SalaryPaymentRecord[];
}

/** T.R. Form 13 / 15, arrears PDF and office staff T.R. Form 15 downloads (one per employee). */
export interface SalaryPrintStats {
  total: number;
  free: number;
  approved: number;
}

const reportDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');

/** Date range of a print report, Bangladesh dates; both ends included. Defaults to the last 30 days. */
export const salaryPrintReportQuerySchema = z.object({
  from: reportDate.optional(),
  to: reportDate.optional(),
});
export type SalaryPrintReportQuery = z.infer<typeof salaryPrintReportQuerySchema>;
export const SALARY_PRINT_REPORT_MAX_DAYS = 366;

/** Downloads on one Bangladesh date; a staff T.R. Form 15 counts once per employee. */
export interface SalaryPrintDayRow {
  date: string;
  total: number;
  tr_form_13: number;
  tr_form_15: number;
  staff_tr_form_15: number;
  arrears_pdf: number;
  /** Users who downloaded that day. */
  users: number;
}

export interface SalaryPrintReport {
  from: string;
  to: string;
  /** Downloads in the range. */
  total: number;
  /** Downloads since the start. */
  all_time: number;
  /** Dates with downloads, newest first. */
  days: SalaryPrintDayRow[];
}

/** One user's prints: today, yesterday (Bangladesh dates), and every print since the start. */
export interface SalaryUserPrintRow {
  user_id: string;
  name: string;
  phone: string;
  office: string;
  today: number;
  yesterday: number;
  total: number;
  /** Prints made with a free T.R. Form. */
  free: number;
  /** Prints charged to an approved bill allowance. */
  approved: number;
}

export interface SalaryUserPrintReport {
  /** Bangladesh date for the Today column. */
  today: string;
  /** Bangladesh date for the Yesterday column. */
  yesterday: string;
  rows: SalaryUserPrintRow[];
  today_total: number;
  yesterday_total: number;
  all_time: number;
  free_total: number;
  approved_total: number;
}

export interface SalaryBillAccessStats {
  all_time: SalaryPrintStats;
  /** Since midnight, Bangladesh time. */
  today: SalaryPrintStats;
  pending_requests: number;
  approved_users: number;
}

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
  /** True when a bill is left or a free single T.R. Form is still available. */
  can_bill: boolean;
  free_tr_form: SalaryFreeTrFormState;
  /** Free single T.R. Form downloads left; used only when no approved bill is left. */
  free_tr_left: number;
  /** Bills in one bulk. */
  bulk_size: number;
  calc: SalaryArrearsCalcInfo;
  /** Whether the next arrears calculation is allowed. */
  can_calculate: boolean;
  request: SalaryBillRequestInfo;
  /** The office admins of the user's bill-passing office, or the admin's numbers when it has none. */
  contacts: SalaryContactNumber[];
  contacts_source: 'office' | 'admin';
  /** Bill-passing office whose admins are listed in `contacts`. */
  contact_office: string | null;
}

/** Admins and users the admin has granted bills to; status alone turns `pending` on a new request. */
export function salaryCanSeeDownloads(access: Pick<SalaryBillAccessRecord, 'unlimited' | 'bill_limit'>): boolean {
  return access.unlimited || access.bill_limit > 0;
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
  free_tr_form: SalaryFreeTrFormState;
  request: SalaryBillRequestInfo;
  /** Seen only by admins. */
  admin_note: string;
  /** Charged / received / due — never sent to the user. */
  billing: SalaryAccessBilling;
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

/** Employees one user can keep in the office staff arrear bill (active and trashed). */
export const SALARY_MAX_STAFF = 200;
/** Offices a user prepares staff arrear bills for besides their own; not their registered office. */
export const SALARY_MAX_STAFF_OFFICES = 20;

/**
 * True when editing would change more than 90% of the employee name; the user should trash and add
 * a new employee instead.
 */
export function salaryStaffNameChangeTooLarge(prev: string, next: string): boolean {
  const a = prev.trim().toLowerCase();
  const b = next.trim().toLowerCase();
  if (a === b) return false;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return false;
  const dist = levenshtein(a, b);
  return dist / maxLen > 0.9;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}

const arrearMonth = z.string().regex(/^\d{4}-\d{2}$/);

const staffPayChangeSchema = z
  .object({
    effective_date: z.string(),
    grade: z.number().int().min(1).max(20),
    old_pay: z.number().int().min(1),
    substantive_grade: z.number().int().min(1).max(20).nullable().optional(),
  })
  .nullable()
  .default(null);

/** Exceptional fixation / arrears overrides for one staff employee (admin of their own bill). */
export const salaryStaffExceptionalSchema = z
  .object({
    increment_exempt: z.boolean().default(false),
    pay_change: staffPayChangeSchema,
    arrear_start_date: z.string().nullable().default(null),
  })
  .default({ increment_exempt: false, pay_change: null, arrear_start_date: null });

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
    excess_rr: z.boolean().default(false),
    excess_puja: z.boolean().default(false),
    /** Office added only for the staff arrear bill; null = the user's own office. */
    staff_office_id: officeId.nullable().default(null),
    /**
     * YYYY-MM-DD; required for the initial basic of Grade 7–20. On or after 02-01-2026 there is no
     * 01-07-2026 increment; after 01-07-2026 the arrears start from it.
     */
    joining_date: z.string().nullable().default(null),
    exceptional: salaryStaffExceptionalSchema,
  })
  .superRefine((v, ctx) => {
    if (!NPS_2015[v.grade as PayGrade]?.includes(v.old_pay)) {
      ctx.addIssue({ code: 'custom', path: ['old_pay'], message: 'Choose a basic from the grade scale' });
    }
    if (asksJoiningDate(v.grade, v.old_pay) && !isIsoDate(v.joining_date)) {
      ctx.addIssue({ code: 'custom', path: ['joining_date'], message: 'Enter the joining date of service' });
    }
    const ex = v.exceptional;
    if (ex.arrear_start_date != null && ex.arrear_start_date !== '') {
      if (!isIsoDate(ex.arrear_start_date)) {
        ctx.addIssue({ code: 'custom', path: ['exceptional', 'arrear_start_date'], message: 'Enter a valid arrears start date' });
      } else if (ex.arrear_start_date <= '2026-07-01') {
        ctx.addIssue({
          code: 'custom',
          path: ['exceptional', 'arrear_start_date'],
          message: 'Custom arrears start must be after 01-07-2026',
        });
      }
    }
    if (ex.pay_change) {
      if (!isIsoDate(ex.pay_change.effective_date)) {
        ctx.addIssue({
          code: 'custom',
          path: ['exceptional', 'pay_change', 'effective_date'],
          message: 'Enter the pay-change effective date',
        });
      } else if (ex.pay_change.effective_date < '2026-07-01') {
        ctx.addIssue({
          code: 'custom',
          path: ['exceptional', 'pay_change', 'effective_date'],
          message: 'Pay change must be on or after 01-07-2026',
        });
      }
      if (!NPS_2015[ex.pay_change.grade as PayGrade]?.includes(ex.pay_change.old_pay)) {
        ctx.addIssue({
          code: 'custom',
          path: ['exceptional', 'pay_change', 'old_pay'],
          message: 'Choose a basic from the pay-change grade scale',
        });
      }
      const promoGrade = ex.pay_change.grade as PayGrade;
      const postSub = ex.pay_change.substantive_grade;
      if (
        asksSubstantiveGrade(promoGrade) &&
        (postSub == null || !substantiveGradeOptions(promoGrade).includes(postSub as PayGrade))
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['exceptional', 'pay_change', 'substantive_grade'],
          message: 'Select the substantive grade after promotion / higher scale',
        });
      }
    }
  });
export type SalaryStaffDto = z.infer<typeof salaryStaffSchema>;

export interface SalaryStaffRecord extends SalaryStaffDto {
  id: string;
  /** Soft-removed; still counts toward the employee and approved-bill limits. */
  trashed: boolean;
  created_at: string;
  updated_at: string;
}

const staffOfficeKey = officeId.nullable();

export const consumeSalaryStaffBillSchema = z
  .object({
    months: z.array(arrearMonth).min(1).max(60),
    /** One office (null = the user's own office). Ignored when `staff_office_ids` is set. */
    staff_office_id: staffOfficeKey.optional(),
    /** Consolidated print: one dedicated T.R. Form 15 per checked office. */
    staff_office_ids: z.array(staffOfficeKey).min(1).max(SALARY_MAX_STAFF_OFFICES + 1).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.staff_office_ids == null && v.staff_office_id === undefined) {
      ctx.addIssue({ code: 'custom', path: ['staff_office_id'], message: 'Choose an office' });
    }
  });
export type ConsumeSalaryStaffBillDto = z.infer<typeof consumeSalaryStaffBillSchema>;

export const salaryStaffOfficeSchema = z.object({
  name: z.string().trim().min(3, 'Enter the full office name').max(200, 'Office name is too long'),
});
export type SalaryStaffOfficeDto = z.infer<typeof salaryStaffOfficeSchema>;

export interface SalaryStaffOfficeRecord {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}
