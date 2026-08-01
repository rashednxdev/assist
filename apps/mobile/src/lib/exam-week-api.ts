import { apiFetch } from './api';
import type { ExamWeekSummary } from '@ibas/shared-types';

export type { ExamWeekSummary };

export interface ExamWeekPaper {
  id: string;
  name: string;
  session_year?: string;
  total_marks: number;
  pass_marks: number;
  duration_minutes: number;
  exam_subject_name?: string;
  exam_short_name?: string;
  paper_type_name?: string;
  paper_type_code?: string;
  question_count: number;
}

export async function fetchExamWeeks() {
  return apiFetch<{ data: ExamWeekSummary[] }>('/papers/exam-week/weeks');
}

export async function fetchExamWeekPapers(weekStart: string) {
  return apiFetch<{ data: ExamWeekPaper[] }>(`/papers/exam-week/weeks/${weekStart}`);
}
