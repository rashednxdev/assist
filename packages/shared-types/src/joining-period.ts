import { z } from 'zod';
import {
  JOINING_CALC_METHODS,
  JOINING_HANDOVER_TIMES,
  JOINING_TRAVEL_MODES,
  JOINING_WEEKLY_HOLIDAYS,
} from '@ibas/shared-constants';

export const joiningJourneyLegSchema = z.object({
  mode: z.enum(JOINING_TRAVEL_MODES),
  /** Distance in km (preferred). Used for rail/sea/river/bus/road under distance method. */
  distance_km: z.number().min(0).optional(),
  /** Distance in miles (legacy). Converted when km not provided. */
  distance_miles: z.number().min(0).optional(),
  /** Actual journey days — air travel, or current-practice method. */
  actual_journey_days: z.number().min(0).optional(),
  /** Road distance residence/office → station/ghat at journey start (km). ≤8 km excluded. */
  approach_start_km: z.number().min(0).optional(),
  /** Road distance station/ghat → residence/office at journey end (km). ≤8 km excluded. */
  approach_end_km: z.number().min(0).optional(),
  /** Steamer delay due to unavoidable reasons — counted as preparation. */
  steamer_delay_days: z.number().min(0).optional(),
});

export const joiningPeriodCalculateSchema = z.object({
  /** False = same station / no residence change → 1 day only. */
  residence_change: z.boolean(),
  /** Charge handover date (YYYY-MM-DD). Used to place prep/travel on the calendar. */
  handover_date: z.string().min(1).optional(),
  handover_time: z.enum(JOINING_HANDOVER_TIMES).default('unspecified'),
  weekly_holiday: z.enum(JOINING_WEEKLY_HOLIDAYS).default('friday'),
  /** distance = legacy mile/km formula; actual = current practice (journey time). */
  calc_method: z.enum(JOINING_CALC_METHODS).default('actual'),
  journeys: z.array(joiningJourneyLegSchema).default([]),
  /** Declared government / optional holiday dates (YYYY-MM-DD) — count within joining period. */
  government_holiday_dates: z.array(z.string()).default([]),
  /** HoD extension for unavoidable delay (days), subject to 30-day cap. */
  hod_extension_days: z.number().min(0).default(0),
});

export type JoiningJourneyLegDto = z.infer<typeof joiningJourneyLegSchema>;
export type JoiningPeriodCalculateDto = z.infer<typeof joiningPeriodCalculateSchema>;
