import type { UpdateTermsDto, TermsRecord } from '@ibas/shared-types';
import { cleanExplanationSections } from '@ibas/shared-types';
import { TermsAndConditions } from './models/TermsAndConditions.model.js';

const DEFAULT_HEADER = 'Terms and Conditions';

export async function getTerms(): Promise<TermsRecord> {
  const doc = await TermsAndConditions.findOne({ key: 'global' });
  return {
    header: doc?.header ?? DEFAULT_HEADER,
    sections: doc?.sections ?? [],
    updated_at: (doc?.updated_at ?? new Date(0)).toISOString(),
  };
}

export async function updateTerms(dto: UpdateTermsDto, updatedBy: string): Promise<TermsRecord> {
  const sections = cleanExplanationSections(dto.sections);
  const doc = await TermsAndConditions.findOneAndUpdate(
    { key: 'global' },
    { header: dto.header.trim(), sections, updated_by: updatedBy, updated_at: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return {
    header: doc.header,
    sections: doc.sections,
    updated_at: doc.updated_at.toISOString(),
  };
}
