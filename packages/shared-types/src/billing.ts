import { z } from 'zod';
import { ACCESS_PACKAGE_KINDS, type AccessPackageKind } from '@ibas/shared-constants';

/*
 * Packages & payments. Exam Preparation packages are priced per exam subject, Basic Module plans
 * by duration, and Live class packages open the classes the admin assigns to them. Payment runs
 * through a gateway (a bKash-style demo for now) and access is granted when the payment succeeds.
 */

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const ACCESS_PACKAGE_KIND_LABELS: Record<AccessPackageKind, string> = {
  exam_prep: 'Exam Preparation',
  basic: 'Basic Module',
  live: 'Live class',
};

export const accessPackageInputSchema = z
  .object({
    kind: z.enum(ACCESS_PACKAGE_KINDS),
    name: z.string().trim().max(120).optional().or(z.literal('')),
    name_bn: z.string().trim().max(120).optional().or(z.literal('')),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
    /** Exam Preparation: the exam part this price is for. With no subject = every subject of the part. */
    exam_part_id: mongoId.optional().or(z.literal('')).nullable(),
    /** Exam Preparation: the subject this price is for. Part and subjects both empty = all of that part (older packages). */
    exam_subject_id: mongoId.optional().or(z.literal('')).nullable(),
    /** Exam Preparation or Live: one package may cover several subjects. A subject may also appear in other packages. */
    exam_subject_ids: z.array(mongoId).max(40).optional().default([]),
    /** Live class: the named package (Flex, Quick Review) this subject class belongs to. */
    live_program_id: mongoId.optional().or(z.literal('')).nullable(),
    /** Live class: how many classes of the chosen subject this package includes. */
    class_limit: z.coerce.number().int().min(1).max(500).optional().nullable(),
    duration_days: z.coerce.number().int().min(1, 'At least 1 day').max(3650),
    price: z.coerce.number().min(0).max(1_000_000),
    /** Optional "was" price shown struck through. */
    compare_at_price: z.coerce.number().min(0).max(1_000_000).optional().nullable(),
    features: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
    is_featured: z.boolean().default(false),
    sort_order: z.coerce.number().int().min(0).max(9999).default(100),
    is_active: z.boolean().default(true),
  })
  .superRefine((d, ctx) => {
    if (d.kind === 'basic' && (d.exam_subject_id || (d.exam_subject_ids?.length ?? 0) > 0)) {
      ctx.addIssue({ code: 'custom', path: ['exam_subject_ids'], message: 'Basic Module packages are not tied to a subject' });
    }
    if (d.kind !== 'exam_prep' && d.exam_part_id) {
      ctx.addIssue({ code: 'custom', path: ['exam_part_id'], message: 'Only Exam Preparation packages have an exam part' });
    }
    if (d.kind !== 'live' && !d.name?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'Name is required' });
    }
    if (d.kind === 'live' && !d.live_program_id) {
      ctx.addIssue({ code: 'custom', path: ['live_program_id'], message: 'Create the live package first, then add one subject under it' });
    }
    if (d.kind === 'live' && (d.exam_subject_ids?.length ?? 0) !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['exam_subject_ids'],
        message: 'Add one subject at a time',
      });
    }
    if (d.kind === 'live' && d.class_limit == null) {
      ctx.addIssue({ code: 'custom', path: ['class_limit'], message: 'Set how many live classes this package includes' });
    }
    if (d.kind !== 'live' && d.live_program_id) {
      ctx.addIssue({ code: 'custom', path: ['live_program_id'], message: 'Only Live class packages belong to a live package' });
    }
    if (d.kind !== 'live' && d.class_limit != null) {
      ctx.addIssue({ code: 'custom', path: ['class_limit'], message: 'Only Live class packages have a class count' });
    }
    if (d.compare_at_price != null && d.compare_at_price > 0 && d.compare_at_price <= d.price) {
      ctx.addIssue({ code: 'custom', path: ['compare_at_price'], message: '"Was" price must be higher than the price' });
    }
  });
export type AccessPackageInput = z.input<typeof accessPackageInputSchema>;

export const EXAM_PREP_SCOPE_KINDS = ['subject', 'part', 'legacy'] as const;
export type ExamPrepScopeKind = (typeof EXAM_PREP_SCOPE_KINDS)[number];

