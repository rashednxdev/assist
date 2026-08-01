import { apiFetch } from './api';
import type { MySubmittedQuestionRecord } from '@ibas/shared-types';

export type { MySubmittedQuestionRecord };

export async function submitUserQuestion(examSubjectId: string, body: string) {
  return apiFetch<{ data: MySubmittedQuestionRecord }>('/user-questions', {
    method: 'POST',
    body: JSON.stringify({ exam_subject_id: examSubjectId, body }),
  });
}

export async function fetchMySubmittedQuestions() {
  return apiFetch<{ data: MySubmittedQuestionRecord[] }>('/user-questions/mine');
}
