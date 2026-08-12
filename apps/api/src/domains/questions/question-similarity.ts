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

/** Distinct normalized query words (length > 1), same set used by scoring and Mongo prefilters. */
export function querySearchWords(query: string): string[] {
  return [...new Set(normalizeQuestionText(query).split(' ').filter((w) => w.length > 1))];
}

/** Best word-match score across English / Bangla bodies. */
export function questionTextMatchScore(
  query: string,
  bodyEn?: string | null,
  bodyBn?: string | null,
): number {
  const scoreEn = bodyEn ? queryWordMatchScore(query, bodyEn) : 0;
  const scoreBn = bodyBn ? queryWordMatchScore(query, bodyBn) : 0;
  return Math.max(scoreEn, scoreBn);
}

/**
 * Mongo `$or` clauses: any query word appearing in body_en / body_bn.
 * Matches the prefilter used by similar / link-search so candidates the scorer would keep are fetched.
 */
export function wordMatchMongoOr(query: string): Array<Record<string, unknown>> | null {
  const words = querySearchWords(query);
  if (words.length === 0) {
    const normalized = normalizeQuestionText(query);
    if (!normalized) return null;
    return [
      { body_en: { $regex: escapeRegex(normalized), $options: 'i' } },
      { body_bn: { $regex: escapeRegex(normalized), $options: 'i' } },
    ];
  }
  return words.flatMap((w) => [
    { body_en: { $regex: escapeRegex(w), $options: 'i' } },
    { body_bn: { $regex: escapeRegex(w), $options: 'i' } },
  ]);
}
