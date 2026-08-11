import { apiFetch } from './api';
import type { ExamRoutineDetail } from '@ibas/shared-types';

export interface ExamRoutineListItem {
  exam_name_id: string;
  exam_name: string;
  start_date: string;
  start_date_note?: string;
}

export type { ExamRoutineDetail };

export async function fetchExamRoutineList() {
  return apiFetch<{ data: ExamRoutineListItem[] }>('/exam-routine/list');
}

export async function fetchExamRoutineByExamName(examNameId: string) {
  return apiFetch<{ data: ExamRoutineDetail }>(`/exam-routine/names/${examNameId}`);
}
