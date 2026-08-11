import { banglaText } from '@/lib/bangla-format';
import type { PaperItem, PaperQuestionPart, PaperQuestionRow } from '@/types/papers';

/** Shared paper-sheet heading lines (list + detail): name + first two center lines. */
export function paperHeadingLines(paper: PaperItem): {
  paperName: string;
  examLine: string;
  subjectLine: string;
} {
  const examName = paper.exam_name_bn?.trim() || paper.exam_name?.trim() || paper.exam_short_name || '';
  const partName = paper.exam_part_name_bn?.trim() || paper.exam_part_name?.trim() || '';
  const sessionLabel = paper.session_label_bn?.trim() || paper.session_year?.trim() || '';
  const examLine = [examName, partName, sessionLabel]
    .filter(Boolean)
    .map((segment) => banglaText(segment))
    .join('/');
  const subjectRaw = paper.exam_subject_name_bn?.trim() || paper.exam_subject_name?.trim() || '';
  return {
    paperName: banglaText(paper.name),
    examLine,
    subjectLine: subjectRaw ? banglaText(subjectRaw) : '',
  };
}

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
