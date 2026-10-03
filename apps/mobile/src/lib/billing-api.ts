import type { Href } from 'expo-router';
import type { AccessPackageKind } from '@ibas/shared-constants';
import type {
  AccessPackageRecord,
  BillingCatalog,
  CartRecord,
  EntitlementRecord,
  ExamPrepPartsResponse,
  MyAccessSummary,
  OrderStatus,
  PaymentOrderRecord,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api';

export const BKASH = '#e2136e';
const DAY_MS = 86_400_000;

export async function fetchCatalog(): Promise<BillingCatalog> {
  return (await apiFetch<{ data: BillingCatalog }>('/billing/catalog')).data;
}

export async function fetchMyAccess(): Promise<MyAccessSummary> {
  return (await apiFetch<{ data: MyAccessSummary }>('/billing/my-access')).data;
}

export async function fetchMyOrders(): Promise<PaymentOrderRecord[]> {
  return (await apiFetch<{ data: PaymentOrderRecord[] }>('/billing/orders')).data;
}

export async function createOrder(packageId: string): Promise<PaymentOrderRecord> {
  return (
    await apiFetch<{ data: PaymentOrderRecord }>('/billing/orders', {
      method: 'POST',
      body: JSON.stringify({ package_id: packageId }),
    })
  ).data;
}

export async function fetchOrder(id: string): Promise<PaymentOrderRecord> {
  return (await apiFetch<{ data: PaymentOrderRecord }>(`/billing/orders/${id}`)).data;
}

export async function payOrder(
  id: string,
  body: { msisdn: string; otp: string; pin: string; simulate_failure?: boolean },
): Promise<PaymentOrderRecord> {
  return (
    await apiFetch<{ data: PaymentOrderRecord }>(`/billing/orders/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  ).data;
}

export async function cancelOrder(id: string): Promise<void> {
  await apiFetch(`/billing/orders/${id}/cancel`, { method: 'POST' });
}

export async function createCart(packageIds: string[]): Promise<CartRecord> {
  return (
    await apiFetch<{ data: CartRecord }>('/billing/carts', {
      method: 'POST',
      body: JSON.stringify({ package_ids: packageIds }),
    })
  ).data;
}

export async function fetchCart(cartId: string): Promise<CartRecord> {
  return (await apiFetch<{ data: CartRecord }>(`/billing/carts/${cartId}`)).data;
}

export async function payCart(
  cartId: string,
  body: { msisdn: string; otp: string; pin: string; simulate_failure?: boolean },
): Promise<CartRecord> {
  return (
    await apiFetch<{ data: CartRecord }>(`/billing/carts/${cartId}/pay`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  ).data;
}

export async function cancelCart(cartId: string): Promise<void> {
  await apiFetch(`/billing/carts/${cartId}/cancel`, { method: 'POST' });
}

export async function fetchExamPrepParts(): Promise<ExamPrepPartsResponse> {
  return (await apiFetch<{ data: ExamPrepPartsResponse }>('/exam-prep/parts')).data;
}

export async function selectExamPrepPart(partId: string): Promise<ExamPrepPartsResponse> {
  return (
    await apiFetch<{ data: ExamPrepPartsResponse }>('/exam-prep/part', {
      method: 'PUT',
      body: JSON.stringify({ exam_part_id: partId }),
    })
  ).data;
}

export const PACKAGE_TABS: Array<{
  id: AccessPackageKind;
  label: string;
  blurb: string;
  icon: 'school-outline' | 'briefcase-outline' | 'videocam-outline';
}> = [
  {
    id: 'exam_prep',
    label: 'Exam Preparation',
    blurb: 'Books & Tools, Question Bank, Exam Programs, Exam Papers, Exams of the Week, User Questions and Answer PDFs.',
    icon: 'school-outline',
  },
  {
    id: 'basic',
    label: 'Basic Module',
    blurb: 'Circulars & Policy library, iBAS++ workspace, Checklists & templates, and Pension & Joining period.',
    icon: 'briefcase-outline',
  },
  {
    id: 'live',
    label: 'Live class',
    blurb: 'Buy a package to join every class in it. You can own more than one package at a time.',
    icon: 'videocam-outline',
  },
];

export function isPackageKind(v: unknown): v is AccessPackageKind {
  return v === 'exam_prep' || v === 'basic' || v === 'live';
}

/** Where to go once a package of this kind is bought. */
export const OPEN_AFTER_PURCHASE: Record<AccessPackageKind, { href: Href; label: string }> = {
  exam_prep: { href: '/(app)/home' as Href, label: 'Start learning' },
  basic: { href: '/(app)/ibas' as Href, label: 'Open iBAS++ workspace' },
  live: { href: '/(app)/zoom' as Href, label: 'Go to live classes' },
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  paid: '#059669',
  pending: '#d97706',
  failed: '#dc2626',
  cancelled: '#64748b',
  expired: '#64748b',
};

export const ENTITLEMENT_STATUS_COLOR: Record<EntitlementRecord['status'], string> = {
  active: '#059669',
  upcoming: '#d97706',
  expired: '#64748b',
  revoked: '#dc2626',
};

/** e.g. "29 Oct 2026". */
export function accessDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** e.g. "29 Oct 2026, 10:30". */
export function accessDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${accessDate(iso)}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export function durationLabel(days: number): string {
  if (days % 365 === 0) return days === 365 ? '1 year' : `${days / 365} years`;
  if (days % 30 === 0) return days === 30 ? '1 month' : `${days / 30} months`;
  if (days % 7 === 0) return days === 7 ? '1 week' : `${days / 7} weeks`;
  return days === 1 ? '1 day' : `${days} days`;
}

export function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS));
}

/** When the user's current access of the same kind (same package for live) ends. */
export function currentUntil(catalog: BillingCatalog, pkg: AccessPackageRecord): string | undefined {
  if (pkg.kind === 'exam_prep') return catalog.access.exam_prep_until;
  if (pkg.kind === 'basic') return catalog.access.basic_until;
  return catalog.access.live_packages.find((p) => p.package_id === pkg.id)?.until;
}

/** Access window a new purchase would open: it starts when the current access ends. */
export function purchaseWindow(catalog: BillingCatalog, pkg: AccessPackageRecord): { start: Date; end: Date; extends: boolean } {
  const until = currentUntil(catalog, pkg);
  const extendsCurrent = !!until && new Date(until).getTime() > Date.now();
  const start = extendsCurrent ? new Date(until) : new Date();
  return { start, end: new Date(start.getTime() + pkg.duration_days * DAY_MS), extends: extendsCurrent };
}
