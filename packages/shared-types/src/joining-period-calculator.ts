import {
  JOINING_APPROACH_EXCLUDE_KM,
  JOINING_MAX_DAYS_INCLUDING_WEEKLY,
  JOINING_PREPARATION_DAYS,
  JOINING_SAME_STATION_DAYS,
  JOINING_TRAVEL_PER_DAY,
  type JoiningCalcMethod,
  type JoiningHandoverTime,
  type JoiningTravelMode,
  type JoiningWeeklyHoliday,
} from '@ibas/shared-constants';
import type { JoiningJourneyLegDto, JoiningPeriodCalculateDto } from './joining-period.js';

export interface JoiningJourneyBreakdown {
  mode: JoiningTravelMode;
  countable_distance_km: number;
  travel_days: number;
  steamer_delay_days: number;
  approach_excluded_km: number;
  notes: string[];
}

export interface JoiningPeriodResult {
  residence_change: boolean;
  calc_method: JoiningCalcMethod;
  preparation_days: number;
  travel_days: number;
  steamer_delay_days: number;
  hod_extension_days: number;
  /** Joining-period days before weekly-holiday calendar expansion (prep + travel + delays + extension). */
  joining_period_days: number;
  /** Weekly holidays that fall inside the joining span (additional on calendar, not counted in prep). */
  weekly_holiday_days: number;
  /** Government / optional holidays that fell inside the span (counted within joining period). */
  government_holiday_days_in_span: number;
  /** Calendar days from start through end of joining period (includes weekly holidays). */
  calendar_days: number;
  /** Final allowed calendar days after applying the 30-day cap. */
  allowed_calendar_days: number;
  capped: boolean;
  start_date?: string;
  end_date?: string;
  journeys: JoiningJourneyBreakdown[];
  rules_applied: string[];
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function formatYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** JS getUTCDay: 0=Sun … 5=Fri, 6=Sat */
function isWeeklyHoliday(date: Date, weekly: JoiningWeeklyHoliday): boolean {
  const day = date.getUTCDay();
  if (weekly === 'friday') return day === 5;
  if (weekly === 'friday_saturday') return day === 5 || day === 6;
  return day === 0; // sunday
}

function milesToKm(miles: number, mode: Exclude<JoiningTravelMode, 'air'>): number {
  const row = JOINING_TRAVEL_PER_DAY[mode];
  // Convert via the official mile↔km pairing for that mode.
  return (miles * row.km) / row.miles;
}

function resolveDistanceKm(leg: JoiningJourneyLegDto, mode: Exclude<JoiningTravelMode, 'air'>): number {
  if (leg.distance_km != null && Number.isFinite(leg.distance_km)) return Math.max(0, leg.distance_km);
  if (leg.distance_miles != null && Number.isFinite(leg.distance_miles)) {
    return Math.max(0, milesToKm(leg.distance_miles, mode));
  }
  return 0;
}

function approachExcludedKm(km: number | undefined): number {
  if (km == null || !Number.isFinite(km) || km <= 0) return 0;
  return km <= JOINING_APPROACH_EXCLUDE_KM ? km : 0;
}

function travelDaysFromDistance(mode: Exclude<JoiningTravelMode, 'air'>, distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  const perDay = JOINING_TRAVEL_PER_DAY[mode].km;
  return Math.ceil(distanceKm / perDay);
}

function breakdownJourney(
  leg: JoiningJourneyLegDto,
  calcMethod: JoiningCalcMethod,
): JoiningJourneyBreakdown {
  const notes: string[] = [];
  const steamerDelay = Math.max(0, leg.steamer_delay_days ?? 0);

  if (leg.mode === 'air' || calcMethod === 'actual') {
    const travel = Math.max(0, leg.actual_journey_days ?? 0);
    if (leg.mode === 'air') {
      notes.push('Air travel: preparation (6 days excl. weekly holidays) + actual journey time.');
    } else {
      notes.push('Current practice: travel days from actual journey time.');
    }
    if (steamerDelay > 0) {
      notes.push(`Steamer delay ${steamerDelay} day(s) counted as preparation.`);
    }
    return {
      mode: leg.mode,
      countable_distance_km: 0,
      travel_days: travel,
      steamer_delay_days: steamerDelay,
      approach_excluded_km: 0,
      notes,
    };
  }

  const mode = leg.mode;
  let distanceKm = resolveDistanceKm(leg, mode);
  const exclStart = approachExcludedKm(leg.approach_start_km);
  const exclEnd = approachExcludedKm(leg.approach_end_km);
  const excluded = exclStart + exclEnd;
  if (excluded > 0) {
    distanceKm = Math.max(0, distanceKm - excluded);
    notes.push(
      `Approach ≤ ${JOINING_APPROACH_EXCLUDE_KM} km excluded (${excluded} km) from travel distance.`,
    );
  }

  const travel = travelDaysFromDistance(mode, distanceKm);
  const per = JOINING_TRAVEL_PER_DAY[mode];
  notes.push(
    `${mode}: 1 day per ${per.miles} miles / ${per.km} km (fraction → full day) → ${travel} day(s) for ${distanceKm} km.`,
  );
  if (steamerDelay > 0) {
    notes.push(`Steamer delay ${steamerDelay} day(s) counted as preparation.`);
  }

  return {
    mode,
    countable_distance_km: distanceKm,
    travel_days: travel,
    steamer_delay_days: steamerDelay,
    approach_excluded_km: excluded,
    notes,
  };
}

/**
 * Walk the calendar from startDate, consuming `joiningDays` of joining-period credit.
 * Weekly holidays do not consume credit (they are additional calendar days).
 * Government holidays consume credit (counted within joining period).
 * Stops when joining credit is exhausted or calendar would exceed maxDays.
 */
function placeOnCalendar(params: {
  startDate: Date;
  joiningDays: number;
  weekly: JoiningWeeklyHoliday;
  govHolidays: Set<string>;
  maxCalendarDays: number;
}): {
  calendarDays: number;
  weeklyHolidayDays: number;
  governmentHolidayDaysInSpan: number;
  endDate: Date;
  capped: boolean;
} {
  let joiningLeft = params.joiningDays;
  let calendarDays = 0;
  let weeklyHolidayDays = 0;
  let governmentHolidayDaysInSpan = 0;
  let cursor = new Date(params.startDate);
  let capped = false;
  let endDate = new Date(params.startDate);

  if (joiningLeft <= 0) {
    return {
      calendarDays: 0,
      weeklyHolidayDays: 0,
      governmentHolidayDaysInSpan: 0,
      endDate,
      capped: false,
    };
  }

  // Safety bound
  const hardStop = params.maxCalendarDays + 60;
  let steps = 0;

  while (joiningLeft > 0 && steps < hardStop) {
    steps += 1;
    if (calendarDays >= params.maxCalendarDays) {
      capped = true;
      break;
    }

    const ymd = formatYmd(cursor);
    const weekly = isWeeklyHoliday(cursor, params.weekly);
    const isGov = params.govHolidays.has(ymd);

    calendarDays += 1;
    endDate = new Date(cursor);

    if (weekly) {
      weeklyHolidayDays += 1;
      // Weekly holiday is additional — does not consume joining credit
    } else {
      joiningLeft -= 1;
      if (isGov) governmentHolidayDaysInSpan += 1;
    }

    cursor = addUtcDays(cursor, 1);
  }

  if (joiningLeft > 0) capped = true;

  return {
    calendarDays,
    weeklyHolidayDays,
    governmentHolidayDaysInSpan,
    endDate,
    capped,
  };
}

function resolveStartDate(
  handoverDate: string | undefined,
  handoverTime: JoiningHandoverTime,
): { start?: Date; note: string } {
  if (!handoverDate?.trim()) {
    return {
      start: undefined,
      note: 'No handover date — calendar span estimated without weekly-holiday placement.',
    };
  }
  let start = parseYmd(handoverDate.trim());
  if (handoverTime === 'afternoon') {
    start = addUtcDays(start, 1);
    return {
      start,
      note: 'Handover in the afternoon — joining period starts the next day.',
    };
  }
  if (handoverTime === 'unspecified') {
    return {
      start,
      note: 'Handover time not mentioned — assumed morning; joining period starts that day.',
    };
  }
  return {
    start,
    note: 'Handover in the morning — joining period starts that day.',
  };
}

export function calculateJoiningPeriod(input: JoiningPeriodCalculateDto): JoiningPeriodResult {
  const rules: string[] = [];

  if (!input.residence_change) {
    rules.push(
      'No change of residence (same station): only 1 day of joining period; leave is also counted in this 1 day.',
    );
    return {
      residence_change: false,
      calc_method: input.calc_method,
      preparation_days: 0,
      travel_days: 0,
      steamer_delay_days: 0,
      hod_extension_days: 0,
      joining_period_days: JOINING_SAME_STATION_DAYS,
      weekly_holiday_days: 0,
      government_holiday_days_in_span: 0,
      calendar_days: JOINING_SAME_STATION_DAYS,
      allowed_calendar_days: JOINING_SAME_STATION_DAYS,
      capped: false,
      journeys: [],
      rules_applied: rules,
    };
  }

  rules.push(
    'Change of residence (station to station): preparation + travel (+ delays/extensions), subject to a 30-day maximum including weekly holidays.',
  );
  rules.push(
    `Preparation: ${JOINING_PREPARATION_DAYS} days. Weekly holidays within preparation are excluded from the ${JOINING_PREPARATION_DAYS}-day count; government/optional holidays count within it.`,
  );
  rules.push(
    'Weekly holidays are not included in joining-period credit (they are additional on the calendar). Declared government holidays count within the joining period.',
  );
  rules.push(
    `Maximum: joining period including weekly holidays must not exceed ${JOINING_MAX_DAYS_INCLUDING_WEEKLY} days.`,
  );

  const calcMethod = input.calc_method;
  if (calcMethod === 'actual') {
    rules.push(
      'Current practice: travel portion uses actual journey time instead of the legacy distance formula.',
    );
  } else {
    rules.push(
      'Legacy distance method: rail 250 mi/400 km, sea 200 mi/320 km, river 80 mi/128 km, bus 80 mi/128 km, road 15 mi/15 km per day; any fraction = full day.',
    );
    rules.push(
      `Approach by road of ${JOINING_APPROACH_EXCLUDE_KM} km (5 miles) or less to/from station/ghat is not counted.`,
    );
  }

  const journeyBreakdowns = (input.journeys ?? []).map((leg) => breakdownJourney(leg, calcMethod));
  const travelDays = journeyBreakdowns.reduce((s, j) => s + j.travel_days, 0);
  const steamerDelayDays = journeyBreakdowns.reduce((s, j) => s + j.steamer_delay_days, 0);
  const preparationDays = JOINING_PREPARATION_DAYS + steamerDelayDays;
  const hodExtension = Math.max(0, input.hod_extension_days ?? 0);
  if (hodExtension > 0) {
    rules.push(
      `Head of Department extension: ${hodExtension} day(s) for unavoidable delay (still subject to the ${JOINING_MAX_DAYS_INCLUDING_WEEKLY}-day cap).`,
    );
  }
  if (journeyBreakdowns.length > 1) {
    rules.push('Multiple journeys: joining periods for similar journeys are added together.');
  }
  for (const j of journeyBreakdowns) {
    rules.push(...j.notes);
  }

  const joiningPeriodDays = preparationDays + travelDays + hodExtension;

  const { start, note: handoverNote } = resolveStartDate(input.handover_date, input.handover_time);
  rules.push(handoverNote);

  const govSet = new Set((input.government_holiday_dates ?? []).map((d) => d.trim()).filter(Boolean));

  if (!start) {
    // Without a start date, approximate calendar = joining days (weekly holidays unknown).
    const allowed = Math.min(joiningPeriodDays, JOINING_MAX_DAYS_INCLUDING_WEEKLY);
    const capped = joiningPeriodDays > JOINING_MAX_DAYS_INCLUDING_WEEKLY;
    if (capped) {
      rules.push(
        `Capped at ${JOINING_MAX_DAYS_INCLUDING_WEEKLY} days (including weekly holidays). Provide a handover date for a precise calendar span.`,
      );
    }
    return {
      residence_change: true,
      calc_method: calcMethod,
      preparation_days: preparationDays,
      travel_days: travelDays,
      steamer_delay_days: steamerDelayDays,
      hod_extension_days: hodExtension,
      joining_period_days: joiningPeriodDays,
      weekly_holiday_days: 0,
      government_holiday_days_in_span: 0,
      calendar_days: allowed,
      allowed_calendar_days: allowed,
      capped,
      journeys: journeyBreakdowns,
      rules_applied: rules,
    };
  }

  const placed = placeOnCalendar({
    startDate: start,
    joiningDays: joiningPeriodDays,
    weekly: input.weekly_holiday,
    govHolidays: govSet,
    maxCalendarDays: JOINING_MAX_DAYS_INCLUDING_WEEKLY,
  });

  if (placed.capped) {
    rules.push(
      `Result capped: calendar span including weekly holidays cannot exceed ${JOINING_MAX_DAYS_INCLUDING_WEEKLY} days.`,
    );
  }

  return {
    residence_change: true,
    calc_method: calcMethod,
    preparation_days: preparationDays,
    travel_days: travelDays,
    steamer_delay_days: steamerDelayDays,
    hod_extension_days: hodExtension,
    joining_period_days: joiningPeriodDays,
    weekly_holiday_days: placed.weeklyHolidayDays,
    government_holiday_days_in_span: placed.governmentHolidayDaysInSpan,
    calendar_days: placed.calendarDays,
    allowed_calendar_days: placed.calendarDays,
    capped: placed.capped,
    start_date: formatYmd(start),
    end_date: formatYmd(placed.endDate),
    journeys: journeyBreakdowns,
    rules_applied: rules,
  };
}
