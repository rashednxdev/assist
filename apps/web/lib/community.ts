import { Archive, BookOpenCheck, ClipboardCheck, FileSignature, Route } from 'lucide-react';
import type { CommunityLinkKind } from '@ibas/shared-types';

/** "just now", "5m", "3h", "2d", then a short date. */
export function timeAgo(iso: string): string {
  const d = new Date(iso);
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

export const LINK_KIND_STYLE: Record<CommunityLinkKind, { icon: typeof Route; className: string }> = {
  workflow: { icon: Route, className: 'border-blue-200 bg-blue-50 text-blue-800' },
  checklist: { icon: ClipboardCheck, className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  template: { icon: FileSignature, className: 'border-violet-200 bg-violet-50 text-violet-800' },
  guide: { icon: BookOpenCheck, className: 'border-sky-200 bg-sky-50 text-sky-800' },
  circular: { icon: Archive, className: 'border-amber-200 bg-amber-50 text-amber-900' },
};

export const LINK_KIND_ORDER: CommunityLinkKind[] = ['workflow', 'checklist', 'template', 'guide', 'circular'];
