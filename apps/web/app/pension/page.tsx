'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Settings, Plus, Trash2, ChevronDown, X, BookOpen, ListChecks } from 'lucide-react';
import {
  breakdownFromDays,
  calculateBoyServiceDays,
  calculatePensionGratuity,
  calculatePrl,
  calculateQualifyingPensionService,
  daysBetweenInclusive,
  formatPeriodLabel,
  isMaternityLeaveCode,
  isSuspensionLeaveCode,
  isUnauthorisedLeaveCode,
  maternityDaysFromStartDate,
  previewRestLeaveDeduction,
  roundHalfUp,
  type PensionCalculateResult,
  type PensionEnjoyedLeaveInput,
  type PensionGratuityResult,
  type PensionLeaveTypeCalc,
  type PrlCalculateResult,
  type QualifyingPensionServiceResult,
} from '@ibas/shared-types';
import {
  PENSION_GRATUITY_MULTIPLIER_TABLE,
  PENSION_LAMP_GRANT_MONTHS,
  PENSION_MATERNITY_DAYS_BEFORE_RULE,
  PENSION_MATERNITY_DAYS_FROM_RULE,
  PENSION_MATERNITY_RULE_CHANGE_DATE,
  PENSION_PRL_START_AGE_YEARS,
  PENSION_SUSPENSION_LEAVE_CODE,
  PENSION_UNAUTHORISED_LEAVE_CODE,
  type PensionLeavePayCategory,
} from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import {
  payCategoryLabel,
  deductionRuleLabel,
  leaveTypeDisplayName,
} from '@/lib/pension-labels';
import { CalcLocaleProvider, useCalcLocale } from '@/components/shared/calc-locale-provider';
import { LocaleSwitcher } from '@/components/shared/locale-switcher';
import type { AppLocale } from '@/i18n/config';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface LeaveTypeRow {
  id: string;
  code: string;
  name_en: string;
  name_bn?: string;
  pay_category: PensionLeavePayCategory;
  deduction_rule: 'leave_earning_only' | 'both' | 'none';
  is_auto_entitlement?: boolean;
}

type EnjoyedInputMode = 'days' | 'dates' | 'maternity_start';

interface EnjoyedRow {
  key: string;
  leave_type_id: string;
  input_mode: EnjoyedInputMode;
  days: string;
  from_date: string;
  to_date: string;
  /** SUSPENSION rows only: regularized as duty by order -> not excluded, contributes 0. */
  regularized?: boolean;
}

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

/** Synthetic ids for SUSPENSION/UNAUTHORISEDLEAVE when not seeded as real DB leave types — must match the ids ensureSuspensionAndUnauthorizedLeaveTypes (shared-types) generates server-side. */
const AUTO_SUSPENSION_ID = '__auto_suspension__';
const AUTO_UNAUTHORISED_ID = '__auto_unauthorised__';

/** Ensures SUSPENSION and UNAUTHORISEDLEAVE are always selectable in the Enjoyed Leave list, even if not admin-configured in the DB. */
function withSpecialLeaveTypes(leaveTypes: LeaveTypeRow[]): LeaveTypeRow[] {
  const extra: LeaveTypeRow[] = [];
  if (!leaveTypes.some((t) => t.code === PENSION_SUSPENSION_LEAVE_CODE)) {
    extra.push({
      id: AUTO_SUSPENSION_ID,
      code: PENSION_SUSPENSION_LEAVE_CODE,
      name_en: 'Suspension (unregularized)',
      pay_category: 'without_pay',
      deduction_rule: 'both',
    });
  }
  if (!leaveTypes.some((t) => t.code === PENSION_UNAUTHORISED_LEAVE_CODE)) {
    extra.push({
      id: AUTO_UNAUTHORISED_ID,
      code: PENSION_UNAUTHORISED_LEAVE_CODE,
      name_en: 'Unauthorized absence',
      pay_category: 'without_pay',
      deduction_rule: 'both',
    });
  }
  return extra.length > 0 ? [...leaveTypes, ...extra] : leaveTypes;
}

function leaveTypeCode(leaveTypes: LeaveTypeRow[], leaveTypeId: string): string | undefined {
  return leaveTypes.find((t) => t.id === leaveTypeId)?.code;
}

