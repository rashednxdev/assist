import type { AccessPackageKind } from '@ibas/shared-constants';
import type { OrderStatus } from '@ibas/shared-types';

/** Local date, e.g. "29 Oct 2026". */
export function accessDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Local date and time, e.g. "29 Oct 2026, 10:30". */
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
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export const ORDER_STATUS_BADGE: Record<OrderStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  paid: 'success',
  pending: 'warning',
  failed: 'destructive',
  cancelled: 'secondary',
  expired: 'secondary',
};

export const PACKAGE_TABS: Array<{ id: AccessPackageKind; label: string; blurb: string }> = [
  {
    id: 'exam_prep',
    label: 'Exam Preparation',
    blurb: 'Books & Tools, Question Bank, Exam Programs, Exam Papers, Exams of the Week, User Questions and Answer PDFs.',
  },
  {
    id: 'basic',
    label: 'Basic Module',
    blurb: 'Circulars & Policy library, iBAS++ workspace, Checklists & templates, and Pension & Joining period.',
  },
  {
    id: 'live',
    label: 'Live class',
    blurb: 'Buy a package to join every class in it. You can own more than one package at a time.',
  },
];
