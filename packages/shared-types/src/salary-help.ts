import { z } from 'zod';

/** Suggest a previous salary question when the typed text matches at least this much. */
export const SALARY_QUESTION_MATCH_MIN = 0.8;

export const SALARY_FAQ_STATUSES = ['pending', 'published', 'rejected'] as const;
export type SalaryFaqStatus = (typeof SALARY_FAQ_STATUSES)[number];

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'of',
  'to',
  'for',
  'and',
  'or',
  'is',
  'are',
  'was',
  'what',
  'how',
  'when',
  'why',
  'my',
  'in',
  'on',
  'do',
  'does',
  'can',
  'i',
  'from',
  'with',
  'your',
  'about',
  'please',
  'কি',
  'কী',
  'এর',
  'এবং',
  'বা',
  'জন্য',
  'কিভাবে',
  'কীভাবে',
  'কখন',
  'কেন',
  'আমার',
  'এই',
  'যে',
  'না',
]);

export function normalizeSalaryQuestion(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trigramCounts(value: string): Map<string, number> {
  const padded = `  ${value}  `;
  const counts = new Map<string, number>();
  for (let i = 0; i < padded.length - 2; i += 1) {
    const gram = padded.slice(i, i + 3);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

/** Sørensen–Dice on character trigrams. Works for Bangla and English, including small typos. */
function dice(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const left = trigramCounts(a);
  const right = trigramCounts(b);
  let leftSize = 0;
  let rightSize = 0;
  let overlap = 0;
  for (const count of left.values()) leftSize += count;
  for (const [gram, count] of right) {
    rightSize += count;
    const have = left.get(gram) ?? 0;
    if (have > 0) {
      const used = Math.min(have, count);
      overlap += used;
      left.set(gram, have - used);
    }
  }
  const total = leftSize + rightSize;
  return total === 0 ? 0 : (2 * overlap) / total;
}

function meaningfulTokens(value: string): string[] {
  return value.split(' ').filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const size = Math.min(a.length, b.length, 6);
  return size >= 4 && a.slice(0, size) === b.slice(0, size);
}

/** Share of the typed words that already appear in a stored question. */
function tokenContainment(query: string, candidate: string): number {
  const words = meaningfulTokens(query);
  if (words.length < 2) return 0;
  const have = meaningfulTokens(candidate);
  if (have.length === 0) return 0;
  let hit = 0;
  for (const word of words) {
    if (have.some((other) => sameWord(word, other))) hit += 1;
  }
  return hit / words.length;
}

/**
 * 0–1 similarity.
 * An exact prefix counts while the user is still typing.
 * Word containment catches the same question written in a different order.
 */
export function salaryQuestionSimilarity(query: string, candidate: string): number {
  const q = normalizeSalaryQuestion(query);
  const c = normalizeSalaryQuestion(candidate);
  if (q.length < 4 || c.length < 4) return 0;
  const wordsReady = meaningfulTokens(q).length >= 2;
  if (q.length < 8 && !wordsReady) return 0;
  const full = dice(q, c);
  const prefix =
    c.startsWith(q) && (q.length >= 8 || wordsReady)
      ? 1
      : q.length >= 12 && q.length < c.length
        ? dice(q, c.slice(0, q.length))
        : 0;
  const words = tokenContainment(q, c);
  return Math.max(full, prefix, words);
}

export interface SalaryQuestionCandidate {
  id: string;
  texts: string[];
  status: string;
}

export interface SalaryQuestionMatch {
  id: string;
  score: number;
  status: string;
}

export function rankSalaryQuestions(
  query: string,
  items: SalaryQuestionCandidate[],
  limit = 5,
): SalaryQuestionMatch[] {
  const qLen = normalizeSalaryQuestion(query).length;
  return items
    .map((item) => {
      const texts = item.texts.map((text) => text.trim()).filter(Boolean);
      let score = 0;
      let closest = Number.POSITIVE_INFINITY;
      for (const text of texts) {
        const next = salaryQuestionSimilarity(query, text);
        if (next > score) score = next;
        const len = normalizeSalaryQuestion(text).length;
        if (len > 0) closest = Math.min(closest, Math.abs(len - qLen));
      }
      return { id: item.id, score, status: item.status, closest };
    })
    .filter((item) => item.score >= SALARY_QUESTION_MATCH_MIN)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.status !== b.status) {
        if (a.status === 'published') return -1;
        if (b.status === 'published') return 1;
      }
      return a.closest - b.closest;
    })
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      status: item.status,
      score: Math.round(item.score * 1000) / 1000,
    }));
}

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const askSalaryQuestionSchema = z.object({
  question: z.string().trim().min(8, 'Question must be at least 8 characters').max(500),
  locale: z.enum(['en', 'bn']).default('bn'),
});

