/**
 * Bangladesh National Pay Scale — 2015 → 2026 conversion (Salary On 2026).
 *
 * Phases:
 * - 01-07-2026: Step 5 = next stage after matched Step 4; Step 6 rate 40% (grades 1–9) / 50% (10–20)
 * - 01-01-2027: same layout; Step 6 rate 70% (grades 1–9) / 75% (10–20)
 * - 01-07-2027: if Step 4 is not last stage, Step 5 = next stage after Step 4;
 *               if last stage, keep 01-01-2027 percentage rule
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
  5: [43000, 44940, 46970, 49090, 51300, 53610, 56030, 58560, 61200, 63960, 66840, 69850],
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
    22000, 23100, 24260, 25480, 26760, 28100, 29510, 30990, 32540, 34170, 35880, 37670, 39560,
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
    11300, 11870, 12470, 13100, 13760, 14450, 15180, 15940, 16740, 17580, 18460, 19380, 20360,
    21380, 22450, 23580, 24760, 26000, 27000,
  ],
  13: [
    11000, 11550, 12130, 12740, 13380, 14050, 14760, 15500, 16280, 17100, 17960, 18870, 19810,
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
  2: [132000, 136960, 142110, 147460, 153000],
  3: [113000, 117530, 122240, 127150, 132240, 137550, 143060, 148800],
  4: [100000, 104040, 108240, 112610, 117160, 121890, 126810, 131930, 137260, 142800],
  5: [86000, 89880, 93930, 98170, 102590, 107220, 112050, 117110, 122390, 127910, 133670, 139700],
  6: [
    71000, 74720, 78640, 82770, 87110, 91680, 96490, 101550, 106870, 112480, 118380, 124590,
    131120, 138000,
  ],
  7: [
    58000, 60910, 63960, 67160, 70530, 74060, 77770, 81670, 85760, 90050, 94570, 99300, 104280,
    109500, 114990, 120750, 126800,
  ],
  8: [
    46000, 48300, 50720, 53260, 55920, 58720, 61660, 64750, 67990, 71390, 74970, 78720, 82660,
    86790, 91140, 95700, 100490, 105520, 110800,
  ],
  9: [
    44000, 46200, 48510, 50940, 53480, 56160, 58970, 61910, 65010, 68260, 71670, 75260, 79020,
    82970, 87120, 91480, 96050, 100860, 105900,
  ],
  10: [
    32000, 33610, 35290, 37070, 38930, 40880, 42940, 45090, 47360, 49740, 52230, 54860, 57610,
    60500, 63540, 66730, 70080, 73600, 77300,
  ],
  11: [
    25000, 26260, 27580, 28970, 30430, 31960, 33560, 35250, 37030, 38890, 40850, 42900, 45060,
    47330, 49710, 52210, 54840, 57600, 60500,
  ],
  12: [
    24300, 25520, 26800, 28150, 29560, 31050, 32600, 34240, 35960, 37770, 39660, 41660, 43750,
    45950, 48250, 50680, 53220, 55890, 58700,
  ],
  13: [
    24000, 25210, 26470, 27800, 29200, 30670, 32210, 33830, 35520, 37310, 39180, 41150, 43220,
    45390, 47670, 50070, 52580, 55230, 58000,
  ],
  14: [
    23500, 24680, 25920, 27220, 28590, 30030, 31540, 33120, 34790, 36530, 38370, 40300, 42320,
    44450, 46680, 49030, 51490, 54080, 56800,
  ],
  15: [
    22800, 23950, 25150, 26420, 27750, 29150, 30620, 32160, 33780, 35480, 37260, 39140, 41110,
    43180, 45350, 47640, 50030, 52550, 55200,
  ],
  16: [
    21900, 23000, 24150, 25370, 26640, 27980, 29380, 30860, 32410, 34040, 35750, 37540, 39430,
    41410, 43490, 45670, 47960, 50370, 52900,
  ],
  17: [
    21400, 22480, 23610, 24810, 26060, 27370, 28750, 30200, 31730, 33330, 35010, 36770, 38630,
    40580, 42630, 44780, 47030, 49410, 51900,
  ],
  18: [
    21000, 22060, 23170, 24340, 25570, 26850, 28210, 29630, 31120, 32690, 34340, 36070, 37890,
    39800, 41810, 43920, 46130, 48460, 50900,
  ],
  19: [
    20500, 21530, 22610, 23750, 24950, 26200, 27520, 28910, 30360, 31890, 33490, 35180, 36950,
    38810, 40760, 42810, 44960, 47220, 49600,
  ],
  20: [
    20000, 21020, 22080, 23210, 24380, 25620, 26930, 28290, 29730, 31240, 32830, 34500, 36250,
    38090, 40030, 42060, 44200, 46440, 48800,
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
  /** 01-07-2027 Stage-3: Step 5 taken as next stage after matched stage. */
  used_next_stage_for_step5: boolean;
  /** Stage-3 only: basic as on 01-07-2026 = matched NPS 2026 stage. */
  basic_on_2026_07?: number;
  /** Stage-3 only: basic as on 01-07-2027 = next stage (or matched if last). */
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
  const nextStage = isLast ? step4 : newScale[matched.index + 1]!;

  // Stage-3 (01-07-2027): single-line — 01-07-2026 = matched stage; 01-07-2027 = next (if not last).
  // No Pay Scale 2015 comparison in this stage's presentation.
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
      new_pay: nextStage,
      matched_new_stage: step4,
      increment: isLast ? 0 : nextStage - step4,
      increment_skipped: isLast,
      used_next_stage_for_step5: !isLast,
      basic_on_2026_07: step4,
      basic_on_2027_07: nextStage,
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