/** Admin: one subject package per subject of a part, in one go. */
export const bulkSubjectPackagesSchema = z
  .object({
    exam_part_id: mongoId,
    duration_days: z.coerce.number().int().min(1, 'At least 1 day').max(3650),
    price: z.coerce.number().min(0).max(1_000_000),
    compare_at_price: z.coerce.number().min(0).max(1_000_000).optional().nullable(),
    /** Also set this price on subjects of the part that already have a package with the same duration. */
    update_existing: z.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    if (d.compare_at_price != null && d.compare_at_price > 0 && d.compare_at_price <= d.price) {
      ctx.addIssue({ code: 'custom', path: ['compare_at_price'], message: '"Was" price must be higher than the price' });
    }
  });
export type BulkSubjectPackagesInput = z.input<typeof bulkSubjectPackagesSchema>;

export interface BulkSubjectPackagesResult {
  created: number;
  updated: number;
  skipped: number;
}

export interface LiveClassBrief {
  id: string;
  topic: string;
  details?: string;
  scheduled_at: string;
  status: string;
  video_platform: 'agora' | 'zoom';
  /** Host / co-host / access — filled on admin package class lists. */
  host_user_id?: string;
  host_name?: string;
  support_user_id?: string;
  support_name?: string;
  access_type?: 'free' | 'paid';
  free_audience?: 'all' | 'selected';
  recording_audience?: 'off' | 'all' | 'attended' | 'enrolled';
  auto_record_cloud?: boolean;
  exam_subject_id?: string;
}

export interface AccessPackageRecord {
  id: string;
  kind: AccessPackageKind;
  name: string;
  name_bn?: string;
  description?: string;
  exam_part_id?: string;
  exam_part_name?: string;
  exam_subject_id?: string;
  exam_subject_name?: string;
  exam_subject_ids?: string[];
  exam_subject_names?: string[];
  /** Live class packages: classes included for the chosen subject. */
  class_limit?: number;
  /** Named live package this subject class belongs to. */
  live_program_id?: string;
  live_program_name?: string;
  /** Exam Preparation: one subject, a whole part, or (older packages) all of Part 1. */
  scope?: ExamPrepScopeKind;
  duration_days: number;
  price: number;
  compare_at_price?: number;
  features: string[];
  is_featured: boolean;
  sort_order: number;
  is_active: boolean;
  /** Live packages: number of classes assigned. */
  class_count?: number;
  /** Live packages (catalog): upcoming classes, soonest first. */
  upcoming_classes?: LiveClassBrief[];
  /** Admin list: paid orders for this package. */
  sold_count?: number;
}

export const BILLING_CHARGE_TYPES = ['none', 'percent', 'fixed'] as const;
export type BillingChargeType = (typeof BILLING_CHARGE_TYPES)[number];

export const billingSettingsSchema = z
  .object({
    charge_type: z.enum(BILLING_CHARGE_TYPES).default('percent'),
    /** Percent (e.g. 1.85) or taka, depending on charge_type. */
    charge_value: z.coerce.number().min(0).max(100_000).default(0),
    charge_label: z.string().trim().min(1).max(60).default('Payment charge'),
    /** Shown on the checkout page. */
    checkout_note: z.string().trim().max(500).optional().or(z.literal('')),
    /** Personal or merchant bKash number the user sends the package amount to. */
    bkash_number: z
      .string()
      .trim()
      .regex(/^(01[3-9]\d{8})?$/, 'Enter a valid bKash number (01XXXXXXXXX)')
      .optional()
      .or(z.literal('')),
    gateway_enabled: z.boolean().default(true),
    /**
     * Percent taken off when a learner enrolls this many subjects of one part together.
     * One subject is never reduced.
     */
    subject_discount_2: z.coerce.number().min(0).max(90).default(10),
    subject_discount_3: z.coerce.number().min(0).max(90).default(0),
    subject_discount_4: z.coerce.number().min(0).max(90).default(0),
  })
  .superRefine((d, ctx) => {
    if (d.charge_type === 'percent' && d.charge_value > 50) {
      ctx.addIssue({ code: 'custom', path: ['charge_value'], message: 'Percentage charge cannot exceed 50%' });
    }
  });
