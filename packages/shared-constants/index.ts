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
  'NOTICE',
  'QOTD',
  'EXAM_ROUTINE',
  'USER_QUESTIONS',
  'EXAM_WEEK',
] as const;
export type ModuleCode = (typeof MODULE_CODES)[number];

/** Modules every authenticated user may open without a grant or payment. */
export const FREE_MODULE_CODES = ['QOTD', 'EXAM_ROUTINE'] as const;
export type FreeModuleCode = (typeof FREE_MODULE_CODES)[number];

export function isFreeModuleCode(code: string): boolean {
  return (FREE_MODULE_CODES as readonly string[]).includes(code);
}

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
export const QUESTION_TYPE_CODES = ['MCQ', 'TF', 'DESCRIPTIVE', 'SHORT_NOTE', 'DIFFERENCES'] as const;
export type QuestionTypeCode = (typeof QUESTION_TYPE_CODES)[number];

export const QUESTION_LINK_LEVELS = ['chapter', 'rule', 'sub_rule'] as const;
export type QuestionLinkLevel = (typeof QUESTION_LINK_LEVELS)[number];

/**
 * Question review workflow: draft -> quality_check -> published, with published/quality_check
 * both able to fall back to an earlier stage (published -> quality_check, quality_check -> draft).
 */
export const QUESTION_REVIEW_STATUSES = ['draft', 'quality_check', 'published'] as const;
export type QuestionReviewStatus = (typeof QUESTION_REVIEW_STATUSES)[number];

/** Question Bank list sort options. */
export const QUESTION_SORT_OPTIONS = [
  'updated_desc',
  'updated_asc',
  'created_desc',
  'created_asc',
  'marks_desc',
  'marks_asc',
  'body_en_asc',
  'body_en_desc',
] as const;
export type QuestionSortOption = (typeof QUESTION_SORT_OPTIONS)[number];

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

/** PRL (Post-Retirement Leave) — starts on the 59th birthday under normal retirement. */
export const PENSION_PRL_START_AGE_YEARS = 59;
/** Standard PRL salary duration ("as if in service for 1 year"), in months. */
export const PENSION_PRL_STANDARD_MONTHS = 12;

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

/** Suspension — excluded from pensionable service unless regularized as duty (per-row override, not auto-entitlement). */
export const PENSION_SUSPENSION_LEAVE_CODE = 'SUSPENSION';
/** Unauthorized absence — always excluded from pensionable service. */
export const PENSION_UNAUTHORISED_LEAVE_CODE = 'UNAUTHORISEDLEAVE';

/** Pension & Gratuity (retirement benefit) — mandatory 50% surrender + monthly pension. */
export const PENSION_GRATUITY_MIN_QUALIFYING_YEARS = 5;

/** Pension rate (% of last basic salary) by completed qualifying years. Irregular by design — encode verbatim, do not "smooth". Sorted descending by min_years. */
export const PENSION_GRATUITY_RATE_TABLE: { min_years: number; rate_percent: number }[] = [
  { min_years: 25, rate_percent: 90 },
  { min_years: 24, rate_percent: 87 },
  { min_years: 23, rate_percent: 83 },
  { min_years: 22, rate_percent: 79 },
  { min_years: 21, rate_percent: 75 },
  { min_years: 20, rate_percent: 71 },
  { min_years: 19, rate_percent: 67 },
  { min_years: 18, rate_percent: 63 },
  { min_years: 17, rate_percent: 59 },
  { min_years: 16, rate_percent: 55 },
  { min_years: 15, rate_percent: 54 },
  { min_years: 14, rate_percent: 51 },
  { min_years: 13, rate_percent: 48 },
  { min_years: 12, rate_percent: 45 },
  { min_years: 11, rate_percent: 42 },
  { min_years: 10, rate_percent: 36 },
  { min_years: 9, rate_percent: 33 },
  { min_years: 8, rate_percent: 30 },
  { min_years: 7, rate_percent: 27 },
  { min_years: 6, rate_percent: 24 },
  { min_years: 5, rate_percent: 21 },
];

/** Gratuity multiplier (BDT paid per BDT 1 of surrendered pension) by qualifying-year band. Sorted descending by min_years. */
export const PENSION_GRATUITY_MULTIPLIER_TABLE: { min_years: number; multiplier: number }[] = [
  { min_years: 25, multiplier: 230 },
  { min_years: 20, multiplier: 240 },
  { min_years: 15, multiplier: 245 },
  { min_years: 10, multiplier: 260 },
  { min_years: 5, multiplier: 265 },
];

export const PENSION_MEDICAL_ALLOWANCE_AGE_THRESHOLD = 65;
export const PENSION_MEDICAL_ALLOWANCE_UNDER_65 = 1500;
export const PENSION_MEDICAL_ALLOWANCE_65_PLUS = 2500;
export const PENSION_MIN_MONTHLY_NET_PENSION = 3000;
export const PENSION_BAISHAKHI_ALLOWANCE_RATE = 0.2;
export const PENSION_FESTIVAL_ALLOWANCES_PER_YEAR = 2;

/** Joining period (যোগদানকাল) — transfer / posting rules. */
export const JOINING_SAME_STATION_DAYS = 1;
export const JOINING_PREPARATION_DAYS = 6;
export const JOINING_MAX_DAYS_INCLUDING_WEEKLY = 30;
export const JOINING_APPROACH_EXCLUDE_MILES = 5;
export const JOINING_APPROACH_EXCLUDE_KM = 8;

/** Travel day divisors (legacy distance method). */
export const JOINING_TRAVEL_PER_DAY = {
  rail: { miles: 250, km: 400 },
  sea: { miles: 200, km: 320 },
  river: { miles: 80, km: 128 },
  bus: { miles: 80, km: 128 },
  road: { miles: 15, km: 15 },
} as const;

