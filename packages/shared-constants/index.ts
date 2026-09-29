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
  'QUESTION_EDIT',
  'ANSWER_PDF',
  'LIVE_STREAM',
  'SALARY',
  'CIRCULARS',
  'IBAS_BUDGET',
  'IBAS_BILL',
  'IBAS_PERSONAL',
  'IBAS_TAX',
  'IBAS_ACCOUNTS',
  'IBAS_PREAUDIT',
  'IBAS_AUDIT',
  'IBAS_PENSION',
] as const;
export type ModuleCode = (typeof MODULE_CODES)[number];

/** Modules every authenticated user may open without a grant or payment. */
export const FREE_MODULE_CODES = ['QOTD', 'EXAM_ROUTINE', 'LIVE_STREAM'] as const;
export type FreeModuleCode = (typeof FREE_MODULE_CODES)[number];

export function isFreeModuleCode(code: string): boolean {
  return (FREE_MODULE_CODES as readonly string[]).includes(code);
}

/** Opened by an Exam Preparation package (the mobile learning modules, without live class). */
export const EXAM_PREP_MODULE_CODES = [
  'BOOKS',
  'QUESTIONS',
  'EXAM',
  'PAPER',
  'EXAM_WEEK',
  'USER_QUESTIONS',
  'ANSWER_PDF',
] as const;

/**
 * Opened by a Basic Module plan: office tools and references. iBAS++ areas (any `IBAS_*` code or
 * admin-created area) and their legacy office codes also belong here.
 */
export const BASIC_MODULE_CODES = [
  'CIRCULARS',
  'PENSION',
  'OCR',
  'BUDGET_PREP',
  'BUDGET_EXEC',
  'ACCOUNTING',
  'GL',
  'BILL',
  'REPORTING',
  'HR',
  'ESERVICE',
] as const;

export const ACCESS_PACKAGE_KINDS = ['exam_prep', 'basic', 'live'] as const;
export type AccessPackageKind = (typeof ACCESS_PACKAGE_KINDS)[number];
/** Package kinds that open whole modules (live packages open individual classes instead). */
export type ModuleAccessGroup = Exclude<AccessPackageKind, 'live'>;

