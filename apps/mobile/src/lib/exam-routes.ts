import type { Href } from 'expo-router';

export function examsLibraryHref(): Href {
  return '/(app)/exams' as Href;
}

export function examDetailHref(id: string): Href {
  return `/(app)/exams/${id}` as Href;
}

export function examSubjectSyllabusHref(subjectId: string): Href {
  return `/(app)/exams/subjects/${subjectId}` as Href;
}
