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
