import { Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { Href } from 'expo-router';
import { TOOLKIT_CATEGORIES } from '@ibas/shared-constants';
import type { CircularRecord, IbasAreaDetail, IbasAreaSummary, ToolkitItemDetail, ToolkitResolvedRef } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api';
import { webUrl } from '@/lib/web-href';
import type { TopicDetail } from '@/types/books';

export async function fetchIbasAreas(): Promise<IbasAreaSummary[]> {
  const r = await apiFetch<{ data: IbasAreaSummary[] }>('/ibas/areas');
  return r.data;
}

export async function fetchIbasArea(code: string): Promise<IbasAreaDetail> {
  const r = await apiFetch<{ data: IbasAreaDetail }>(`/ibas/areas/${encodeURIComponent(code)}`);
  return r.data;
}

export interface AreaRuleDetail extends Omit<TopicDetail, 'regulations'> {
  book_id: string;
  source: string;
  regulations: Array<{ id: string; regulation_no: string; title: string; full_text?: string; is_amended?: boolean }>;
}

export async function fetchAreaRule(code: string, topicId: string): Promise<AreaRuleDetail> {
  const r = await apiFetch<{ data: AreaRuleDetail }>(`/ibas/areas/${encodeURIComponent(code)}/rules/${topicId}`);
  return r.data;
}

export async function fetchAreaCircular(code: string, id: string): Promise<CircularRecord> {
  const r = await apiFetch<{ data: CircularRecord }>(`/ibas/areas/${encodeURIComponent(code)}/circulars/${id}`);
  return r.data;
}

export async function fetchToolkitItem(id: string): Promise<ToolkitItemDetail> {
  const r = await apiFetch<{ data: ToolkitItemDetail }>(`/toolkit/${id}`);
  return r.data;
}

export interface ProcessStep {
  id: string;
  step_number: number;
  title_en: string;
  title_bn?: string;
  description_en: string;
  role_code: string;
  role_name_en?: string;
  condition_text?: string | null;
  handoff_msg?: string | null;
  handoff_role?: string | null;
  is_auto?: boolean;
  is_optional?: boolean;
  fields: Array<{ name: string; label: string; type: string; required?: boolean }>;
}

export interface ProcessDetail {
  task: {
    id: string;
    name_en: string;
    name_bn?: string;
    description_en: string;
    module_name_en: string;
    total_steps: number;
    roles_involved: string[];
    estimated_time?: number;
  };
  steps: ProcessStep[];
}

export async function fetchProcess(id: string): Promise<ProcessDetail> {
  const r = await apiFetch<{ data: ProcessDetail }>(`/workflow/tasks/${id}`);
  return r.data;
}

export interface RunField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  hint?: string;
  options?: string[];
}

export type RunStatus = 'in_progress' | 'completed' | 'rejected' | 'cancelled';

export interface RunSummary {
  id: string;
  task_id: string;
  task_name_en: string;
  current_step: number;
  current_role: string;
  status: RunStatus;
  started_at: string;
  completed_at?: string;
  last_activity_at: string;
  rejection_reason?: string;
  fiscal_year?: string;
  month?: string;
  reference_no?: string;
}

export interface RunDetail {
  run: RunSummary;
  steps: Array<{
    id: string;
    step_number: number;
    title_en: string;
    description_en: string;
    role_code: string;
    role_name_en?: string;
    fields: RunField[];
    condition_text?: string;
    handoff_msg?: string;
    is_optional?: boolean;
    is_auto?: boolean;
  }>;
  responses: Array<{
    id: string;
    step_number: number;
    role_code: string;
    action: string;
    field_responses?: Record<string, unknown>;
    remarks?: string;
    performed_at: string;
  }>;
  current_step: {
    step_number: number;
    title_en: string;
    description_en: string;
    role_code: string;
    fields: RunField[];
    handoff_msg?: string;
    condition_text?: string;
  } | null;
  can_act: boolean;
  can_reject?: boolean;
  can_cancel?: boolean;
}

/** Same rule as the server: the first step's office role (or super admin) starts a run. */
export function canStartProcess(user: { is_super_admin?: boolean; workflow_roles?: Array<{ role_code: string; is_active: boolean }> } | null, steps: ProcessStep[]): boolean {
  if (!user || steps.length === 0) return false;
  if (user.is_super_admin) return true;
  const first = steps[0]!.role_code;
  return (user.workflow_roles ?? []).some((r) => r.is_active && r.role_code === first);
}