export type AskSalaryQuestionDto = z.infer<typeof askSalaryQuestionSchema>;

export const salaryFaqWriteSchema = z
  .object({
    question_bn: z.string().trim().max(500).default(''),
    question_en: z.string().trim().max(500).default(''),
    answer_bn: z.string().trim().max(4000).default(''),
    answer_en: z.string().trim().max(4000).default(''),
    status: z.enum(SALARY_FAQ_STATUSES),
    pinned: z.boolean().default(false),
    circular_ids: z.array(objectIdSchema).max(12).default([]),
  })
  .refine((value) => value.question_bn.length >= 8 || value.question_en.length >= 8, {
    message: 'Enter the question in Bangla or English (at least 8 characters)',
  })
  .refine((value) => value.status !== 'published' || value.answer_bn.length >= 2 || value.answer_en.length >= 2, {
    message: 'A published question needs an answer in Bangla or English',
  });

export type SalaryFaqWriteDto = z.infer<typeof salaryFaqWriteSchema>;

const sourceUrlSchema = z
  .string()
  .trim()
  .min(4, 'Source link is required')
  .max(1000)
  .transform((value, ctx) => {
    const withProto = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const url = new URL(withProto);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Source link must start with http:// or https://' });
        return z.NEVER;
      }
      return url.toString();
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Source link must be a valid URL' });
      return z.NEVER;
    }
  });

export const salaryCircularWriteSchema = z
  .object({
    title_bn: z.string().trim().max(300).default(''),
    title_en: z.string().trim().max(300).default(''),
    circular_no: z.string().trim().max(80).default(''),
    publish_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Publish date must be YYYY-MM-DD')
      .refine((value) => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!match) return false;
        const date = new Date(`${value}T00:00:00Z`);
        return (
          date.getUTCFullYear() === Number(match[1]) &&
          date.getUTCMonth() + 1 === Number(match[2]) &&
          date.getUTCDate() === Number(match[3])
        );
      }, 'Publish date must be a real date'),
    source_url: sourceUrlSchema,
    source_name: z.string().trim().min(2, 'Issuing authority is required').max(160),
    summary_bn: z.string().trim().max(1000).default(''),
    summary_en: z.string().trim().max(1000).default(''),
    is_published: z.boolean().default(true),
  })
  .refine((value) => value.title_bn.length >= 2 || value.title_en.length >= 2, {
    message: 'Enter the circular name in Bangla or English',
  });

export type SalaryCircularWriteDto = z.infer<typeof salaryCircularWriteSchema>;

export interface SalaryFaqRecord {
  id: string;
  question_bn: string;
  question_en: string;
  answer_bn: string;
  answer_en: string;
  status: SalaryFaqStatus;
  pinned: boolean;
  circular_ids: string[];
  asker_name: string;
  created_at: string;
  updated_at: string;
}

export interface SalaryCircularRecord {
  id: string;
  title_bn: string;
  title_en: string;
  circular_no: string;
  publish_date: string;
  source_url: string;
  source_name: string;
  summary_bn: string;
  summary_en: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalaryOpenQuestion {
  id: string;
  question_bn: string;
  question_en: string;
  status: 'pending' | 'rejected';
  mine: boolean;
  created_at: string;
}

export interface SalaryHelpFeed {
  faqs: SalaryFaqRecord[];
  circulars: SalaryCircularRecord[];
  open_questions: SalaryOpenQuestion[];
}

export interface AskSalaryQuestionResult {
  created: boolean;
  item: SalaryFaqRecord | null;
  matches: SalaryQuestionMatch[];
}

const RICH_HTML_TAGS = new Set([
  'p',
  'br',
  'hr',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'sub',
  'sup',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
]);

const VOID_HTML_TAGS = new Set(['br', 'hr']);

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (all, hex: string) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return all;
      try {
        return String.fromCodePoint(code);
      } catch {
        return all;
      }
    })
    .replace(/&#(\d+);/g, (all, num: string) => {
      const code = Number(num);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return all;
      try {
        return String.fromCodePoint(code);
      } catch {
        return all;
      }
    })
    .replace(/&colon;/gi, ':')
    .replace(/&sol;/gi, '/')
    .replace(/&amp;/gi, '&');
}

