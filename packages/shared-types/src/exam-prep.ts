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
