import { z } from 'zod';
import { comparisonTableSchema, cleanComparisonTable, hasComparisonTableContent } from './comparison-table.js';

export const explanationSubsectionSchema = z.object({
  subtitle: z.string(),
  details: z.string().optional(),
  note: z.string().optional(),
});

export const explanationSectionSchema = z.object({
  title: z.string(),
  details: z.string().optional(),
  note: z.string().optional(),
  subsections: z.array(explanationSubsectionSchema).default([]),
  /** Optional comparison table nested under this section's title (e.g. a "Differences" table inside a normal model answer). */
  table: comparisonTableSchema.optional(),
});

export type ExplanationSubsection = z.infer<typeof explanationSubsectionSchema>;
export type ExplanationSection = z.infer<typeof explanationSectionSchema>;

export function emptyExplanationSubsection(): ExplanationSubsection {
  return { subtitle: '', details: '', note: '' };
}

export function emptyExplanationSection(): ExplanationSection {
  return { title: '', details: '', note: '', subsections: [] };
}

function subsectionHasContent(sub: ExplanationSubsection): boolean {
  return Boolean(sub.subtitle.trim() || sub.details?.trim() || sub.note?.trim());
}

function sectionHasContent(section: ExplanationSection): boolean {
  if (section.title.trim() || section.details?.trim() || section.note?.trim()) return true;
  if (hasComparisonTableContent(section.table)) return true;
  return (section.subsections ?? []).some(subsectionHasContent);
}

export function cleanExplanationSections(sections: ExplanationSection[]): ExplanationSection[] {
  return sections
    .map((section) => ({
      title: section.title.trim(),
      details: section.details?.trim() || undefined,
      note: section.note?.trim() || undefined,
      subsections: (section.subsections ?? [])
        .filter(subsectionHasContent)
        .map((sub) => ({
          subtitle: sub.subtitle.trim(),
          details: sub.details?.trim() || undefined,
          note: sub.note?.trim() || undefined,
        })),
      table: cleanComparisonTable(section.table),
    }))
    .filter(sectionHasContent);
}

export function hasExplanationContent(sections?: ExplanationSection[] | null): boolean {
  return cleanExplanationSections(sections ?? []).length > 0;
}

/** Convert legacy plain-text or v1 JSON explanation into structured sections. */
export function parseLegacyExplanation(raw: string): ExplanationSection[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('{"v":1')) {
    try {
      const parsed = JSON.parse(trimmed) as { v?: number; sections?: ExplanationSection[] };
      if (parsed.v === 1 && Array.isArray(parsed.sections)) {
        return cleanExplanationSections(parsed.sections);
      }
    } catch {
      /* fall through */
    }
  }
  return cleanExplanationSections([{ title: '', details: trimmed, note: '', subsections: [] }]);
}

export function serializeExplanationSections(
  sections?: ExplanationSection[] | null,
): ExplanationSection[] {
  return (sections ?? []).map((section) => ({
    title: section.title ?? '',
    details: section.details,
    note: section.note,
    subsections: (section.subsections ?? []).map((sub) => ({
      subtitle: sub.subtitle ?? '',
      details: sub.details,
      note: sub.note,
    })),
    table: section.table,
  }));
}