function safeRichHref(raw: string): string {
  const decoded = decodeHtmlEntities(raw.trim().replace(/^['"]|['"]$/g, ''));
  const compact = decoded.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
  if (!compact || compact.startsWith('javascript:') || compact.startsWith('data:') || compact.startsWith('vbscript:')) return '';
  if (/^https?:\/\//i.test(decoded) || /^mailto:/i.test(decoded)) return decoded;
  if (decoded.startsWith('/') && !decoded.startsWith('//')) return decoded;
  return '';
}

function safeTextAlign(raw: string): string {
  const align = /text-align\s*:\s*(left|center|right|justify)/i.exec(raw)?.[1];
  return align ? `text-align:${align.toLowerCase()}` : '';
}

function readHtmlAttrs(source: string): Array<[string, string]> {
  const attrs: Array<[string, string]> = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const name = match[1];
    if (!name) continue;
    attrs.push([name.toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '']);
  }
  return attrs;
}

function cleanRichAttrs(tag: string, source: string): string {
  const parts: string[] = [];
  for (const [name, value] of readHtmlAttrs(source)) {
    if (name === 'style') {
      const align = safeTextAlign(value);
      if (align) parts.push(`style="${align}"`);
      continue;
    }
    if (tag === 'a' && name === 'href') {
      const href = safeRichHref(value);
      if (href) parts.push(`href="${href.replace(/"/g, '%22')}"`);
    }
  }
  if (tag === 'a' && parts.some((part) => part.startsWith('href="http'))) {
    parts.push('target="_blank"', 'rel="noopener noreferrer"');
  }
  return parts.length ? ` ${parts.join(' ')}` : '';
}

/** Keep headings, lists, alignment, and emphasis. Drop scripts and event handlers. */
export function sanitizeRichHtml(input: string): string {
  const withoutDanger = input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|svg|math|noscript|textarea|button|input|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|svg|math|noscript|textarea|button|input|link|meta)\b[^>]*\/?\s*>/gi, '');

  return withoutDanger.replace(/<\/?\s*([a-zA-Z0-9]+)([^>]*)>/g, (full, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase();
    if (!RICH_HTML_TAGS.has(tag)) return '';
    if (full.startsWith('</')) return VOID_HTML_TAGS.has(tag) ? '' : `</${tag}>`;
    if (VOID_HTML_TAGS.has(tag)) return `<${tag}>`;
    return `<${tag}${cleanRichAttrs(tag, attrs)}>`;
  });
}

export function richHtmlIsEmpty(input: string): boolean {
  return sanitizeRichHtml(input)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim().length === 0;
}

export const salaryCalcGuideSchema = z.object({
  body_bn: z.string().max(80000).default(''),
  body_en: z.string().max(80000).default(''),
}).transform((value) => ({
  body_bn: sanitizeRichHtml(value.body_bn).slice(0, 80000),
  body_en: sanitizeRichHtml(value.body_en).slice(0, 80000),
}));

export type SalaryCalcGuideWriteDto = z.infer<typeof salaryCalcGuideSchema>;

export interface SalaryCalcGuide {
  body_bn: string;
  body_en: string;
  updated_at: string;
}

function plainNoticeText(value: string, max: number): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Shown after Download free T.R. Form, before the form details. Approved downloads skip it. */
export const salaryTrNoticeSchema = z
  .object({
    body_bn: z.string().max(80000).default(''),
    body_en: z.string().max(80000).default(''),
    confirm_bn: z.string().max(500).default(''),
    confirm_en: z.string().max(500).default(''),
  })
  .transform((value) => ({
    body_bn: sanitizeRichHtml(value.body_bn).slice(0, 80000),
    body_en: sanitizeRichHtml(value.body_en).slice(0, 80000),
    confirm_bn: plainNoticeText(value.confirm_bn, 500),
    confirm_en: plainNoticeText(value.confirm_en, 500),
  }));

export type SalaryTrNoticeWriteDto = z.infer<typeof salaryTrNoticeSchema>;

/** Admin show/hide for the free T.R. Form notice. Content is saved separately. */
export const updateSalaryTrNoticeVisibilitySchema = z.object({
  shown: z.boolean(),
});
export type UpdateSalaryTrNoticeVisibilityDto = z.infer<typeof updateSalaryTrNoticeVisibilitySchema>;

export interface SalaryTrNotice {
  body_bn: string;
  body_en: string;
  confirm_bn: string;
  confirm_en: string;
  /** False hides the notice even when text is saved. Missing means shown. */
  shown: boolean;
  updated_at: string;
}
