import type { Href } from 'expo-router';

export function questionsLibraryHref(): Href {
  return '/(app)/questions' as Href;
}

export function questionDetailHref(id: string): Href {
  return `/(app)/questions/${id}` as Href;
}
