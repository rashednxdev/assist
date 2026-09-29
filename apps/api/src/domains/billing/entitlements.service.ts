import {
  BASIC_MODULE_CODES,
  EXAM_PREP_MODULE_CODES,
  moduleAccessGroup,
  type ModuleAccessGroup,
} from '@ibas/shared-constants';
import { IbasArea } from '../policy/models/IbasArea.model.js';
import { UserEntitlement } from './models/UserEntitlement.model.js';

/** Active package access for one user, loaded once per request. */
export interface EntitlementSnapshot {
  /** Latest end of an active entitlement per module group. */
  groups: Partial<Record<ModuleAccessGroup, Date>>;
  /** Live package id → latest end. */
  live: Map<string, Date>;
}

const AREA_CACHE_MS = 60_000;
let areaCache: { at: number; codes: string[] } | null = null;

/** Admin-created iBAS++ area codes (they belong to the Basic Module even without an IBAS_ prefix). */
export async function areaModuleCodes(): Promise<string[]> {
  if (areaCache && Date.now() - areaCache.at < AREA_CACHE_MS) return areaCache.codes;
  const rows = await IbasArea.find().select('code legacy_codes').lean();
  const codes = [...new Set(rows.flatMap((r) => [r.code, ...((r as { legacy_codes?: string[] }).legacy_codes ?? [])]))];
  areaCache = { at: Date.now(), codes };
  return codes;
}

export async function groupOf(code: string): Promise<ModuleAccessGroup | null> {
  return moduleAccessGroup(code, await areaModuleCodes());
}

/** Module codes a group opens (used to expose package access as read grants on /auth/me). */
export async function codesInGroup(group: ModuleAccessGroup): Promise<string[]> {
  if (group === 'exam_prep') return [...EXAM_PREP_MODULE_CODES];
  return [...new Set([...BASIC_MODULE_CODES, ...(await areaModuleCodes())])];
}

export async function loadEntitlementSnapshot(userId: string, now = new Date()): Promise<EntitlementSnapshot> {
  const rows = await UserEntitlement.find({
    user_id: userId,
    is_revoked: false,
    starts_at: { $lte: now },
    ends_at: { $gt: now },
  })
    .select('kind package_id ends_at')
    .lean();
  const snap: EntitlementSnapshot = { groups: {}, live: new Map() };
  for (const r of rows) {
    if (r.kind === 'live') {
      const key = String(r.package_id);
      const prev = snap.live.get(key);
      if (!prev || r.ends_at > prev) snap.live.set(key, r.ends_at);
    } else {
      const prev = snap.groups[r.kind];
      if (!prev || r.ends_at > prev) snap.groups[r.kind] = r.ends_at;
    }
  }
  return snap;
}

/** True when an active package opens any of the given module codes. */
export function snapshotOpens(snap: EntitlementSnapshot, codes: string[], extraBasic: readonly string[]): boolean {
  return codes.some((c) => {
    const g = moduleAccessGroup(c, extraBasic);
    return !!g && !!snap.groups[g];
  });
}

/** True when any code belongs to a purchasable group (so "buy a package" is the way in). */
export function isPurchasable(codes: string[], extraBasic: readonly string[]): boolean {
  return codes.some((c) => moduleAccessGroup(c, extraBasic) !== null);
}

export async function hasPackageAccess(userId: string, codes: string[]): Promise<boolean> {
  const extra = await areaModuleCodes();
  if (!isPurchasable(codes, extra)) return false;
  return snapshotOpens(await loadEntitlementSnapshot(userId), codes, extra);
}
