import type { Href } from 'expo-router';

export function booksLibraryHref(): Href {
  return '/(app)/books' as Href;
}

export function bookDetailHref(bookId: string, opts?: { fromSaved?: boolean }): Href {
  if (opts?.fromSaved) return `/(app)/books/${bookId}?from=saved` as Href;
  return `/(app)/books/${bookId}` as Href;
}

export function bookChapterHref(bookId: string, chapterId: string): Href {
  return `/(app)/books/${bookId}/chapter/${chapterId}` as Href;
}

export function bookRuleHref(bookId: string, topicId: string): Href {
  return `/(app)/books/${bookId}/rule/${topicId}` as Href;
}

export function regulationsSearchHref(): Href {
  return '/(app)/books/regulations' as Href;
}

export function regulationDetailHref(id: string): Href {
  return `/(app)/books/regulations/${id}` as Href;
}
