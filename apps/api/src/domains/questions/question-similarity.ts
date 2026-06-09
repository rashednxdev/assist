/** Normalize question text for fuzzy comparison. */
export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(text: string): string[] {
  if (text.length < 2) return text.length === 1 ? [text] : [];
  const out: string[] = [];
  for (let i = 0; i < text.length - 1; i++) out.push(text.slice(i, i + 2));
  return out;
}

function diceCoefficient(a: string, b: string): number {
  const bgA = bigrams(a);
  const bgB = bigrams(b);
  if (!bgA.length && !bgB.length) return a === b ? 1 : 0;
  if (!bgA.length || !bgB.length) return 0;

  const counts = new Map<string, number>();
  for (const bg of bgA) counts.set(bg, (counts.get(bg) ?? 0) + 1);

  let matches = 0;
  for (const bg of bgB) {
    const c = counts.get(bg) ?? 0;
    if (c > 0) {
      matches++;
      counts.set(bg, c - 1);
    }
  }
  return (2 * matches) / (bgA.length + bgB.length);
}

function tokenJaccard(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter((w) => w.length > 1));
  const tb = new Set(b.split(' ').filter((w) => w.length > 1));
  if (!ta.size && !tb.size) return 0;

  let intersection = 0;
  for (const w of ta) if (tb.has(w)) intersection++;
  const union = new Set([...ta, ...tb]).size;
  return union ? intersection / union : 0;
}

/** Similarity score from 0 to 1 (1 = identical). */
export function questionSimilarity(a: string, b: string): number {
  const na = normalizeQuestionText(a);
  const nb = normalizeQuestionText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length > nb.length ? na : nb;
  let containment = 0;
  if (longer.includes(shorter)) {
    containment = shorter.length / longer.length;
  }

  const dice = diceCoefficient(na, nb);
  const jaccard = tokenJaccard(na, nb);
  return Math.max(containment, dice, jaccard);
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractSearchKeywords(text: string): string[] {
  return [
    ...new Set(
      normalizeQuestionText(text)
        .split(' ')
        .filter((w) => w.length >= 3),
    ),
  ].slice(0, 8);
}