function resolveEnjoyedDays(row: EnjoyedRow, leaveTypes: LeaveTypeRow[]): number {
  const code = leaveTypeCode(leaveTypes, row.leave_type_id);
  if (isSuspensionLeaveCode(code) && row.regularized) return 0;
  if (isMaternityLeaveCode(code) || row.input_mode === 'maternity_start') {
    return maternityDaysFromStartDate(row.from_date);
  }
  if (row.input_mode === 'dates') {
    if (!row.from_date || !row.to_date) return 0;
    return daysBetweenInclusive(row.from_date, row.to_date);
  }
  const days = Number(row.days);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

function emptyEnjoyedRow(leaveTypeId = '', leaveTypes: LeaveTypeRow[] = []): EnjoyedRow {
  const code = leaveTypeCode(leaveTypes, leaveTypeId);
  const isMaternity = isMaternityLeaveCode(code);
  return {
    key: crypto.randomUUID(),
    leave_type_id: leaveTypeId,
    input_mode: isMaternity ? 'maternity_start' : 'days',
    days: '',
    from_date: '',
    to_date: '',
    regularized: false,
  };
}

const SUMMARY_CATEGORIES: PensionLeavePayCategory[] = [
  'average_salary',
  'half_average_salary',
  'without_pay',
  'regular_working_period',
];

function PeriodCard({
  title,
  period,
  note,
  locale,
}: {
  title: string;
  period: { years: number; months: number; days: number; total_days?: number };
  note?: string;
  locale: AppLocale;
}) {
  return (
    <div className="rounded-lg border border-border bg-slate-50/80 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <div className="mt-1 text-lg font-semibold">
        {formatPeriodLabel(
          {
            years: period.years,
            months: period.months,
            days: period.days,
            total_days: period.total_days ?? period.years * 360 + period.months * 30 + period.days,
          },
          locale,
        )}
      </div>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-primary" style={{ fontVariantNumeric: 'normal' }}>
        {value}
      </div>
    </div>
  );
}

function InfoModal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden rounded-none border border-border bg-background shadow-xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:rounded-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function MathRow({
  label,
  value,
  note,
  emphasize,
}: {
  label: string;
  value: string;
  note?: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 py-2 last:border-b-0 ${
        emphasize ? 'font-semibold text-foreground' : 'text-sm'
      }`}
    >
      <div>
        <span>{label}</span>
        {note ? <span className="ml-2 text-xs font-normal text-muted">{note}</span> : null}
      </div>
      <span className={emphasize ? 'text-base' : undefined}>{value}</span>
    </div>
  );
}

function formatDaysLabel(t: TranslateFn, locale: AppLocale, days: number): string {
  const rounded = roundHalfUp(days);
  return t('formatDays', {
    days: rounded,
    period: formatPeriodLabel(breakdownFromDays(rounded), locale),
  });
}

function formatMoney(amount: number): string {
  return `৳ ${amount.toLocaleString('en-BD', { minimumFractionDigits: 2 })}`;
}

/** ISO date + N calendar years, as an ISO date string (empty if the input isn't a valid date). */
function addYearsIso(iso: string, years: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/** Band label for a row in a descending min-years table — "25+ years" for the top row, "20–24 years" otherwise. */
function yearsBandLabel(
  t: TranslateFn,
  table: readonly { min_years: number }[],
  index: number,
): string {
  const row = table[index]!;
  if (index === 0) return t('multiplierTablePlus', { years: row.min_years });
  const max = table[index - 1]!.min_years - 1;
  return t('multiplierTableRange', { min: row.min_years, max });
}

interface AppliedRuleStage {
  title: string;
  rules: string[];
}

function buildAppliedRules(args: {
  joinDate: string;
  endDate: string;
  lastBasic: string;
  enjoyed: EnjoyedRow[];
  leaveTypes: LeaveTypeRow[];
  result: PensionCalculateResult | null;
  restDays: number;
  restAutoApplied: boolean;
  restCycles: number;
  t: TranslateFn;
  locale: AppLocale;
}): AppliedRuleStage[] {
  const {
    joinDate,
    endDate,
    lastBasic,
    enjoyed,
    leaveTypes,
    result,
    restDays,
    restAutoApplied,
    restCycles,
    t,
    locale,
  } = args;
  const stages: AppliedRuleStage[] = [];

  if (joinDate && endDate) {
    const serviceDays = result?.service_period.total_days ?? daysBetweenInclusive(joinDate, endDate);
    stages.push({
      title: t('stageService'),
      rules: [t('stageService1', { days: serviceDays }), t('stageService2')],
    });
  }

  const maternityRows = enjoyed.filter((r) => {
    const code = leaveTypeCode(leaveTypes, r.leave_type_id);
    return isMaternityLeaveCode(code) && r.from_date;
  });
  const dateRangeRows = enjoyed.filter((r) => {
    const code = leaveTypeCode(leaveTypes, r.leave_type_id);
    return !isMaternityLeaveCode(code) && r.input_mode === 'dates' && r.from_date && r.to_date;
  });
  const dayRows = enjoyed.filter((r) => {
    const code = leaveTypeCode(leaveTypes, r.leave_type_id);
    return !isMaternityLeaveCode(code) && r.input_mode === 'days' && Number(r.days) > 0;
  });

  const inputRules: string[] = [];
  if (dayRows.length > 0) {
    inputRules.push(t('stageInputDays', { count: dayRows.length }));
  }
  if (dateRangeRows.length > 0) {
    inputRules.push(t('stageInputDates', { count: dateRangeRows.length }));
  }
  for (const row of maternityRows) {
    const days = maternityDaysFromStartDate(row.from_date);
    const detail =
      row.from_date < PENSION_MATERNITY_RULE_CHANGE_DATE
        ? t('maternityBefore', {
            date: PENSION_MATERNITY_RULE_CHANGE_DATE,
            days: PENSION_MATERNITY_DAYS_BEFORE_RULE,
          })
        : t('maternityAfter', {
            date: PENSION_MATERNITY_RULE_CHANGE_DATE,
            days: PENSION_MATERNITY_DAYS_FROM_RULE,
          });
    inputRules.push(
      t('stageInputMaternity', {
        date: row.from_date,
        detail,
        days,
      }),
    );
  }
  if (restDays > 0) {
    inputRules.push(
      restAutoApplied
        ? t('stageInputRestAuto', { cycles: restCycles, days: restDays })
        : t('stageInputRestManual', { days: restDays }),
    );
  } else if (joinDate && endDate) {
    inputRules.push(t('stageInputRestNone'));
  }
  if (inputRules.length > 0) {
    stages.push({ title: t('stageInput'), rules: inputRules });
  }

  const usedTypes = new Map<
    string,
    { name: string; days: number; deduction: string; category: string }
  >();
  for (const row of enjoyed) {
    const days = resolveEnjoyedDays(row, leaveTypes);
    if (!row.leave_type_id || days <= 0) continue;
    const type = leaveTypes.find((lt) => lt.id === row.leave_type_id);
    if (!type) continue;
    const existing = usedTypes.get(type.id);
    if (existing) {
      existing.days += days;
    } else {
      usedTypes.set(type.id, {
        name: leaveTypeDisplayName(locale, type),
        days,
        deduction: deductionRuleLabel(t, type.deduction_rule),
        category: payCategoryLabel(t, type.pay_category),
      });
    }
  }
  if (restAutoApplied && restDays > 0) {
    const restType = leaveTypes.find((lt) => lt.code === 'REST');
    if (restType && !usedTypes.has(restType.id)) {
      usedTypes.set(restType.id, {
        name: leaveTypeDisplayName(locale, restType),
        days: restDays,
        deduction: deductionRuleLabel(t, restType.deduction_rule),
        category: payCategoryLabel(t, restType.pay_category),
      });
    }
  }

  if (usedTypes.size > 0) {
    stages.push({
      title: t('stageDeduction'),
      rules: [...usedTypes.values()].map((row) =>
        t('stageDeductionRow', {
          name: row.name,
          days: row.days,
          category: row.category,
          deduction: row.deduction,
        }),
      ),
    });
  }

  if (result) {
    stages.push({
      title: t('stageEarning'),
      rules: [
        t('stageEarning1', { days: result.leave_earning_period.total_days }),
        t('stageEarning2', { days: result.average_salary_leave_earned_days }),
        t('stageEarning3', { days: result.half_average_leave_earned_days }),
        t('stageEarning4', {
          enjoyed: result.enjoyed_average_salary_days,
          balance: formatPeriodLabel(result.average_salary_leave, locale),
        }),
        t('stageEarning5', {
          enjoyed: result.enjoyed_half_average_days,
          balance: formatPeriodLabel(result.half_average_leave, locale),
        }),
        t('stageEarning6'),
        t('stageEarning7', {
          balance: formatPeriodLabel(result.total_average_salary_leave, locale),
          months: result.average_salary_leave_months.toFixed(2),
        }),
      ],
    });

    if (lastBasic) {
      stages.push({
        title: t('stageLamp'),
        rules: [
          t('stageLampRule1', { months: result.average_salary_leave_months.toFixed(2) }),
          t('stageLampRule2', { months: result.lamp_grant_months_used.toFixed(2) }),
        ],
      });
    }
  } else if (joinDate && endDate) {
    stages.push({
      title: t('stageEarningPending'),
      rules: [
        t('stageEarningPending1'),
        t('stageEarningPending2'),
        t('stageEarningPending3'),
        t('stageEarningPending4'),
      ],
    });
    if (lastBasic) {
      stages.push({
        title: t('stageLampPending'),
        rules: [t('stageLampPending1'), t('stageLampPending2')],
      });
    }
  }

  return stages;
}

function sumEnjoyedDays(rows: EnjoyedRow[], leaveTypes: LeaveTypeRow[]): number {
  return rows.reduce((sum, row) => sum + resolveEnjoyedDays(row, leaveTypes), 0);
}

function sumEnjoyedByCategory(
  rows: EnjoyedRow[],
  leaveTypes: LeaveTypeRow[],
  category: PensionLeavePayCategory,
  excludeTypeId?: string,
): number {
  const typeIds = new Set(
    leaveTypes.filter((lt) => lt.pay_category === category && lt.id !== excludeTypeId).map((lt) => lt.id),
  );
  return rows
    .filter((r) => typeIds.has(r.leave_type_id))
    .reduce((sum, row) => sum + resolveEnjoyedDays(row, leaveTypes), 0);
}

export default function PensionCalculatorPage() {
  return (
    <CalcLocaleProvider>
      <PensionCalculatorInner />
    </CalcLocaleProvider>
  );
}

function PensionCalculatorInner() {
  const t = useTranslations('pension');
  const tc = useTranslations('common');
  const { locale } = useCalcLocale();
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [joinDate, setJoinDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastBasic, setLastBasic] = useState('');
  const [age, setAge] = useState('');
  const [dob, setDob] = useState('');
  const [prlDate, setPrlDate] = useState('');
  const [contractualDays, setContractualDays] = useState('');
  const [chosenLumpSumMonths, setChosenLumpSumMonths] = useState('');
  const [editingSplit, setEditingSplit] = useState(false);
  const [appliedLumpSumMonths, setAppliedLumpSumMonths] = useState<number | undefined>(undefined);
  const [enjoyed, setEnjoyed] = useState<EnjoyedRow[]>([]);
  const [result, setResult] = useState<PensionCalculateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showRulesApplied, setShowRulesApplied] = useState(false);

  const effectiveLeaveTypes = withSpecialLeaveTypes(leaveTypes);

  useEffect(() => {
    apiFetch<{ data: LeaveTypeRow[] }>('/pension/leave-types')
      .then((res) => setLeaveTypes(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : t('loadError')))
      .finally(() => setLoading(false));
    fetchMe()
      .then((res) => {
        setIsAdmin(
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin',
        );
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const restType = effectiveLeaveTypes.find((lt) => lt.code === 'REST');
  const enjoyedForPreview: PensionEnjoyedLeaveInput[] = enjoyed
    .map((r) => ({ leave_type_id: r.leave_type_id, days: resolveEnjoyedDays(r, effectiveLeaveTypes) }))
    .filter((r) => r.leave_type_id && r.days > 0);
  const calcLeaveTypes: PensionLeaveTypeCalc[] = effectiveLeaveTypes.map((lt) => ({
    id: lt.id,
    code: lt.code,
    name_en: lt.name_en,
    pay_category: lt.pay_category,
    deduction_rule: lt.deduction_rule,
    is_auto_entitlement: lt.is_auto_entitlement,
  }));
  const restPreview = previewRestLeaveDeduction(joinDate, endDate, enjoyedForPreview, calcLeaveTypes);
  const restDays = result?.rest_leave?.enjoyed_days ?? restPreview.days;
  const restAutoApplied = result?.rest_leave?.auto_applied ?? restPreview.auto_applied;
  const restCycles = result?.rest_leave?.cycles ?? restPreview.cycles;

  const summaryByCategory: Record<PensionLeavePayCategory, number> = {
    average_salary: result?.enjoyed_average_salary_days ?? 0,
    half_average_salary: result?.enjoyed_half_average_days ?? 0,
    without_pay: result?.enjoyed_without_pay_days ?? 0,
    regular_working_period: result?.enjoyed_regular_working_days ?? 0,
  };

  if (!result) {
    const averageOther = sumEnjoyedByCategory(enjoyed, effectiveLeaveTypes, 'average_salary', restType?.id);
    summaryByCategory.average_salary = averageOther + restDays;
    summaryByCategory.half_average_salary = sumEnjoyedByCategory(enjoyed, effectiveLeaveTypes, 'half_average_salary');
    summaryByCategory.without_pay = sumEnjoyedByCategory(enjoyed, effectiveLeaveTypes, 'without_pay');
    summaryByCategory.regular_working_period = sumEnjoyedByCategory(
      enjoyed,
      effectiveLeaveTypes,
      'regular_working_period',
    );
  }

  const boyServiceDays = calculateBoyServiceDays(dob, joinDate, endDate);
  const suspensionDaysTotal = enjoyed
    .filter((r) => isSuspensionLeaveCode(leaveTypeCode(effectiveLeaveTypes, r.leave_type_id)))
    .reduce((sum, r) => sum + resolveEnjoyedDays(r, effectiveLeaveTypes), 0);
  const qualifyingService: QualifyingPensionServiceResult | null =
    joinDate && endDate
      ? calculateQualifyingPensionService(joinDate, endDate, {
          leave_without_pay_days: summaryByCategory.without_pay,
          suspension_days: suspensionDaysTotal,
          boy_service_days: boyServiceDays,
          contractual_part_time_days: Number(contractualDays) || 0,
        })
      : null;
  const suggestedPrlDate = dob ? addYearsIso(dob, PENSION_PRL_START_AGE_YEARS) : '';
  const prlResult: PrlCalculateResult | null =
    dob && result && Number(lastBasic) > 0
      ? calculatePrl({
          dob,
          prl_date: prlDate || undefined,
          total_leave_months: result.average_salary_leave_months,
          last_basic_salary: Number(lastBasic),
          chosen_lump_sum_months: appliedLumpSumMonths,
        })
      : null;
  // Monthly pension + gratuity are computed on the PRL-adjusted (July-1, +5%) basic when it applies.
  const pensionRateBasic = prlResult?.pension_basic_salary ?? Number(lastBasic);
  const gratuityResult: PensionGratuityResult | null =
    qualifyingService && pensionRateBasic > 0
      ? calculatePensionGratuity({
          qualifying_years: qualifyingService.qualifying_service_years,
          last_basic_salary: pensionRateBasic,
          age_years: age ? Number(age) : undefined,
        })
      : null;

  function addEnjoyedRow() {
    setEnjoyed((rows) => [...rows, emptyEnjoyedRow(effectiveLeaveTypes[0]?.id ?? '', effectiveLeaveTypes)]);
  }

  function updateEnjoyedRow(idx: number, patch: Partial<EnjoyedRow>) {
    setEnjoyed((rows) =>
      rows.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, ...patch };
        const code = leaveTypeCode(effectiveLeaveTypes, next.leave_type_id);

        if (isMaternityLeaveCode(code)) {
          next.input_mode = 'maternity_start';
          next.to_date = '';
          const maternityDays = maternityDaysFromStartDate(next.from_date);
          next.days = maternityDays > 0 ? String(maternityDays) : '';
          return next;
        }

        if (patch.leave_type_id && next.input_mode === 'maternity_start') {
          next.input_mode = 'days';
          next.from_date = '';
          next.days = '';
        }

        if (next.input_mode === 'dates' && next.from_date && next.to_date) {
          const autoDays = daysBetweenInclusive(next.from_date, next.to_date);
          next.days = autoDays > 0 ? String(autoDays) : '';
        }
        return next;
      }),
    );
  }

  async function calculate() {
    setCalculating(true);
    setError('');
    setResult(null);
    try {
      const res = await apiFetch<{ data: PensionCalculateResult }>('/pension/calculate', {
        method: 'POST',
        body: JSON.stringify({
          join_date: joinDate,
          end_date: endDate,
          last_basic_salary: Number(lastBasic),
          enjoyed_leaves: enjoyedForPreview,
        }),
      });
      setResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setCalculating(false);
    }
  }

  const appliedRuleStages = buildAppliedRules({
    joinDate,
    endDate,
    lastBasic,
    enjoyed,
    leaveTypes: effectiveLeaveTypes,
    result,
    restDays,
    restAutoApplied,
    restCycles,
    t,
    locale,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setShowInstructions(true)}>
              <BookOpen className="h-4 w-4" />
              {t('instructions')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowRulesApplied(true)}>
              <ListChecks className="h-4 w-4" />
              {t('rulesApplied')}
            </Button>
            <LocaleSwitcher />
            <Button asChild size="sm" variant="outline">
              <Link href="/joining-period">{t('joiningLink')}</Link>
            </Button>
            {isAdmin ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/setup/pension-leaves">
                  <Settings className="h-4 w-4" />
                  {t('leaveTypeSetup')}
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <InfoModal title={t('instructions')} open={showInstructions} onClose={() => setShowInstructions(false)}>
        <div className="space-y-4 text-muted">
          <p>
            {t.rich('instructionsIntro', {
              strong: (chunks) => <strong className="text-foreground">{chunks}</strong>,
            })}
          </p>
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-foreground">{t('leaveAccountTitle')}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>{t('leaveAccount1')}</li>
                <li>{t('leaveAccount2')}</li>
                <li>{t('leaveAccount3')}</li>
                <li>{t('leaveAccount4')}</li>
                <li>{t('leaveAccount5')}</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">{t('lampGrantTitle')}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>{t('lampGrant1')}</li>
                <li>{t('lampGrant2')}</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">{t('qualifyingServiceRuleTitle')}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>{t('qualifyingServiceRule1')}</li>
                <li>{t('qualifyingServiceRule2')}</li>
                <li>{t('qualifyingServiceRule3')}</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">{t('gratuityRuleTitle')}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>{t('gratuityRule1')}</li>
                <li>{t('gratuityRule2')}</li>
                <li>{t('gratuityRule3')}</li>
                <li>{t('gratuityRule4')}</li>
              </ul>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full border-collapse text-sm">
                  <caption className="caption-top pb-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('multiplierTableTitle')}
                  </caption>
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border-b border-border px-3 py-2 text-left font-semibold text-foreground">
                        {t('multiplierTableYears')}
                      </th>
                      <th className="border-b border-l border-border px-3 py-2 text-left font-semibold text-foreground">
                        {t('multiplierTableValue')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {PENSION_GRATUITY_MULTIPLIER_TABLE.map((row, i) => (
                      <tr key={row.min_years}>
                        <td className="border-b border-border px-3 py-2 text-foreground">
                          {yearsBandLabel(t, PENSION_GRATUITY_MULTIPLIER_TABLE, i)}
                        </td>
                        <td className="border-b border-l border-border px-3 py-2 font-medium text-foreground">
                          {row.multiplier}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">{t('prlRuleTitle')}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>{t('prlRule1')}</li>
                <li>{t('prlRule2')}</li>
                <li>{t('prlRule3')}</li>
                <li>{t('prlRule4')}</li>
              </ul>
            </div>
          </div>
        </div>
      </InfoModal>

      <InfoModal title={t('rulesApplied')} open={showRulesApplied} onClose={() => setShowRulesApplied(false)}>
        {appliedRuleStages.length === 0 ? (
          <p className="text-muted">{t('rulesEmpty')}</p>
        ) : (
          <div className="space-y-4">
            {appliedRuleStages.map((stage) => (
              <div key={stage.title}>
                <p className="font-semibold text-foreground">{stage.title}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                  {stage.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </InfoModal>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t('serviceSalary')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="join_date">{t('joinDate')}</Label>
            <Input id="join_date" type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">{t('endDate')}</Label>
            <Input id="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_basic">{t('lastBasic')}</Label>
            <Input
              id="last_basic"
              type="number"
              min={1}
              value={lastBasic}
              onChange={(e) => setLastBasic(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pension_age">{t('gratuityAgeLabel')}</Label>
            <Input id="pension_age" type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} />
            <p className="text-xs text-muted">{t('gratuityAgeHint')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('enjoyedLeave')}</CardTitle>
            <p className="mt-1 text-sm text-muted">{t('enjoyedLeaveHint')}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!effectiveLeaveTypes.length}
            onClick={addEnjoyedRow}
          >
            <Plus className="h-4 w-4" />
            {t('addRow')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted">{t('loadingTypes')}</p>
          ) : effectiveLeaveTypes.length === 0 ? (
            <p className="text-sm text-muted">{t('noTypes')}</p>
          ) : enjoyed.length === 0 ? (
            <p className="text-sm text-muted">{t('noRows')}</p>
          ) : (
            enjoyed.map((row, idx) => {
              const selectedType = effectiveLeaveTypes.find((lt) => lt.id === row.leave_type_id);
              const isMaternity = isMaternityLeaveCode(selectedType?.code);
              const isSuspension = isSuspensionLeaveCode(selectedType?.code);
              const resolvedDays = resolveEnjoyedDays(row, effectiveLeaveTypes);
              return (
                <div key={row.key} className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[220px] flex-1 space-y-1">
                      <Label>{t('leaveType')}</Label>
                      <select
                        className="ibas-select"
                        value={row.leave_type_id}
                        onChange={(e) => updateEnjoyedRow(idx, { leave_type_id: e.target.value })}
                      >
                        {SUMMARY_CATEGORIES.map((category) => {
                          const types = effectiveLeaveTypes.filter((lt) => lt.pay_category === category);
                          if (types.length === 0) return null;
                          return (
                            <optgroup key={category} label={payCategoryLabel(t, category)}>
                              {types.map((lt) => (
                                <option key={lt.id} value={lt.id}>
                                  {leaveTypeDisplayName(locale, lt)}
                                  {lt.code === 'REST' ? ` ${t('restSuffix')}` : ''}
                                  {lt.code === 'MATERNITY' ? ` ${t('maternitySuffix')}` : ''}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                    </div>
                    {!isMaternity ? (
                      <div className="w-36 space-y-1">
                        <Label>{t('input')}</Label>
                        <select
                          className="ibas-select"
                          value={row.input_mode === 'maternity_start' ? 'days' : row.input_mode}
                          onChange={(e) =>
                            updateEnjoyedRow(idx, {
                              input_mode: e.target.value as EnjoyedInputMode,
                            })
                          }
                        >
                          <option value="days">{t('inputDays')}</option>
                          <option value="dates">{t('inputDates')}</option>
                        </select>
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEnjoyed((rows) => rows.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {isMaternity ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1">
                        <Label>{t('startDate')}</Label>
                        <Input
                          type="date"
                          value={row.from_date}
                          onChange={(e) => updateEnjoyedRow(idx, { from_date: e.target.value })}
                        />
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span className="text-muted">{t('daysLabel')}: </span>
                        <span className="font-semibold">
                          {resolvedDays > 0 ? resolvedDays : '—'}
                        </span>
                        {row.from_date ? (
                          <span className="ml-2 text-xs text-muted">
                            {row.from_date < PENSION_MATERNITY_RULE_CHANGE_DATE
                              ? t('maternityBefore', {
                                  date: PENSION_MATERNITY_RULE_CHANGE_DATE,
                                  days: PENSION_MATERNITY_DAYS_BEFORE_RULE,
                                })
                              : t('maternityAfter', {
                                  date: PENSION_MATERNITY_RULE_CHANGE_DATE,
                                  days: PENSION_MATERNITY_DAYS_FROM_RULE,
                                })}
                          </span>
                        ) : (
                          <span className="ml-2 text-xs text-muted">
                            {t('maternityHint', {
                              before: PENSION_MATERNITY_DAYS_BEFORE_RULE,
                              after: PENSION_MATERNITY_DAYS_FROM_RULE,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : row.input_mode === 'days' ? (
                    <div className="w-36 space-y-1">
                      <Label>{t('daysLabel')}</Label>
                      <Input
                        type="number"
                        min={1}
                        value={row.days}
                        onChange={(e) => updateEnjoyedRow(idx, { days: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1">
                        <Label>{t('fromDate')}</Label>
                        <Input
                          type="date"
                          value={row.from_date}
                          onChange={(e) => updateEnjoyedRow(idx, { from_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{t('toDate')}</Label>
                        <Input
                          type="date"
                          value={row.to_date}
                          min={row.from_date || undefined}
                          onChange={(e) => updateEnjoyedRow(idx, { to_date: e.target.value })}
                        />
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span className="text-muted">{t('daysLabel')}: </span>
                        <span className="font-semibold">
                          {resolvedDays > 0 ? resolvedDays : '—'}
                        </span>
                        {row.from_date && row.to_date && resolvedDays <= 0 ? (
                          <span className="ml-2 text-xs text-destructive">{t('invalidRange')}</span>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {isSuspension ? (
                    <div className="flex items-center gap-2">
                      <input
                        id={`regularized_${row.key}`}
                        type="checkbox"
                        checked={row.regularized ?? false}
                        onChange={(e) => updateEnjoyedRow(idx, { regularized: e.target.checked })}
                      />
                      <Label htmlFor={`regularized_${row.key}`} className="font-normal">
                        {t('suspensionRegularizedLabel')}
                      </Label>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-muted">{t('rowsInList')}: </span>
            <span className="font-semibold">{enjoyed.length}</span>
            <span className="mx-2 text-muted">·</span>
            <span className="text-muted">{t('daysEntered')}: </span>
            <span className="font-semibold">{sumEnjoyedDays(enjoyed, effectiveLeaveTypes)}</span>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div>
              <p className="font-semibold text-foreground">{t('exclusionsTitle')}</p>
              <p className="mt-1 text-xs text-muted">{t('exclusionsHint')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="dob">{t('dobLabel')}</Label>
                <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                {dob && joinDate ? (
                  <p className="text-xs text-muted">{t('boyServiceAuto', { days: boyServiceDays })}</p>
                ) : (
                  <p className="text-xs text-muted">{t('dobHint')}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="prl_date">{t('prlDateLabel')}</Label>
                <Input
                  id="prl_date"
                  type="date"
                  value={prlDate || suggestedPrlDate}
                  onChange={(e) => setPrlDate(e.target.value)}
                  max={suggestedPrlDate || undefined}
                  disabled={!dob}
                />
                <p className="text-xs text-muted">{t('prlDateHint')}</p>
                {prlResult?.prl_date_capped ? (
                  <p className="text-xs text-amber-600">
                    {t('prlDateCappedNote', { date: prlResult.prl_start_date })}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor="contractual_days">{t('contractualLabel')}</Label>
                <Input
                  id="contractual_days"
                  type="number"
                  min={0}
                  value={contractualDays}
                  onChange={(e) => setContractualDays(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('enjoyedSummary')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {SUMMARY_CATEGORIES.map((category) => {
            const typesInCategory = effectiveLeaveTypes.filter((lt) => lt.pay_category === category);
            if (typesInCategory.length === 0 && category !== 'average_salary') return null;

            const total = summaryByCategory[category];
            const isAverage = category === 'average_salary';

            return (
              <div key={category} className="rounded-lg border px-3 py-2">
                <div className="flex justify-between">
                  <span>{payCategoryLabel(t, category)}</span>
                  <span className="font-semibold">
                    {total} {tc('days')}
                  </span>
                </div>
                {isAverage && restDays === 0 && joinDate && endDate ? (
                  <p className="mt-1 text-xs text-muted">{t('restNoCycle')}</p>
                ) : null}
                {isAverage && restAutoApplied && restCycles > 0 ? (
                  <p className="mt-1 text-xs text-muted">
                    {t('restAutoCycles', { cycles: restCycles })}
                  </p>
                ) : null}
                {total > 0 || (isAverage && restDays > 0) ? (
                  <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-xs">
                    {isAverage && restDays > 0 ? (
                      <div className="flex justify-between">
                        <span className="text-muted">
                          {t('restLeave')}
                          {restAutoApplied ? ` ${t('restAuto')}` : ''}
                        </span>
                        <span className="font-medium">
                          {restDays} {tc('days')}
                        </span>
                      </div>
                    ) : null}
                    {typesInCategory.map((type) => {
                      if (type.id === restType?.id && restAutoApplied) return null;
                      const days = enjoyed
                        .filter((r) => r.leave_type_id === type.id)
                        .reduce((s, r) => s + resolveEnjoyedDays(r, effectiveLeaveTypes), 0);
                      if (days <= 0) return null;
                      return (
                        <div key={type.id} className="flex justify-between">
                          <span className="text-muted">{leaveTypeDisplayName(locale, type)}</span>
                          <span className="font-medium">
                            {days} {tc('days')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
          <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 font-medium">
            <span>{t('daysEnteredInList')}</span>
            <span>
              {sumEnjoyedDays(enjoyed, effectiveLeaveTypes)} {tc('days')}
            </span>
          </div>
        </CardContent>
      </Card>

      <details className="group rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-6 py-4 [&::-webkit-details-marker]:hidden">
          <span className="text-lg font-semibold">{t('leaveTypeReference')}</span>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-border px-6 pb-6 pt-4 sm:grid-cols-2">
          {effectiveLeaveTypes.map((lt) => (
            <div key={lt.id} className="rounded-lg border p-3 text-sm">
              <div className="font-medium">{leaveTypeDisplayName(locale, lt)}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge variant="outline">{payCategoryLabel(t, lt.pay_category)}</Badge>
                {lt.is_auto_entitlement ? (
                  <Badge variant="secondary">{t('autoDeducted')}</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-muted">{deductionRuleLabel(t, lt.deduction_rule)}</p>
            </div>
          ))}
        </div>
      </details>

      <Button
        size="lg"
        disabled={calculating || !joinDate || !endDate || !lastBasic}
        onClick={() => void calculate()}
      >
        {calculating ? tc('calculating') : t('calculateBtn')}
      </Button>

      {result ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('servicePeriods')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PeriodCard title={t('completeService')} period={result.service_period} locale={locale} />
              <PeriodCard title={t('workingPeriod')} period={result.working_period} locale={locale} />
              <PeriodCard title={t('leaveEarning')} period={result.leave_earning_period} locale={locale} />
              <PeriodCard
                title={t('qualifyingServiceLabel')}
                period={qualifyingService?.breakdown ?? { years: 0, months: 0, days: 0, total_days: 0 }}
                note={
                  qualifyingService
                    ? t('qualifyingServiceExcludedNote', { days: qualifyingService.total_exclusion_days })
                    : undefined
                }
                locale={locale}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('leaveBalances')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="mb-2 text-sm font-semibold">
                  {payCategoryLabel(t, 'average_salary')}
                </div>
                <MathRow
                  label={t('averageEarning')}
                  value={formatDaysLabel(t, locale, result.average_salary_leave_earned_days)}
                />
                <MathRow
                  label={t('averageDeduction')}
                  note={
                    result.rest_leave
                      ? result.rest_leave.auto_applied
                        ? `${t('restLeave')} ${t('restAuto')} ${result.rest_leave.enjoyed_days} ${tc('days')}`
                        : `${t('restLeave')} ${result.rest_leave.enjoyed_days} ${tc('days')}`
                      : undefined
                  }
                  value={`− ${formatDaysLabel(t, locale, result.enjoyed_average_salary_days)}`}
                />
                <MathRow
                  label={t('averageBalance')}
                  emphasize
                  value={formatPeriodLabel(result.average_salary_leave, locale)}
                />
              </div>

              <div className="rounded-lg border p-4">
                <div className="mb-2 text-sm font-semibold">
                  {payCategoryLabel(t, 'half_average_salary')}
                </div>
                <MathRow
                  label={t('halfEarning')}
                  value={formatDaysLabel(t, locale, result.half_average_leave_earned_days)}
                />
                <MathRow
                  label={t('halfDeduction')}
                  value={`− ${formatDaysLabel(t, locale, result.enjoyed_half_average_days)}`}
                />
                <MathRow
                  label={t('halfBalance')}
                  emphasize
                  value={formatPeriodLabel(result.half_average_leave, locale)}
                />
              </div>

              {(result.enjoyed_without_pay_days > 0 || result.enjoyed_regular_working_days > 0) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {result.enjoyed_without_pay_days > 0 ? (
                    <div className="rounded-lg border p-4">
                      <div className="mb-2 text-sm font-semibold">
                        {payCategoryLabel(t, 'without_pay')}
                      </div>
                      <MathRow label={t('averageEarning')} value="—" />
                      <MathRow
                        label={t('averageDeduction')}
                        value={formatDaysLabel(t, locale, result.enjoyed_without_pay_days)}
                      />
                      <MathRow
                        label={t('averageBalance')}
                        emphasize
                        value={formatPeriodLabel(result.without_pay_leave, locale)}
                      />
                    </div>
                  ) : null}
                  {result.enjoyed_regular_working_days > 0 ? (
                    <div className="rounded-lg border p-4">
                      <div className="mb-2 text-sm font-semibold">
                        {payCategoryLabel(t, 'regular_working_period')}
                      </div>
                      <MathRow label={t('averageEarning')} value="—" />
                      <MathRow
                        label={t('averageDeduction')}
                        value={formatDaysLabel(t, locale, result.enjoyed_regular_working_days)}
                      />
                      <MathRow
                        label={t('averageBalance')}
                        emphasize
                        value={formatPeriodLabel(result.regular_working_period, locale)}
                      />
                    </div>
                  ) : null}
                </div>
              )}

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="mb-2 text-sm font-semibold">{t('totalLeaveBalance')}</div>
                <MathRow
                  label={t('averageBalance')}
                  value={formatPeriodLabel(result.average_salary_leave, locale)}
                />
                <MathRow
                  label={t('halfToAverage')}
                  value={formatDaysLabel(t, locale, roundHalfUp(result.half_average_leave.total_days / 2))}
                />
                <MathRow
                  label={t('totalLeaveBalance')}
                  emphasize
                  value={`${formatPeriodLabel(result.total_average_salary_leave, locale)} · ${result.average_salary_leave_months.toFixed(2)}`}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('lampGrant')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-bold text-primary">
                ৳ {result.lamp_grant.toLocaleString('en-BD', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-sm text-muted">
                {t('stageLampRule2', { months: result.lamp_grant_months_used.toFixed(2) })}
              </p>
              <p className="text-xs text-muted">
                {t('lampFormula', {
                  basic: formatMoney(Number(lastBasic) || 0),
                  months: result.lamp_grant_months_used.toFixed(2),
                  total: formatMoney(result.lamp_grant),
                })}
              </p>
              <div className="mt-3 space-y-1 border-t border-border/60 pt-3 text-xs">
                <p className="font-medium text-foreground">{t('enjoyedByGroupTitle')}</p>
                <div className="flex justify-between">
                  <span className="text-muted">{payCategoryLabel(t, 'average_salary')}</span>
                  <span>
                    {result.enjoyed_average_salary_days} {tc('days')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{payCategoryLabel(t, 'half_average_salary')}</span>
                  <span>
                    {result.enjoyed_half_average_days} {tc('days')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{payCategoryLabel(t, 'without_pay')}</span>
                  <span>
                    {result.enjoyed_without_pay_days} {tc('days')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{payCategoryLabel(t, 'regular_working_period')}</span>
                  <span>
                    {result.enjoyed_regular_working_days} {tc('days')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('gratuityTitle')}</CardTitle>
              <p className="mt-1 text-sm text-muted">{t('gratuityDescription')}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {!prlResult ? (
                <Alert variant="warning">{t('prlNoInput')}</Alert>
              ) : (
                <>
                  <div className="grid gap-x-6 sm:grid-cols-2">
                    <MathRow label={t('finalRetirementDate')} value={prlResult.final_retirement_date} />
                    <MathRow label={t('finalRetirementBasic')} value={formatMoney(prlResult.pension_basic_salary)} />
                    <MathRow label={t('postRetirementLeaveMonths')} value={String(prlResult.prl_salary_months)} />
                  </div>

                  <Alert variant={prlResult.july_first_falls_within_prl ? 'warning' : 'success'}>
                    {prlResult.july_first_falls_within_prl
                      ? t('prlJulyFirstYes', { date: prlResult.july_first_date ?? '' })
                      : t('prlJulyFirstNo')}
                  </Alert>

                  {!prlResult.is_fixed_split ? (
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      {!editingSplit ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm text-muted">
                            {appliedLumpSumMonths === undefined
                              ? t('prlSplitSuggested', {
                                  prlMonths: prlResult.prl_salary_months,
                                  lumpMonths: prlResult.lump_sum_months,
                                })
                              : t('prlSplitCustom', {
                                  prlMonths: prlResult.prl_salary_months,
                                  lumpMonths: prlResult.lump_sum_months,
                                })}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setChosenLumpSumMonths(String(prlResult.lump_sum_months));
                              setEditingSplit(true);
                            }}
                          >
                            {t('prlChangeSplitBtn')}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="prl-chosen-lump">{t('prlChosenLumpSumLabel')}</Label>
                          <Input
                            id="prl-chosen-lump"
                            type="number"
                            min={0}
                            value={chosenLumpSumMonths}
                            onChange={(e) => setChosenLumpSumMonths(e.target.value)}
                          />
                          <p className="text-xs text-muted">{t('prlChosenLumpSumHint')}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setAppliedLumpSumMonths(Number(chosenLumpSumMonths) || 0);
                                setEditingSplit(false);
                              }}
                            >
                              {t('prlApplySplitBtn')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingSplit(false);
                                setChosenLumpSumMonths('');
                              }}
                            >
                              {t('prlCancelBtn')}
                            </Button>
                            {appliedLumpSumMonths !== undefined ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setAppliedLumpSumMonths(undefined);
                                  setChosenLumpSumMonths('');
                                  setEditingSplit(false);
                                }}
                              >
                                {t('prlResetSplitBtn')}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">{t('prlFixedSplitNote')}</p>
                  )}

                  <StatTile label={t('prlLumpSumGrant')} value={formatMoney(prlResult.lump_sum_grant_amount)} />
                </>
              )}

              {!gratuityResult?.eligible ? (
                <Alert variant="error">
                  {t('gratuityNotEligible', { years: qualifyingService?.qualifying_service_years ?? 0 })}
                </Alert>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <StatTile label={t('gratuityLumpSum')} value={formatMoney(gratuityResult.gratuity_amount)} />
                    <StatTile label={t('gratuityMonthlyNet')} value={formatMoney(gratuityResult.monthly_net_pension)} />
                  </div>
                  <p className="text-xs text-muted">
                    {t('monthlyPensionFormula', {
                      basic: formatMoney(pensionRateBasic),
                      rate: gratuityResult.pension_rate_percent ?? 0,
                      half: formatMoney(gratuityResult.half_pension_amount),
                      medical: formatMoney(gratuityResult.medical_allowance),
                      total: formatMoney(gratuityResult.monthly_net_pension),
                    })}
                  </p>
                  <div className="grid gap-x-6 sm:grid-cols-2">
                    <MathRow label={t('gratuityQualifyingYears')} value={String(gratuityResult.qualifying_years)} />
                    <MathRow label={t('gratuityRate')} value={`${gratuityResult.pension_rate_percent}%`} />
                    <MathRow label={t('gratuityHalfPension')} value={formatMoney(gratuityResult.half_pension_amount)} />
                    <MathRow label={t('gratuityMultiplier')} value={String(gratuityResult.gratuity_multiplier)} />
                    <MathRow label={t('gratuityMedical')} value={formatMoney(gratuityResult.medical_allowance)} />
                    <MathRow
                      label={t('gratuityFestival', { count: gratuityResult.festival_allowances_per_year })}
                      value={formatMoney(gratuityResult.festival_allowance_per_occasion)}
                    />
                    <MathRow label={t('gratuityBaishakhi')} value={formatMoney(gratuityResult.baishakhi_allowance)} />
                    <MathRow
                      label={t('gratuityLeaveEncashmentCap', { months: PENSION_LAMP_GRANT_MONTHS })}
                      value={formatMoney(gratuityResult.leave_encashment_cap)}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
