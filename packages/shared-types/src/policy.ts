import { z } from 'zod';
import {
  CIRCULAR_DOC_TYPE_CODES,
  CIRCULAR_ISSUER_CODES,
  IBAS_AREA_CODE_PATTERN,
  POLICY_COLLECTION_CODES,
  type CircularDocType,
  type CircularIssuerCode,
  type IbasAreaCode,
  type PolicyCollectionCode,
} from '@ibas/shared-constants';
import type { ToolkitItemSummary } from './toolkit.js';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);

export const ibasAreaCodeSchema = z
  .string()
  .regex(IBAS_AREA_CODE_PATTERN, 'Area code must look like IBAS_NAME (capital letters, digits, _)');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const optionalUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v), {
    message: 'Link must be an http(s) URL or a site path starting with /',
  })
  .optional();

export const circularChecklistItemSchema = z.object({
  id: z.string().trim().min(1).max(40),
  text: z.string().trim().min(1, 'Checklist items cannot be empty').max(1000),
  required: z.boolean().default(true),
});
export type CircularChecklistItem = z.infer<typeof circularChecklistItemSchema>;

const optionalText = (max: number) => z.string().trim().max(max).optional();

const circularFieldsSchema = z.object({
  /** Order / memo / circular number as printed. */
  circular_no: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(500),
  title_bn: optionalText(500),
  summary: z.string().max(4000).optional(),
  full_text: z.string().max(200_000).optional(),
  issuer: z.enum(CIRCULAR_ISSUER_CODES as [CircularIssuerCode, ...CircularIssuerCode[]]),
  /** Ministry or division that published it, e.g. "Ministry of Finance, Finance Division". */
  ministry: optionalText(200),
  /** Department / directorate / office, e.g. "Office of the CGA". */
  department: optionalText(200),
  /** Wing, branch or section. */
  issuer_detail: optionalText(300),
  /** Who signed / issued the order. */
  order_by: optionalText(200),
  order_by_designation: optionalText(200),
  doc_type: z.enum(CIRCULAR_DOC_TYPE_CODES as [CircularDocType, ...CircularDocType[]]),
  issue_date: isoDate,
  effective_date: isoDate.optional().or(z.literal('')),
  collections: z.array(z.enum(POLICY_COLLECTION_CODES as [PolicyCollectionCode, ...PolicyCollectionCode[]])).default([]),
  areas: z.array(ibasAreaCodeSchema).default([]),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  attachment_url: optionalUrl,
  source_url: optionalUrl,
  supersedes_ids: z.array(mongoId).default([]),
  /** Optional compliance checklist for acting on this circular. */
  checklist: z.array(circularChecklistItemSchema).max(60).default([]),
  /** Optional explanatory note (plain text or HTML). */
  note: z.string().max(20_000).optional(),
  /** Existing Toolkit checklists that help apply this circular. */
  toolkit_ids: z.array(mongoId).max(10).default([]),
  is_published: z.boolean().default(false),
});

export const createCircularSchema = circularFieldsSchema;
export const updateCircularSchema = circularFieldsSchema.partial();
export type CreateCircularDto = z.infer<typeof createCircularSchema>;
export type UpdateCircularDto = z.infer<typeof updateCircularSchema>;

export const circularListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  issuer: z.string().optional(),
  doc_type: z.string().optional(),
  collection: z.string().optional(),
  area: z.string().optional(),
  tag: z.string().optional(),
  year: z.coerce.number().int().min(1950).max(2100).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
  include_unpublished: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type CircularListQuery = z.infer<typeof circularListQuerySchema>;

