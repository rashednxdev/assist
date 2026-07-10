'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, Plus, Trash2, ChevronDown } from 'lucide-react';
import {
  breakdownFromDays,
  daysBetweenInclusive,
  formatPeriodLabel,
  isMaternityLeaveCode,
  maternityDaysFromStartDate,
  previewRestLeaveDeduction,
  roundHalfUp,
  type PensionCalculateResult,
  type PensionEnjoyedLeaveInput,
  type PensionLeaveTypeCalc,
} from '@ibas/shared-types';
import {
  PENSION_MATERNITY_DAYS_BEFORE_RULE,
  PENSION_MATERNITY_DAYS_FROM_RULE,
  PENSION_MATERNITY_RULE_CHANGE_DATE,
  type PensionLeavePayCategory,
} from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { DEDUCTION_RULE_LABELS, PAY_CATEGORY_LABELS } from '@/lib/pension-labels';
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
}

function leaveTypeCode(leaveTypes: LeaveTypeRow[], leaveTypeId: string): string | undefined {
  return leaveTypes.find((t) => t.id === leaveTypeId)?.code;
}

function resolveEnjoyedDays(row: EnjoyedRow, leaveTypes: LeaveTypeRow[]): number {
  const code = leaveTypeCode(leaveTypes, row.leave_type_id);
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
  };
}

const SUMMARY_CATEGORIES: PensionLeavePayCategory[] = [
  'average_salary',
  'half_average_salary',
  'without_pay',
  'regular_working_period',
];

