import { isFreeModuleCode } from '@ibas/shared-constants';
import type { AuthUser } from './auth.js';
import { UserModuleAccess } from '../domains/users/models/UserModuleAccess.model.js';
import { Module } from '../domains/setup/models/Module.model.js';
import { User } from '../domains/users/models/User.model.js';
import {
  areaModuleCodes,
  isPurchasable,
  loadEntitlementSnapshot,
  snapshotOpens,
} from '../domains/billing/entitlements.service.js';

export type ModuleAccessState = 'open' | 'stopped' | 'unpaid' | 'denied';

export interface ModuleAccessChecker {
  isAdmin: boolean;
  /**
   * Same rules as requireModuleAccessAny, evaluated in memory: blocked only when every code is
   * stopped (unless bypassed), then free → paid → any read grant.
   */
  stateFor(codes: string[]): ModuleAccessState;
  /** Area-style check: the primary code alone decides "stopped"; any code's grant opens it. */
  stateForPrimary(primary: string, codes: string[]): ModuleAccessState;
  stoppedReason(code: string): string | undefined;
  canRead(codes: string[]): boolean;
}

function isAdminUser(user: AuthUser): boolean {
  return user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin';
}

/** Loads grants, stops and payment once so many module checks (search, workspace areas) stay cheap. */
export async function loadModuleAccessChecker(user: AuthUser): Promise<ModuleAccessChecker> {
  if (isAdminUser(user)) {
    return {
      isAdmin: true,
      stateFor: () => 'open',
      stateForPrimary: () => 'open',
      stoppedReason: () => undefined,
      canRead: () => true,
    };
  }

  const [grants, stoppedModules, dbUser, entitlements, extraBasic] = await Promise.all([
    UserModuleAccess.find({ user_id: user.id, is_active: true, can_read: true })
      .select('module_code bypass_stop')
      .lean(),
    Module.find({ is_active: false }).select('code stopped_reason').lean(),
    User.findById(user.id).select('amount_received').lean(),
    loadEntitlementSnapshot(user.id),
    areaModuleCodes(),
  ]);
  const stopped = new Map(stoppedModules.map((m) => [m.code, m.stopped_reason ?? '']));
  const paid = Number(dbUser?.amount_received ?? 0) > 0;
  const active = user.status === 'active';

  const bypassed = (codes: string[]) => grants.some((g) => codes.includes(g.module_code) && g.bypass_stop);
  const granted = (codes: string[]) => grants.some((g) => codes.includes(g.module_code));

  /** free → bought package → legacy (admin-marked paid + grant) → "unpaid" means buy a package. */
  function afterStop(codes: string[]): ModuleAccessState {
    if (codes.some((c) => isFreeModuleCode(c))) return 'open';
    if (snapshotOpens(entitlements, codes, extraBasic)) return 'open';
    if (paid && granted(codes)) return 'open';
    if (!paid || isPurchasable(codes, extraBasic)) return 'unpaid';
    return 'denied';
  }

  const checker: ModuleAccessChecker = {
    isAdmin: false,
    stateFor(codes) {
      if (!active) return 'denied';
      if (codes.length > 0 && codes.every((c) => stopped.has(c)) && !bypassed(codes)) return 'stopped';
      return afterStop(codes);
    },
    stateForPrimary(primary, codes) {
      if (!active) return 'denied';
      if (stopped.has(primary) && !bypassed([primary])) return 'stopped';
      return afterStop(codes);
    },
    stoppedReason: (code) => stopped.get(code) || undefined,
    canRead: (codes) => checker.stateFor(codes) === 'open',
  };
  return checker;
}