export interface CircularRecord {
  id: string;
  circular_no: string;
  title: string;
  title_bn?: string;
  summary?: string;
  full_text?: string;
  issuer: CircularIssuerCode;
  ministry?: string;
  department?: string;
  issuer_detail?: string;
  order_by?: string;
  order_by_designation?: string;
  doc_type: CircularDocType;
  issue_date: string;
  effective_date?: string;
  collections: PolicyCollectionCode[];
  areas: IbasAreaCode[];
  tags: string[];
  attachment_url?: string;
  source_url?: string;
  supersedes: Array<{ id: string; circular_no: string; title: string }>;
  superseded_by: Array<{ id: string; circular_no: string; title: string }>;
  /** Number of checklist items (lists omit the items themselves). */
  checklist_count: number;
  /** Detail view only. */
  checklist?: CircularChecklistItem[];
  note?: string;
  toolkit?: Array<{ id: string; title: string; kind: string; is_published: boolean }>;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface CircularFacets {
  years: number[];
  tags: Array<{ tag: string; count: number }>;
  total: number;
}

export interface CircularTagCount {
  tag: string;
  count: number;
}

/** Previously used values, offered as suggestions in the circular form. */
export interface CircularFieldSuggestions {
  ministry: string[];
  department: string[];
  issuer_detail: string[];
  order_by: string[];
  order_by_designation: string[];
}

export const renameCircularTagSchema = z.object({
  from: z.string().trim().min(1).max(60),
  to: z.string().trim().min(1).max(60),
});

export const updateBookCollectionsSchema = z.object({
  policy_collections: z.array(
    z.enum(POLICY_COLLECTION_CODES as [PolicyCollectionCode, ...PolicyCollectionCode[]]),
  ),
});

export interface PolicyBookItem {
  id: string;
  name: string;
  name_bn: string;
  short_name?: string;
  book_type_name?: string;
  is_published: boolean;
  policy_collections: PolicyCollectionCode[];
}

export interface PolicyCollectionSummary {
  code: PolicyCollectionCode;
  name_en: string;
  name_bn: string;
  description_en: string;
  books: PolicyBookItem[];
  circular_count: number;
}

export const CONTENT_LINK_TARGET_TYPES = ['book', 'book_topic', 'circular'] as const;
export type ContentLinkTargetType = (typeof CONTENT_LINK_TARGET_TYPES)[number];

export const createIbasLinkSchema = z.object({
  area_code: ibasAreaCodeSchema,
  target_type: z.enum(CONTENT_LINK_TARGET_TYPES),
  target_id: mongoId,
  note: z.string().trim().max(500).optional(),
});
export type CreateIbasLinkDto = z.infer<typeof createIbasLinkSchema>;

export type IbasAreaAccessState = 'open' | 'stopped' | 'unpaid' | 'denied';

const areaFieldsSchema = z.object({
  name_en: z.string().trim().min(1, 'English name is required').max(120),
  name_bn: z.string().trim().max(120).default(''),
  description_en: z.string().trim().max(500).default(''),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour like #1E40AF'),
  legacy_codes: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  policy_collections: z
    .array(z.enum(POLICY_COLLECTION_CODES as [PolicyCollectionCode, ...PolicyCollectionCode[]]))
    .default([]),
  sort_order: z.number().int().min(0).max(10_000).default(100),
  is_active: z.boolean().default(true),
});

export const createIbasAreaSchema = areaFieldsSchema.extend({ code: ibasAreaCodeSchema });
export const updateIbasAreaSchema = areaFieldsSchema;
export type CreateIbasAreaDto = z.infer<typeof createIbasAreaSchema>;
export type UpdateIbasAreaDto = z.infer<typeof updateIbasAreaSchema>;

/** Admin view of an area, including its module's stop state and what is filed under it. */
export interface IbasAreaRecord {
  code: IbasAreaCode;
  name_en: string;
  name_bn: string;
  description_en: string;
  color: string;
  legacy_codes: string[];
  policy_collections: PolicyCollectionCode[];
  sort_order: number;
  is_active: boolean;
  module_stopped: boolean;
  usage: { tagged_tasks: number; legacy_tasks: number; links: number; circulars: number; toolkit: number };
}

export interface IbasAreaSummary {
  code: IbasAreaCode;
  name_en: string;
  name_bn: string;
  description_en: string;
  color: string;
  access: IbasAreaAccessState;
  stopped_reason?: string;
  counts: {
    procedures: number;
    rules: number;
    circulars: number;
    tools: number;
    checklists: number;
    templates: number;
    guides: number;
  };
}

export interface IbasRuleItem {
  link_id?: string;
  kind: 'book' | 'book_topic';
  id: string;
  book_id: string;
  title: string;
  subtitle?: string;
  snippet?: string;
  note?: string;
  href: string;
}

export interface IbasAreaDetail extends IbasAreaSummary {
  procedures: Array<{
    id: string;
    name_en: string;
    name_bn?: string;
    description_en: string;
    total_steps: number;
    estimated_time?: number;
    href: string;
  }>;
  rules: IbasRuleItem[];
  collection_books: Array<{ id: string; name: string; name_bn: string; href: string }>;
  circulars: Array<{
    link_id?: string;
    id: string;
    circular_no: string;
    title: string;
    issuer: string;
    issue_date: string;
    note?: string;
    href: string;
  }>;
  tools: Array<{ key: string; title: string; description: string; href: string; module_code?: string }>;
  toolkit: ToolkitItemSummary[];
}

export interface IbasLinkRecord {
  id: string;
  area_code: IbasAreaCode;
  target_type: ContentLinkTargetType;
  target_id: string;
  title: string;
  subtitle?: string;
  note?: string;
  sort_order: number;
}

export const SEARCH_GROUPS = [
  'areas',
  'tools',
  'rules',
  'books',
  'circulars',
  'regulations',
  'questions',
  'procedures',
  'toolkit',
] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export interface SearchHit {
  id: string;
  title: string;
  subtitle?: string;
  snippet?: string;
  href: string;
}

export interface SearchResponse {
  q: string;
  groups: Array<{ group: SearchGroup; label: string; hits: SearchHit[] }>;
  /** Groups skipped because the user has no access (so the UI can hint at unlocking them). */
  locked: SearchGroup[];
}
