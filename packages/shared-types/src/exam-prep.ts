import { z } from 'zod';

/*
 * Exam Preparation parts. Every learning module (Question Bank, Marathon review, Exam Papers,
 * Question of the Day, Syllabus…) follows the part the learner picked. Paid modules show only the
 * subjects the learner bought for that part.
 */

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export interface ExamPrepPartSubject {
  id: string;
  name: string;
  name_bn?: string;
  /** The learner can open this subject in paid modules now. */
  owned: boolean;
  owned_until?: string;
}

export interface ExamPrepPartOption {
  id: string;
  exam_name_id: string;
  exam_name: string;
  part_number: number;
  name: string;
  name_bn?: string;
  /** Short label for switchers, e.g. "Part 2" or "SAS · Part 2" when there are several exams. */
  label: string;
  /** Part 1 also holds content not tagged to any subject. */
  is_primary: boolean;
  subjects: ExamPrepPartSubject[];
  /** The learner owns every subject of this part. */
  whole_part: boolean;
  owned_count: number;
}

export interface ExamPrepPartsResponse {
  parts: ExamPrepPartOption[];
  selected_part_id: string | null;
  /** Changes whenever the learner's visible subjects change (part switch, purchase, admin edit). */
  scope_key: string;
  /** Admins see every part and subject regardless of purchases. */
  is_admin: boolean;
}

export const selectExamPrepPartSchema = z.object({ exam_part_id: mongoId });
export type SelectExamPrepPartInput = z.infer<typeof selectExamPrepPartSchema>;

/** A sellable package that covers one subject or its whole part. Shown on the subject overview before enrollment. */
export interface PreparationPackageBrief {
  id: string;
  name: string;
  name_bn?: string;
  kind: 'exam_prep' | 'live' | 'basic';
  price: number;
  duration_days: number;
  description?: string;
  features?: string[];
  class_limit?: number | null;
  live_program_name?: string;
  whole_part?: boolean;
}

export interface PreparationNextClassBrief {
  id: string;
  topic: string;
  scheduled_at: string;
  status: string;
  access_type: 'free' | 'paid';
}

/** Counts every learner may see. Content itself stays behind enrollment. */
export interface PreparationSubjectSummary {
  id: string;
  name: string;
  name_bn?: string;
  part_id: string;
  part_label: string;
  owned: boolean;
  owned_until?: string;
  live_owned: boolean;
  books: number;
  written: number;
  mcq: number;
  papers: number;
  past_classes: number;
  upcoming_classes: number;
  written_read: number;
  mcq_touched: number;
  mcq_correct: number;
  mcq_wrong: number;
  progress_percent: number;
  next_class?: PreparationNextClassBrief;
  packages: PreparationPackageBrief[];
}

/** Safe structural outline shown even before enrollment (no content or stems). */
export interface PreparationPreviewBook {
  id: string;
  name: string;
  name_bn?: string;
  short_name?: string;
  edition?: string;
  chapter_count: number;
  chapters: Array<{
    id: string;
    name: string;
    chapter_number?: string;
    written_count: number;
    mcq_count: number;
  }>;
}

export interface PreparationBookRow {
  id: string;
  name: string;
  name_bn?: string;
  short_name?: string;
  edition?: string;
  publish_date?: string;
  effective_date?: string;
  is_superseded?: boolean;
  chapter_count: number;
}

export interface PreparationWrittenRow {
  id: string;
  title: string;
  question_type_code: string;
  book_id?: string;
  book_name?: string;
  chapter_id?: string;
  chapter_name?: string;
  read_count: number;
  last_read_at?: string;
}

export interface PreparationChapterRow {
  id: string;
  name: string;
  chapter_number?: string;
  book_id?: string;
  book_name?: string;
  mcq_total: number;
  touched: number;
  correct: number;
  wrong: number;
}

export interface PreparationPaperRow {
  id: string;
  name: string;
  session_year?: string;
  total_marks: number;
  pass_marks: number;
  duration_minutes: number;
  question_count: number;
  is_exam_of_week?: boolean;
}

export interface PreparationClassRow {
  id: string;
  topic: string;
  details?: string;
  scheduled_at: string;
  status: string;
  access_type: 'free' | 'paid';
  past: boolean;
}

export interface PreparationSubjectWorkspace extends PreparationSubjectSummary {
  locked: boolean;
  preview_books: PreparationPreviewBook[];
  books_list: PreparationBookRow[];
  written_questions: PreparationWrittenRow[];
  chapters: PreparationChapterRow[];
  papers_list: PreparationPaperRow[];
  classes: PreparationClassRow[];
}

export interface PreparationQuizOption {
  id: string;
  key: string;
  text: string;
}

export interface PreparationQuizQuestion {
  id: string;
  title: string;
  marks: number;
  options: PreparationQuizOption[];
  correct_option_id?: string;
  explanation?: string;
  previous_selected_option_id?: string;
  previous_is_correct?: boolean;
}
