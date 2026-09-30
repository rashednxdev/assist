import type { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import type {
  CommunityAnswerRecord,
  CommunityAuthor,
  CommunityCategoryRecord,
  CommunityFilter,
  CommunityLinkKind,
  CommunityLinkRecord,
  CommunityLinkType,
  CommunityOverview,
  CommunityReportReason,
  CommunitySort,
  CommunityThreadDetail,
  CommunityThreadSummary,
} from '@ibas/shared-types';
import { apiFetch } from './api';
import type { Page } from './contacts-api';
import type { MeUser } from './auth-api';

export interface ThreadQuery {
  q?: string;
  category?: string;
  tag?: string;
  link_type?: CommunityLinkType | '';
  sort?: CommunitySort;
  filter?: CommunityFilter;
  page?: number;
  limit?: number;
}

export interface ThreadPayload {
  title: string;
  body: string;
  category_id: string;
  tags: string[];
  links: Array<{ type: CommunityLinkType; id: string }>;
}

type Vote = { voted: boolean; vote_score: number };

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function threadHref(id: string): Href {
  return `/(app)/community/${id}` as Href;
}

export const linkRefs = (links: CommunityLinkRecord[]) => links.map((l) => ({ type: l.type, id: l.id }));

export async function fetchOverview(): Promise<CommunityOverview> {
  const r = await apiFetch<{ data: CommunityOverview }>('/community/overview');
  return r.data;
}

export async function fetchCategories(): Promise<CommunityCategoryRecord[]> {
  const r = await apiFetch<{ data: CommunityCategoryRecord[] }>('/community/categories');
  return r.data;
}

export function fetchThreads(query: ThreadQuery) {
  return apiFetch<Page<CommunityThreadSummary>>(`/community/threads${qs({ ...query })}`);
}

export async function fetchThread(id: string, countView = true): Promise<CommunityThreadDetail> {
  const r = await apiFetch<{ data: CommunityThreadDetail }>(`/community/threads/${id}${countView ? '' : '?view=false'}`);
  return r.data;
}

export async function createThread(body: ThreadPayload): Promise<CommunityThreadDetail> {
  const r = await apiFetch<{ data: CommunityThreadDetail }>('/community/threads', { method: 'POST', body: JSON.stringify(body) });
  return r.data;
}

export async function updateThread(id: string, body: ThreadPayload): Promise<CommunityThreadDetail> {
  const r = await apiFetch<{ data: CommunityThreadDetail }>(`/community/threads/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  return r.data;
}

export async function deleteThread(id: string): Promise<void> {
  await apiFetch(`/community/threads/${id}`, { method: 'DELETE' });
}

export async function voteThread(id: string): Promise<Vote> {
  const r = await apiFetch<{ data: Vote }>(`/community/threads/${id}/vote`, { method: 'POST' });
  return r.data;
}

export async function followThread(id: string): Promise<{ following: boolean; follower_count: number }> {
  const r = await apiFetch<{ data: { following: boolean; follower_count: number } }>(`/community/threads/${id}/follow`, { method: 'POST' });
  return r.data;
}

export async function acceptAnswer(threadId: string, answerId: string | null): Promise<void> {
  await apiFetch(`/community/threads/${threadId}/accept`, { method: 'POST', body: JSON.stringify({ answer_id: answerId }) });
}

export async function createAnswer(threadId: string, body: string, links: CommunityLinkRecord[]): Promise<CommunityAnswerRecord> {
  const r = await apiFetch<{ data: CommunityAnswerRecord }>(`/community/threads/${threadId}/answers`, {
    method: 'POST',
    body: JSON.stringify({ body, links: linkRefs(links) }),
  });
  return r.data;
}

export async function updateAnswer(id: string, body: string, links: CommunityLinkRecord[]): Promise<CommunityAnswerRecord> {
  const r = await apiFetch<{ data: CommunityAnswerRecord }>(`/community/answers/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ body, links: linkRefs(links) }),
  });
  return r.data;
}

export async function deleteAnswer(id: string): Promise<void> {
  await apiFetch(`/community/answers/${id}`, { method: 'DELETE' });
}

export async function voteAnswer(id: string): Promise<Vote> {
  const r = await apiFetch<{ data: Vote }>(`/community/answers/${id}/vote`, { method: 'POST' });
  return r.data;
}

export async function reportContent(body: { target_type: 'thread' | 'answer'; target_id: string; reason: CommunityReportReason; note: string }) {
  await apiFetch('/community/reports', { method: 'POST', body: JSON.stringify(body) });
}

export async function moderateThread(
  id: string,
  patch: { is_hidden?: boolean; is_locked?: boolean; is_pinned?: boolean; category_id?: string },
): Promise<CommunityThreadDetail> {
  const r = await apiFetch<{ data: CommunityThreadDetail }>(`/community/admin/threads/${id}/moderate`, {
    method: 'POST',
    body: JSON.stringify(patch),
  });
  return r.data;
}

export async function moderateAnswer(id: string, isHidden: boolean): Promise<void> {
  await apiFetch(`/community/admin/answers/${id}/moderate`, { method: 'POST', body: JSON.stringify({ is_hidden: isHidden }) });
}

export async function fetchLinkOptions(q: string, kind: CommunityLinkKind | ''): Promise<CommunityLinkRecord[]> {
  const r = await apiFetch<{ data: CommunityLinkRecord[] }>(`/community/link-options${qs({ q, kind })}`);
  return r.data;
}

export function isPlatformAdmin(user: Pick<MeUser, 'is_super_admin' | 'user_type'> | null): boolean {
  return !!user && (user.is_super_admin || user.user_type === 'admin');
}

/** Tagged items live on the website; open them there. */
export function webUrl(href: string): string {
  const base = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://ibas-web.onrender.com').trim().replace(/\/+$/, '');
  return `${base}${href.startsWith('/') ? href : `/${href}`}`;
}

/** "just now", "5m ago", "3h ago", "2d ago", then a short date. */
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

/** "Designation, Office" — short forms when `short` and available. */
export function authorWork(a: CommunityAuthor, short = false): string {
  const d = short ? a.designation_short || a.designation : a.designation;
  const o = short ? a.office_short || a.office : a.office;
  return [d, o].filter(Boolean).join(', ');
}

export const LINK_KIND_STYLE: Record<CommunityLinkKind, { icon: keyof typeof Ionicons.glyphMap; bg: string; border: string; fg: string }> = {
  workflow: { icon: 'git-branch-outline', bg: '#eff6ff', border: '#bfdbfe', fg: '#1e40af' },
  checklist: { icon: 'checkbox-outline', bg: '#ecfdf5', border: '#a7f3d0', fg: '#065f46' },
  template: { icon: 'document-text-outline', bg: '#f5f3ff', border: '#ddd6fe', fg: '#5b21b6' },
  guide: { icon: 'book-outline', bg: '#f0f9ff', border: '#bae6fd', fg: '#075985' },
  circular: { icon: 'archive-outline', bg: '#fffbeb', border: '#fde68a', fg: '#78350f' },
};

export const LINK_KIND_ORDER: CommunityLinkKind[] = ['workflow', 'checklist', 'template', 'guide', 'circular'];