export type BillingSettingsInput = z.input<typeof billingSettingsSchema>;
export type BillingSettingsRecord = z.infer<typeof billingSettingsSchema>;

export const DEFAULT_BILLING_SETTINGS: BillingSettingsRecord = {
  charge_type: 'percent',
  charge_value: 1.85,
  charge_label: 'bKash charge',
  checkout_note: '',
  bkash_number: '',
  gateway_enabled: true,
  subject_discount_2: 10,
  subject_discount_3: 0,
  subject_discount_4: 0,
};

/** A learner can enroll at most this many subjects of one part in a single payment. */
export const MAX_SUBJECTS_PER_ENROLLMENT = 4;

/** A named live package such as Flex or Quick Review. Subject classes sit under it. */
export const liveProgramSchema = z.object({
  name: z.string().trim().min(1, 'Package name is required').max(80),
  name_bn: z.string().trim().max(80).optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  /** Percent taken off when this many subjects of the package are enrolled together. One subject is never reduced. */
  waiver_2: z.coerce.number().min(0).max(90).default(10),
  waiver_3: z.coerce.number().min(0).max(90).default(0),
  waiver_4: z.coerce.number().min(0).max(90).default(0),
  sort_order: z.coerce.number().int().min(0).max(9999).default(100),
  is_active: z.boolean().default(true),
});
export type LiveProgramInput = z.input<typeof liveProgramSchema>;

export interface LiveProgramRecord {
  id: string;
  name: string;
  name_bn?: string;
  description?: string;
  waiver_2: number;
  waiver_3: number;
  waiver_4: number;
  sort_order: number;
  is_active: boolean;
}

export interface LiveWaiverItem {
  id: string;
  programId: string;
  price: number;
  /** 1 when the row is one subject of the package. */
  subjects: number;
}

/** Price after the package's own waiver for enrolling several subjects together. */
export function liveSubjectWaiverQuote(
  items: LiveWaiverItem[],
  programs: Array<Pick<LiveProgramRecord, 'id' | 'waiver_2' | 'waiver_3' | 'waiver_4'>>,
): { priceById: Record<string, number>; groups: Array<{ programId: string; count: number; percent: number }> } {
  const priceById: Record<string, number> = {};
  const byProgram = new Map<string, LiveWaiverItem[]>();
  for (const item of items) {
    if (item.subjects !== 1 || !item.programId) continue;
    const list = byProgram.get(item.programId) ?? [];
    list.push(item);
    byProgram.set(item.programId, list);
  }
  const groups: Array<{ programId: string; count: number; percent: number }> = [];
  for (const [programId, list] of byProgram) {
    const program = programs.find((p) => p.id === programId);
    const percent =
      !program || list.length > MAX_SUBJECTS_PER_ENROLLMENT
        ? 0
        : subjectBundlePercent(list.length, {
            subject_discount_2: program.waiver_2,
            subject_discount_3: program.waiver_3,
            subject_discount_4: program.waiver_4,
          });
    const next =
      list.length > MAX_SUBJECTS_PER_ENROLLMENT
        ? list.map((item) => roundTaka(item.price))
        : pricesAfterPercent(
            list.map((item) => item.price),
            percent,
          );
    list.forEach((item, i) => {
      priceById[item.id] = next[i] ?? roundTaka(item.price);
    });
    groups.push({ programId, count: list.length, percent });
  }
  return { priceById, groups };
}

export function subjectBundlePercent(
  count: number,
  settings: Pick<BillingSettingsRecord, 'subject_discount_2' | 'subject_discount_3' | 'subject_discount_4'>,
): number {
  if (count === 2) return settings.subject_discount_2;
  if (count === 3) return settings.subject_discount_3;
  if (count === 4) return settings.subject_discount_4;
  return 0;
}

/** Apply one percent to a list of prices. The last price absorbs rounding so the sum matches. */
export function pricesAfterPercent(prices: number[], percent: number): number[] {
  if (percent <= 0 || prices.length === 0) return prices.map((p) => roundTaka(p));
  const full = prices.reduce((s, p) => s + p, 0);
  const target = roundTaka(full * (1 - percent / 100));
  if (full <= 0) return prices.map(() => 0);
  let assigned = 0;
  return prices.map((p, i) => {
    if (i === prices.length - 1) return roundTaka(Math.max(0, target - assigned));
    const share = roundTaka((target * p) / full);
    assigned = roundTaka(assigned + share);
    return share;
  });
}

