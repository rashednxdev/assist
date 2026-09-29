import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const optionalId = mongoId.nullable().optional().or(z.literal('').transform(() => null));
const bdMobile = /^01[3-9]\d{8}$/;

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];
export const bloodGroupSchema = z.enum(BLOOD_GROUPS, { errorMap: () => ({ message: 'Choose a blood group' }) });

/** Minimum gap between whole-blood donations. */
export const BLOOD_DONATION_GAP_MONTHS = 3;

/** Recipient group → groups that can donate to it (red cells). */
export const BLOOD_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

export function donorGroupsFor(recipient: BloodGroup): BloodGroup[] {
  return BLOOD_COMPATIBILITY[recipient];
}

export function recipientGroupsOf(donor: BloodGroup): BloodGroup[] {
  return BLOOD_GROUPS.filter((g) => BLOOD_COMPATIBILITY[g].includes(donor));
}

/** Calendar months later, clamped to the month's last day (31 Jan + 1 month → 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export function defaultNextEligible(donatedOn: Date): Date {
  return addMonths(donatedOn, BLOOD_DONATION_GAP_MONTHS);
}

/* ------------------------------- my blood profile ------------------------------ */

export interface BloodDonorProfile {
  is_donor: boolean;
  /** Donor switched off temporarily (ill, travelling…). */
  available: boolean;
  district: { id: string; name: string } | null;
  thana: { id: string; name: string } | null;
  area?: string;
  show_phone: boolean;
  note?: string;
  last_donation_date: string | null;
  next_eligible_date: string | null;
  eligible: boolean;
  /** 0 when eligible now. */
  days_until_eligible: number;
  donation_count: number;
}

export interface BloodMe {
  /** Blood group set (or admin) — the blood bank is open. */
  ready: boolean;
  is_admin: boolean;
  blood_group: BloodGroup | null;
  donor: BloodDonorProfile;
  /** From date of birth, when known. */
  age: number | null;
  open_request_count: number;
}

export const bloodProfileInputSchema = z
  .object({
    blood_group: bloodGroupSchema,
    is_donor: z.boolean().default(false),
    available: z.boolean().default(true),
    district_id: optionalId,
    thana_id: optionalId,
    area: z.string().trim().max(150).optional().default(''),
    show_phone: z.boolean().default(true),
    note: z.string().trim().max(300).optional().default(''),
  })
  .superRefine((v, ctx) => {
    if (v.is_donor && !v.district_id) ctx.addIssue({ code: 'custom', path: ['district_id'], message: 'Choose the district where you can donate' });
  });
export type BloodProfileInput = z.infer<typeof bloodProfileInputSchema>;

export const bloodGroupOnlySchema = z.object({ blood_group: bloodGroupSchema });

/* ---------------------------------- donations --------------------------------- */

export interface BloodDonationRecord {
  id: string;
  donated_on: string;
  next_eligible_on: string;
  place?: string;
  note?: string;
  request_id?: string;
  created_at: string;
}

const dateOnly = z.coerce.date({ errorMap: () => ({ message: 'Enter a valid date' }) });

export const bloodDonationInputSchema = z
  .object({
    donated_on: dateOnly,
    /** Defaults to donated_on + 3 months; may only be later (doctor's advice). */
    next_eligible_on: dateOnly.nullable().optional().or(z.literal('').transform(() => null)),
    place: z.string().trim().max(150).optional().default(''),
    note: z.string().trim().max(300).optional().default(''),
    request_id: optionalId,
  })
  .superRefine((v, ctx) => {
    const tomorrow = new Date();
    tomorrow.setUTCHours(23, 59, 59, 999);
    if (v.donated_on > tomorrow) ctx.addIssue({ code: 'custom', path: ['donated_on'], message: 'Donation date cannot be in the future' });
    if (v.next_eligible_on && v.next_eligible_on < defaultNextEligible(v.donated_on)) {
      ctx.addIssue({ code: 'custom', path: ['next_eligible_on'], message: `Next eligible date must be at least ${BLOOD_DONATION_GAP_MONTHS} months after the donation` });
    }
  });

/* ----------------------------------- donors ----------------------------------- */

