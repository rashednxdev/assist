import type { Href } from 'expo-router';

export function questionsLibraryHref(): Href {
  return '/(app)/questions' as Href;
}

export function questionDetailHref(id: string, opts?: { fromSaved?: boolean }): Href {
  if (opts?.fromSaved) return `/(app)/questions/${id}?from=saved` as Href;
  return `/(app)/questions/${id}` as Href;
}