export interface SubjectBundleItem {
  id: string;
  partId: string;
  price: number;
  /** 1 when the package is a single subject. Other packages keep their own price. */
  subjects: number;
}

export interface SubjectBundleQuote {
  priceById: Record<string, number>;
  full: number;
  payable: number;
  saving: number;
  groups: Array<{ partId: string; count: number; percent: number }>;
}

/** Price for enrolling several single-subject packages of the same part at once. */
export function subjectBundleQuote(
  items: SubjectBundleItem[],
  settings: Pick<BillingSettingsRecord, 'subject_discount_2' | 'subject_discount_3' | 'subject_discount_4'>,
): SubjectBundleQuote {
  const priceById: Record<string, number> = {};
  const buckets = new Map<string, SubjectBundleItem[]>();
  for (const item of items) {
    if (item.subjects !== 1 || !item.partId) {
      priceById[item.id] = roundTaka(item.price);
      continue;
    }
    const list = buckets.get(item.partId) ?? [];
    list.push(item);
    buckets.set(item.partId, list);
  }
  const groups: SubjectBundleQuote['groups'] = [];
  for (const [partId, list] of buckets) {
    const percent = list.length > MAX_SUBJECTS_PER_ENROLLMENT ? 0 : subjectBundlePercent(list.length, settings);
    const next =
      list.length > MAX_SUBJECTS_PER_ENROLLMENT
        ? list.map((item) => roundTaka(item.price))
        : pricesAfterPercent(
            list.map((item) => item.price),
            percent,
          );
    list.forEach((item, i) => {
      priceById[item.id] = next[i] ?? roundTaka(item.price);
    });
    groups.push({ partId, count: list.length, percent });
  }
  const full = roundTaka(items.reduce((s, item) => s + item.price, 0));
  const payable = roundTaka(items.reduce((s, item) => s + (priceById[item.id] ?? item.price), 0));
  return { priceById, full, payable, saving: roundTaka(Math.max(0, full - payable)), groups };
}

