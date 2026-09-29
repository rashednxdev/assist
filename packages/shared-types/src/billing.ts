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
    name: z.string().trim().min(1, 'Name is required').max(120),
    name_bn: z.string().trim().max(120).optional().or(z.literal('')),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
    /** Exam Preparation: the subject this price is for. Empty = all subjects. */
    exam_subject_id: mongoId.optional().or(z.literal('')).nullable(),
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
    if (d.kind !== 'exam_prep' && d.exam_subject_id) {
      ctx.addIssue({ code: 'custom', path: ['exam_subject_id'], message: 'Only Exam Preparation packages have a subject' });
    }
    if (d.compare_at_price != null && d.compare_at_price > 0 && d.compare_at_price <= d.price) {
      ctx.addIssue({ code: 'custom', path: ['compare_at_price'], message: '"Was" price must be higher than the price' });
    }
  });
export type AccessPackageInput = z.input<typeof accessPackageInputSchema>;

export interface LiveClassBrief {
  id: string;
  topic: string;
  scheduled_at: string;
  status: string;
  video_platform: 'agora' | 'zoom';
}

export interface AccessPackageRecord {
  id: string;
  kind: AccessPackageKind;
  name: string;
  name_bn?: string;
  description?: string;
  exam_subject_id?: string;
  exam_subject_name?: string;
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
    gateway_enabled: z.boolean().default(true),
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
  gateway_enabled: true,
};

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
  exam_subject_name?: string;
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
  entitlements: EntitlementRecord[];
}

export interface BillingCatalog {
  settings: Pick<BillingSettingsRecord, 'charge_type' | 'charge_value' | 'charge_label' | 'checkout_note' | 'gateway_enabled'>;
  packages: AccessPackageRecord[];
  access: MyAccessSummary;
}
