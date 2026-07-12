/**
 * Prefer a single stem when EN/BN are the same (or one is empty).
 * Returns primary text plus an optional secondary translation line.
 */
export function bilingualQuestionText(bodyEn?: string | null, bodyBn?: string | null) {
  const en = bodyEn?.trim() ?? '';
  const bn = bodyBn?.trim() ?? '';

  if (!en && !bn) return { primary: '', secondary: undefined as string | undefined };
  if (!en) return { primary: bn, secondary: undefined };
  if (!bn) return { primary: en, secondary: undefined };

  const same =
    en === bn ||
    en.replace(/\s+/g, ' ') === bn.replace(/\s+/g, ' ');

  if (same) return { primary: en, secondary: undefined };
  return { primary: en, secondary: bn };
}
