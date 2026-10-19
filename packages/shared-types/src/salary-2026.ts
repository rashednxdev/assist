/**
 * Bangladesh National Pay Scale — 2015 → 2026 conversion (Salary On 2026).
 *
 * Phases:
 * - 01-07-2026: Step 5 = (Step 4 − old pay) × 40%/50%; Step 6 = next stage − Step 4;
 *               Step 7 = old pay + Step 5 + Step 6
 * - 01-01-2027: same layout; Step 5 rate 70% (grades 1–9) / 75% (10–20)
 * - 01-07-2027: 01-07-2026 basic = next stage after matched Step 4;
 *               01-07-2027 basic = next stage after that amount
 */

import { z } from 'zod';

export type PayGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

export type SalaryPhase = '2026-07-01' | '2027-01-01' | '2027-07-01';

/** National Pay Scale 2015 — stages per grade (grade 1 is fixed). */
export const NPS_2015: Record<PayGrade, readonly number[]> = {
  1: [78000],
  2: [66000, 68480, 71050, 73720, 76490],
  3: [56500, 58760, 61120, 63570, 66120, 68770, 71530, 74400],
  4: [50000, 52000, 54080, 56250, 58500, 60840, 63280, 65820, 68460, 71200],
  5: [
    43000, 44940, 46970, 49090, 51300, 53610, 56030, 58560, 61200, 63960, 66840, 69850,
  ],
  6: [
    35500, 37280, 39150, 41110, 43170, 45330, 47600, 49980, 52480, 55110, 57870, 60770, 63810,
    67010,
  ],
  7: [
    29000, 30450, 31980, 33580, 35260, 37030, 38890, 40840, 42890, 45040, 47300, 49670, 52160,
    54770, 57510, 60390, 63410,
  ],
  8: [
    23000, 24150, 25360, 26630, 27970, 29370, 30840, 32390, 34010, 35720, 37510, 39390, 41360,
    43430, 45610, 47900, 50300, 52820, 55470,
  ],
  9: [
    22000, 23100, 24260, 25480, 26760, 28100, 29510, 30990, 32540, 34170, 35880, 37680, 39570,
    41550, 43630, 45820, 48120, 50530, 53060,
  ],
  10: [
    16000, 16800, 17640, 18530, 19460, 20440, 21470, 22550, 23680, 24870, 26120, 27430, 28810,
    30260, 31780, 33370, 35040, 36800, 38640,
  ],
  11: [
    12500, 13130, 13790, 14480, 15210, 15980, 16780, 17620, 18510, 19440, 20420, 21450, 22530,
    23660, 24850, 26100, 27410, 28790, 30230,
  ],
  12: [
    11300, 11870, 12470, 13100, 13760, 14450, 15180, 15940, 16740, 17580, 18460, 19390, 20360,
    21380, 22450, 23580, 24760, 26000, 27300,
  ],
  13: [
    11000, 11550, 12130, 12740, 13380, 14050, 14760, 15500, 16280, 17100, 17960, 18860, 19810,
    20810, 21860, 22960, 24110, 25320, 26590,
  ],
  14: [
    10200, 10710, 11250, 11820, 12420, 13050, 13710, 14400, 15120, 15880, 16680, 17520, 18400,
    19320, 20290, 21310, 22380, 23500, 24680,
  ],
  15: [
    9700, 10190, 10700, 11240, 11810, 12410, 13040, 13700, 14390, 15110, 15870, 16670, 17510,
    18390, 19310, 20280, 21300, 22370, 23490,
  ],
  16: [
    9300, 9770, 10260, 10780, 11320, 11890, 12490, 13120, 13780, 14470, 15200, 15960, 16760,
    17600, 18480, 19410, 20390, 21410, 22490,
  ],
  17: [
    9000, 9450, 9930, 10430, 10960, 11510, 12090, 12700, 13340, 14010, 14920, 15460, 16240,
    17060, 17920, 18820, 19770, 20760, 21800,
  ],
  18: [
    8800, 9240, 9710, 10200, 10710, 11250, 11820, 12420, 13050, 13710, 14400, 15120, 15880,
    16680, 17520, 18400, 19320, 20290, 21310,
  ],
  19: [
    8500, 8930, 9380, 9850, 10350, 10870, 11420, 12000, 12600, 13230, 13900, 14600, 15330,
    16100, 16910, 17760, 18650, 19590, 20570,
  ],
  20: [
    8250, 8670, 9110, 9570, 10050, 10560, 11090, 11650, 12240, 12860, 13510, 14190, 14900,
    15650, 16440, 17270, 18140, 19050, 20010,
  ],
};

/** National Pay Scale 2026 — stages per grade (grade 1 is fixed). */
export const NPS_2026: Record<PayGrade, readonly number[]> = {
  1: [156000],
  2: [132000, 135700, 139400, 143200, 147200, 151200, 153000],
  3: [113000, 117000, 121100, 125300, 129700, 134300, 139000, 143800, 148800],
  4: [
    100000, 103500, 107200, 110900, 114800, 118800, 123000, 127300, 131700, 136300, 142400,
  ],
  5: [
    86000, 89500, 93100, 96800, 100700, 104700, 108900, 113200, 117700, 122400, 127400, 132400,
    139700,
  ],
  6: [
    71000, 74600, 78300, 82200, 86400, 90700, 95200, 100000, 104900, 110200, 115700, 121500,
    127600, 134000,
  ],
  7: [
    58000, 60900, 64000, 67200, 70500, 74100, 77800, 81700, 85700, 90000, 94500, 99200, 104200,
    109400, 114900, 120600, 126800,
  ],
  8: [
    46000, 48300, 50800, 53300, 56000, 58800, 61700, 64800, 68000, 71400, 75000, 78700, 82700,
    86800, 91100, 95700, 100500, 105500, 110800,
  ],
  9: [
    44000, 46200, 48600, 51000, 53500, 56200, 59000, 62000, 65100, 68300, 71700, 75300, 79100,
    83000, 87200, 91500, 96100, 100900, 105900,
  ],
  10: [
    32000, 33600, 35300, 37100, 38900, 40900, 42900, 45100, 47300, 49700, 52200, 54800, 57500,
    60400, 63400, 66600, 69900, 73400, 77000,
  ],
  11: [
    25000, 26300, 27600, 29000, 30400, 32000, 33600, 35200, 37000, 38800, 40800, 42800, 44900,
    47200, 49500, 52000, 54600, 57300, 60500,
  ],
  12: [
    24300, 25600, 26800, 28200, 29600, 31100, 32600, 34200, 36000, 37700, 39600, 41400, 43400,
    45300, 48200, 50600, 53100, 55700, 58700,
  ],
  13: [
    24000, 25200, 26500, 27800, 29200, 30700, 32200, 33800, 35500, 37300, 39100, 41100, 43200,
    45300, 47600, 49900, 52400, 55100, 58000,
  ],
  14: [
    23500, 24700, 26000, 27300, 28600, 30000, 31500, 33100, 34800, 36500, 38300, 40200, 42300,
    44400, 46600, 48900, 51300, 53900, 56800,
  ],
  15: [
    22800, 24000, 25200, 26400, 27800, 29100, 30600, 32100, 33700, 35400, 37200, 39000, 41000,
    43000, 45200, 47400, 49800, 52300, 55200,
  ],
  16: [
    21900, 23000, 24200, 25400, 26700, 28000, 29400, 30900, 32400, 34000, 35700, 37500, 39400,
    41300, 43400, 45600, 47900, 50200, 52900,
  ],
  17: [
    21400, 22500, 23600, 24800, 26100, 27400, 28700, 30200, 31700, 33200, 34900, 36700, 38500,
    40400, 42400, 44500, 46800, 49100, 51900,
  ],
  18: [
    21000, 22100, 23200, 24400, 25600, 26900, 28200, 29600, 31100, 32600, 34300, 36000, 37800,
    39600, 41600, 43700, 45900, 48200, 50600,
  ],
  19: [
    20500, 21600, 22700, 23800, 25000, 26200, 27500, 28900, 30300, 31900, 33800, 35100, 36900,
    38700, 40600, 42700, 44800, 47000, 49600,
  ],
  20: [
    20000, 21000, 22100, 23200, 24400, 25600, 26900, 28200, 29600, 31100, 32600, 34300, 36000,
    37800, 39600, 41600, 43700, 45900, 48400,
  ],
};

export const PAY_GRADES: PayGrade[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
];

export const SALARY_PHASES: SalaryPhase[] = ['2026-07-01', '2027-01-01', '2027-07-01'];

export function isPayGrade(n: number): n is PayGrade {
  return Number.isInteger(n) && n >= 1 && n <= 20;
}

export function isFixedPayGrade(grade: PayGrade): boolean {
  return NPS_2015[grade].length === 1 && NPS_2026[grade].length === 1;
}

/** Rates for percentage-based Step 5 (not used when 01-07-2027 takes next stage). */
export function salaryConversionRate(
  grade: PayGrade,
  phase: SalaryPhase = '2026-07-01',
): number {
  if (phase === '2027-01-01' || phase === '2027-07-01') {
    return grade >= 10 ? 0.75 : 0.7;
  }
  return grade >= 10 ? 0.5 : 0.4;
}