function PeriodCard({ title, period }: { title: string; period: { years: number; months: number; days: number } }) {
  return (
    <div className="rounded-lg border border-border bg-slate-50/80 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <div className="mt-1 text-lg font-semibold">{formatPeriodLabel(period)}</div>
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

function formatDaysLabel(days: number): string {
  const rounded = roundHalfUp(days);
  return `${rounded} days (${formatPeriodLabel(breakdownFromDays(rounded))})`;
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
}): AppliedRuleStage[] {
  const { joinDate, endDate, lastBasic, enjoyed, leaveTypes, result, restDays, restAutoApplied, restCycles } = args;
  const stages: AppliedRuleStage[] = [];

  if (joinDate && endDate) {
    const serviceDays = result?.service_period.total_days ?? daysBetweenInclusive(joinDate, endDate);
    stages.push({
      title: '1. Service period',
      rules: [
        `Join date is included; service days = inclusive days from join to end (${serviceDays} days).`,
        '1 year = 360 days; 1 month = 30 days.',
      ],
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
    inputRules.push(`Days input used for ${dayRows.length} enjoyed-leave row(s).`);
  }
  if (dateRangeRows.length > 0) {
    inputRules.push(
      `From–to dates used for ${dateRangeRows.length} row(s); days = inclusive calendar days.`,
    );
  }
  for (const row of maternityRows) {
    const days = maternityDaysFromStartDate(row.from_date);
    inputRules.push(
      `Maternity start ${row.from_date}: ${
        row.from_date < PENSION_MATERNITY_RULE_CHANGE_DATE
          ? `before ${PENSION_MATERNITY_RULE_CHANGE_DATE} → ${PENSION_MATERNITY_DAYS_BEFORE_RULE} days`
          : `on/after ${PENSION_MATERNITY_RULE_CHANGE_DATE} → ${PENSION_MATERNITY_DAYS_FROM_RULE} days`
      } (applied ${days} days).`,
    );
  }
  if (restDays > 0) {
    inputRules.push(
      restAutoApplied
        ? `REST (R&R) auto-applied: ${restCycles} complete 3-year cycle(s) × 15 days = ${restDays} days on average-salary account.`
        : `REST (R&R) taken from enjoyed-leave list: ${restDays} days (manual override of auto entitlement).`,
    );
  } else if (joinDate && endDate) {
    inputRules.push('REST (R&R): no complete 3-year cycle yet — 0 days auto-applied.');
  }
  if (inputRules.length > 0) {
    stages.push({ title: '2. Enjoyed leave input rules', rules: inputRules });
  }

  const usedTypes = new Map<string, { name: string; days: number; deduction: string; category: string }>();
  for (const row of enjoyed) {
    const days = resolveEnjoyedDays(row, leaveTypes);
    if (!row.leave_type_id || days <= 0) continue;
    const type = leaveTypes.find((t) => t.id === row.leave_type_id);
    if (!type) continue;
    const existing = usedTypes.get(type.id);
    if (existing) {
      existing.days += days;
    } else {
      usedTypes.set(type.id, {
        name: type.name_en,
        days,
        deduction: DEDUCTION_RULE_LABELS[type.deduction_rule],
        category: PAY_CATEGORY_LABELS[type.pay_category],
      });
    }
  }
  if (restAutoApplied && restDays > 0) {
    const restType = leaveTypes.find((t) => t.code === 'REST');
    if (restType && !usedTypes.has(restType.id)) {
      usedTypes.set(restType.id, {
        name: restType.name_en,
        days: restDays,
        deduction: DEDUCTION_RULE_LABELS[restType.deduction_rule],
        category: PAY_CATEGORY_LABELS[restType.pay_category],
      });
    }
  }

  if (usedTypes.size > 0) {
    stages.push({
      title: '3. Service deduction rules (applied leave types)',
      rules: [...usedTypes.values()].map(
        (t) => `${t.name}: ${t.days} days · ${t.category} · ${t.deduction}.`,
      ),
    });
  }

  if (result) {
    stages.push({
      title: '4. Leave earning & account balances',
      rules: [
        `Leave-earning period after deductions: ${result.leave_earning_period.total_days} days.`,
        `Average-salary earning = leave-earning ÷ 11 → ${result.average_salary_leave_earned_days} days (round .5+ up).`,
        `Half-average earning = leave-earning ÷ 12 → ${result.half_average_leave_earned_days} days (round .5+ up).`,
        `Average balance = earning − enjoyed (${result.enjoyed_average_salary_days} days) → ${formatPeriodLabel(result.average_salary_leave)}.`,
        `Half-average balance = earning − enjoyed (${result.enjoyed_half_average_days} days) → ${formatPeriodLabel(result.half_average_leave)}.`,
        `Half-average → average pay = half balance ÷ 2 (round .5+ up).`,
        `Total leave balance = average balance + converted half-average → ${formatPeriodLabel(result.total_average_salary_leave)} (${result.average_salary_leave_months.toFixed(2)} months).`,
      ],
    });

    if (lastBasic) {
      stages.push({
        title: '5. Lamp grant',
        rules: result.lamp_grant_uses_bonus_salary
          ? [
              `Total average leave ≥ 18 months (${result.average_salary_leave_months.toFixed(2)} months).`,
              `Lamp grant = (last basic + 5%) × 18 months.`,
            ]
          : [
              `Total average leave < 18 months (${result.average_salary_leave_months.toFixed(2)} months).`,
              `Lamp grant = last basic × ${result.lamp_grant_months_used.toFixed(2)} months (no 5% increase).`,
            ],
      });
    }
  } else if (joinDate && endDate) {
    stages.push({
      title: '4. Leave earning (pending calculate)',
      rules: [
        'Average-salary leave earned = leave-earning period ÷ 11 (round .5+ up).',
        'Half-average leave earned = leave-earning period ÷ 12 (round .5+ up).',
        'Balance = earning − enjoyed days for each account.',
        'Total leave = average balance + (half-average balance ÷ 2, round .5+ up).',
      ],
    });
    if (lastBasic) {
      stages.push({
        title: '5. Lamp grant (pending calculate)',
        rules: [
          'If total average leave ≥ 18 months: (last basic + 5%) × 18.',
          'If less than 18 months: last basic × remaining months (no 5%).',
        ],
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
    leaveTypes.filter((t) => t.pay_category === category && t.id !== excludeTypeId).map((t) => t.id),
  );
  return rows
    .filter((r) => typeIds.has(r.leave_type_id))
    .reduce((sum, row) => sum + resolveEnjoyedDays(row, leaveTypes), 0);
}

export default function PensionCalculatorPage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [joinDate, setJoinDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastBasic, setLastBasic] = useState('');
  const [enjoyed, setEnjoyed] = useState<EnjoyedRow[]>([]);
  const [result, setResult] = useState<PensionCalculateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    apiFetch<{ data: LeaveTypeRow[] }>('/pension/leave-types')
      .then((res) => setLeaveTypes(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load leave types'))
      .finally(() => setLoading(false));
    fetchMe()
      .then((res) => {
        setIsAdmin(
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin',
        );
      })
      .catch(() => {});
  }, []);

  const restType = leaveTypes.find((t) => t.code === 'REST');
  const enjoyedForPreview: PensionEnjoyedLeaveInput[] = enjoyed
    .map((r) => ({ leave_type_id: r.leave_type_id, days: resolveEnjoyedDays(r, leaveTypes) }))
    .filter((r) => r.leave_type_id && r.days > 0);
  const calcLeaveTypes: PensionLeaveTypeCalc[] = leaveTypes.map((t) => ({
    id: t.id,
    code: t.code,
    name_en: t.name_en,
    pay_category: t.pay_category,
    deduction_rule: t.deduction_rule,
    is_auto_entitlement: t.is_auto_entitlement,
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
    const averageOther = sumEnjoyedByCategory(enjoyed, leaveTypes, 'average_salary', restType?.id);
    summaryByCategory.average_salary = averageOther + restDays;
    summaryByCategory.half_average_salary = sumEnjoyedByCategory(enjoyed, leaveTypes, 'half_average_salary');
    summaryByCategory.without_pay = sumEnjoyedByCategory(enjoyed, leaveTypes, 'without_pay');
    summaryByCategory.regular_working_period = sumEnjoyedByCategory(enjoyed, leaveTypes, 'regular_working_period');
  }

  function addEnjoyedRow() {
    setEnjoyed((rows) => [...rows, emptyEnjoyedRow(leaveTypes[0]?.id ?? '', leaveTypes)]);
  }

  function updateEnjoyedRow(idx: number, patch: Partial<EnjoyedRow>) {
    setEnjoyed((rows) =>
      rows.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, ...patch };
        const code = leaveTypeCode(leaveTypes, next.leave_type_id);

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
      setError(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setCalculating(false);
    }
  }

  const appliedRuleStages = buildAppliedRules({
    joinDate,
    endDate,
    lastBasic,
    enjoyed,
    leaveTypes,
    result,
    restDays,
    restAutoApplied,
    restCycles,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pension leave account & lamp grant"
        description="Calculate government pension leave balances and lamp grant from service and enjoyed leave."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/joining-period">Joining period</Link>
            </Button>
            {isAdmin ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/setup/pension-leaves">
                  <Settings className="h-4 w-4" />
                  Leave type setup
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-muted">
          <p>
            While calculating pension, government employees must work out <strong className="text-foreground">two things</strong>:
          </p>
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-foreground">1. Leave account</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Complete service period and leave earned during service.</li>
                <li>
                  Leave is of four account types: <em>on average salary</em>, <em>on half-average salary</em>,
                  <em> without pay</em>, and <em>regular working period</em>, with sub-types under each.
                </li>
                <li>
                  Add all enjoyed leave in one list. For each row choose <strong>days</strong> or{' '}
                  <strong>from–to dates</strong> (days are calculated automatically from the date range). The
                  summary groups totals by leave account type.
                </li>
                <li>
                  <strong>Maternity leave</strong>: enter start date only. Before 18 May 2021 → 120 days; on/after
                  18 May 2021 → 180 days.
                </li>
                <li>
                  <strong>REST leave</strong> is auto-deducted on the average-salary account (15 days every 3 years)
                  unless you add a REST row to override.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">2. Lamp grant</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  If total average-salary leave is <strong>18 months or more</strong>: last basic salary + 5% × 18
                  months.
                </li>
                <li>
                  If less than 18 months: last basic salary × remaining months (no 5% increase).
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rules applied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          {appliedRuleStages.length === 0 ? (
            <p className="text-muted">
              Enter service dates and enjoyed leave to see which calculation rules apply at each stage.
            </p>
          ) : (
            appliedRuleStages.map((stage) => (
              <div key={stage.title}>
                <p className="font-semibold text-foreground">{stage.title}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                  {stage.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Service & salary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="join_date">Date of joining service</Label>
            <Input id="join_date" type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">Retirement / calculation end date</Label>
            <Input id="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_basic">Last basic salary (৳)</Label>
            <Input
              id="last_basic"
              type="number"
              min={1}
              value={lastBasic}
              onChange={(e) => setLastBasic(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Enjoyed leave</CardTitle>
            <p className="mt-1 text-sm text-muted">
              One list for all leave types. Enter days directly, or choose dates and days are calculated
              automatically. Summary below groups by leave account type.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" disabled={!leaveTypes.length} onClick={addEnjoyedRow}>
            <Plus className="h-4 w-4" />
            Add row
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted">Loading leave types…</p>
          ) : leaveTypes.length === 0 ? (
            <p className="text-sm text-muted">No leave types configured. Contact an administrator.</p>
          ) : enjoyed.length === 0 ? (
            <p className="text-sm text-muted">
              Add rows for leave enjoyed during service. For each row you can enter days or a from–to date range.
              REST is auto-deducted on the average-salary account if not listed.
            </p>
          ) : (
            enjoyed.map((row, idx) => {
              const selectedType = leaveTypes.find((t) => t.id === row.leave_type_id);
              const isMaternity = isMaternityLeaveCode(selectedType?.code);
              const resolvedDays = resolveEnjoyedDays(row, leaveTypes);
              return (
                <div key={row.key} className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[220px] flex-1 space-y-1">
                      <Label>Leave type</Label>
                      <select
                        className="ibas-select"
                        value={row.leave_type_id}
                        onChange={(e) => updateEnjoyedRow(idx, { leave_type_id: e.target.value })}
                      >
                        {SUMMARY_CATEGORIES.map((category) => {
                          const types = leaveTypes.filter((t) => t.pay_category === category);
                          if (types.length === 0) return null;
                          return (
                            <optgroup key={category} label={PAY_CATEGORY_LABELS[category]}>
                              {types.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name_en}
                                  {t.code === 'REST' ? ' (auto if not listed)' : ''}
                                  {t.code === 'MATERNITY' ? ' (start date only)' : ''}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                    </div>
                    {!isMaternity ? (
                      <div className="w-36 space-y-1">
                        <Label>Input</Label>
                        <select
                          className="ibas-select"
                          value={row.input_mode === 'maternity_start' ? 'days' : row.input_mode}
                          onChange={(e) =>
                            updateEnjoyedRow(idx, {
                              input_mode: e.target.value as EnjoyedInputMode,
                            })
                          }
                        >
                          <option value="days">Days</option>
                          <option value="dates">From–to dates</option>
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
                        <Label>Start date</Label>
                        <Input
                          type="date"
                          value={row.from_date}
                          onChange={(e) => updateEnjoyedRow(idx, { from_date: e.target.value })}
                        />
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span className="text-muted">Days: </span>
                        <span className="font-semibold">
                          {resolvedDays > 0 ? resolvedDays : '—'}
                        </span>
                        {row.from_date ? (
                          <span className="ml-2 text-xs text-muted">
                            {row.from_date < PENSION_MATERNITY_RULE_CHANGE_DATE
                              ? `before ${PENSION_MATERNITY_RULE_CHANGE_DATE} → ${PENSION_MATERNITY_DAYS_BEFORE_RULE} days`
                              : `on/after ${PENSION_MATERNITY_RULE_CHANGE_DATE} → ${PENSION_MATERNITY_DAYS_FROM_RULE} days`}
                          </span>
                        ) : (
                          <span className="ml-2 text-xs text-muted">
                            Before 18 May 2021: {PENSION_MATERNITY_DAYS_BEFORE_RULE} days; otherwise{' '}
                            {PENSION_MATERNITY_DAYS_FROM_RULE} days
                          </span>
                        )}
                      </div>
                    </div>
                  ) : row.input_mode === 'days' ? (
                    <div className="w-36 space-y-1">
                      <Label>Days</Label>
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
                        <Label>From date</Label>
                        <Input
                          type="date"
                          value={row.from_date}
                          onChange={(e) => updateEnjoyedRow(idx, { from_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>To date</Label>
                        <Input
                          type="date"
                          value={row.to_date}
                          min={row.from_date || undefined}
                          onChange={(e) => updateEnjoyedRow(idx, { to_date: e.target.value })}
                        />
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span className="text-muted">Days: </span>
                        <span className="font-semibold">
                          {resolvedDays > 0 ? resolvedDays : '—'}
                        </span>
                        {row.from_date && row.to_date && resolvedDays <= 0 ? (
                          <span className="ml-2 text-xs text-destructive">Invalid date range</span>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-muted">Rows in list: </span>
            <span className="font-semibold">{enjoyed.length}</span>
            <span className="mx-2 text-muted">·</span>
            <span className="text-muted">Days entered: </span>
            <span className="font-semibold">{sumEnjoyedDays(enjoyed, leaveTypes)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enjoyed leave summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
            {SUMMARY_CATEGORIES.map((category) => {
              const typesInCategory = leaveTypes.filter((t) => t.pay_category === category);
              if (typesInCategory.length === 0 && category !== 'average_salary') return null;

              const total = summaryByCategory[category];
              const isAverage = category === 'average_salary';

              return (
                <div key={category} className="rounded-lg border px-3 py-2">
                  <div className="flex justify-between">
                    <span>{PAY_CATEGORY_LABELS[category]}</span>
                    <span className="font-semibold">{total} days</span>
                  </div>
                  {isAverage && restDays === 0 && joinDate && endDate ? (
                    <p className="mt-1 text-xs text-muted">REST (R&amp;R): no complete 3-year cycle yet</p>
                  ) : null}
                  {isAverage && restAutoApplied && restCycles > 0 ? (
                    <p className="mt-1 text-xs text-muted">
                      REST auto: {restCycles} cycle{restCycles === 1 ? '' : 's'} × 15 days
                    </p>
                  ) : null}
                  {total > 0 || (isAverage && restDays > 0) ? (
                    <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-xs">
                      {isAverage && restDays > 0 ? (
                        <div className="flex justify-between">
                          <span className="text-muted">
                            REST (R&amp;R) leave
                            {restAutoApplied ? ' (auto)' : ''}
                          </span>
                          <span className="font-medium">{restDays} days</span>
                        </div>
                      ) : null}
                      {typesInCategory.map((type) => {
                        if (type.id === restType?.id && restAutoApplied) return null;
                        const days = enjoyed
                          .filter((r) => r.leave_type_id === type.id)
                          .reduce((s, r) => s + resolveEnjoyedDays(r, leaveTypes), 0);
                        if (days <= 0) return null;
                        return (
                          <div key={type.id} className="flex justify-between">
                            <span className="text-muted">{type.name_en}</span>
                            <span className="font-medium">{days} days</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 font-medium">
              <span>Days entered in list</span>
              <span>{sumEnjoyedDays(enjoyed, leaveTypes)} days</span>
            </div>
        </CardContent>
      </Card>

      <details className="group rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-6 py-4 [&::-webkit-details-marker]:hidden">
          <span className="text-lg font-semibold">Leave type reference</span>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-border px-6 pb-6 pt-4 sm:grid-cols-2">
          {leaveTypes.map((t) => (
            <div key={t.id} className="rounded-lg border p-3 text-sm">
              <div className="font-medium">{t.name_en}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge variant="outline">{PAY_CATEGORY_LABELS[t.pay_category]}</Badge>
                {t.is_auto_entitlement ? <Badge variant="secondary">Auto-deducted from service</Badge> : null}
              </div>
              <p className="mt-2 text-xs text-muted">{DEDUCTION_RULE_LABELS[t.deduction_rule]}</p>
            </div>
          ))}
        </div>
      </details>

      <Button
        size="lg"
        disabled={calculating || !joinDate || !endDate || !lastBasic}
        onClick={() => void calculate()}
      >
        {calculating ? 'Calculating…' : 'Calculate leave account & lamp grant'}
      </Button>

      {result ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service periods</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <PeriodCard title="Total service" period={result.service_period} />
              <PeriodCard title="Working period" period={result.working_period} />
              <PeriodCard title="Leave-earning period" period={result.leave_earning_period} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leave account balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="mb-2 text-sm font-semibold">On average salary</div>
                <MathRow
                  label="Earning"
                  note="leave-earning period ÷ 11"
                  value={formatDaysLabel(result.average_salary_leave_earned_days)}
                />
                <MathRow
                  label="Less: deduction (enjoyed)"
                  note={
                    result.rest_leave
                      ? result.rest_leave.auto_applied
                        ? `includes REST auto ${result.rest_leave.enjoyed_days} days`
                        : `includes REST ${result.rest_leave.enjoyed_days} days`
                      : undefined
                  }
                  value={`− ${formatDaysLabel(result.enjoyed_average_salary_days)}`}
                />
                <MathRow
                  label="Balance"
                  emphasize
                  value={formatPeriodLabel(result.average_salary_leave)}
                />
              </div>

              <div className="rounded-lg border p-4">
                <div className="mb-2 text-sm font-semibold">On half-average salary</div>
                <MathRow
                  label="Earning"
                  note="leave-earning period ÷ 12"
                  value={formatDaysLabel(result.half_average_leave_earned_days)}
                />
                <MathRow
                  label="Less: deduction (enjoyed)"
                  value={`− ${formatDaysLabel(result.enjoyed_half_average_days)}`}
                />
                <MathRow
                  label="Balance"
                  emphasize
                  value={formatPeriodLabel(result.half_average_leave)}
                />
              </div>

              {(result.enjoyed_without_pay_days > 0 || result.enjoyed_regular_working_days > 0) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {result.enjoyed_without_pay_days > 0 ? (
                    <div className="rounded-lg border p-4">
                      <div className="mb-2 text-sm font-semibold">Without pay</div>
                      <MathRow label="Earning" value="—" note="not earned on this account" />
                      <MathRow
                        label="Deduction (enjoyed)"
                        value={formatDaysLabel(result.enjoyed_without_pay_days)}
                      />
                      <MathRow
                        label="Recorded"
                        emphasize
                        value={formatPeriodLabel(result.without_pay_leave)}
                      />
                    </div>
                  ) : null}
                  {result.enjoyed_regular_working_days > 0 ? (
                    <div className="rounded-lg border p-4">
                      <div className="mb-2 text-sm font-semibold">Regular working period</div>
                      <MathRow label="Earning" value="—" note="not earned on this account" />
                      <MathRow
                        label="Deduction (enjoyed)"
                        value={formatDaysLabel(result.enjoyed_regular_working_days)}
                      />
                      <MathRow
                        label="Recorded"
                        emphasize
                        value={formatPeriodLabel(result.regular_working_period)}
                      />
                    </div>
                  ) : null}
                </div>
              )}

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="mb-2 text-sm font-semibold">Total leave balance (as average pay)</div>
                <MathRow
                  label="Average pay balance"
                  value={formatPeriodLabel(result.average_salary_leave)}
                />
                <MathRow
                  label="Half-average pay → average pay"
                  note="half-average balance ÷ 2 (round .5+ up)"
                  value={formatDaysLabel(roundHalfUp(result.half_average_leave.total_days / 2))}
                />
                <MathRow
                  label="Total balances of leave"
                  emphasize
                  value={`${formatPeriodLabel(result.total_average_salary_leave)} · ${result.average_salary_leave_months.toFixed(2)} months`}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lamp grant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-bold text-primary">
                ৳ {result.lamp_grant.toLocaleString('en-BD', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-sm text-muted">
                {result.lamp_grant_uses_bonus_salary
                  ? `Last basic + 5% × 18 months (${result.lamp_grant_months_used} months used).`
                  : `Last basic × ${result.lamp_grant_months_used.toFixed(2)} months (under 18-month threshold).`}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
