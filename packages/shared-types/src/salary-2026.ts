/**
 * Bangladesh National Pay Scale — 2015 → 2026 conversion (Salary On 2026).
 *
 * Phases:
 * - 01-07-2026: Step 5 = next stage after matched Step 4; Step 6 rate 40% (grades 1–9) / 50% (10–20)
 * - 01-01-2027: same layout; Step 6 rate 70% (grades 1–9) / 75% (10–20)
 * - 01-07-2027: 01-07-2026 basic = Step 5 (next stage after matched Step 4);
 *               01-07-2027 basic = next stage after that Step 5 amount
 */

import { z } from 'zod';

export type PayGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

export type SalaryPhase = '2026-07-01' | '2027-01-01' | '2027-07-01';

/** National Pay Scale 2015 — stages per grade (grade 1 is fixed). */
export const NPS_2015: Record<PayGrade, readonly number[]> = {
  1: [78000],
  2: [66000, 68860, 71850, 74920, 78150],
  3: [56500, 58760, 61120, 63570, 66120, 68770, 71570, 74800],
  4: [50000, 52000, 54080, 56250, 58500, 60840, 63280, 65820, 68860, 71200],
  5: [
    43000, 44980, 46970, 49010, 51100, 53280, 55560, 57950, 61200, 63960, 66840, 69850,
  ],
  6: [
    35500, 37280, 39150, 41110, 43170, 45330, 47600, 49980, 52460, 55110, 57870, 60770, 63810,
    67010,
  ],
  7: [
    29000, 30450, 31980, 33580, 35260, 37030, 38890, 40840, 42890, 45040, 47300, 49670, 52160,
    54770, 57510, 60390, 63410,
  ],
  8: [
    23000, 24150, 25360, 26630, 27970, 29370, 30840, 32390, 34010, 35720, 37510, 39390, 41360,
    43430, 45610, 47900, 50300, 52820, 55460,
  ],
  9: [
    22000, 23100, 24260, 25470, 26750, 28100, 29510, 30990, 32540, 34170, 35880, 37680, 39570,
    41550, 43630, 45810, 48100, 50510, 53060,
  ],
  10: [
    16000, 16800, 17640, 18530, 19460, 20440, 21470, 22550, 23680, 24870, 26120, 27430, 28810,
    30250, 31760, 33350, 35020, 36770, 38640,
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
    10200, 10710, 11250, 11820, 12420, 13040, 13700, 14390, 15110, 15870, 16670, 17510, 18390,
    19310, 20280, 21300, 22370, 23490, 24670,
  ],
  15: [
    9700, 10190, 10700, 11240, 11810, 12410, 13040, 13700, 14390, 15110, 15870, 16670, 17510,
    18390, 19310, 20280, 21300, 22370, 23430,
  ],
  16: [
    9300, 9770, 10260, 10780, 11320, 11890, 12490, 13120, 13780, 14470, 15200, 15960, 16760,
    17600, 18480, 19410, 20380, 21400, 22470,
  ],
  17: [
    9000, 9450, 9930, 10430, 10960, 11510, 12090, 12700, 13340, 14010, 14720, 15460, 16240,
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
    86000, 89500, 93100, 96800, 100700, 104700, 108900, 113200, 117700, 122500, 127400, 132400,
    137700,
  ],
  6: [
    71000, 74600, 78300, 82200, 86400, 90700, 95200, 100000, 104200, 110200, 115700, 121500,
    127600, 134000,
  ],
  7: [
    58000, 60900, 64000, 67200, 70500, 74100, 77800, 81700, 85700, 90000, 94500, 99200, 104200,
    109400, 114900, 120600, 126600,
  ],
  8: [
    46000, 48300, 50700, 53200, 55800, 58600, 61500, 64600, 67800, 71200, 74700, 78500, 82400,
    86600, 91100, 95700, 100500, 105500, 110800,
  ],
  9: [
    44000, 46200, 48500, 51000, 53500, 56200, 59000, 62000, 65100, 68300, 71700, 75300, 79100,
    83000, 87200, 91500, 96100, 100900, 105900,
  ],
  10: [
    32000, 33600, 35300, 37100, 38900, 40900, 42900, 45100, 47300, 49700, 52200, 54800, 57500,
    60400, 63400, 66600, 69900, 73400, 77100,
  ],
  11: [
    25000, 26300, 27600, 29000, 30400, 32000, 33600, 35200, 37000, 38800, 40800, 42800, 44900,
    47200, 49500, 52000, 54600, 57300, 60200,
  ],
  12: [
    24000, 25200, 26500, 27800, 29200, 30700, 32200, 33800, 35500, 37300, 39100, 41100, 43200,
    45300, 47600, 49900, 52400, 55100, 58000,
  ],
  13: [
    24000, 25200, 26500, 27800, 29200, 30700, 32200, 33800, 35500, 37300, 39100, 41100, 43200,
    45300, 47600, 49900, 52400, 55100, 58000,
  ],
  14: [
    23500, 24700, 26000, 27300, 28700, 30000, 31500, 33100, 34800, 36500, 38300, 40200, 42300,
    44400, 46600, 48900, 51300, 53900, 56700,
  ],
  15: [
    22800, 24000, 25200, 26400, 27800, 29100, 30600, 32100, 33700, 35400, 37200, 39000, 41000,
    43000, 45200, 47400, 49800, 52300, 55200,
  ],
  16: [
    21900, 23000, 24200, 25400, 26700, 28000, 29400, 30900, 32800, 34400, 36100, 37900, 39800,
    41800, 43900, 46000, 48300, 50700, 53200,
  ],
  17: [
    21400, 22500, 23600, 24800, 26100, 27400, 28700, 30200, 31700, 33200, 34900, 36700, 38500,
    40400, 42400, 44500, 46800, 49100, 51900,
  ],
  18: [
    21000, 22100, 23200, 24400, 25600, 26900, 28200, 29600, 31100, 32600, 34300, 36000, 37800,
    39600, 41600, 43700, 45900, 48200, 50900,
  ],
  19: [
    20500, 21600, 22700, 23800, 25000, 26200, 27500, 28900, 30300, 31900, 33400, 35100, 36900,
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

/** Rates for percentage-based Step 6 (not used when 01-07-2027 takes next stage). */
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

export function formatTaka(amount: number): string {
  return new Intl.NumberFormat('en-BD').format(Math.round(amount));
}

function stageOrNextHigher(scale: readonly number[], target: number): { amount: number; index: number } {
  for (let i = 0; i < scale.length; i++) {
    if (scale[i]! >= target) return { amount: scale[i]!, index: i };
  }
  const last = scale.length - 1;
  return { amount: scale[last]!, index: last };
}

export interface Salary2026Input {
  grade: PayGrade;
  /** Current basic on NPS 2015 for this grade (must match a published stage). */
  old_pay: number;
  phase?: SalaryPhase;
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
  /** Stage-3 only: Step 5 taken as next stage after matched stage. */
  used_next_stage_for_step5: boolean;
  /** Stage-3 only: basic as on 01-07-2026 = Step 5 amount. */
  basic_on_2026_07?: number;
  /** Stage-3 only: basic as on 01-07-2027 = next stage after Step 5 (or Step 5 if last). */
  basic_on_2027_07?: number;
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
  } = opts;
  const ratePercent = Math.round(rate * 100);
  const isLast = matchedIndex >= newScale.length - 1;
  const nextStageAmount = isLast ? step4 : newScale[matchedIndex + 1]!;
  const step5 = nextStageAmount;
  const step6 = (step5 - oldPay) * rate;
  const step7 = oldPay + step6;
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
    increment: isLast ? 0 : nextStageAmount - step4,
    increment_skipped: isLast,
    used_next_stage_for_step5: !isLast,
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
        label: `Next stage after Step 4 (Fact Increment ${effective})`,
        value: step5,
        note: isLast ? 'Last stage — Step 4 amount used' : `Next stage after ${formatTaka(step4)}`,
      },
      {
        step: 6,
        label: `(Step 5 − Old pay) × ${ratePercent}%`,
        calculation: `(${formatTaka(step5)} − ${formatTaka(oldPay)}) × ${ratePercent}%`,
        value: Math.round(step6),
        note: salaryPhaseRateNote(grade, phase),
      },
      {
        step: 7,
        label: `Old pay + Step 6 (new basic) (${effective})`,
        calculation: `${formatTaka(oldPay)} + ${formatTaka(Math.round(step6))}`,
        value: Math.round(step7),
      },
    ],
  };
}

export function calculateSalary2026(input: Salary2026Input): Salary2026Result {
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
        used_next_stage_for_step5: false,
        basic_on_2026_07: newFixed,
        basic_on_2027_07: newFixed,
        steps: [],
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
      used_next_stage_for_step5: false,
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
  const step5 = isLast ? step4 : newScale[matched.index + 1]!;
  const step5Index = isLast ? matched.index : matched.index + 1;
  const step5IsLast = step5Index >= newScale.length - 1;
  const nextAfterStep5 = step5IsLast ? step5 : newScale[step5Index + 1]!;

  // Stage-3 (01-07-2027): 01-07-2026 basic = Step 5; 01-07-2027 basic = next stage after Step 5.
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
      new_pay: nextAfterStep5,
      matched_new_stage: step4,
      increment: step5IsLast ? 0 : nextAfterStep5 - step5,
      increment_skipped: step5IsLast,
      used_next_stage_for_step5: !isLast,
      basic_on_2026_07: step5,
      basic_on_2027_07: nextAfterStep5,
      steps: [],
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
  });
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
