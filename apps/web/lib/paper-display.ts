export interface PaperQuestionBrief {
  id: string;
  question_type_code: string;
  body_en: string;
  marks: number;
}

export interface PaperPartRow {
  id: string;
  question_id: string;
  part_label: string;
  marks: number;
  marks_display_bn?: string;
  question?: PaperQuestionBrief;
}

export interface PaperQuestionRow {
  id: string;
  from_question_bank: boolean;
  question_id?: string;
  header_text?: string;
  question_number: number;
  display_question_number?: string;
  marks: number;
  marks_display_bn?: string;
  is_compulsory: boolean;
  question?: PaperQuestionBrief;
  parts: PaperPartRow[];
}

export function displayQuestionLabel(pq: PaperQuestionRow) {
  return pq.display_question_number?.trim() || String(pq.question_number);
}

/** Composite row with no header: first sub-part is shown on the main question line. */
export function promotedFirstPart(pq: PaperQuestionRow): PaperPartRow | undefined {
  if (pq.from_question_bank || pq.header_text?.trim() || pq.parts.length === 0) return undefined;
  return pq.parts[0];
}

export function questionInlineText(pq: PaperQuestionRow): string | null {
  if (pq.header_text?.trim()) return pq.header_text.trim();
  const promoted = promotedFirstPart(pq);
  if (promoted) return promoted.question?.body_en ?? null;
  if (pq.from_question_bank && pq.question?.body_en) return pq.question.body_en;
  return null;
}

/** Sub-parts listed below the main line (excludes promoted first part when header is empty). */
export function partsForDisplay(pq: PaperQuestionRow): PaperPartRow[] {
  if (pq.header_text?.trim()) return pq.parts;
  if (!pq.from_question_bank && pq.parts.length > 1) return pq.parts.slice(1);
  return [];
}

export function showPartsList(pq: PaperQuestionRow) {
  return partsForDisplay(pq).length > 0;
}

export function mainRowMarks(pq: PaperQuestionRow): {
  marks: number;
  marks_display_bn?: string;
} {
  const promoted = promotedFirstPart(pq);
  if (promoted) {
    return { marks: promoted.marks, marks_display_bn: promoted.marks_display_bn };
  }
  return { marks: pq.marks, marks_display_bn: pq.marks_display_bn };
}

export function marksPreview(pq: { marks: number; marks_display_bn?: string }) {
  return pq.marks_display_bn?.trim() || `${pq.marks} mark${pq.marks !== 1 ? 's' : ''}`;
}

export function truncate(text: string, len = 120) {
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

export function primaryQuestionId(pq: PaperQuestionRow): string | undefined {
  if (pq.from_question_bank && pq.question_id) return pq.question_id;
  const promoted = promotedFirstPart(pq);
  if (promoted) return promoted.question_id;
  return undefined;
}
