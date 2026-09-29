import { z } from 'zod';
import type { ContactEmployee } from './contacts.js';

/** BCS cadre posts are pay grades 1–9; grade 10 and below are non-cadre. */
export const CADRE_GRADE_MAX = 9;
/** Non-cadre batch: same joining post, joined within this many months of the group's first joiner. */
export const BATCH_WINDOW_MONTHS = 2;
export const BCS_BATCH_MIN = 1;
export const BCS_BATCH_MAX = 99;

export type ServiceType = 'cadre' | 'non_cadre';

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function bcsBatchLabel(n: number): string {
  return `${ordinal(n)} BCS`;
}

/** Cadre is only offered when the current designation is grade 1–9 (or has no grade yet). */
export function cadreAllowedForGrade(grade: number | null | undefined): boolean {
  return grade === null || grade === undefined || grade <= CADRE_GRADE_MAX;
}

export interface ServiceInfo {
  service_type: ServiceType | null;
  bcs_batch: number | null;
  joining_date: string | null;
  joining_designation: { id: string; name: string; short_name: string; grade: number | null } | null;
  current_designation: { id: string; name: string; short_name: string; grade: number | null } | null;
  cadre_allowed: boolean;
  /** Enough to place the user in a batch. */
  complete: boolean;
}

const joiningDate = z.coerce
  .date({ errorMap: () => ({ message: 'Enter your joining date' }) })
  .refine((d) => d.getTime() <= Date.now() + 86_400_000, 'Joining date cannot be in the future')
  .refine((d) => d.getUTCFullYear() >= 1950, 'Enter a valid joining date');

export const serviceInfoInputSchema = z.discriminatedUnion(
  'service_type',
  [
    z.object({
      service_type: z.literal('cadre'),
      bcs_batch: z.coerce
        .number({ invalid_type_error: 'Enter your BCS batch' })
        .int('Enter a whole number')
        .min(BCS_BATCH_MIN, 'Enter your BCS batch')
        .max(BCS_BATCH_MAX, 'Enter a valid BCS batch'),
      joining_date: joiningDate,
    }),
    z.object({
      service_type: z.literal('non_cadre'),
      joining_designation_id: z.string().regex(/^[a-f\d]{24}$/i, 'Choose your joining post'),
      joining_date: joiningDate,
    }),
  ],
  { errorMap: () => ({ message: 'Tell us whether you are a cadre officer' }) },
);
export type ServiceInfoInput = z.infer<typeof serviceInfoInputSchema>;

export interface BatchGroup {
  /** `cadre:27` or `post:<designationId>:<yyyy-mm-dd of the first joiner>` */
  key: string;
  kind: ServiceType;
  title: string;
  bcs_batch?: number;
  designation?: { id: string; name: string; short_name: string; grade: number | null };
  /** First and last joining dates in the group. */
  from: string | null;
  to: string | null;
  count: number;
  is_mine: boolean;
}

export interface MyBatch {
  info: ServiceInfo;
  group: BatchGroup | null;
  members: ContactEmployee[];
}

export interface BatchDirectory {
  cadre: BatchGroup[];
  non_cadre: BatchGroup[];
}

export interface BatchMembers {
  group: BatchGroup;
  members: ContactEmployee[];
}
