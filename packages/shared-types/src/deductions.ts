import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const DEDUCTION_SETUP_KINDS = ['economic_code', 'bill_type', 'deduction_type'] as const;
export type DeductionSetupKind = (typeof DEDUCTION_SETUP_KINDS)[number];

export const DEDUCTION_SETUP_LABELS: Record<DeductionSetupKind, { label: string; plural: string }> = {
  economic_code: { label: 'Economic code', plural: 'Economic codes' },
  bill_type: { label: 'Type of bill', plural: 'Types of bill' },
  deduction_type: { label: 'Deduction type', plural: 'Deduction types' },
};

export const deductionSetupInputSchema = z
  .object({
    kind: z.enum(DEDUCTION_SETUP_KINDS),
    code: optText(40),
    name_en: z.string().trim().min(1, 'Name is required').max(200),
    name_bn: optText(200),
    description: optText(500),
    sort_order: z.coerce.number().int().min(0).max(9999).default(0),
    is_active: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'economic_code' && !v.code) ctx.addIssue({ code: 'custom', path: ['code'], message: 'Economic code is required' });
  });
export type DeductionSetupInput = z.infer<typeof deductionSetupInputSchema>;

export interface DeductionSetupItem {
  id: string;
  kind: DeductionSetupKind;
  code?: string;
  name_en: string;
  name_bn?: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
}

export const DEDUCTION_AMOUNT_MODES = ['percent', 'fixed', 'text'] as const;
export type DeductionAmountMode = (typeof DEDUCTION_AMOUNT_MODES)[number];

export const DEDUCTION_AMOUNT_MODE_LABELS: Record<DeductionAmountMode, string> = {
  percent: 'Percent (%)',
  fixed: 'Fixed amount (Tk)',
  text: 'Text / slab',
};

export const deductionLineSchema = z
  .object({
    deduction_type_id: mongoId,
    mode: z.enum(DEDUCTION_AMOUNT_MODES),
    value: z.number().min(0).max(1_000_000_000).optional(),
    text: optText(200),
    note: optText(300),
  })
  .superRefine((v, ctx) => {
    if (v.mode !== 'text' && v.value === undefined) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter the deduction amount' });
    if (v.mode === 'percent' && (v.value ?? 0) > 100) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Percent cannot exceed 100' });
    if (v.mode === 'text' && !v.text) ctx.addIssue({ code: 'custom', path: ['text'], message: 'Enter the deduction text' });
  });
export type DeductionLineInput = z.infer<typeof deductionLineSchema>;

export const deductionEntryInputSchema = z.object({
  economic_code_id: mongoId,
  bill_type_id: mongoId,
  title: optText(200),
  details: optText(5000),
  deductions: z.array(deductionLineSchema).min(1, 'Add at least one deduction').max(20),
  highlights: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  source: optText(500),
  process_ids: z.array(mongoId).max(5).default([]),
  circular_ids: z.array(mongoId).max(10).default([]),
  is_published: z.boolean().default(false),
});
export type DeductionEntryInput = z.infer<typeof deductionEntryInputSchema>;

export const deductionListQuerySchema = z.object({
  economic_code: z.string().optional(),
  bill_type: z.string().optional(),
  deduction_type: z.string().optional(),
  q: z.string().trim().max(100).optional(),
  include_unpublished: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true'),
});
export type DeductionListQuery = z.infer<typeof deductionListQuerySchema>;

export interface DeductionSetupRef {
  id: string;
  code?: string;
  name_en: string;
  name_bn?: string;
}

export interface DeductionLineView {
  deduction_type: DeductionSetupRef;
  mode: DeductionAmountMode;
  value?: number;
  text?: string;
  note?: string;
}

export interface DeductionEntrySummary {
  id: string;
  economic_code: DeductionSetupRef;
  bill_type: DeductionSetupRef;
  title?: string;
  deductions: DeductionLineView[];
  is_published: boolean;
  updated_at: string;
}

export interface DeductionLinkedProcess {
  id: string;
  name_en: string;
  name_bn?: string;
  missing?: boolean;
}

export interface DeductionLinkedCircular {
  id: string;
  circular_no: string;
  title: string;
  issue_date?: string;
  attachment_url?: string;
  missing?: boolean;
}

export interface DeductionEntryDetail extends DeductionEntrySummary {
  details?: string;
  highlights: string[];
  source?: string;
  processes: DeductionLinkedProcess[];
  circulars: DeductionLinkedCircular[];
}

/** "7.5%", "Tk 1,000" or the admin's slab text. */
export function formatDeductionAmount(line: Pick<DeductionLineView, 'mode' | 'value' | 'text'>): string {
  if (line.mode === 'text') return line.text ?? '';
  const v = line.value ?? 0;
  if (line.mode === 'percent') return `${Number.isInteger(v) ? v : Number(v.toFixed(2))}%`;
  return `Tk ${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
