/**
 * Shared constants — import from @ibas/shared-constants in api and web.
 * Schema v3.2
 */

export const USER_TYPES = ['system_admin', 'admin', 'applicant', 'officer'] as const;
export type UserType = (typeof USER_TYPES)[number];

export const USER_STATUSES = ['active', 'inactive', 'suspended', 'pending_verify'] as const;

export const WORKFLOW_ROLE_CODES = ['SDO', 'DDO', 'AO', 'FD', 'ADMIN', 'SYSTEM'] as const;
export type WorkflowRoleCode = (typeof WORKFLOW_ROLE_CODES)[number];

export const MODULE_CODES = [
  'USER',
  'SETUP',
  'BOOKS',
  'QUESTIONS',
  'EXAM',
  'SYLLABUS',
  'WORKFLOW',
  'PAPER',
  'CANDIDATE',
  'AUDIT',
  'OCR',
  'PENSION',
] as const;
export type ModuleCode = (typeof MODULE_CODES)[number];

export const DEFAULT_LOCALE = 'en' as const;
export const SUPPORTED_LOCALES = ['en', 'bn'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const TASK_RUN_STATUSES = ['in_progress', 'completed', 'rejected', 'cancelled'] as const;

export const STEP_ACTIONS = ['submit', 'approve', 'reject', 'return', 'skip'] as const;

export const WORKFLOW_FIELD_TYPES = ['text', 'number', 'select', 'date', 'otp', 'file'] as const;

export const BOOK_LANGUAGES = ['en', 'bn', 'both'] as const;
export type BookLanguage = (typeof BOOK_LANGUAGES)[number];

export const REGULATION_TYPES = ['rule', 'circular', 'sro', 'act_section', 'order'] as const;
export type RegulationType = (typeof REGULATION_TYPES)[number];

export const BOOK_NODE_TYPES = ['part', 'chapter', 'topic', 'sub_topic'] as const;
export type BookNodeType = (typeof BOOK_NODE_TYPES)[number];

export const QUESTION_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

/** Standard question type codes (seeded in question_types collection). */
export const QUESTION_TYPE_CODES = ['MCQ', 'TF', 'DESCRIPTIVE', 'SHORT_NOTE'] as const;
export type QuestionTypeCode = (typeof QUESTION_TYPE_CODES)[number];

export const QUESTION_LINK_LEVELS = ['chapter', 'rule', 'sub_rule'] as const;
export type QuestionLinkLevel = (typeof QUESTION_LINK_LEVELS)[number];

export const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

export const AUTHORITY_TYPES = ['central', 'regional', 'departmental'] as const;
export type AuthorityType = (typeof AUTHORITY_TYPES)[number];

export const SYLLABUS_REF_LEVELS = ['book', 'chapter', 'rule', 'regulation'] as const;
export type SyllabusRefLevel = (typeof SYLLABUS_REF_LEVELS)[number];

/** Self-assessment levels for descriptive / short-note questions (progress index weights). */
export const SELF_RATING_LEVELS = ['overall', 'understand', 'confidence'] as const;
export type SelfRatingLevel = (typeof SELF_RATING_LEVELS)[number];

export const SELF_RATING_PROGRESS: Record<SelfRatingLevel, number> = {
  overall: 50,
  understand: 75,
  confidence: 100,
};

/** Question types scored from selected options. */
export const OBJECTIVE_QUESTION_TYPE_CODES = ['MCQ', 'TF'] as const;
export type ObjectiveQuestionTypeCode = (typeof OBJECTIVE_QUESTION_TYPE_CODES)[number];

/** How enjoyed leave affects service period (pension calculator). */
export const PENSION_LEAVE_DEDUCTION_RULES = [
  'leave_earning_only',
  'both',
  'none',
] as const;
export type PensionLeaveDeductionRule = (typeof PENSION_LEAVE_DEDUCTION_RULES)[number];

/** Leave account category for pension (÷11 vs ÷12 earning). */
export const PENSION_LEAVE_PAY_CATEGORIES = [
  'average_salary',
  'half_average_salary',
  'without_pay',
  'regular_working_period',
] as const;
export type PensionLeavePayCategory = (typeof PENSION_LEAVE_PAY_CATEGORIES)[number];

export const PENSION_DAYS_PER_MONTH = 30;
export const PENSION_DAYS_PER_YEAR = 360;
export const PENSION_LAMP_GRANT_MONTHS = 18;
export const PENSION_BASIC_SALARY_BONUS_RATE = 0.05;

/** REST leave — auto-entitlement (15 days per 3 years of service). */
export const PENSION_REST_LEAVE_CODE = 'REST';
export const PENSION_REST_DAYS_PER_CYCLE = 15;
export const PENSION_REST_CYCLE_YEARS = 3;
export const PENSION_REST_ALLOWANCE_BASIC_MONTHS = 1;

/** Maternity leave — days depend on start date vs rule change. */
export const PENSION_MATERNITY_LEAVE_CODE = 'MATERNITY';
/** Inclusive cutoff: start date before this → 120 days; on/after → 180 days. */
export const PENSION_MATERNITY_RULE_CHANGE_DATE = '2021-05-18';
export const PENSION_MATERNITY_DAYS_BEFORE_RULE = 120;
export const PENSION_MATERNITY_DAYS_FROM_RULE = 180;
