import { z } from 'zod';
import {
  TOOLKIT_CATEGORIES,
  TOOLKIT_CATEGORY_CODES,
  type IbasAreaCode,
  type ToolkitCategoryCode,
  type ToolkitKind,
} from '@ibas/shared-constants';
import {
  CONTENT_LINK_TARGET_TYPES,
  ibasAreaCodeSchema,
  type ContentLinkTargetType,
  type IbasAreaAccessState,
} from './policy.js';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);
const localId = z.string().trim().min(1).max(40);

export const toolkitRefSchema = z.object({
  target_type: z.enum(CONTENT_LINK_TARGET_TYPES),
  target_id: mongoId,
});
export type ToolkitRefInput = z.infer<typeof toolkitRefSchema>;

/** A PDF or other document link (Google Drive, office website, or a site path). */
export const toolkitAttachmentSchema = z.object({
  title: z.string().trim().min(1, 'Each file link needs a title').max(200),
  url: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => v.startsWith('/') || /^https?:\/\//i.test(v), 'File link must start with http(s):// or /'),
});
export type ToolkitAttachment = z.infer<typeof toolkitAttachmentSchema>;

export const TEMPLATE_FIELD_TYPES = ['text', 'textarea', 'date', 'number'] as const;
export type TemplateFieldType = (typeof TEMPLATE_FIELD_TYPES)[number];

/** Reserved placeholder names the renderer fills itself. */
export const TEMPLATE_RESERVED_KEYS = ['rows', 'row_no', 'row_count', 'today'] as const;

const templateFieldSchema = z.object({
  key: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,39}$/, 'Field keys use lowercase letters, digits and _ (start with a letter)')
    .refine((k) => !(TEMPLATE_RESERVED_KEYS as readonly string[]).includes(k), 'This field key is reserved'),
  label: z.string().trim().min(1).max(120),
  type: z.enum(TEMPLATE_FIELD_TYPES).default('text'),
  required: z.boolean().default(false),
  placeholder: z.string().max(200).optional(),
  help: z.string().max(300).optional(),
});
export type TemplateField = z.infer<typeof templateFieldSchema>;

const baseFields = {
  title: z.string().trim().min(1).max(300),
  title_bn: z.string().trim().max(300).optional(),
  summary: z.string().max(2000).optional(),
  areas: z.array(ibasAreaCodeSchema).min(1, 'Choose at least one iBAS++ area'),
  category: z.enum(TOOLKIT_CATEGORY_CODES as [ToolkitCategoryCode, ...ToolkitCategoryCode[]]),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  refs: z.array(toolkitRefSchema).max(20).default([]),
  attachments: z.array(toolkitAttachmentSchema).max(20).default([]),
  is_published: z.boolean().default(false),
};

const checklistSchema = z.object({
  ...baseFields,
  kind: z.literal('checklist'),
  items: z
    .array(
      z.object({
        id: localId,
        section: z.string().trim().max(120).optional(),
        text: z.string().trim().min(1).max(1000),
        help: z.string().max(2000).optional(),
        required: z.boolean().default(true),
        refs: z.array(toolkitRefSchema).max(5).default([]),
        attachments: z.array(toolkitAttachmentSchema).max(10).default([]),
      }),
    )
    .min(1, 'Add at least one checklist item')
    .max(300),
});

const templateSchema = z.object({
  ...baseFields,
  kind: z.literal('template'),
  fields: z.array(templateFieldSchema).max(40).default([]),
  row_label: z.string().trim().max(60).optional(),
  row_fields: z.array(templateFieldSchema).max(15).default([]),
  row_template: z.string().max(20_000).optional(),
  body: z.string().min(1, 'Template body is required').max(100_000),
});

const guideSchema = z.object({
  ...baseFields,
  kind: z.literal('guide'),
  sections: z
    .array(
      z.object({
        id: localId,
        heading: z.string().trim().min(1).max(200),
        body: z.string().max(100_000).default(''),
        refs: z.array(toolkitRefSchema).max(10).default([]),
      }),
    )
    .min(1, 'Add at least one section')
    .max(100),
});

export const toolkitItemSchema = z
  .discriminatedUnion('kind', [checklistSchema, templateSchema, guideSchema])
  .superRefine((val, ctx) => {
    const cat = TOOLKIT_CATEGORIES.find((c) => c.code === val.category);
    if (cat && !(cat.kinds as readonly string[]).includes(val.kind)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['category'], message: `“${cat.label}” is not a ${val.kind} category` });
    }
    const unique = (list: Array<{ id?: string; key?: string }>, prop: 'id' | 'key', path: string) => {
      const seen = new Set<string>();
      for (const x of list) {
        const v = x[prop];
        if (!v) continue;
        if (seen.has(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: `Duplicate ${prop} “${v}”` });
        seen.add(v);
      }
    };
    if (val.kind === 'checklist') unique(val.items, 'id', 'items');
    if (val.kind === 'guide') unique(val.sections, 'id', 'sections');
    if (val.kind === 'template') {
      unique([...val.fields, ...val.row_fields], 'key', 'fields');
      if (val.row_fields.length > 0 && !val.row_template?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['row_template'], message: 'Row fields need a row template' });
      }
    }
  });
