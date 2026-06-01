/**
 * Resolve display text: English UI prefers _en, falls back to _bn.
 */
export function displayText(doc: {
  [key: string]: string | undefined;
  name_en?: string;
  name_bn?: string;
  full_name_en?: string;
  full_name_bn?: string;
}): string {
  return (
    doc.full_name_en ??
    doc.name_en ??
    doc.full_name_bn ??
    doc.name_bn ??
    ''
  );
}

/** Zod-friendly bilingual pair for data entry forms */
export const bilingualTextFields = {
  enKey: '_en',
  bnKey: '_bn',
} as const;