export function salaryPhaseLabel(phase: SalaryPhase): string {
  switch (phase) {
    case '2026-07-01':
      return '01-07-2026';
    case '2027-01-01':
      return '01-01-2027';
    case '2027-07-01':
      return '01-07-2027';
  }
}

export function salaryPhaseTitle(phase: SalaryPhase): string {
  switch (phase) {
    case '2026-07-01':
      return 'Stage-1';
    case '2027-01-01':
      return 'Stage-2';
    case '2027-07-01':
      return 'Stage-3';
  }
}

export function salaryPhaseRateNote(grade: PayGrade, phase: SalaryPhase): string {
  if (phase === '2026-07-01') {
    return grade >= 10 ? 'Rate 50% (grades 10–20)' : 'Rate 40% (grades 1–9)';
  }
  return grade >= 10 ? 'Rate 75% (grades 10–20)' : 'Rate 70% (grades 1–9)';
}

/** Always two decimals (e.g. 8,250.00) so taka and paisa read the same everywhere. */
export function formatTaka(amount: number): string {
  const paisa = Math.round(amount * 100);
  return new Intl.NumberFormat('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paisa / 100);
}

/**
 * Paisa → whole Taka (government half-up rule):
 * - 50 paisa or more → round up to the next taka (2.50 → 3, 2.60 → 3)
 * - less than 50 paisa → discard the fraction (2.49 → 2)
 */
export function roundSalaryTaka(amount: number): number {
  const sign = amount < 0 ? -1 : 1;
  const abs = Math.abs(amount);
  const whole = Math.trunc(abs);
  const fraction = abs - whole;
  return sign * (fraction >= 0.5 ? whole + 1 : whole);
}

function toPaisa(amount: number): number {
  return roundSalaryTaka(amount);
}

function stageOrNextHigher(scale: readonly number[], target: number): { amount: number; index: number } {
  for (let i = 0; i < scale.length; i++) {
    if (scale[i]! >= target) return { amount: scale[i]!, index: i };
  }
  const last = scale.length - 1;
  return { amount: scale[last]!, index: last };
}

/** Joined on or after this date (YYYY-MM-DD): no 01-07-2026 increment for the initial basic of Grade 7–20. */
export const SALARY_INCREMENT_CUTOFF_DATE = '2026-01-02';

/** Grades 7–20 on the initial NPS 2015 basic (step 1): the joining date of service is asked. */
export function asksJoiningDate(grade: number, oldPay: number): boolean {
  return isPayGrade(grade) && grade >= 7 && NPS_2015[grade][0] === Math.round(Number(oldPay));
}

/** True when the 01-07-2026 increment is withheld: initial basic of Grade 7–20, joined on or after 02-01-2026. */
export function isIncrementWithheld(grade: number, oldPay: number, joiningDate?: string | null): boolean {
  return asksJoiningDate(grade, oldPay) && isIsoDate(joiningDate) && joiningDate >= SALARY_INCREMENT_CUTOFF_DATE;
}

/** True when Step 6 is excluded — joining-date rule or an exceptional increment exemption. */
export function isIncrementExcluded(
  grade: number,
  oldPay: number,
  joiningDate?: string | null,
  incrementExempt?: boolean,
): boolean {
  return Boolean(incrementExempt) || isIncrementWithheld(grade, oldPay, joiningDate);
}

/** Promotion / demotion / disciplinary pay change on or after 01-07-2026 (NPS 2015 grade + basic). */
export interface SalaryPayChange {
  effective_date: string;
  grade: number;
  old_pay: number;
  /**
   * Substantive grade of the working post after this pay change.
   * Used for post-promotion special allowance and T.R. Form; pre-promotion uses the main `substantive_grade`.
   */
  substantive_grade?: number | null;
}

/** Optional exceptional inputs that alter fixation and arrears (web “Exceptional issues” dialog). */
export interface SalaryExceptionalIssues {
  /** No 01-07-2026 fact increment for a special reason (any grade/basic). */
  increment_exempt?: boolean;
  /** From this date, arrears use the new grade and 2015 basic for fixation and HRA. */
  pay_change?: SalaryPayChange | null;
  /** Arrears start on this date when it is after 01-07-2026 (YYYY-MM-DD). */
  arrear_start_date?: string | null;
}

export const NO_EXCEPTIONAL_ISSUES: SalaryExceptionalIssues = {
  increment_exempt: false,
  pay_change: null,
  arrear_start_date: null,
};

export interface Salary2026Input {
  grade: PayGrade;
  /** Current basic on NPS 2015 for this grade (must match a published stage). */
  old_pay: number;
  phase?: SalaryPhase;
  /** Joining date of service (YYYY-MM-DD); only read for the initial basic of Grade 7–20. */
  joining_date?: string | null;
  /** When true, Step 6 (01-07-2026 increment) is excluded regardless of joining date. */
  increment_exempt?: boolean;
  /**
   * Promotion / demotion / higher scale from the exceptional-issues dialog.
   * New basic = fixation new_pay + (matched 2026 step − origin fixed 01-07-2026) × phase rate.
   */
  pay_change?: SalaryPayChange | null;
  /** Substantive grade for the promotion % rate (defaults like arrears). */
  substantive_grade?: number | null;
}

export interface Salary2026StepRow {
  step: number;
  label: string;
  /** Human-readable arithmetic for the Description, when applicable. */
  calculation?: string;
  value: number;
  note?: string;
}

export interface Salary2026Result {
  grade: PayGrade;
  phase: SalaryPhase;
  phase_label: string;
  phase_title: string;
  fixed: boolean;
  rate: number;
  rate_percent: number;
  old_pay: number;
  old_minimum: number;
  new_minimum: number;
  new_pay: number;
  matched_new_stage: number | null;
  increment: number;
  increment_skipped: boolean;
  /** No 01-07-2026 increment because of the joining date (initial basic, Grade 7–20). */
  increment_withheld: boolean;
  /** True when Step 6 was excluded by an exceptional increment exemption. */
  increment_exempt: boolean;
  /** Stage-3 only: next stage after matched Step 4 was used for 01-07-2026 basic. */
  used_next_stage_for_step5: boolean;
  /** Stage-3 only: basic as on 01-07-2026 = next stage after matched Step 4. */
  basic_on_2026_07?: number;
  /** Stage-3 only: basic as on 01-07-2027 = next stage after 01-07-2026 basic (or same if last). */
  basic_on_2027_07?: number;
  /** Promotion / higher-scale increase added to this phase’s new basic (0 when none). */
  pay_change_increase: number;
  /** Effective date of promotion / higher scale (YYYY-MM-DD), or null. */
  pay_change_effective_date: string | null;
  /**
   * New basic before the promotion / higher-scale date (fixation only).
   * Null when there is no pay change. After that date, use `new_pay`.
   */
  new_pay_before_pay_change: number | null;
  /** Stage-3: 01-07-2026 basic before the promotion overlay. */
  basic_on_2026_07_before_pay_change?: number | null;
  /** Stage-3: 01-07-2027 basic before the promotion overlay. */
  basic_on_2027_07_before_pay_change?: number | null;
  steps: Salary2026StepRow[];
}

function buildPercentageScaleResult(opts: {
  grade: PayGrade;
  phase: SalaryPhase;
  oldPay: number;
  oldMinimum: number;
  newMinimum: number;
  newScale: readonly number[];
  step1: number;
  step3: number;
  step4: number;
  matchedIndex: number;
  rate: number;
  withheld: boolean;
  incrementExempt: boolean;
}): Salary2026Result {
  const {
    grade,
    phase,
    oldPay,
    oldMinimum,
    newMinimum,
    newScale,
    step1,
    step3,
    step4,
    matchedIndex,
    rate,
    withheld,
    incrementExempt,
  } = opts;
  const ratePercent = Math.round(rate * 100);
  const isLast = matchedIndex >= newScale.length - 1;
  const noIncrement = isLast || withheld;
  const nextStageAmount = noIncrement ? step4 : newScale[matchedIndex + 1]!;
  /** Step 5 = (Step 4 − old pay) × rate. */
  const step5 = (step4 - oldPay) * rate;
  /** Step 6 = next stage amount − Step 4 (fact increment; 0 if last stage). */
  const step6 = nextStageAmount - step4;
  /** Step 7 = old pay + Step 5 + Step 6. */
  const step7 = oldPay + step5 + step6;
  const newPay = step7;
  const effective = salaryPhaseLabel(phase);

  return {
    grade,
    phase,
    phase_label: effective,
    phase_title: salaryPhaseTitle(phase),
    fixed: false,
    rate,
    rate_percent: ratePercent,
    old_pay: oldPay,
    old_minimum: oldMinimum,
    new_minimum: newMinimum,
    new_pay: Math.round(newPay),
    matched_new_stage: step4,
    increment: step6,
    increment_skipped: noIncrement,
    increment_withheld: withheld,
    increment_exempt: incrementExempt,
    used_next_stage_for_step5: !isLast,
    pay_change_increase: 0,
    pay_change_effective_date: null,
    new_pay_before_pay_change: null,
    steps: [
      {
        step: 1,
        label: 'Old pay − Old minimum pay (30-06-26)',
        calculation: `${formatTaka(oldPay)} − ${formatTaka(oldMinimum)}`,
        value: step1,
      },
      {
        step: 2,
        label: 'New minimum pay',
        value: newMinimum,
        note: 'Published NPS 2026 minimum for this grade',
      },
      {
        step: 3,
        label: 'New minimum + Step 1',
        calculation: `${formatTaka(newMinimum)} + ${formatTaka(step1)}`,
        value: step3,
      },
      {
        step: 4,
        label: 'Matching / next higher stage on NPS 2026',
        value: step4,
        note: step3 === step4 ? 'Exact stage match' : `Next higher than ${formatTaka(step3)}`,
      },
      {
        step: 5,
        label: `(Step 4 − Old pay) × ${ratePercent}%`,
        calculation: `(${formatTaka(step4)} − ${formatTaka(oldPay)}) × ${ratePercent}%`,
        value: Math.round(step5),
        note: salaryPhaseRateNote(grade, phase),
      },
      {
        step: 6,
        label: `Next stage − Step 4 (Fact Increment ${effective})`,
        calculation: `${formatTaka(nextStageAmount)} − ${formatTaka(step4)}`,
        value: step6,
        note: withheld
          ? incrementExempt
            ? 'Exceptional exemption — no increment (Step 6 = 0)'
            : 'Joined on or after 02-01-2026 — no increment (Step 6 = 0)'
          : isLast
            ? 'Last stage — no next stage (Step 6 = 0)'
            : `Next stage ${formatTaka(nextStageAmount)} − Step 4`,
      },
      {
        step: 7,
        label: `Old pay + Step 5 + Step 6 (new basic) (${effective})`,
        calculation: `${formatTaka(oldPay)} + ${formatTaka(Math.round(step5))} + ${formatTaka(step6)}`,
        value: Math.round(step7),
      },
    ],
  };
}

/** Core fixation only (no promotion overlay). */
function calculateSalary2026Base(input: Salary2026Input): Salary2026Result {
  const grade = input.grade;
  const phase: SalaryPhase = input.phase ?? '2026-07-01';
  if (!isPayGrade(grade)) throw new Error('Grade must be between 1 and 20');

  const oldScale = NPS_2015[grade];
  const newScale = NPS_2026[grade];
  const oldPay = Math.round(Number(input.old_pay));
  if (!Number.isFinite(oldPay) || oldPay <= 0) throw new Error('Enter a valid current basic pay');
  if (!oldScale.includes(oldPay)) {
    throw new Error(`Current pay ${oldPay} is not a stage on Grade ${grade} of NPS 2015`);
  }

  const rate = salaryConversionRate(grade, phase);
  const ratePercent = Math.round(rate * 100);
  const oldMinimum = oldScale[0]!;
  const newMinimum = newScale[0]!;
  const fixed = isFixedPayGrade(grade);
  const effective = salaryPhaseLabel(phase);

  if (fixed) {
    const newFixed = newScale[0]!;
    // Stage-3: fixed grade — matched stage only (no next stage).
    if (phase === '2027-07-01') {
      return {
        grade,
        phase,
        phase_label: effective,
        phase_title: salaryPhaseTitle(phase),
        fixed: true,
        rate,
        rate_percent: ratePercent,
        old_pay: oldPay,
        old_minimum: oldMinimum,
        new_minimum: newMinimum,
        new_pay: newFixed,
        matched_new_stage: newFixed,
        increment: 0,
        increment_skipped: true,
        increment_withheld: false,
        increment_exempt: Boolean(input.increment_exempt),
        used_next_stage_for_step5: false,
        pay_change_increase: 0,
        pay_change_effective_date: null,
        new_pay_before_pay_change: null,
        basic_on_2026_07: newFixed,
        basic_on_2027_07: newFixed,
        steps: [
          {
            step: 1,
            label: 'New fixed basic (NPS 2026)',
            value: newFixed,
            note: 'Fixed pay: one published amount for this grade',
          },
          {
            step: 2,
            label: 'Basic as on 01-07-2026',
            value: newFixed,
            calculation: formatTaka(newFixed),
          },
          {
            step: 3,
            label: 'Basic as on 01-07-2027',
            value: newFixed,
            calculation: formatTaka(newFixed),
            note: 'Fixed pay — no stage move',
          },
        ],
      };
    }
    const step5 = (newFixed - oldPay) * rate;
    const newPay = oldPay + step5;
    return {
      grade,
      phase,
      phase_label: effective,
      phase_title: salaryPhaseTitle(phase),
      fixed: true,
      rate,
      rate_percent: ratePercent,
      old_pay: oldPay,
      old_minimum: oldMinimum,
      new_minimum: newMinimum,
      new_pay: Math.round(newPay),
      matched_new_stage: newFixed,
      increment: 0,
      increment_skipped: true,
      increment_withheld: false,
      increment_exempt: Boolean(input.increment_exempt),
      used_next_stage_for_step5: false,
      pay_change_increase: 0,
      pay_change_effective_date: null,
      new_pay_before_pay_change: null,
      steps: [
        {
          step: 5,
          label: `(New fixed − Old pay) × ${ratePercent}%`,
          calculation: `(${formatTaka(newFixed)} − ${formatTaka(oldPay)}) × ${ratePercent}%`,
          value: Math.round(step5),
          note: 'Fixed pay: steps 1–4 and 6–7 do not apply',
        },
        {
          step: 6,
          label: `Old pay + Step 5 (new basic) (${effective})`,
          calculation: `${formatTaka(oldPay)} + ${formatTaka(Math.round(step5))}`,
          value: Math.round(newPay),
        },
      ],
    };
  }

  const step1 = oldPay - oldMinimum;
  const step3 = newMinimum + step1;
  const matched = stageOrNextHigher(newScale, step3);
  const step4 = matched.amount;
  const isLast = matched.index >= newScale.length - 1;
  const withheld = isIncrementExcluded(grade, oldPay, input.joining_date, input.increment_exempt);
  const noIncrement = isLast || withheld;
  const nextAfterMatched = noIncrement ? step4 : newScale[matched.index + 1]!;
  const nextAfterMatchedIndex = noIncrement ? matched.index : matched.index + 1;
  const nextIsLast = nextAfterMatchedIndex >= newScale.length - 1;
  const nextAfter2026Basic = nextIsLast
    ? nextAfterMatched
    : newScale[nextAfterMatchedIndex + 1]!;

  // Stage-3 (01-07-2027): basics from scale stages; same Steps 1–4 as Stages 1–2, then 2026/2027 basics.
  if (phase === '2027-07-01') {
    return {
      grade,
      phase,
      phase_label: effective,
      phase_title: salaryPhaseTitle(phase),
      fixed: false,
      rate,
      rate_percent: ratePercent,
      old_pay: oldPay,
      old_minimum: oldMinimum,
      new_minimum: newMinimum,
      new_pay: nextAfter2026Basic,
      matched_new_stage: step4,
      increment: nextIsLast ? 0 : nextAfter2026Basic - nextAfterMatched,
      increment_skipped: nextIsLast,
      increment_withheld: withheld,
      increment_exempt: Boolean(input.increment_exempt),
      used_next_stage_for_step5: !isLast,
      pay_change_increase: 0,
      pay_change_effective_date: null,
      new_pay_before_pay_change: null,
      basic_on_2026_07: nextAfterMatched,
      basic_on_2027_07: nextAfter2026Basic,
      steps: [
        {
          step: 1,
          label: 'Old pay − Old minimum pay (30-06-26)',
          calculation: `${formatTaka(oldPay)} − ${formatTaka(oldMinimum)}`,
          value: step1,
        },
        {
          step: 2,
          label: 'New minimum pay',
          value: newMinimum,
          note: 'Published NPS 2026 minimum for this grade',
        },
        {
          step: 3,
          label: 'New minimum + Step 1',
          calculation: `${formatTaka(newMinimum)} + ${formatTaka(step1)}`,
          value: step3,
        },
        {
          step: 4,
          label: 'Matching / next higher stage on NPS 2026',
          value: step4,
          note: step3 === step4 ? 'Exact stage match' : `Next higher than ${formatTaka(step3)}`,
        },
        {
          step: 5,
          label: 'Basic as on 01-07-2026 (next stage after Step 4)',
          calculation: `${formatTaka(nextAfterMatched)}`,
          value: nextAfterMatched,
          note: input.increment_exempt
            ? 'Exceptional exemption — no 01-07-2026 increment (stays at Step 4)'
            : withheld
              ? 'Joined on or after 02-01-2026 — no 01-07-2026 increment (stays at Step 4)'
              : isLast
                ? 'Last stage — no next stage (stays at Step 4)'
                : `Next stage after matched Step 4`,
        },
        {
          step: 6,
          label: 'Basic as on 01-07-2027 (next stage after 01-07-2026)',
          calculation: `${formatTaka(nextAfter2026Basic)}`,
          value: nextAfter2026Basic,
          note: nextIsLast
            ? 'Last stage — no further move'
            : `Next stage after basic on 01-07-2026`,
        },
      ],
    };
  }

  return buildPercentageScaleResult({
    grade,
    phase,
    oldPay,
    oldMinimum,
    newMinimum,
    newScale,
    step1,
    step3,
    step4,
    matchedIndex: matched.index,
    rate,
    withheld,
    incrementExempt: Boolean(input.increment_exempt),
  });
}

/** YYYY-MM-DD → DD-MM-YYYY for step notes. */
function payChangeDateLabel(iso: string): string {
  return iso.split('-').reverse().join('-');
}

/** Which conversion phase contains this calendar date. */
export function salaryPhaseForDate(iso: string): SalaryPhase {
  if (iso >= '2027-07-01') return '2027-07-01';
  if (iso >= '2027-01-01') return '2027-01-01';
  return '2026-07-01';
}

/**
 * After fixation: add promotion / higher-scale increase
 * (matched NPS 2026 − origin fixed 01-07-2026) × phase rate on the substantive grade.
 *
 * - Phase that contains the effective date → Before + After basics
 * - Earlier phases → fixation only (no promo overlay)
 * - Later phases → single revised (after) basic only
 */
function applyPayChangeToSalaryResult(result: Salary2026Result, input: Salary2026Input): Salary2026Result {
  const payChange = assertPayChange(input.pay_change);
  if (!payChange) return result;

  const changePhase = salaryPhaseForDate(payChange.effective_date);
  const resultIdx = SALARY_PHASES.indexOf(result.phase);
  const changeIdx = SALARY_PHASES.indexOf(changePhase);

  /** Phases before the promotion date: keep fixation; no before/after pair. */
  if (resultIdx < changeIdx) {
    return {
      ...result,
      pay_change_effective_date: payChange.effective_date,
      pay_change_increase: 0,
      new_pay_before_pay_change: null,
    };
  }

  /** Promotion % uses the post-promotion substantive grade (selected with the pay change). */
  const substantive = effectiveSubstantiveGrade(
    payChange.grade as PayGrade,
    payChange.substantive_grade ?? input.substantive_grade,
  );
  const originFixed = originFixedBasic2026(
    result.grade,
    result.old_pay,
    input.joining_date,
    Boolean(input.increment_exempt),
  );
  const matched = promotedMatchedBasic2026(originFixed, payChange.grade as PayGrade);
  const scaleDiff = matched - originFixed;
  const ratePct = Math.round(promotionIncreaseRate(substantive, result.phase) * 100);
  const fromDate = payChangeDateLabel(payChange.effective_date);
  const note = `Matched NPS 2026 ${formatTaka(matched)} − fixed 01-07-2026 ${formatTaka(originFixed)} (Grade ${payChange.grade})`;
  /** Only the phase that contains the effective date shows Before + After. */
  const showBeforeAfter = resultIdx === changeIdx;

  if (result.phase === '2027-07-01') {
    const before2026 = result.basic_on_2026_07 ?? result.new_pay;
    const before2027 = result.basic_on_2027_07 ?? result.new_pay;
    const inc2026 = toPaisa(scaleDiff * promotionIncreaseRate(substantive, '2026-07-01'));
    const inc2027 = toPaisa(scaleDiff * promotionIncreaseRate(substantive, result.phase));
    const after2026 = toPaisa(before2026 + inc2026);
    const after2027 = toPaisa(before2027 + inc2027);
    const n = result.steps.length;
    return {
      ...result,
      new_pay: after2027,
      basic_on_2026_07: after2026,
      basic_on_2027_07: after2027,
      pay_change_increase: inc2027,
      pay_change_effective_date: payChange.effective_date,
      new_pay_before_pay_change: showBeforeAfter ? before2027 : null,
      basic_on_2026_07_before_pay_change: showBeforeAfter ? before2026 : null,
      basic_on_2027_07_before_pay_change: showBeforeAfter ? before2027 : null,
      steps: showBeforeAfter
        ? [
            ...result.steps,
            {
              step: n + 1,
              label: `Basic before promotion / higher scale (before ${fromDate})`,
              calculation: formatTaka(before2027),
              value: before2027,
              note: `Applies until the day before ${fromDate}`,
            },
            {
              step: n + 2,
              label: `Basic after promotion / higher scale (from ${fromDate})`,
              calculation: `${formatTaka(before2027)} + ${formatTaka(scaleDiff)} × ${ratePct}%`,
              value: after2027,
              note,
            },
          ]
        : [
            ...result.steps,
            {
              step: n + 1,
              label: 'Revised basic after promotion / higher scale',
              calculation: `${formatTaka(before2027)} + ${formatTaka(scaleDiff)} × ${ratePct}%`,
              value: after2027,
              note,
            },
          ],
    };
  }

  const before = result.new_pay;
  const increase = toPaisa(scaleDiff * promotionIncreaseRate(substantive, result.phase));
  const after = toPaisa(before + increase);
  const n = result.steps.length;
  return {
    ...result,
    new_pay: after,
    pay_change_increase: increase,
    pay_change_effective_date: payChange.effective_date,
    new_pay_before_pay_change: showBeforeAfter ? before : null,
    steps: showBeforeAfter
      ? [
          ...result.steps,
          {
            step: n + 1,
            label: `Basic before promotion / higher scale (before ${fromDate})`,
            calculation: formatTaka(before),
            value: before,
            note: `Applies until the day before ${fromDate}`,
          },
          {
            step: n + 2,
            label: `Basic after promotion / higher scale (from ${fromDate})`,
            calculation: `${formatTaka(before)} + ${formatTaka(scaleDiff)} × ${ratePct}%`,
            value: after,
            note,
          },
        ]
      : [
          ...result.steps,
          {
            step: n + 1,
            label: 'Revised basic after promotion / higher scale',
            calculation: `${formatTaka(before)} + ${formatTaka(scaleDiff)} × ${ratePct}%`,
            value: after,
            note,
          },
        ],
  };
}

/** Fixation for one phase; applies increment hold-up and optional promotion / higher scale. */
export function calculateSalary2026(input: Salary2026Input): Salary2026Result {
  return applyPayChangeToSalaryResult(calculateSalary2026Base(input), input);
}

/** All three conversion phases, in order. */
export function calculateSalary2026AllPhases(input: Omit<Salary2026Input, 'phase'>): Salary2026Result[] {
  return SALARY_PHASES.map((phase) => calculateSalary2026({ ...input, phase }));
}

export const salaryCalculateSchema = z.object({
  grade: z.number().int().min(1).max(20),
  old_pay: z.number().positive(),
});

export type SalaryCalculateDto = z.infer<typeof salaryCalculateSchema>;

export interface SalaryUsageStatsRecord {
  calculate_all_phases_count: number;
  pdf_download_count: number;
  last_calculate_at: string | null;
  last_pdf_at: string | null;
}

/** Posting area for House Rent Allowance. */
export type HraArea = 'dhaka' | 'major_city' | 'other';

export type HousingStatus = 'hra_eligible' | 'govt_accommodation';

export type EducationChildren = 0 | 1 | 2;

/** Grades 2–10: regular post vs additional current charge. */
export type ChargeType = 'regular' | 'current_charge';

/** Substantive grade: the pay grade itself or a lower grade (higher number, up to 20). */
export type SubstantiveGrade = PayGrade;

/** Substantive grades allowed for a pay grade: the same grade or any lower one (e.g. Grade 9 → 9–20). */
export function substantiveGradeOptions(grade: PayGrade): PayGrade[] {
  return PAY_GRADES.filter((g) => g >= grade);
}

/** Only Grade 6–10 users are asked for a substantive grade; for every other grade it is the pay grade. */
export function asksSubstantiveGrade(grade: PayGrade): boolean {
  return grade >= 6 && grade <= 10;
}

/** The chosen substantive grade when it is the same or lower than the pay grade; otherwise the pay grade. */
export function effectiveSubstantiveGrade(grade: PayGrade, substantive: number | null | undefined): PayGrade {
  return substantive != null && isPayGrade(substantive) && substantive >= grade ? substantive : grade;
}

export interface EmployeeGrossInput {
  grade: PayGrade;
  /** Basic on 30 June 2026 (NPS 2015 stage). */
  basic: number;
  housing_status: HousingStatus;
  hra_area: HraArea;
  education_children: EducationChildren;
  /** Uniformed 4th-class employees only. */
  washing_allowance: boolean;
  /**
   * Grades 2–10 only. Default regular.
   * Current charge adds ৳ 1,500 / month.
   */
  charge_type?: ChargeType;
  /** Same as the pay grade by default; substantive grade 11–20 gets tiffin + conveyance. */
  substantive_grade?: SubstantiveGrade | null;
}

export interface AllowanceLine {
  code: string;
  label: string;
  amount: number;
  note?: string;
}

export interface EmployeeGrossResult {
  grade: PayGrade;
  basic: number;
  housing_status: HousingStatus;
  hra_area: HraArea;
  hra_rate_percent: number;
  hra_minimum: number;
  monthly_lines: AllowanceLine[];
  /** Sum of basic + monthly regular allowances (HRA, medical, etc.). */
  monthly_gross: number;
  annual_lines: AllowanceLine[];
  /** Festival (2×) + Pahela Baishakh (20%). */
  annual_extra_total: number;
  /** Rest & recreation once every 3 years (= 1× basic). */
  rest_recreation_every_3_years: number;
  /**
   * Rough monthly equivalent including annual extras / 12 and rest-recreation / 36.
   * Excludes leave entitlement.
   */
  estimated_average_monthly: number;
}

interface HraRule {
  rate: number;
  min: number;
}

const HRA_BANDS: Array<{
  maxBasic: number;
  dhaka: HraRule;
  major_city: HraRule;
  other: HraRule;
}> = [
  {
    maxBasic: 9700,
    dhaka: { rate: 0.65, min: 5600 },
    major_city: { rate: 0.55, min: 5000 },
    other: { rate: 0.5, min: 4500 },
  },
  {
    maxBasic: 16000,
    dhaka: { rate: 0.6, min: 6400 },
    major_city: { rate: 0.5, min: 5400 },
    other: { rate: 0.45, min: 4800 },
  },
  {
    maxBasic: 35500,
    dhaka: { rate: 0.55, min: 9600 },
    major_city: { rate: 0.45, min: 8000 },
    other: { rate: 0.4, min: 7000 },
  },
  {
    maxBasic: Number.POSITIVE_INFINITY,
    dhaka: { rate: 0.5, min: 19500 },
    major_city: { rate: 0.4, min: 16000 },
    other: { rate: 0.35, min: 13800 },
  },
];

export function hraAreaLabel(area: HraArea): string {
  switch (area) {
    case 'dhaka':
      return 'Dhaka City Corporation Area';
    case 'major_city':
      return 'Chittagong, Khulna, Rajshahi, Sylhet, Barisal, Rangpur, Narayanganj & Gazipur City Corporations, and Savar Municipal Area';
    case 'other':
      return 'Other Places';
  }
}

function hraBandForBasic(basic: number) {
  for (const band of HRA_BANDS) {
    if (basic <= band.maxBasic) return band;
  }
  return HRA_BANDS[HRA_BANDS.length - 1]!;
}

export function calculateHouseRentAllowance(
  basic: number,
  area: HraArea,
): { amount: number; rate_percent: number; minimum: number } {
  const band = hraBandForBasic(basic);
  const rule = band[area];
  return {
    amount: toPaisa(Math.max(basic * rule.rate, rule.min)),
    rate_percent: Math.round(rule.rate * 100),
    minimum: rule.min,
  };
}

/** Allowance lines only (no basic) for a given basic + options. */
export function calculateAllowancesExcludingBasic(input: EmployeeGrossInput): {
  lines: AllowanceLine[];
  allowances_total: number;
} {
  const grade = input.grade;
  const basic = Math.round(Number(input.basic));
  if (!isPayGrade(grade)) throw new Error('Grade must be between 1 and 20');
  if (!Number.isFinite(basic) || basic <= 0) throw new Error('Enter a valid basic pay');

  const lines: AllowanceLine[] = [];

  if (input.housing_status === 'govt_accommodation') {
    lines.push({
      code: 'hra',
      label: 'House Rent Allowance',
      amount: 0,
      note: 'Not eligible — government accommodation. A portion of basic may be deducted per rules.',
    });
  } else {
    const hra = calculateHouseRentAllowance(basic, input.hra_area);
    lines.push({
      code: 'hra',
      label: `House Rent Allowance (${hraAreaLabel(input.hra_area)})`,
      amount: hra.amount,
      note: `${hra.rate_percent}% of basic (min ৳ ${formatTaka(hra.minimum)})`,
    });
  }

  lines.push({
    code: 'medical',
    label: 'Medical Allowance',
    amount: 1500,
    note: 'General officers and employees',
  });

  const education =
    input.education_children === 2 ? 1000 : input.education_children === 1 ? 500 : 0;
  lines.push({
    code: 'education',
    label: 'Education Assistance Allowance',
    amount: education,
    note:
      input.education_children === 0
        ? 'No child selected'
        : input.education_children === 1
          ? '1 child'
          : '2 children (maximum)',
  });

  const chargeType = input.charge_type ?? 'regular';
  if (grade >= 2 && grade <= 10 && chargeType === 'current_charge') {
    lines.push({
      code: 'current_charge',
      label: 'Current Charge Allowance',
      amount: 1500,
      note: 'Grades 2–10 — additional current charge',
    });
  }

  const tiffinGrade = resolveTiffinConveyanceGrade(input);
  const tiffinEligible = tiffinGrade != null;
  lines.push({
    code: 'tiffin',
    label: 'Tiffin Allowance',
    amount: tiffinEligible ? 200 : 0,
    note: tiffinEligible
      ? `Eligible — substantive Grade ${tiffinGrade} (11–20)`
      : 'Not applicable (requires substantive Grade 11–20)',
  });

  const washing = input.washing_allowance ? 100 : 0;
  lines.push({
    code: 'washing',
    label: 'Washing Allowance',
    amount: washing,
    note: input.washing_allowance
      ? 'Uniformed 4th Class employees'
      : 'Not selected',
  });

  lines.push({
    code: 'conveyance',
    label: 'Conveyance Allowance',
    amount: tiffinEligible ? 300 : 0,
    note: tiffinEligible
      ? `Eligible — substantive Grade ${tiffinGrade} (11–20)`
      : 'Not applicable (requires substantive Grade 11–20)',
  });

  return {
    lines,
    allowances_total: toPaisa(lines.reduce((sum, line) => sum + line.amount, 0)),
  };
}

/** Substantive grade 11–20 (the pay grade unless a lower substantive grade is chosen). */
export function resolveTiffinConveyanceGrade(
  input: Pick<EmployeeGrossInput, 'grade' | 'substantive_grade'>,
): PayGrade | null {
  const substantive = effectiveSubstantiveGrade(input.grade, input.substantive_grade);
  return substantive >= 11 ? substantive : null;
}

/** First month with arrears — the 2026 basic takes effect on 01-07-2026. */
export const ARREAR_START_MONTH = '2026-07';

/** Stage-2 basic applies from this month onwards. */
const ARREAR_STAGE2_MONTH = '2027-01';

const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isArrearMonthKey(key: string): boolean {
  return MONTH_KEY_RE.test(key) && key >= ARREAR_START_MONTH;
}

export function arrearMonthLabel(key: string): string {
  const m = MONTH_KEY_RE.exec(key);
  if (!m) return key;
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${names[Number(m[2]) - 1]} ${m[1]}`;
}

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

const ISO_DATE_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isIsoDate(value: string | null | undefined): value is string {
  const m = value ? ISO_DATE_RE.exec(value) : null;
  return !!m && Number(m[3]) <= daysInMonth(`${m[1]}-${m[2]}`);
}

/**
 * Arrears start from the joining date when the 01-07-2026 increment is withheld and the
 * employee joined after 01-07-2026; null when arrears run from July 2026 as usual.
 */
export function arrearJoinStart(
  grade: number,
  oldPay: number,
  joiningDate: string | null | undefined,
): { date: string; month: string; day: number } | null {
  if (!isIncrementWithheld(grade, oldPay, joiningDate) || !isIsoDate(joiningDate)) return null;
  if (joiningDate <= `${ARREAR_START_MONTH}-01`) return null;
  return { date: joiningDate, month: joiningDate.slice(0, 7), day: Number(joiningDate.slice(8, 10)) };
}

/** Custom arrears start after 01-07-2026, or null when the usual July start applies. */
export function arrearCustomStart(
  arrearStartDate: string | null | undefined,
): { date: string; month: string; day: number } | null {
  if (!isIsoDate(arrearStartDate)) return null;
  if (arrearStartDate <= `${ARREAR_START_MONTH}-01`) return null;
  return {
    date: arrearStartDate,
    month: arrearStartDate.slice(0, 7),
    day: Number(arrearStartDate.slice(8, 10)),
  };
}

/** Later of joining-based start and optional custom start; null = full July 2026. */
export function arrearPeriodStart(
  grade: number,
  oldPay: number,
  joiningDate: string | null | undefined,
  arrearStartDate?: string | null,
): { date: string; month: string; day: number } | null {
  const join = arrearJoinStart(grade, oldPay, joiningDate);
  const custom = arrearCustomStart(arrearStartDate);
  if (!join) return custom;
  if (!custom) return join;
  return custom.date > join.date ? custom : join;
}

function assertPayChange(change: SalaryPayChange | null | undefined): SalaryPayChange | null {
  if (!change) return null;
  if (!isIsoDate(change.effective_date)) throw new Error('Enter the pay-change effective date');
  if (change.effective_date < `${ARREAR_START_MONTH}-01`) {
    throw new Error('Pay change must be on or after 01-07-2026');
  }
  if (!isPayGrade(change.grade)) throw new Error('Pay-change grade must be between 1 and 20');
  const scale = NPS_2015[change.grade];
  const basic = Math.round(Number(change.old_pay));
  if (!scale.includes(basic)) {
    throw new Error(`Basic ${basic} is not a stage on Grade ${change.grade} of NPS 2015`);
  }
  const promoGrade = change.grade as PayGrade;
  const substantive = effectiveSubstantiveGrade(promoGrade, change.substantive_grade);
  return {
    effective_date: change.effective_date,
    grade: promoGrade,
    old_pay: basic,
    substantive_grade: substantive,
  };
}

/** Month keys (YYYY-MM) from July 2026 up to and including the month of `today`. */
export function arrearMonthOptions(today: Date = new Date()): string[] {
  const end = monthKeyOf(today);
  const keys: string[] = [];
  let year = 2026;
  let month = 7;
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (key > end) break;
    keys.push(key);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

/** Completed months before the current one; the current month alone when none has completed yet. */
export function defaultArrearMonths(today: Date = new Date()): string[] {
  const all = arrearMonthOptions(today);
  const current = monthKeyOf(today);
  const past = all.filter((k) => k < current);
  return past.length > 0 ? past : all;
}

export function arrearPhaseForMonth(key: string): SalaryPhase {
  return key >= ARREAR_STAGE2_MONTH ? '2027-01-01' : '2026-07-01';
}

/** Special allowance rate by substantive grade: 10% for grades 1–9, 15% for grades 10–20. */
export function specialAllowanceRate(substantiveGrade: PayGrade): number {
  return substantiveGrade >= 10 ? 0.15 : 0.1;
}

/** Office staff arrear bills always deduct special allowance at 15%, whatever the grade. */
export const STAFF_SPECIAL_RATE = 0.15;

export interface SalaryArrearInput {
  grade: PayGrade;
  /** Basic on 30 June 2026 (NPS 2015 stage). */
  old_pay: number;
  /** Same as the pay grade or lower; sets the special allowance rate (15% for 10–20) only. */
  substantive_grade?: SubstantiveGrade | null;
  housing_status: HousingStatus;
  hra_area: HraArea;
  /** Month keys (YYYY-MM), July 2026 or later. */
  months: string[];
  /** Overrides the substantive-grade special allowance rate (fraction, e.g. 0.15). */
  special_rate?: number;
  /** Excess Rest & Recreation allowance drawn: one NPS 2015 increment is deducted once. */
  excess_rr?: boolean;
  /** Excess Puja bonus drawn: two NPS 2015 increments are deducted once. */
  excess_puja?: boolean;
  /**
   * Joining date of service (YYYY-MM-DD); only read for the initial basic of Grade 7–20.
   * On or after 02-01-2026 there is no 01-07-2026 increment; after 01-07-2026 arrears start from it.
   */
  joining_date?: string | null;
  /** Exceptional increment exemption, mid-period pay change, and/or custom arrears start. */
  exceptional?: SalaryExceptionalIssues | null;
}

export interface SalaryArrearMonthRow {
  month: string;
  label: string;
  phase: SalaryPhase;
  phase_title: string;
  new_basic: number;
  /** Basic drawn in the month: NPS 2015 stage after the 30 June 2026 basic (or after promotion, the new grade). */
  drawn_basic: number;
  /** New basic − drawn basic. */
  basic_difference: number;
  /** Special allowance % used for this segment (10 or 15 from its substantive grade). */
  special_rate_percent: number;
  special_allowance: number;
  excess_hra: number;
  /**
   * House rent shortfall vs the 30/06/2026 entitlement when drawn HRA is lower; added to arrears.
   * Entitlement is always HRA on the 30/06/2026 basic (not the promoted basic).
   */
  hra_protection: number;
  /** basic_difference − special_allowance − excess_hra + hra_protection. */
  net_arrear: number;
  /** Days paid in the month: fewer than `month_days` only in a joining or pay-change segment. */
  days: number;
  month_days: number;
  /** Net arrear for the whole month; `net_arrear` = this ÷ month_days × days. */
  full_net_arrear: number;
  /** True when this row is the post-promotion / higher-scale segment. */
  pay_change_segment: boolean;
  /** Inclusive day range within the month when the month is split (e.g. promotion mid-month). */
  day_from: number | null;
  day_to: number | null;
  /** Grade used for new basic / drawn in this segment. */
  segment_grade: PayGrade;
}

export interface SalaryArrearResult {
  grade: PayGrade;
  /** Substantive grade before promotion — special allowance on pre-promotion segments. */
  substantive_grade: PayGrade;
  /**
   * Substantive grade after exceptional promotion / higher scale; null when there is no pay change.
   * Special allowance on post-promotion segments and T.R. Form use this grade.
   */
  substantive_grade_after: PayGrade | null;
  old_pay: number;
  /** NPS 2015 stage after the 30 June 2026 basic (the basic itself when it is the last stage). */
  next_step: number;
  next_step_is_last: boolean;
  /** No 01-07-2026 increment (joining rule and/or exceptional exemption); the drawn basic stays without Step 6. */
  increment_withheld: boolean;
  /** True when the user marked an exceptional increment exemption. */
  increment_exempt: boolean;
  /** Joining or custom date after 01-07-2026 that the arrears start from, or null. */
  arrear_from_date: string | null;
  /** Mid-period promotion/demotion applied in the arrears, or null. */
  pay_change: SalaryPayChange | null;
  /**
   * After promotion: NPS 2026 stage on the new grade (equal/next higher to the old grade’s
   * 01/07/2026 fixed 2026-scale basic). Used only to size the promotion increase.
   */
  pay_change_matched_basic: number | null;
  /** Old grade’s fixed NPS 2026 basic as on 01/07/2026 (including annual increment), e.g. ৳90,700. */
  pay_change_origin_fixed_2026: number | null;
  /** Matched new-grade 2026 basic − origin fixed 2026 basic (before applying 40%/50%/…). */
  pay_change_scale_diff: number | null;
  /**
   * Grade for T.R. Form: post-promotion substantive when a pay change applies, else the pay grade.
   * Without a pay change the download uses `substantive_grade`.
   */
  bill_grade: PayGrade;
  /** House rent entitlement amount as of 30/06/2026 (HRA on the June basic). */
  hra_entitlement_30_06: number;
  /** Special allowance % for pre-promotion segments (or the only rate when there is no pay change). */
  special_rate_percent: number;
  /** Special allowance % for post-promotion segments; null when there is no pay change. */
  special_rate_percent_after: number | null;
  /** True when the rate was fixed by `special_rate` (office staff bill) rather than the substantive grade. */
  special_rate_fixed: boolean;
  special_allowance: number;
  hra_eligible: boolean;
  /** July 2026 house rent on the next stage. */
  hra_on_next_step: number;
  /** June 2026 house rent − July 2026 house rent when July is lower; added to the arrears each month. */
  hra_protection: number;
  hra_on_old_pay: number;
  hra_rate_percent_next_step: number;
  hra_rate_percent_old_pay: number;
  excess_hra: number;
  monthly_deduction: number;
  rows: SalaryArrearMonthRow[];
  /** NPS 2015 increment: basic on 01-07-2026 (next stage) − basic on 30-06-2026. */
  increment: number;
  /** One-time deduction for excess Rest & Recreation allowance (1 × increment), 0 when not chosen. */
  excess_rr: number;
  /** One-time deduction for excess Puja bonus (2 × increment), 0 when not chosen. */
  excess_puja: number;
  total_basic_difference: number;
  total_special_allowance: number;
  total_excess_hra: number;
  total_hra_protection: number;
  /** Monthly deductions plus the one-time Rest & Recreation and Puja deductions. */
  total_deduction: number;
  total_net_arrear: number;
}

/** NPS 2015 stage after the 30/06/2026 basic (annual increment on 01/07/2026), or the basic itself when withheld/last. */
function nps2015AfterIncrement(
  grade: PayGrade,
  oldPay: number,
  joiningDate: string | null | undefined,
  incrementExempt: boolean,
): { next_step: number; next_step_is_last: boolean; withheld: boolean } {
  const scale = NPS_2015[grade];
  const oldIndex = scale.indexOf(oldPay);
  const nextIsLast = oldIndex < 0 || oldIndex >= scale.length - 1;
  const withheld = isIncrementExcluded(grade, oldPay, joiningDate, incrementExempt);
  const nextStep = nextIsLast || withheld ? oldPay : scale[oldIndex + 1]!;
  return { next_step: nextStep, next_step_is_last: nextIsLast || withheld, withheld };
}

/**
 * Old grade’s fixed NPS 2026 basic as on 01/07/2026, including the annual increment:
 * take the next 2015 stage, then the Stage-3 “basic as on 01-07-2026” on that amount
 * (e.g. Grade-6 ৳47,600 → ৳49,980 → ৳90,700).
 */
function originFixedBasic2026(
  grade: PayGrade,
  oldPay: number,
  joiningDate: string | null | undefined,
  incrementExempt: boolean,
): number {
  // 1) Annual increment on NPS 2015 (e.g. 47,600 → 49,980).
  // 2) Map that onto NPS 2026 (Steps 1–4) and take the next stage as the fixed 01/07/2026
  //    2026-scale basic (e.g. → ৳90,700). Do not re-apply joining withhold on the already-incremented basic.
  const incremented = nps2015AfterIncrement(grade, oldPay, joiningDate, incrementExempt).next_step;
  const fixed = calculateSalary2026Base({
    grade,
    old_pay: incremented,
    phase: '2027-07-01',
  }).basic_on_2026_07;
  return fixed ?? stageOrNextHigher(NPS_2026[grade], incremented).amount;
}

/**
 * Promotion / higher scale on NPS 2026 of the target grade:
 * equal or next higher stage to the old grade’s fixed 01/07/2026 2026-scale basic.
 */
function promotedMatchedBasic2026(originFixed2026: number, promoGrade: PayGrade): number {
  return stageOrNextHigher(NPS_2026[promoGrade], originFixed2026).amount;
}

/** Percentage applied to the promotion scale difference (substantive grade; Stage-3 uses Stage-2 rates). */
function promotionIncreaseRate(substantive: PayGrade, phase: SalaryPhase): number {
  if (phase === '2027-07-01') return salaryConversionRate(substantive, '2027-01-01');
  return salaryConversionRate(substantive, phase);
}

type ArrearBasisAmounts = {
  grade: PayGrade;
  old_pay: number;
  /** Drawn basic for the segment (NPS 2015). */
  next_step: number;
  next_step_is_last: boolean;
  withheld: boolean;
  pay_change_segment: boolean;
  new_basic: (phase: SalaryPhase) => number;
};

function primaryArrearBasis(
  grade: PayGrade,
  oldPay: number,
  joiningDate: string | null | undefined,
  incrementExempt: boolean,
  basicCache: Map<string, number>,
): ArrearBasisAmounts {
  const step = nps2015AfterIncrement(grade, oldPay, joiningDate, incrementExempt);
  return {
    grade,
    old_pay: oldPay,
    next_step: step.next_step,
    next_step_is_last: step.next_step_is_last,
    withheld: step.withheld,
    pay_change_segment: false,
    new_basic: (phase) => {
      const key = `p:${grade}:${oldPay}:${phase}:${incrementExempt ? 1 : 0}:${joiningDate ?? ''}`;
      let value = basicCache.get(key);
      if (value == null) {
        value = calculateSalary2026Base({
          grade,
          old_pay: oldPay,
          phase,
          joining_date: joiningDate,
          increment_exempt: incrementExempt,
        }).new_pay;
        basicCache.set(key, value);
      }
      return value;
    },
  };
}

/**
 * After promotion: admissible new basic = original stage new_pay + (matched − originFixed) × rate%.
 * Exception dialog grade/basic only set drawn basic (and thus HRA / special on that drawn amount).
 */
function promotedArrearBasis(
  originGrade: PayGrade,
  originOldPay: number,
  payChange: SalaryPayChange,
  joiningDate: string | null | undefined,
  incrementExempt: boolean,
  originFixed2026: number,
  matched2026: number,
  substantive: PayGrade,
  basicCache: Map<string, number>,
): ArrearBasisAmounts {
  const promoGrade = payChange.grade as PayGrade;
  const promoOldPay = payChange.old_pay;
  const scaleDiff = matched2026 - originFixed2026;
  return {
    grade: promoGrade,
    old_pay: promoOldPay,
    // Dialog Grade & Basic → drawn (no second annual increment on the new grade).
    next_step: promoOldPay,
    next_step_is_last: true,
    withheld: false,
    pay_change_segment: true,
    new_basic: (phase) => {
      const key = `c:${originGrade}:${originOldPay}:${promoGrade}:${matched2026}:${phase}:${incrementExempt ? 1 : 0}:${joiningDate ?? ''}:${substantive}`;
      let value = basicCache.get(key);
      if (value == null) {
        const originNew = calculateSalary2026Base({
          grade: originGrade,
          old_pay: originOldPay,
          phase,
          joining_date: joiningDate,
          increment_exempt: incrementExempt,
        }).new_pay;
        const increase = toPaisa(scaleDiff * promotionIncreaseRate(substantive, phase));
        value = toPaisa(originNew + increase);
        basicCache.set(key, value);
      }
      return value;
    },
  };
}

/** House rent vs 30/06/2026 entitlement; excess drawn (e.g. after promotion) is deductible. */
function hraAdjustment(
  hraEligible: boolean,
  hraArea: HraArea,
  entitlementBasic30_06: number,
  drawnBasic: number,
): { excess_hra: number; hra_protection: number; hra_drawn: number; hra_entitlement: number } {
  if (!hraEligible) {
    return { excess_hra: 0, hra_protection: 0, hra_drawn: 0, hra_entitlement: 0 };
  }
  const entitlement = calculateHouseRentAllowance(entitlementBasic30_06, hraArea).amount;
  const drawn = calculateHouseRentAllowance(drawnBasic, hraArea).amount;
  const gap = toPaisa(drawn - entitlement);
  return {
    excess_hra: Math.max(0, gap),
    hra_protection: Math.max(0, -gap),
    hra_drawn: drawn,
    hra_entitlement: entitlement,
  };
}

function blendArrearSegment(
  basis: ArrearBasisAmounts,
  phase: SalaryPhase,
  days: number,
  monthDays: number,
  specialRate: number,
  hraEligible: boolean,
  hraArea: HraArea,
  entitlementBasic30_06: number,
): Pick<
  SalaryArrearMonthRow,
  | 'new_basic'
  | 'drawn_basic'
  | 'basic_difference'
  | 'special_rate_percent'
  | 'special_allowance'
  | 'excess_hra'
  | 'hra_protection'
  | 'net_arrear'
  | 'full_net_arrear'
  | 'pay_change_segment'
  | 'segment_grade'
> {
  const newBasic = basis.new_basic(phase);
  const drawnBasic = basis.next_step;
  const basicDifference = newBasic - drawnBasic;
  const specialAllowance = Math.round(drawnBasic * specialRate);
  const specialRatePercent = Math.round(specialRate * 100);
  const hra = hraAdjustment(hraEligible, hraArea, entitlementBasic30_06, drawnBasic);
  const fullNet = toPaisa(basicDifference - specialAllowance - hra.excess_hra + hra.hra_protection);
  const base = {
    new_basic: newBasic,
    drawn_basic: drawnBasic,
    pay_change_segment: basis.pay_change_segment,
    segment_grade: basis.grade,
    special_rate_percent: specialRatePercent,
  };
  if (days === monthDays) {
    return {
      ...base,
      basic_difference: basicDifference,
      special_allowance: specialAllowance,
      excess_hra: hra.excess_hra,
      hra_protection: hra.hra_protection,
      net_arrear: fullNet,
      full_net_arrear: fullNet,
    };
  }
  const part = (amount: number) => toPaisa((amount * days) / monthDays);
  const net = part(fullNet);
  const special = part(specialAllowance);
  const excess = part(hra.excess_hra);
  const protection = part(hra.hra_protection);
  return {
    ...base,
    basic_difference: toPaisa(net + special + excess - protection),
    special_allowance: special,
    excess_hra: excess,
    hra_protection: protection,
    net_arrear: net,
    full_net_arrear: fullNet,
  };
}

/** Engine label is month (+ day range); UI localizes promotion tags via `monthRowLabel`. */
function segmentLabel(month: string, from: number, to: number, monthDays: number, _payChange: boolean): string {
  const base = arrearMonthLabel(month);
  if (from === 1 && to === monthDays) return base;
  return `${base} (${from}–${to})`;
}

/**
 * Monthly arrears on the 2026 fixation:
 * (new basic − drawn NPS 2015 stage) − special allowance − excess house rent
 * + house rent protection.
 * House rent entitlement is always the amount applicable on the 30/06/2026 basic; any excess
 * drawn after promotion (or otherwise) is deducted as overpayment.
 * Promotion / higher scale: fix 01/07/2026 increment on the old grade, then match that step to
 * equal/next higher on NPS 2026 of the new grade; months split by the effective date are listed separately.
 */
export function calculateSalaryArrears(input: SalaryArrearInput): SalaryArrearResult {
  const grade = input.grade;
  if (!isPayGrade(grade)) throw new Error('Grade must be between 1 and 20');
  const oldScale = NPS_2015[grade];
  const oldPay = Math.round(Number(input.old_pay));
  if (!oldScale.includes(oldPay)) {
    throw new Error(`Basic ${oldPay} is not a stage on Grade ${grade} of NPS 2015`);
  }

  const exceptional = input.exceptional ?? NO_EXCEPTIONAL_ISSUES;
  const incrementExempt = Boolean(exceptional.increment_exempt);
  const payChange = assertPayChange(exceptional.pay_change);
  const periodStart = arrearPeriodStart(grade, oldPay, input.joining_date, exceptional.arrear_start_date);

  const months = [...new Set(input.months)]
    .filter((k) => isArrearMonthKey(k) && (!periodStart || k >= periodStart.month))
    .sort();
  if (months.length === 0) {
    throw new Error(
      periodStart
        ? `Select at least one month from ${arrearMonthLabel(periodStart.month)} (arrears start)`
        : 'Select at least one month from July 2026',
    );
  }

  /** Pre-promotion substantive (main form); post-promotion from pay_change when present. */
  const substantive = effectiveSubstantiveGrade(grade, input.substantive_grade);
  const substantiveAfter =
    payChange != null
      ? effectiveSubstantiveGrade(payChange.grade as PayGrade, payChange.substantive_grade)
      : null;
  const specialRateFixed = input.special_rate != null;
  const specialRateBefore = input.special_rate ?? specialAllowanceRate(substantive);
  const specialRateAfter =
    input.special_rate ?? (substantiveAfter != null ? specialAllowanceRate(substantiveAfter) : specialRateBefore);
  const hraEligible = input.housing_status !== 'govt_accommodation';
  const basicCache = new Map<string, number>();
  /** House rent entitlement is locked to the 30/06/2026 basic for every stage / promotion. */
  const entitlementBasic30_06 = oldPay;
  const hraEntitlement = hraEligible ? calculateHouseRentAllowance(entitlementBasic30_06, input.hra_area) : null;

  const primary = primaryArrearBasis(grade, oldPay, input.joining_date, incrementExempt, basicCache);
  const originFixed2026 =
    payChange != null ? originFixedBasic2026(grade, oldPay, input.joining_date, incrementExempt) : null;
  const matchedPromo =
    payChange != null && originFixed2026 != null
      ? promotedMatchedBasic2026(originFixed2026, payChange.grade as PayGrade)
      : null;
  const scaleDiff =
    matchedPromo != null && originFixed2026 != null ? matchedPromo - originFixed2026 : null;
  const changed =
    payChange && matchedPromo != null && originFixed2026 != null && substantiveAfter != null
      ? promotedArrearBasis(
          grade,
          oldPay,
          payChange,
          input.joining_date,
          incrementExempt,
          originFixed2026,
          matchedPromo,
          substantiveAfter,
          basicCache,
        )
      : null;

  /** T.R. Form after promotion uses the post-promotion substantive grade. */
  const billGrade = (substantiveAfter ?? grade) as PayGrade;

  const rows: SalaryArrearMonthRow[] = [];
  for (const month of months) {
    const phase = arrearPhaseForMonth(month);
    const monthDays = daysInMonth(month);
    const startDay = periodStart && month === periodStart.month ? periodStart.day : 1;
    const changeDay =
      payChange && month === payChange.effective_date.slice(0, 7)
        ? Number(payChange.effective_date.slice(8, 10))
        : null;

    type Seg = { basis: ArrearBasisAmounts; from: number; to: number };
    const segs: Seg[] = [];
    if (!changed || !payChange || month < payChange.effective_date.slice(0, 7)) {
      segs.push({ basis: primary, from: startDay, to: monthDays });
    } else if (month > payChange.effective_date.slice(0, 7)) {
      segs.push({ basis: changed, from: startDay, to: monthDays });
    } else {
      const split = Math.max(startDay, changeDay!);
      if (split > startDay) segs.push({ basis: primary, from: startDay, to: split - 1 });
      if (split <= monthDays) segs.push({ basis: changed, from: split, to: monthDays });
    }

    for (const s of segs) {
      const days = s.to - s.from + 1;
      if (days <= 0) continue;
      const segRate = s.basis.pay_change_segment ? specialRateAfter : specialRateBefore;
      const blend = blendArrearSegment(
        s.basis,
        phase,
        days,
        monthDays,
        segRate,
        hraEligible,
        input.hra_area,
        entitlementBasic30_06,
      );
      rows.push({
        month,
        label: segmentLabel(month, s.from, s.to, monthDays, s.basis.pay_change_segment),
        phase,
        phase_title: salaryPhaseTitle(phase),
        days,
        month_days: monthDays,
        day_from: s.from === 1 && s.to === monthDays ? null : s.from,
        day_to: s.from === 1 && s.to === monthDays ? null : s.to,
        ...blend,
      });
    }
  }

  const sum = (pick: (r: SalaryArrearMonthRow) => number) => toPaisa(rows.reduce((s, r) => s + pick(r), 0));
  const increment = primary.next_step - oldPay;
  const excessRr = input.excess_rr ? increment : 0;
  const excessPuja = input.excess_puja ? increment * 2 : 0;
  const oneTime = excessRr + excessPuja;
  const primaryHra = hraAdjustment(hraEligible, input.hra_area, entitlementBasic30_06, primary.next_step);

  return {
    grade,
    substantive_grade: substantive,
    substantive_grade_after: substantiveAfter,
    old_pay: oldPay,
    next_step: primary.next_step,
    next_step_is_last: primary.next_step_is_last,
    increment_withheld: primary.withheld,
    increment_exempt: incrementExempt,
    arrear_from_date: periodStart?.date ?? null,
    pay_change: payChange,
    pay_change_matched_basic: matchedPromo,
    pay_change_origin_fixed_2026: originFixed2026,
    pay_change_scale_diff: scaleDiff,
    bill_grade: billGrade,
    hra_entitlement_30_06: hraEntitlement?.amount ?? 0,
    special_rate_percent: Math.round(specialRateBefore * 100),
    special_rate_percent_after: payChange != null ? Math.round(specialRateAfter * 100) : null,
    special_rate_fixed: specialRateFixed,
    special_allowance: Math.round(primary.next_step * specialRateBefore),
    hra_eligible: hraEligible,
    hra_on_next_step: primaryHra.hra_drawn,
    hra_protection: primaryHra.hra_protection,
    hra_on_old_pay: hraEntitlement?.amount ?? 0,
    hra_rate_percent_next_step: hraEligible
      ? calculateHouseRentAllowance(primary.next_step, input.hra_area).rate_percent
      : 0,
    hra_rate_percent_old_pay: hraEntitlement?.rate_percent ?? 0,
    excess_hra: primaryHra.excess_hra,
    monthly_deduction: toPaisa(Math.round(primary.next_step * specialRateBefore) + primaryHra.excess_hra),
    rows,
    increment,
    excess_rr: excessRr,
    excess_puja: excessPuja,
    total_basic_difference: sum((r) => r.basic_difference),
    total_special_allowance: sum((r) => r.special_allowance),
    total_excess_hra: sum((r) => r.excess_hra),
    total_hra_protection: sum((r) => r.hra_protection),
    total_deduction: toPaisa(sum((r) => r.special_allowance + r.excess_hra) + oneTime),
    total_net_arrear: toPaisa(sum((r) => r.net_arrear) - oneTime),
  };
}

/** Office staff arrear bill for one employee: no substantive grade, special allowance fixed at 15%. */
export function calculateStaffArrears(
  staff: {
    grade: number;
    old_pay: number;
    housing_status: HousingStatus;
    hra_area: HraArea;
    excess_rr?: boolean;
    excess_puja?: boolean;
    joining_date?: string | null;
    exceptional?: SalaryExceptionalIssues | null;
  },
  months: string[],
): SalaryArrearResult {
  return calculateSalaryArrears({
    grade: staff.grade as PayGrade,
    old_pay: staff.old_pay,
    housing_status: staff.housing_status,
    hra_area: staff.hra_area,
    months,
    special_rate: STAFF_SPECIAL_RATE,
    excess_rr: staff.excess_rr,
    excess_puja: staff.excess_puja,
    joining_date: staff.joining_date,
    exceptional: staff.exceptional,
  });
}

/** Monthly + annual/periodic benefits on Basic (30 June 2026) and Grade. */
export function calculateEmployeeGross(input: EmployeeGrossInput): EmployeeGrossResult {
  const grade = input.grade;
  const basic = Math.round(Number(input.basic));
  if (!isPayGrade(grade)) throw new Error('Grade must be between 1 and 20');
  if (!Number.isFinite(basic) || basic <= 0) throw new Error('Enter a valid basic pay');

  const { lines: allowanceLines, allowances_total } = calculateAllowancesExcludingBasic(input);
  let hra_rate_percent = 0;
  let hra_minimum = 0;
  if (input.housing_status !== 'govt_accommodation') {
    const hra = calculateHouseRentAllowance(basic, input.hra_area);
    hra_rate_percent = hra.rate_percent;
    hra_minimum = hra.minimum;
  }

  const monthly_lines: AllowanceLine[] = [
    { code: 'basic', label: 'Basic pay (30 June 2026)', amount: basic },
    ...allowanceLines,
  ];

  const monthly_gross = toPaisa(basic + allowances_total);

  const festival = basic * 2;
  const baishakh = Math.round(basic * 0.2);
  const restRecreation = basic;

  const annual_lines: AllowanceLine[] = [
    {
      code: 'festival',
      label: 'Festival Bonus (2 festivals / year)',
      amount: festival,
      note: '100% of basic × 2',
    },
    {
      code: 'baishakh',
      label: 'Bengali New Year Allowance (Pahela Baishakh)',
      amount: baishakh,
      note: '20% of basic (paid annually in April)',
    },
    {
      code: 'rest_recreation',
      label: 'Rest & Recreation Allowance (every 3 years)',
      amount: restRecreation,
      note: '1 month basic + 15 days leave on full average pay',
    },
  ];

  const annual_extra_total = festival + baishakh;
  const estimated_average_monthly = Math.round(
    monthly_gross + festival / 12 + baishakh / 12 + restRecreation / 36,
  );

  return {
    grade,
    basic,
    housing_status: input.housing_status,
    hra_area: input.hra_area,
    hra_rate_percent,
    hra_minimum,
    monthly_lines,
    monthly_gross,
    annual_lines,
    annual_extra_total,
    rest_recreation_every_3_years: restRecreation,
    estimated_average_monthly,
  };
}
