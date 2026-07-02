import { apiFetch } from './api';
import type { ExamProgramItem, ExamTree, SubjectSyllabusTree } from '@/types/exams';

export async function fetchExamPrograms() {
  const res = await apiFetch<{ data: ExamProgramItem[] }>('/exams/names');
  return res.data;
}

export async function fetchExamTree(examId: string) {
  const res = await apiFetch<{ data: ExamTree }>(`/exams/names/${examId}/tree`);
  return res.data;
}

export async function fetchSubjectSyllabusTree(subjectId: string) {
  const res = await apiFetch<{ data: SubjectSyllabusTree }>(`/syllabus/subjects/${subjectId}/tree`);
  return res.data;
}