/** Round to poisha (2 decimals). */
export function roundTaka(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeCharge(price: number, settings: Pick<BillingSettingsRecord, 'charge_type' | 'charge_value'>): number {
  if (price <= 0) return 0;
  if (settings.charge_type === 'percent') return roundTaka((price * settings.charge_value) / 100);
  if (settings.charge_type === 'fixed') return roundTaka(settings.charge_value);
  return 0;
}

/** Charge for several packages paid together; a fixed charge is taken once per payment. */
export function computeCartCharge(prices: number[], settings: Pick<BillingSettingsRecord, 'charge_type' | 'charge_value'>): number {
  if (settings.charge_type === 'fixed') return prices.some((p) => p > 0) ? roundTaka(settings.charge_value) : 0;
  return roundTaka(prices.reduce((s, p) => s + computeCharge(p, settings), 0));
}

export function formatBdt(n: number): string {
  const fixed = Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `৳${fixed}`;
}

export const PAYMENT_METHODS = ['bkash_demo', 'manual', 'free'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bkash_demo: 'bKash (demo)',
  manual: 'Recorded by admin',
  free: 'Free',
};

export const ORDER_STATUSES = ['pending', 'paid', 'failed', 'cancelled', 'expired'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const createOrderSchema = z.object({ package_id: mongoId });

/** Several packages bought in one payment; each still gets its own invoice. */
export const createCartSchema = z.object({
  package_ids: z.array(mongoId).min(1, 'Pick at least one package').max(30),
});
export type CreateCartInput = z.infer<typeof createCartSchema>;

/** User has already sent the package amount to the admin bKash number. */
export const submitBkashClaimSchema = z.object({
  trx_id: z.string().trim().min(4, 'Enter the bKash transaction ID').max(40),
  amount: z.coerce.number().positive('Enter the amount you sent'),
  /** The number the user sent from. Optional. */
  payer_account: z
    .string()
    .trim()
    .regex(/^(01[3-9]\d{8})?$/, 'bKash number must be 11 digits')
    .optional()
    .or(z.literal('')),
});
export type SubmitBkashClaimInput = z.infer<typeof submitBkashClaimSchema>;

export const reviewOrderSchema = z.object({
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

export const demoPaySchema = z.object({
  msisdn: z.string().trim().regex(/^01[3-9]\d{8}$/, 'Enter your 11-digit bKash number'),
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  pin: z.string().trim().regex(/^\d{5}$/, 'Enter your 5-digit PIN'),
  /** Demo only: pretend the wallet has insufficient balance. */
  simulate_failure: z.boolean().optional(),
});
export type DemoPayInput = z.infer<typeof demoPaySchema>;

/** The code the demo gateway "sends"; shown on the checkout page. */
export const DEMO_BKASH_OTP = '123456';

export const manualGrantSchema = z.object({
  user_id: mongoId,
  package_id: mongoId,
  amount: z.coerce.number().min(0).max(1_000_000),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

export const adminOrderQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  kind: z.enum(ACCESS_PACKAGE_KINDS).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const setPackageClassesSchema = z.object({ class_ids: z.array(mongoId).max(500) });

export interface PaymentOrderRecord {
  id: string;
  invoice_no: string;
  user?: { id: string; name: string; email?: string; phone?: string };
  package_id: string;
  kind: AccessPackageKind;
  package_name: string;
  exam_part_name?: string;
  exam_subject_name?: string;
  /** Set when the order was bought together with others in one payment. */
  cart_id?: string;
  duration_days: number;
  price: number;
  charge: number;
  charge_label: string;
  total: number;
  currency: 'BDT';
  method: PaymentMethod;
  status: OrderStatus;
  failure_reason?: string;
  payer_account?: string;
  trx_id?: string;
  /** Amount the user says they sent. The admin compares it with the package total. */
  claimed_amount?: number;
  note?: string;
  /** Paid, but an admin revoked the access it granted. */
  access_revoked?: boolean;
  /** Access window this order grants (preview while pending, actual once paid). */
  access_starts_at: string;
  access_ends_at: string;
  created_at: string;
  paid_at?: string;
  expires_at?: string;
}

export interface EntitlementRecord {
  id: string;
  kind: AccessPackageKind;
  package_id: string;
  package_name: string;
  exam_part_name?: string;
  exam_subject_name?: string;
  starts_at: string;
  ends_at: string;
  status: 'active' | 'upcoming' | 'expired' | 'revoked';
  order_id?: string;
  invoice_no?: string;
  /** What this entitlement opens, for display. */
  opens: string[];
}

export interface MyAccessSummary {
  /** Latest end date per module group when currently active. */
  exam_prep_until?: string;
  basic_until?: string;
  live_packages: Array<{ package_id: string; package_name: string; until: string }>;
  /** Active Exam Preparation access per part; no subject = the whole part. */
  exam_prep_access: ExamPrepAccessItem[];
  entitlements: EntitlementRecord[];
}

export interface ExamPrepAccessItem {
  exam_part_id: string;
  exam_part_name: string;
  exam_subject_id?: string;
  exam_subject_name?: string;
  until: string;
}

/** Packages paid together in one checkout. */
export interface CartRecord {
  cart_id: string;
  orders: PaymentOrderRecord[];
  price: number;
  charge: number;
  charge_label: string;
  total: number;
  status: OrderStatus;
  method: PaymentMethod;
  payer_account?: string;
  trx_id?: string;
  failure_reason?: string;
  expires_at?: string;
  paid_at?: string;
}

export interface BillingCatalog {
  settings: Pick<
    BillingSettingsRecord,
    | 'charge_type'
    | 'charge_value'
    | 'charge_label'
    | 'checkout_note'
    | 'bkash_number'
    | 'gateway_enabled'
    | 'subject_discount_2'
    | 'subject_discount_3'
    | 'subject_discount_4'
  >;
  /** False until an admin grants Learning (read). Package requests stay closed. */
  can_request: boolean;
  packages: AccessPackageRecord[];
  live_programs?: LiveProgramRecord[];
  access: MyAccessSummary;
}
