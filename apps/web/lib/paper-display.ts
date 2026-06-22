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

export function questionInlineText(pq: PaperQuestionRow): string | null {
  if (pq.header_text?.trim()) return pq.header_text.trim();
  if (!pq.from_question_bank && pq.parts.length === 1) {
    return pq.parts[0]?.question?.body_en ?? null;
  }
  if (pq.from_question_bank && pq.question?.body_en) return pq.question.body_en;
  return null;
}

export function showPartsList(pq: PaperQuestionRow) {
  if (pq.parts.length === 0) return false;
  if (pq.header_text?.trim()) return true;
  return pq.parts.length > 1;
}

export function marksPreview(pq: { marks: number; marks_display_bn?: string }) {
  return pq.marks_display_bn?.trim() || `${pq.marks} mark${pq.marks !== 1 ? 's' : ''}`;
}

export function truncate(text: string, len = 120) {
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

export function primaryQuestionId(pq: PaperQuestionRow): string | undefined {
  if (pq.from_question_bank && pq.question_id) return pq.question_id;
  if (!pq.header_text?.trim() && pq.parts.length === 1) return pq.parts[0]?.question_id;
  return undefined;
}
