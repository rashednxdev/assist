/** Normalize question text for fuzzy comparison. */
export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fraction of the query's words found anywhere in the candidate (substring match per word, so
 * partial words / suffixes still count). Used to rank link-search results by "how much of what
 * you typed shows up in this question", independent of the two texts' overall length/similarity.
 */
export function queryWordMatchScore(query: string, candidate: string): number {
  const nq = normalizeQuestionText(query);
  const nc = normalizeQuestionText(candidate);
  if (!nq || !nc) return 0;

  const queryWords = [...new Set(nq.split(' ').filter((w) => w.length > 1))];
  if (queryWords.length === 0) return nc.includes(nq) ? 1 : 0;

  const matched = queryWords.filter((w) => nc.includes(w)).length;
  return matched / queryWords.length;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