export async function startProcessRun(taskId: string, body: { fiscal_year: string; month?: string; reference_no?: string }): Promise<RunDetail> {
  const r = await apiFetch<{ data: RunDetail }>(`/workflow/tasks/${taskId}/runs`, { method: 'POST', body: JSON.stringify(body) });
  return r.data;
}

export async function fetchRun(runId: string): Promise<RunDetail> {
  const r = await apiFetch<{ data: RunDetail }>(`/workflow/runs/${runId}`);
  return r.data;
}

export async function respondRunStep(
  runId: string,
  stepNumber: number,
  body: { action: 'submit' | 'reject'; field_responses?: Record<string, string>; remarks?: string },
): Promise<RunDetail> {
  const r = await apiFetch<{ data: RunDetail }>(`/workflow/runs/${runId}/steps/${stepNumber}/respond`, { method: 'POST', body: JSON.stringify(body) });
  return r.data;
}

export async function cancelProcessRun(runId: string, reason?: string): Promise<RunDetail> {
  const r = await apiFetch<{ data: RunDetail }>(`/workflow/runs/${runId}/cancel`, { method: 'POST', body: JSON.stringify({ reason: reason || undefined }) });
  return r.data;
}

export async function fetchMyRuns(): Promise<RunSummary[]> {
  const r = await apiFetch<{ data: RunSummary[] }>('/workflow/runs/mine');
  return r.data;
}

export const RUN_STATUS: Record<RunStatus, { label: string; color: string }> = {
  in_progress: { label: 'In progress', color: '#0369a1' },
  completed: { label: 'Completed', color: '#059669' },
  rejected: { label: 'Rejected', color: '#dc2626' },
  cancelled: { label: 'Cancelled', color: '#64748b' },
};

/** Bangladesh fiscal year runs July–June, e.g. "2025-26". */
export function currentFiscalYear(now = new Date()): string {
  const y = now.getFullYear();
  const start = now.getMonth() >= 6 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

let roleColors: Promise<Record<string, string>> | null = null;

export function fetchRoleColors(): Promise<Record<string, string>> {
  roleColors ??= apiFetch<{ data: Array<{ code: string; color: string }> }>('/workflow/roles')
    .then((r) => Object.fromEntries(r.data.map((x) => [x.code, x.color])))
    .catch(() => {
      roleColors = null;
      return {};
    });
  return roleColors;
}

const categoryLabels = new Map<string, string>(TOOLKIT_CATEGORIES.map((c) => [c.code, c.label]));
export const toolkitCategoryLabel = (code: string) => categoryLabels.get(code) ?? code;

type AreaScreen = 'process' | 'run' | 'kit' | 'rule' | 'book' | 'circular';

export function areaHref(code: string, screen: AreaScreen, id: string, query?: string): Href {
  return `/(app)/ibas/${code}/${screen}/${id}${query ? `?${query}` : ''}` as Href;
}

/** Where a toolkit reference opens inside the area. */
export function refHref(code: string, ref: ToolkitResolvedRef): Href {
  if (ref.target_type === 'book_topic') return areaHref(code, 'rule', ref.target_id);
  if (ref.target_type === 'book') return areaHref(code, 'book', ref.target_id);
  return areaHref(code, 'circular', ref.target_id);
}

/** PDFs and outside documents open in the browser or a viewer app. */
export function openFileLink(url: string): void {
  void Linking.openURL(webUrl(url));
}

const LOCAL_DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}ibas-workspace/` : null;

function localPath(name: string): string | null {
  return LOCAL_DIR ? `${LOCAL_DIR}${name.replace(/[^\w.-]+/g, '_')}.json` : null;
}

/** Checklist ticks and template drafts, kept on this phone only. */
export async function loadLocalDraft<T>(name: string): Promise<T | null> {
  const path = localPath(name);
  if (!path) return null;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    return JSON.parse(await FileSystem.readAsStringAsync(path)) as T;
  } catch {
    return null;
  }
}

export async function saveLocalDraft(name: string, value: unknown): Promise<void> {
  const path = localPath(name);
  if (!path || !LOCAL_DIR) return;
  try {
    await FileSystem.makeDirectoryAsync(LOCAL_DIR, { intermediates: true }).catch(() => undefined);
    await FileSystem.writeAsStringAsync(path, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}