/** Which package opens a module; null for free and admin-only modules (grants only). */
export function moduleAccessGroup(code: string, extraBasicCodes: readonly string[] = []): ModuleAccessGroup | null {
  if ((EXAM_PREP_MODULE_CODES as readonly string[]).includes(code)) return 'exam_prep';
  if ((BASIC_MODULE_CODES as readonly string[]).includes(code) || code.startsWith('IBAS_') || extraBasicCodes.includes(code)) {
    return 'basic';
  }
  return null;
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
export const QUESTION_TYPE_CODES = [
  'MCQ',
  'TF',
  'DESCRIPTIVE',
  'SHORT_NOTE',
  'DIFFERENCES',
  'TRANSLATION',
  'SUMMARY',
  'DRAFTING',
  'CALCULATION',
] as const;
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

/**
 * Strip paired `*bold*` markers for list-marker scanning only.
 * `toOriginal[i]` is the index in the source string for `plain[i]`.
 * Keeps number/bullet/( )/। newline rules working inside bold spans.
 */
function unwrapBoldMarkers(text: string): { plain: string; toOriginal: number[] } {
  const chars: string[] = [];
  const toOriginal: number[] = [];
  let i = 0;
  while (i < text.length) {
    if (text.charAt(i) === '*') {
      let j = i + 1;
      while (j < text.length && text.charAt(j) !== '*') j += 1;
      if (j < text.length && j > i + 1) {
        for (let k = i + 1; k < j; k += 1) {
          chars.push(text.charAt(k));
          toOriginal.push(k);
        }
        i = j + 1;
        continue;
      }
    }
    chars.push(text.charAt(i));
    toOriginal.push(i);
    i += 1;
  }
  return { plain: chars.join(''), toOriginal };
}

function mapMarkersToOriginal(
  text: string,
  toOriginal: number[],
  markers: TextMarker[],
): TextMarker[] {
  return markers.map((m) => {
    const start = toOriginal[m.start] ?? 0;
    const end = (toOriginal[m.end - 1] ?? start) + 1;
    return { start, end, match: text.slice(start, end) };
  });
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
    // Count markers with bold wrappers removed so *1. a 2. b* still qualifies.
    if (findMarkers(unwrapBoldMarkers(plainForCount).plain).length < 2) {
      return text;
    }

    return parts
      .map((part) => {
        if (part.startsWith('<') && part.endsWith('>')) return part;

        const { plain, toOriginal } = unwrapBoldMarkers(part);
        const markers = mapMarkersToOriginal(part, toOriginal, findMarkers(plain));
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

/** Inline / line markup available in question & book plain-text fields (mobile + web). */
export const BOOK_TEXT_MARKUP_HELP = [
  {
    marker: '//',
    description: 'Start a new line (justified). Use consecutive // for blank lines.',
  },
  {
    marker: '///',
    description: 'Start a new centered line.',
  },
  {
    marker: '////',
    description: 'Start a new line centered in the right half of the screen.',
  },
  {
    marker: '/--',
    description: 'Horizontal line across the right half of the screen.',
  },
  {
    marker: '/---',
    description: 'Full-width horizontal line.',
  },
  {
    marker: '*text*',
    description: 'Make the word or sentence between asterisks bold.',
  },
  {
    marker: 'left[]right',
    description: 'Split a line: text before [] is left-aligned, text after [] is right-aligned.',
  },
  {
    marker: '1. 2. / a. b. / ক. খ.',
    description:
      'Auto new line for number or letter bullets ending with a period. Needs at least two markers with spaces around them (e.g. 1. first 2. second). Also works inside *bold*.',
  },
  {
    marker: '১। ২। / ক। খ।',
    description:
      'Auto new line for Bangla dari (।) list markers, same rules as number/letter bullets. Also works inside *bold*.',
  },
  {
    marker: '(ক) (খ) / (a) (1)',
    description:
      'Auto new line for short parenthetical markers (1–2 characters inside). Needs spaces before and after each ( ), and at least two markers. Longer phrases like (বেতন ও ভাতাদি) are ignored. Also works inside *bold*.',
  },
] as const;

/* ------------------------------------------------------------------ */
/* Policy Library, Circular Archive and iBAS++ Workspace               */
/* ------------------------------------------------------------------ */

/** Subject-area shelves of the Policy Library; a Rule Library book can sit on several. */
export const POLICY_COLLECTIONS = [
  {
    code: 'PROCUREMENT',
    name_en: 'Public Procurement',
    name_bn: 'সরকারি ক্রয়',
    description_en: 'PPA 2006, PPR 2008, e-GP and tendering procedures',
  },
  {
    code: 'FINANCIAL_RULES',
    name_en: 'Financial & Treasury Rules',
    name_bn: 'আর্থিক ও ট্রেজারি বিধি',
    description_en: 'GFR, Treasury Rules and delegation of financial powers',
  },
  {
    code: 'SERVICE_RULES',
    name_en: 'Service Rules',
    name_bn: 'চাকরি বিধি',
    description_en: 'FR, SR, BSR, pay, leave and service-related rules',
  },
  {
    code: 'TAX_REVENUE',
    name_en: 'Tax, VAT & Revenue',
    name_bn: 'কর, ভ্যাট ও রাজস্ব',
    description_en: 'Income tax, VAT, TDS/VDS and revenue deposit rules',
  },
  {
    code: 'AUDIT',
    name_en: 'Audit & Accountability',
    name_bn: 'অডিট ও জবাবদিহিতা',
    description_en: 'CAG acts, audit codes, standards and objection settlement',
  },
] as const;
export type PolicyCollectionCode = (typeof POLICY_COLLECTIONS)[number]['code'];
export const POLICY_COLLECTION_CODES = POLICY_COLLECTIONS.map((c) => c.code) as PolicyCollectionCode[];

export const CIRCULAR_ISSUERS = [
  { code: 'FINANCE_DIVISION', label: 'Finance Division (MoF)' },
  { code: 'CAG', label: 'Comptroller & Auditor General' },
  { code: 'CGA', label: 'Controller General of Accounts' },
  { code: 'NBR', label: 'National Board of Revenue' },
  { code: 'IRD', label: 'Internal Resources Division' },
  { code: 'BPPA', label: 'Bangladesh Public Procurement Authority' },
  { code: 'MOPA', label: 'Ministry of Public Administration' },
  { code: 'OTHER', label: 'Other' },
] as const;
export type CircularIssuerCode = (typeof CIRCULAR_ISSUERS)[number]['code'];
export const CIRCULAR_ISSUER_CODES = CIRCULAR_ISSUERS.map((i) => i.code) as CircularIssuerCode[];

export const CIRCULAR_DOC_TYPES = [
  { code: 'circular', label: 'Circular' },
  { code: 'gazette', label: 'Gazette' },
  { code: 'clarification', label: 'Clarification' },
  { code: 'notification', label: 'Notification' },
  { code: 'sro', label: 'SRO' },
  { code: 'office_order', label: 'Office order' },
  { code: 'memo', label: 'Memo / letter' },
] as const;
export type CircularDocType = (typeof CIRCULAR_DOC_TYPES)[number]['code'];
export const CIRCULAR_DOC_TYPE_CODES = CIRCULAR_DOC_TYPES.map((t) => t.code) as CircularDocType[];

/**
 * Starter iBAS++ Workspace areas, inserted into the `ibas_areas` collection once. Admins manage areas
 * (and add new ones) from the Areas admin screen — read areas from the API, not from this list.
 * Each area is its own grantable module; `legacy_codes` are other module codes whose grants and
 * workflow tasks also belong to the area.
 */
export const DEFAULT_IBAS_AREAS = [
  {
    code: 'IBAS_BUDGET',
    name_en: 'Budget & Allocation',
    name_bn: 'বাজেট ও বরাদ্দ',
    description_en: 'Budget estimation, allocation and re-appropriation with economic codes',
    color: '#534AB7',
    legacy_codes: ['BUDGET_PREP', 'BUDGET_EXEC'],
    policy_collections: ['FINANCIAL_RULES'],
  },
  {
    code: 'IBAS_BILL',
    name_en: 'Bills & EFT',
    name_bn: 'বিল ও ইএফটি',
    description_en: 'Pay bills, TA/DA, supplies & services bills, tokens and EFT rectification',
    color: '#185FA5',
    legacy_codes: ['BILL'],
    policy_collections: ['FINANCIAL_RULES', 'PROCUREMENT'],
  },
  {
    code: 'IBAS_PERSONAL',
    name_en: 'Personal Financial Services',
    name_bn: 'ব্যক্তিগত আর্থিক সেবা',
    description_en: 'Pay fixation, increments, digital service book, GPF advance and final payment',
    color: '#BA7517',
    legacy_codes: ['HR', 'ESERVICE'],
    policy_collections: ['SERVICE_RULES'],
  },
  {
    code: 'IBAS_TAX',
    name_en: 'Tax, VAT & A-Challan',
    name_bn: 'কর, ভ্যাট ও এ-চালান',
    description_en: 'TDS/VDS deduction during bill settlement, e-TDS and A-Challan deposits',
    color: '#0E7490',
    legacy_codes: [],
    policy_collections: ['TAX_REVENUE'],
  },
  {
    code: 'IBAS_ACCOUNTS',
    name_en: 'Accounts, Cash Book & Treasury',
    name_bn: 'হিসাব, ক্যাশ বই ও ট্রেজারি',
    description_en: 'Cash book, advance and cheque registers, bank reconciliation',
    color: '#1D9E75',
    legacy_codes: ['ACCOUNTING', 'GL', 'REPORTING'],
    policy_collections: ['FINANCIAL_RULES'],
  },
  {
    code: 'IBAS_PREAUDIT',
    name_en: 'Financial Power & Pre-Audit',
    name_bn: 'আর্থিক ক্ষমতা ও প্রি-অডিট',
    description_en: 'Delegation of financial powers and pre-audit attachment checklists',
    color: '#854F0B',
    legacy_codes: [],
    policy_collections: ['FINANCIAL_RULES'],
  },
  {
    code: 'IBAS_AUDIT',
    name_en: 'Audit & Objections',
    name_bn: 'অডিট ও আপত্তি',
    description_en: 'Broadsheet replies, audit objection settlement and tripartite meetings',
    color: '#A32D2D',
    legacy_codes: [],
    policy_collections: ['AUDIT'],
  },
  {
    code: 'IBAS_PENSION',
    name_en: 'Pension & Retirement',
    name_bn: 'পেনশন ও অবসর',
    description_en: 'PRL, gratuity, lump grant and family pension case processing',
    color: '#0F6E56',
    legacy_codes: [],
    policy_collections: ['SERVICE_RULES'],
  },
] as const satisfies ReadonlyArray<{
  code: string;
  name_en: string;
  name_bn: string;
  description_en: string;
  color: string;
  legacy_codes: readonly string[];
  policy_collections: readonly PolicyCollectionCode[];
}>;
/** Area codes are admin-defined (`IBAS_` + letters/digits/underscore). */
export type IbasAreaCode = string;
export const IBAS_AREA_CODE_PATTERN = /^IBAS_[A-Z0-9_]{2,30}$/;

/** Smart PFM tools. `module_code` omitted = public tool; `areas` places it in iBAS++ drawers. */
export const SMART_TOOLS = [
  {
    key: 'salary-2026',
    title: 'Salary On 2026',
    description: 'NPS 2015 → 2026 basic pay conversion with allowances and GPF',
    href: '/salary',
    areas: ['IBAS_PERSONAL', 'IBAS_BILL'],
  },
  {
    key: 'pension',
    title: 'Pension Calculator',
    description: 'Leave account, PRL, gratuity and lump grant',
    href: '/pension',
    module_code: 'PENSION',
    areas: ['IBAS_PENSION'],
  },
  {
    key: 'joining-period',
    title: 'Joining Period',
    description: 'Preparation and travel time on transfer',
    href: '/joining-period',
    module_code: 'PENSION',
    areas: ['IBAS_PERSONAL'],
  },
  {
    key: 'pdf-to-word',
    title: 'PDF to Word',
    description: 'Convert scanned circulars and orders to editable text',
    href: '/tools/pdf-to-word',
    module_code: 'OCR',
    areas: ['IBAS_ACCOUNTS', 'IBAS_AUDIT'],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  title: string;
  description: string;
  href: string;
  module_code?: string;
  areas: readonly IbasAreaCode[];
}>;
export type SmartTool = (typeof SMART_TOOLS)[number];

/** Admin-authored knowledge kits shown in iBAS++ area drawers and the Toolkit hub. */
export const TOOLKIT_KINDS = [
  {
    code: 'checklist',
    label: 'Checklist',
    label_plural: 'Checklists',
    description: 'Tick-off lists for pre-audit, bill scrutiny, sanctions and pension cases',
  },
  {
    code: 'template',
    label: 'Template',
    label_plural: 'Templates',
    description: 'Fill-in drafts for audit broadsheet replies, letters and note sheets',
  },
  {
    code: 'guide',
    label: 'Guide',
    label_plural: 'Guides',
    description: 'Step-by-step walkthroughs such as cash book and bank reconciliation',
  },
] as const;
export type ToolkitKind = (typeof TOOLKIT_KINDS)[number]['code'];
export const TOOLKIT_KIND_CODES = TOOLKIT_KINDS.map((k) => k.code) as ToolkitKind[];

export const TOOLKIT_CATEGORIES = [
  { code: 'pre_audit', label: 'Pre-audit', kinds: ['checklist'] },
  { code: 'bill_scrutiny', label: 'Bill scrutiny', kinds: ['checklist'] },
  { code: 'financial_power', label: 'Financial power / sanction', kinds: ['checklist'] },
  { code: 'pension_case', label: 'Pension case', kinds: ['checklist', 'guide'] },
  { code: 'reconciliation', label: 'Reconciliation', kinds: ['checklist', 'guide'] },
  { code: 'broadsheet_reply', label: 'Audit broadsheet reply', kinds: ['template'] },
  { code: 'tripartite', label: 'Tripartite meeting', kinds: ['template'] },
  { code: 'letter', label: 'Letter / memo', kinds: ['template'] },
  { code: 'bill_note', label: 'Bill / note sheet', kinds: ['template'] },
  { code: 'cash_book', label: 'Cash book', kinds: ['guide'] },
  { code: 'ibas_howto', label: 'iBAS++ how-to', kinds: ['guide'] },
  { code: 'general', label: 'General', kinds: ['checklist', 'template', 'guide'] },
] as const satisfies ReadonlyArray<{ code: string; label: string; kinds: readonly ToolkitKind[] }>;
export type ToolkitCategoryCode = (typeof TOOLKIT_CATEGORIES)[number]['code'];
export const TOOLKIT_CATEGORY_CODES = TOOLKIT_CATEGORIES.map((c) => c.code) as ToolkitCategoryCode[];

export function toolkitCategoriesFor(kind: ToolkitKind) {
  return TOOLKIT_CATEGORIES.filter((c) => (c.kinds as readonly string[]).includes(kind));
}
