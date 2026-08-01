import { z } from 'zod';
import { explanationSectionSchema, type ExplanationSection } from './explanation.js';

export const updateTermsSchema = z.object({
  header: z.string().min(1).max(200),
  sections: z.array(explanationSectionSchema).min(1, 'Add at least one section'),
});

export type UpdateTermsDto = z.infer<typeof updateTermsSchema>;

export interface TermsRecord {
  header: string;
  sections: ExplanationSection[];
  updated_at: string;
}
