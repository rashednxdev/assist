import type {
  PreparationQuizQuestion,
  PreparationSubjectSummary,
  PreparationSubjectWorkspace,
} from '@ibas/shared-types';
import { apiFetch } from './api';

export async function fetchExamPrepSubjects(): Promise<PreparationSubjectSummary[]> {
  const res = await apiFetch<{ data: PreparationSubjectSummary[] }>('/exam-prep/subjects');
  return res.data;
}

export async function fetchExamPrepSubjectWorkspace(
  subjectId: string,
): Promise<PreparationSubjectWorkspace> {
  const res = await apiFetch<{ data: PreparationSubjectWorkspace }>(
    `/exam-prep/subjects/${subjectId}?read=all`,
  );
  return res.data;
}

export async function fetchChapterQuiz(
  subjectId: string,
  chapterId: string,
  wrongOnly = false,
): Promise<PreparationQuizQuestion[]> {
  const res = await apiFetch<{ data: PreparationQuizQuestion[] }>(
    `/exam-prep/subjects/${subjectId}/chapters/${chapterId}?wrong=${wrongOnly ? '1' : '0'}`,
  );
  return res.data;
}
