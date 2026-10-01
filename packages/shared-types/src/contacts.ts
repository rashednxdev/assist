import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

/** Thrown (403) when office + designation are set but a colleague hasn't verified the user yet. */
export const CONTACT_VERIFICATION_REQUIRED = 'CONTACT_VERIFICATION_REQUIRED';
/** Verified users whose designation grade is 1..this may verify colleagues. */
export const CONTACT_VERIFIER_GRADE_MAX = 11;
export const CONTACT_CODE_LENGTH = 8;

/** `legacy`: had office + designation before verification existed, so counted as verified. */
export type ContactVerificationStatus = 'pending' | 'verified' | 'legacy';

export interface ContactPersonRef {
  id: string;
  name: string;
  designation?: string;
  office?: string;
  grade?: number | null;
}

export interface ContactVerificationInfo {
  status: ContactVerificationStatus;
  /** The user's own 8-digit code while pending. */
  code?: string;
  verified_at?: string;
  verified_by?: ContactPersonRef | null;
}

/** What the viewer may do in the contact directory. */
export interface ContactAccess {
  /** Office + designation set and verified by a colleague (or admin) — the directory is open. */
  ready: boolean;
  /** Office + designation are set (step 1 done). */
  work: boolean;
  /** A colleague verified the user (or they were grandfathered in). */
  verified: boolean;
  /** Null until office + designation are set. */
  verification: ContactVerificationInfo | null;
  /** May verify colleagues' codes (verified, designation grade 1–11) — always true for admins. */
  can_verify: boolean;
  /** Additional charges waiting for a "handed over / still holding" answer. */
  pending_handovers: number;
  /** Paid users (any active package, admin-marked paid, or admin) can see full numbers and call. */
  can_dial: boolean;
  is_admin: boolean;
  my_office_id: string | null;
  privacy: ContactPrivacy;
}

export const contactCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{8}$/, 'Enter the 8-digit code'),
});

/** Who a code belongs to, shown to the verifier before they confirm. */
export interface ContactVerificationCandidate {
  code: string;
  requested_at: string;
  person: {
    id: string;
    name: string;
    initials: string;
    phone_masked?: string;
    designation?: { name: string; grade: number | null };
    office?: { name: string; parent_path: string };
    section?: string;
  };
}

export interface ContactVerifiedRecord {
  id: string;
  person: ContactPersonRef;
  verifier: ContactPersonRef | null;
  verified_at: string;
}

export interface ContactVerificationAdminRow {
  id: string;
  user: ContactPersonRef & { phone?: string };
  status: ContactVerificationStatus;
  code?: string;
  verified_at?: string;
  verifier: ContactPersonRef | null;
  created_at: string;
}

export const contactVerificationAdminQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['pending', 'verified', 'legacy']).optional().or(z.literal('')),
  verifier_id: mongoId.optional().or(z.literal('')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/** Admin view of one user: their own verification and everyone they verified. */
export interface UserContactVerification {
  verification: ContactVerificationAdminRow | null;
  verified_users: ContactVerifiedRecord[];
}

/* ----------------------------- additional charge ---------------------------- */

/** Additional charge is for grade 1–10 officers, on grade 1–10 posts. */
export const ADDITIONAL_CHARGE_GRADE_MAX = 10;
export const ADDITIONAL_CHARGE_MAX = 5;

export interface AdditionalChargeRecord {
  id: string;
  office: { id: string; name: string; short_name?: string; parent_path: string };
  designation: { id: string; name: string; short_name: string; grade: number | null };
  started_at: string;
  /** Someone joined this post substantively; the holder must say whether they handed over. */
  handover: { requested_at: string; new_holder: ContactPersonRef } | null;
}

export interface MyAdditionalCharges {
  eligible: boolean;
  /** Why the user can't add a charge (shown instead of the add button). */
  reason?: string;
  items: AdditionalChargeRecord[];
}

export const additionalChargeInputSchema = z.object({
  office_id: mongoId,
  designation_id: mongoId,
});

export const chargeHandoverSchema = z.object({
  handed_over: z.boolean(),
});

export interface ContactPrivacy {
  hide_phone: boolean;
  hide_email: boolean;
}

export const contactPrivacySchema = z.object({
  hide_phone: z.boolean(),
  hide_email: z.boolean(),
});

export interface ContactPhone {
  /** Full number for paid viewers, partly hidden (e.g. 017•••••45) otherwise. */
  display: string;
  /** Dialable number; only sent to paid viewers. */
  dial?: string;
}

export interface ContactOffice {
  id: string;
  name: string;
  name_bn?: string;
  short_name?: string;
  office_code?: string;
  office_type: { id: string; name: string; short_name: string } | null;
  parent_id: string | null;
  parent_path: string;
  email?: string;
  web_address?: string;
  address?: string;
  division_name?: string;
  district_name?: string;
  thana_name?: string;
  telephone?: ContactPhone;
  mobile?: ContactPhone;
  pabx?: ContactPhone;
  fax?: ContactPhone;
  sub_office_count: number;
  /** People posted directly in this office. */
  employee_count: number;
  /** People in this office and all its sub-offices. */
  employee_total: number;
  is_favorite: boolean;
  is_my_office: boolean;
}

export interface ContactOfficeDetail extends ContactOffice {
  description?: string;
  /** Ancestors from the top office down to the direct parent. */
  breadcrumb: Array<{ id: string; name: string; short_name?: string }>;
}

export interface ContactEmployee {
  id: string;
  name: string;
  name_bn?: string;
  initials: string;
  designation: { id: string; name: string; short_name: string; grade: number | null } | null;
  office: { id: string; name: string; short_name?: string; parent_path: string } | null;
  /** Section / branch within the office. */
  section?: string;
  mobile?: ContactPhone;
  /** Desk telephone and PABX of the current posting. */
  telephone?: ContactPhone;
  pabx?: ContactPhone;
  email?: string;
  phone_hidden: boolean;
  /** Posts this person holds as additional charge. */
  additional_charges: Array<{
    designation: { id: string; name: string; short_name: string };
    office: { id: string; name: string; short_name?: string };
  }>;
  /** Set when the row is listed because of an additional charge in the office being browsed. */
  listed_as_additional?: { designation: { id: string; name: string; short_name: string } };
  is_favorite: boolean;
  is_me: boolean;
}

export interface ContactTypeGroup {
  type: { id: string; name: string; short_name: string };
  office_count: number;
  offices: ContactOffice[];
}

export interface ContactOverview {
  access: ContactAccess;
  totals: { offices: number; employees: number; office_types: number };
  groups: ContactTypeGroup[];
}

export interface ContactDesignationCount {
  id: string;
  name: string;
  short_name: string;
  grade: number | null;
  count: number;
}

export const contactOfficeQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type_id: mongoId.optional().or(z.literal('')),
  /** Direct sub-offices of this office. */
  parent_id: mongoId.optional().or(z.literal('')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const contactEmployeeQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  office_id: mongoId.optional().or(z.literal('')),
  /** With office_id: also people in every sub-office below it. */
  include_sub: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  designation_id: mongoId.optional().or(z.literal('')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const contactFavoriteSchema = z.object({
  target_type: z.enum(['office', 'user']),
  target_id: mongoId,
});

export interface ContactFavorites {
  offices: ContactOffice[];
  employees: ContactEmployee[];
}
