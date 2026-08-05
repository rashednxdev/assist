/**
 * Local "smart search" over already-synced questions — same word-match standard used by the web
 * admin's link-search/similar-questions (see apps/api/src/domains/questions/question-similarity.ts):
 * any word in the query matching anywhere in a question counts, ranked by % of query words found,
 * 50%+ by default. Runs entirely on-device against the SQLite-cached question bank — no network
 * call, since the bank is already fully synced locally.
 */

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
 * partial words / suffixes still count).
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

/** Best match % (0-100) of the query against either text field, or 0 if neither is present. */
export function questionMatchScore(query: string, bodyEn?: string | null, bodyBn?: string | null): number {
  const scoreEn = bodyEn ? queryWordMatchScore(query, bodyEn) : 0;
  const scoreBn = bodyBn ? queryWordMatchScore(query, bodyBn) : 0;
  return Math.max(scoreEn, scoreBn);
}

/**
 * Scores every item against the query, keeps those at or above `threshold` (default 50%), and
 * returns them sorted best-match-first. Pass-through (no scoring/filtering) when the query is blank.
 */
export function searchQuestionsByText<T>(
  query: string,
  items: T[],
  getText: (item: T) => { bodyEn?: string | null; bodyBn?: string | null },
  threshold = 0.5,
): Array<{ item: T; score: number }> {
  const q = query.trim();
  if (!q) return items.map((item) => ({ item, score: 1 }));

  const scored = items.map((item) => {
    const { bodyEn, bodyBn } = getText(item);
    return { item, score: questionMatchScore(q, bodyEn, bodyBn) };
  });

  return scored.filter((row) => row.score >= threshold).sort((a, b) => b.score - a.score);
}
