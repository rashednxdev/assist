import { isLearningPrivilegeModule } from '@ibas/shared-constants';
import type { MeUser } from './auth-api';

export function isPlatformAdminUser(user: Pick<MeUser, 'is_super_admin' | 'user_type'> | null | undefined): boolean {
  return !!user && (user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin');
}

/** Read access to any of the given platform modules (e.g. WORKFLOW, CIRCULARS); admins always pass. */
export function canReadAnyModule(user: MeUser | null | undefined, codes: string[]): boolean {
  if (!user) return false;
  if (isPlatformAdminUser(user)) return true;
  if (user.user_type === 'host' && codes.length > 0 && codes.every((code) => isLearningPrivilegeModule(code))) {
    return true;
  }
  return (user.module_access ?? []).some((g) => codes.includes(g.module_code) && g.can_read);
}
