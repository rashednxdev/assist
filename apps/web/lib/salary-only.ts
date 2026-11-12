/**
 * Compatibility re-exports. Prefer `@/lib/learning-access`.
 * Salary is always available; Learning opens only after admin/package grant.
 */
export {
  SALARY_HOME,
  LEARNING_HOME,
  hasLearningWebAccess,
  isSalaryOnlyUser,
  salaryOnlyAllows,
  homePathFor,
  canHostLive,
} from '@/lib/learning-access';