export const JOINING_TRAVEL_MODES = ['rail', 'sea', 'river', 'bus', 'road', 'air'] as const;
export type JoiningTravelMode = (typeof JOINING_TRAVEL_MODES)[number];

export const JOINING_CALC_METHODS = ['distance', 'actual'] as const;
export type JoiningCalcMethod = (typeof JOINING_CALC_METHODS)[number];

export const JOINING_HANDOVER_TIMES = ['morning', 'afternoon', 'unspecified'] as const;
export type JoiningHandoverTime = (typeof JOINING_HANDOVER_TIMES)[number];

export const JOINING_WEEKLY_HOLIDAYS = ['friday', 'friday_saturday', 'sunday'] as const;
export type JoiningWeeklyHoliday = (typeof JOINING_WEEKLY_HOLIDAYS)[number];

/**
 * Short parenthetical list markers in book descriptions, e.g. (ক), (খ), (a), (1).
 * Content inside () must be 1–2 characters; longer phrases like (বেতন ও ভাতাদি) are ignored.
 *
 * A marker only counts when it has whitespace both before `(` and after `)`.
 * Examples that count: ` (ক) `, `; (খ) text`
 * Examples that skip: `—(ক) `, `(ক)text`, `word(ক) word`
 *
 * When a description has 2+ spaced short markers, each is shown on its own line (Enter).
 *
 * Note: avoid the `u` regex flag — Hermes has historically crashed on it.
 * Avoid a shared /g RegExp instance (mutable lastIndex) across calls.
 */
type TextMarker = { start: number; end: number; match: string };

function shortBracketRegex() {
  return /\(([^)\n\r]{1,2})\)/g;
}

/** Sequential letter/number markers ending with `.` or Bangla dari `।`, e.g. ক. খ. / a. b. / 1. 2. / ১। ২।
 * Letters: exactly 1 character (avoids Mr. / Dr.). Digits: 1–2 characters. */
function sequentialDotMarkerRegex() {
  return /(?:([0-9\u09E6-\u09EF]{1,2})|([a-zA-Z\u0985-\u09B9\u09CE\u09DC-\u09DF]))[.।]/g;
}

function isWhitespaceChar(ch: string | undefined): boolean {
  return Boolean(ch && /\s/.test(ch));
}

/** True when marker has whitespace immediately before and after (brackets). */
function hasSpaceBeforeAndAfter(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : undefined;
  const after = end < text.length ? text[end] : undefined;
  return isWhitespaceChar(before) && isWhitespaceChar(after);
}

/**
 * Dot/dari list markers: whitespace (or start) before the letter/number,
 * and whitespace (or end) after `.` / `।`.
 */
function hasDotMarkerBoundaries(text: string, start: number, end: number): boolean {
  const beforeOk = start === 0 || isWhitespaceChar(text[start - 1]);
  const afterOk = end >= text.length || isWhitespaceChar(text[end]);
  return beforeOk && afterOk;
}

function findSpacedShortBrackets(text: string): TextMarker[] {
  const re = shortBracketRegex();
  const found: TextMarker[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (!hasSpaceBeforeAndAfter(text, start, end)) continue;
    found.push({ start, end, match: m[0] });
  }
  return found;
}

function findSpacedSequentialDots(text: string): TextMarker[] {
  const re = sequentialDotMarkerRegex();
  const found: TextMarker[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (!hasDotMarkerBoundaries(text, start, end)) continue;
    found.push({ start, end, match: m[0] });
  }
  return found;
}

function insertMarkersAsLineBreaks(
  text: string,
  lineBreak: string,
  findMarkers: (plain: string) => TextMarker[],
): string {
  if (!text) return text;

  try {
    const parts = text.split(/(<[^>]+>)/g);
    const plainForCount = parts
      .filter((part) => !(part.startsWith('<') && part.endsWith('>')))
      .join('');
    if (findMarkers(plainForCount).length < 2) {
      return text;
    }

    return parts
      .map((part) => {
        if (part.startsWith('<') && part.endsWith('>')) return part;

        const markers = findMarkers(part);
        if (markers.length === 0) return part;

        let result = '';
        let cursor = 0;
        for (const marker of markers) {
          result += part.slice(cursor, marker.start);
          const before = part.slice(0, marker.start);
          const alreadyOnNewLine =
            before.length === 0 || /(?:\n|<br\s*\/?>)\s*$/i.test(before);
          if (!alreadyOnNewLine) {
            result += lineBreak;
          }
          result += marker.match;
          cursor = marker.end;
        }
        result += part.slice(cursor);
        return result;
      })
      .join('');
  } catch {
    return text;
  }
}

export function insertShortBracketLineBreaks(
  text: string,
  lineBreak: string = '\n',
): string {
  return insertMarkersAsLineBreaks(text, lineBreak, findSpacedShortBrackets);
}

/**
 * Sequential letter/number list markers ending with `.` or `।`, e.g. ক. খ. / a. b. / 1. 2.
 * Letters must be a single character; digits may be 1–2 characters (skips Mr. / সংজ্ঞা।).
 *
 * When a description has 2+ spaced markers, each is shown on its own line (Enter).
 */
export function insertSequentialDotLineBreaks(
  text: string,
  lineBreak: string = '\n',
): string {
  return insertMarkersAsLineBreaks(text, lineBreak, findSpacedSequentialDots);
}

/** Apply bracket then sequential-dot list line breaks (book body formatting). */
export function insertBookListMarkerLineBreaks(
  text: string,
  lineBreak: string = '\n',
): string {
  return insertSequentialDotLineBreaks(
    insertShortBracketLineBreaks(text, lineBreak),
    lineBreak,
  );
}
