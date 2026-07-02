import type { PaperQuestionPart, PaperQuestionRow } from '@/types/papers';

export function displayQuestionLabel(row: PaperQuestionRow) {
  return row.display_question_number?.trim() || String(row.question_number);
}

export function promotedFirstPart(row: PaperQuestionRow): PaperQuestionPart | undefined {
  if (row.from_question_bank || row.header_text?.trim() || row.parts.length === 0) return undefined;
  return row.parts[0];
}

export function questionInlineText(row: PaperQuestionRow): string | null {
  if (row.header_text?.trim()) return row.header_text.trim();
  const promoted = promotedFirstPart(row);
  if (promoted) return promoted.question?.body_en?.trim() ?? null;
  if (row.from_question_bank && row.question?.body_en) return row.question.body_en.trim();
  return null;
}

export function partsForDisplay(row: PaperQuestionRow): PaperQuestionPart[] {
  if (row.header_text?.trim()) return row.parts;
  if (!row.from_question_bank && row.parts.length > 1) return row.parts.slice(1);
  return [];
}

export function mainRowMarks(row: PaperQuestionRow): {
  marks: number;
  marks_display_bn?: string;
} {
  const promoted = promotedFirstPart(row);
  if (promoted) {
    return { marks: promoted.marks, marks_display_bn: promoted.marks_display_bn };
  }
  return { marks: row.marks, marks_display_bn: row.marks_display_bn };
}

export function primaryQuestionId(row: PaperQuestionRow): string | undefined {
  if (row.from_question_bank && row.question_id) return row.question_id;
  const promoted = promotedFirstPart(row);
  if (promoted) return promoted.question_id;
  return undefined;
}
