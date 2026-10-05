import type { MeUser } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/capabilities';

/** Temporary: ordinary web users see only the salary page. Set false to restore all modules. */
export const WEB_USERS_SALARY_ONLY = true;

export const SALARY_HOME = '/salary';

const SALARY_ONLY_PATHS = ['/salary'];

/** Admins and staff with any management grant keep every module. */
export function isSalaryOnlyUser(user: Pick<MeUser, 'is_super_admin' | 'user_type' | 'module_access'> | null): boolean {
  if (!WEB_USERS_SALARY_ONLY || !user || isPlatformAdmin(user)) return false;
  const staff = (user.module_access ?? []).some(
    (g) => g.can_create || g.can_update || g.can_delete || g.can_publish || g.can_grade,
  );
  return !staff;
}

export function salaryOnlyAllows(pathname: string): boolean {
  return SALARY_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function homePathFor(user: Pick<MeUser, 'is_super_admin' | 'user_type' | 'module_access'> | null): string {
  return isSalaryOnlyUser(user) ? SALARY_HOME : '/dashboard';
}