export interface BloodDonorRecord {
  id: string;
  name: string;
  initials: string;
  blood_group: BloodGroup;
  designation?: string;
  office?: string;
  district?: string;
  thana?: string;
  area?: string;
  /** Only when the donor shares it. */
  phone?: string;
  available: boolean;
  eligible: boolean;
  days_until_eligible: number;
  last_donation_date: string | null;
  next_eligible_date: string | null;
  donation_count: number;
  is_me: boolean;
}

export const bloodDonorQuerySchema = z.object({
  /** Exact donor group. */
  group: bloodGroupSchema.optional().or(z.literal('').transform(() => undefined)),
  /** Patient group — lists every compatible donor group. */
  compatible_with: bloodGroupSchema.optional().or(z.literal('').transform(() => undefined)),
  district_id: mongoId.optional().or(z.literal('').transform(() => undefined)),
  thana_id: mongoId.optional().or(z.literal('').transform(() => undefined)),
  eligible: z.enum(['true', 'false']).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export interface BloodGroupStat {
  group: BloodGroup;
  donors: number;
  eligible: number;
}

export interface BloodStats {
  groups: BloodGroupStat[];
  donors: number;
  eligible: number;
  open_requests: number;
  donations_this_year: number;
}

/* ---------------------------------- requests ---------------------------------- */

export const BLOOD_URGENCIES = ['normal', 'urgent', 'critical'] as const;
export type BloodUrgency = (typeof BLOOD_URGENCIES)[number];
export type BloodRequestStatus = 'open' | 'fulfilled' | 'cancelled' | 'expired';

export const bloodRequestInputSchema = z.object({
  patient_name: z.string().trim().max(120).optional().default(''),
  blood_group: bloodGroupSchema,
  units: z.coerce.number().int().min(1, 'At least 1 bag').max(10, 'At most 10 bags'),
  hospital: z.string().trim().min(2, 'Enter the hospital or place').max(200),
  district_id: mongoId,
  thana_id: optionalId,
  address: z.string().trim().max(300).optional().default(''),
  needed_on: z.coerce.date({ errorMap: () => ({ message: 'Enter when the blood is needed' }) }),
  urgency: z.enum(BLOOD_URGENCIES).default('normal'),
  contact_name: z.string().trim().min(2, 'Enter a contact name').max(120),
  contact_phone: z.string().trim().regex(bdMobile, 'Enter a valid mobile number (01XXXXXXXXX)'),
  note: z.string().trim().max(1000).optional().default(''),
});
export type BloodRequestInput = z.infer<typeof bloodRequestInputSchema>;

export const bloodRequestStatusSchema = z.object({ status: z.enum(['open', 'fulfilled', 'cancelled']) });

export const bloodRequestQuerySchema = z.object({
  /** open (default) · mine · responded · closed */
  scope: z.enum(['open', 'mine', 'responded', 'closed']).default('open'),
  group: bloodGroupSchema.optional().or(z.literal('').transform(() => undefined)),
  district_id: mongoId.optional().or(z.literal('').transform(() => undefined)),
  /** Only requests the viewer's blood group can serve. */
  can_help: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export interface BloodResponder {
  id: string;
  name: string;
  blood_group: BloodGroup | null;
  phone?: string;
  designation?: string;
  office?: string;
  eligible: boolean;
  note?: string;
  at: string;
}

export interface BloodRequestRecord {
  id: string;
  requester: { id: string; name: string };
  patient_name?: string;
  blood_group: BloodGroup;
  units: number;
  hospital: string;
  district: { id: string; name: string } | null;
  thana: { id: string; name: string } | null;
  address?: string;
  needed_on: string;
  urgency: BloodUrgency;
  contact_name: string;
  contact_phone: string;
  note?: string;
  status: BloodRequestStatus;
  response_count: number;
  i_responded: boolean;
  is_mine: boolean;
  /** Viewer's group can donate to this patient. */
  compatible: boolean;
  /** Only for the requester and admins. */
  responders?: BloodResponder[];
  fulfilled_at?: string;
  created_at: string;
}

export const bloodRespondSchema = z.object({ note: z.string().trim().max(300).optional().default('') });

export interface GeoOption {
  id: string;
  name: string;
  name_bn?: string;
}
