import { z } from 'zod';
import { comparisonTableSchema, cleanComparisonTable, hasComparisonTableContent } from './comparison-table.js';
import { processStepSchema } from './process.js';

export const explanationSubsectionSchema = z.object({
  subtitle: z.string(),
  details: z.string().optional(),
  note: z.string().optional(),
});

/** A Process nested under an explanation/model-answer section — same shape as the Book Process feature. */
export const explanationProcessSchema = z.object({
  title: z.string().optional(),
  details: z.string().optional(),
  steps: z.array(processStepSchema).default([]),
});

export const explanationSectionSchema = z.object({
  title: z.string(),
  details: z.string().optional(),
  note: z.string().optional(),
  subsections: z.array(explanationSubsectionSchema).default([]),
  /** Optional comparison table nested under this section's title (e.g. a "Differences" table inside a normal model answer). */
  table: comparisonTableSchema.optional(),
  /** Optional step-by-step process nested under this section's title. */
  process: explanationProcessSchema.optional(),
});

export type ExplanationSubsection = z.infer<typeof explanationSubsectionSchema>;
export type ExplanationProcess = z.infer<typeof explanationProcessSchema>;
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

export function hasProcessContent(process?: ExplanationProcess | null): boolean {
  if (!process) return false;
  if (process.title?.trim() || process.details?.trim()) return true;
  return (process.steps ?? []).some((s) => s.title?.trim());
}

export function cleanExplanationProcess(process?: ExplanationProcess | null): ExplanationProcess | undefined {
  if (!hasProcessContent(process)) return undefined;
  const steps = (process!.steps ?? [])
    .map((s) => ({
      title: s.title.trim(),
      description: s.description?.trim() || undefined,
      role: s.role?.trim() || undefined,
    }))
    .filter((s) => s.title);
  return {
    title: process!.title?.trim() || undefined,
    details: process!.details?.trim() || undefined,
    steps,
  };
}

function sectionHasContent(section: ExplanationSection): boolean {
  if (section.title.trim() || section.details?.trim() || section.note?.trim()) return true;
  if (hasComparisonTableContent(section.table)) return true;
  if (hasProcessContent(section.process)) return true;
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
      process: cleanExplanationProcess(section.process),
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
    process: section.process,
  }));
}
