import { EXAM_PREP_MODULE_CODES } from '@ibas/shared-constants';
import type { MeUser } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/capabilities';

/**
 * Codes that open the web Learning hub / Learning routes.
 * Salary is separate and always available to signed-in users.
 */
export const LEARNING_ACCESS_CODES = [
  ...EXAM_PREP_MODULE_CODES,
  'QOTD',
  'EXAM_ROUTINE',
  'LIVE_STREAM',
  'QUESTION_EDIT',
] as const;

export type LearningAccessCode = (typeof LEARNING_ACCESS_CODES)[number];

export const LEARNING_HOME = '/learning';
export const SALARY_HOME = '/salary';

/** Paths every signed-in user may open without Learning grant. */
const PUBLIC_SIGNED_IN_PREFIXES = ['/salary', '/settings', '/packages'] as const;

/** Learning product routes — require Learning grant (or platform admin / content staff). */
const LEARNING_ROUTE_PREFIXES = [
  '/learning',
  '/books',
  '/questions',
  '/exams',
  '/papers',
  '/qotd',
  '/exam-week',
  '/exam-routine',
  '/marathon',
  '/user-questions',
  '/live',
  '/live-room',
  '/progress',
  '/dashboard',
] as const;

function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isLearningAccessCode(code: string): boolean {
  return (LEARNING_ACCESS_CODES as readonly string[]).includes(code);
}

/**
 * Learning hub and Learning routes: platform admin, content staff, or an explicit
 * can_read grant / package entitlement on any Learning code.
 */
export function hasLearningWebAccess(
  user: Pick<MeUser, 'is_super_admin' | 'user_type' | 'module_access'> | null | undefined,
): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  const grants = user.module_access ?? [];
  return grants.some((g) => {
    if (!isLearningAccessCode(g.module_code)) return false;
    if (g.can_create || g.can_update || g.can_delete || g.can_publish || g.can_grade) return true;
    return g.can_read === true;
  });
}

/** Signed-in user with Salary only (no Learning grant). */
export function isSalaryOnlyUser(
  user: Pick<MeUser, 'is_super_admin' | 'user_type' | 'module_access'> | null | undefined,
): boolean {
  return !!user && !hasLearningWebAccess(user);
}

/** Host live nav/page: LIVE_STREAM create/update/publish, or platform admin. */
export function canHostLive(
  user: Pick<MeUser, 'is_super_admin' | 'user_type' | 'module_access'> | null | undefined,
): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  return (user.module_access ?? []).some(
    (g) => g.module_code === 'LIVE_STREAM' && (g.can_create || g.can_update || g.can_publish),
  );
}

export function homePathFor(
  user: Pick<MeUser, 'is_super_admin' | 'user_type' | 'module_access'> | null | undefined,
): string {
  return hasLearningWebAccess(user) ? LEARNING_HOME : SALARY_HOME;
}

export function isPublicSignedInPath(pathname: string): boolean {
  return PUBLIC_SIGNED_IN_PREFIXES.some((p) => pathMatches(pathname, p));
}

export function isLearningRoute(pathname: string): boolean {
  return LEARNING_ROUTE_PREFIXES.some((p) => pathMatches(pathname, p));
}

/** @deprecated Use isPublicSignedInPath */
export function salaryOnlyAllows(pathname: string): boolean {
  return isPublicSignedInPath(pathname);
}
