import type { Href } from 'expo-router';

export function papersLibraryHref(): Href {
  return '/(app)/papers' as Href;
}

export function paperDetailHref(id: string): Href {
  return `/(app)/papers/${id}` as Href;
}
