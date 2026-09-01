import {
  calculateSalary2026AllPhases,
  salaryCalculateSchema,
  type SalaryCalculateDto,
  type SalaryUsageStatsRecord,
} from '@ibas/shared-types';
import { badRequest } from '../../shared/errors/AppError.js';
import { SalaryUsageStats } from './models/SalaryUsageStats.model.js';

const GLOBAL_KEY = 'global';

function parseInput(body: unknown): SalaryCalculateDto {
  const parsed = salaryCalculateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
  }
  return parsed.data;
}

async function incrementField(
  field: 'calculate_all_phases_count' | 'pdf_download_count',
  dateField: 'last_calculate_at' | 'last_pdf_at',
): Promise<void> {
  await SalaryUsageStats.findOneAndUpdate(
    { key: GLOBAL_KEY },
    {
      $inc: { [field]: 1 },
      $set: { [dateField]: new Date() },
    },
    { upsert: true },
  );
}

export async function calculateAllPhasesWithTracking(body: unknown) {
  const input = parseInput(body);
  const results = calculateSalary2026AllPhases({
    grade: input.grade as Parameters<typeof calculateSalary2026AllPhases>[0]['grade'],
    old_pay: input.old_pay,
  });
  await incrementField('calculate_all_phases_count', 'last_calculate_at');
  return results;
}

export async function getSalaryUsageStats(): Promise<SalaryUsageStatsRecord> {
  const doc = await SalaryUsageStats.findOne({ key: GLOBAL_KEY }).lean();
  return {
    calculate_all_phases_count: doc?.calculate_all_phases_count ?? 0,
    pdf_download_count: doc?.pdf_download_count ?? 0,
    last_calculate_at: doc?.last_calculate_at?.toISOString() ?? null,
    last_pdf_at: doc?.last_pdf_at?.toISOString() ?? null,
  };
}

export async function trackPdfDownload(): Promise<void> {
  await incrementField('pdf_download_count', 'last_pdf_at');
}

export { parseInput };