export type ToolkitItemInput = z.infer<typeof toolkitItemSchema>;

export const toolkitListQuerySchema = z.object({
  kind: z.string().optional(),
  area: z.string().optional(),
  category: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  include_unpublished: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
});
export type ToolkitListQuery = z.infer<typeof toolkitListQuerySchema>;

export interface ToolkitResolvedRef {
  target_type: ContentLinkTargetType;
  target_id: string;
  title: string;
  subtitle?: string;
  href: string;
  /** Target deleted or unpublished — admins see it so they can fix the link. */
  missing?: boolean;
}

export interface ToolkitItemSummary {
  id: string;
  kind: ToolkitKind;
  title: string;
  title_bn?: string;
  summary?: string;
  category: ToolkitCategoryCode;
  areas: IbasAreaCode[];
  tags: string[];
  is_published: boolean;
  /** Items (checklist), fields (template) or sections (guide). */
  size: number;
  access: IbasAreaAccessState;
  stopped_reason?: string;
  updated_at: string;
}

export interface ToolkitChecklistItem {
  id: string;
  section?: string;
  text: string;
  help?: string;
  required: boolean;
  refs: ToolkitResolvedRef[];
  attachments: ToolkitAttachment[];
}

export interface ToolkitGuideSection {
  id: string;
  heading: string;
  body: string;
  refs: ToolkitResolvedRef[];
}

export interface ToolkitItemDetail extends ToolkitItemSummary {
  refs: ToolkitResolvedRef[];
  attachments: ToolkitAttachment[];
  items?: ToolkitChecklistItem[];
  fields?: TemplateField[];
  row_label?: string;
  row_fields?: TemplateField[];
  row_template?: string;
  body?: string;
  sections?: ToolkitGuideSection[];
}

/* ------------------------------ template renderer ------------------------------ */

const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatValue(field: TemplateField | undefined, raw: string): string {
  if (field?.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-');
    return `${d}/${m}/${y}`;
  }
  const escaped = escapeHtml(raw);
  return field?.type === 'textarea' ? escaped.replace(/\r?\n/g, '<br/>') : escaped;
}

export interface RenderTemplateInput {
  body: string;
  row_template?: string;
  fields: TemplateField[];
  row_fields: TemplateField[];
  values: Record<string, string>;
  rows: Array<Record<string, string>>;
  /** `mark` highlights unfilled placeholders (preview); `blank` prints a dotted line. */
  missing?: 'mark' | 'blank';
  today?: Date;
}

/**
 * Fills `{{key}}` placeholders. User values are HTML-escaped; the admin-authored body/row template is trusted HTML.
 * `{{rows}}` expands `row_template` once per row, where `{{row_no}}` and row field keys are available.
 */
export function renderToolkitTemplate(input: RenderTemplateInput): string {
  const { fields, row_fields, values, rows, missing = 'mark' } = input;
  const fieldByKey = new Map(fields.map((f) => [f.key, f]));
  const rowFieldByKey = new Map(row_fields.map((f) => [f.key, f]));
  const now = input.today ?? new Date();
  const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  const blank = (label: string) =>
    missing === 'mark'
      ? `<span style="background:#fef3c7;color:#92400e;padding:0 2px;border-radius:2px">[${escapeHtml(label)}]</span>`
      : '……………………';

  const fill = (key: string, row?: Record<string, string>, rowNo?: number): string => {
    if (key === 'today') return today;
    if (key === 'row_count') return String(rows.length);
    if (row && key === 'row_no') return String(rowNo);
    if (row && rowFieldByKey.has(key)) {
      const v = row[key]?.trim();
      return v ? formatValue(rowFieldByKey.get(key), v) : blank(rowFieldByKey.get(key)!.label);
    }
    const f = fieldByKey.get(key);
    const v = values[key]?.trim();
    if (v) return formatValue(f, v);
    return blank(f?.label ?? key);
  };

  const rowsHtml = input.row_template?.trim()
    ? rows.map((row, i) => input.row_template!.replace(PLACEHOLDER, (_, key: string) => fill(key, row, i + 1))).join('\n')
    : '';

  return input.body.replace(PLACEHOLDER, (_, key: string) => (key === 'rows' ? rowsHtml : fill(key)));
}

/** Placeholder keys used in a body/row template (for the admin editor's “unknown placeholder” warning). */
export function templatePlaceholders(text: string | undefined): string[] {
  if (!text) return [];
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]!))];
}
