'use client';

import { useMemo, useState } from 'react';
import {
  arrearMonthOptions,
  calculateSalaryArrears,
  defaultArrearMonths,
  formatTaka,
  type HousingStatus,
  type HraArea,
  type PayGrade,
  type SubstantiveGrade,
} from '@ibas/shared-types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import {
  hraAreaText,
  localNum,
  localTaka,
  monthText,
  salaryCopy,
  type SalaryLocale,
} from '@/lib/salary-i18n';

const STAGE_NUMBER = { '2026-07-01': 1, '2027-01-01': 2, '2027-07-01': 3 } as const;

export function SalaryArrearsCard({
  locale,
  grade,
  oldPay,
  substantiveGrade,
  housingStatus,
  hraArea,
}: {
  locale: SalaryLocale;
  grade: PayGrade;
  oldPay: number;
  substantiveGrade: SubstantiveGrade | null;
  housingStatus: HousingStatus;
  hraArea: HraArea;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const tk = (n: number) => localTaka(locale, n);
  const amt = (n: number) => num(formatTaka(n));
  const signed = (n: number) => (n < 0 ? `− ${amt(-n)}` : amt(n));

  const monthOptions = useMemo(() => arrearMonthOptions(), []);
  const [selected, setSelected] = useState<string[]>(() => defaultArrearMonths());

  const { result, error } = useMemo(() => {
    if (selected.length === 0) return { result: null, error: 'select' as const };
    try {
      return {
        result: calculateSalaryArrears({
          grade,
          old_pay: oldPay,
          substantive_grade: substantiveGrade,
          housing_status: housingStatus,
          hra_area: hraArea,
          months: selected,
        }),
        error: '',
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Could not calculate arrears' };
    }
  }, [grade, oldPay, substantiveGrade, housingStatus, hraArea, selected]);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].sort()));
  }

  return (
    <Card className="salary-print-avoid-break overflow-hidden border border-indigo-200 shadow-sm">
      <div className="bg-indigo-700 px-4 py-2.5 text-white sm:px-5">
        <div className="text-sm font-bold">{t.arrTitle}</div>
        <p className="mt-0.5 text-xs text-indigo-100/90">{t.arrSub}</p>
      </div>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="space-y-2 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-800">{t.arrMonths}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelected(defaultArrearMonths())}>
                {t.arrPast}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSelected(monthOptions)}>
                {t.arrAll}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSelected([])}>
                {t.arrClear}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {monthOptions.map((key) => {
              const on = selected.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    on
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-border bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}
                >
                  {monthText(locale, key)}
                </button>
              );
            })}
          </div>
        </div>

        {error ? <Alert variant="error">{error === 'select' ? t.arrSelectMonth : error}</Alert> : null}

        {result ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-slate-50/80 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.arrSpecialHead}</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-900">{tk(result.special_allowance)}</p>
                <p className="mt-1 text-xs text-muted">
                  {t.arrSpecialCalc(
                    amt(result.next_step),
                    num(result.special_rate_percent),
                    num(result.substantive_grade),
                    result.substantive_grade >= 10 ? t.arrBandHigh : t.arrBandLow,
                  )}
                </p>
                <p className="text-xs text-muted">
                  {result.next_step_is_last ? t.arrSpecialLast(tk(result.old_pay)) : t.arrSpecialNext(tk(result.old_pay))}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-slate-50/80 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.arrHraHead}</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-900">{tk(result.excess_hra)}</p>
                {result.hra_eligible ? (
                  <>
                    <p className="mt-1 text-xs text-muted">
                      {t.arrHraCalc(
                        amt(result.hra_on_next_step),
                        amt(result.next_step),
                        num(result.hra_rate_percent_next_step),
                        amt(result.hra_on_old_pay),
                        amt(result.old_pay),
                        num(result.hra_rate_percent_old_pay),
                      )}
                    </p>
                    <p className="text-xs text-muted">{hraAreaText(locale, hraArea)}</p>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-muted">{t.arrHraNone}</p>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{t.arrColMonth}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t.arrColNewBasic}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t.arrColOldBasic}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t.arrColDiff}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t.arrColSpecial}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t.arrColHra}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t.arrColNet}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.month} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{monthText(locale, row.month)}</div>
                        <div className="text-xs text-muted">{t.stageName(STAGE_NUMBER[row.phase])}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{amt(row.new_basic)}</td>
                      <td className="px-3 py-2 text-right font-mono">{amt(result.old_pay)}</td>
                      <td className="px-3 py-2 text-right font-mono">{signed(row.basic_difference)}</td>
                      <td className="px-3 py-2 text-right font-mono text-rose-700">− {amt(row.special_allowance)}</td>
                      <td className="px-3 py-2 text-right font-mono text-rose-700">− {amt(row.excess_hra)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{signed(row.net_arrear)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-indigo-200 bg-indigo-50">
                    <td className="px-3 py-2.5 font-bold text-indigo-950" colSpan={3}>
                      {t.arrTotalRow(num(result.rows.length), result.rows.length === 1)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {signed(result.total_basic_difference)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-rose-700">
                      − {amt(result.total_special_allowance)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-rose-700">
                      − {amt(result.total_excess_hra)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-lg font-bold text-indigo-900">
                      {signed(result.total_net_arrear)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-indigo-300 bg-indigo-100/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900">{t.arrTotalDue}</p>
              <p className="mt-0.5 font-mono text-2xl font-bold text-indigo-950">৳ {signed(result.total_net_arrear)}</p>
              <p className="text-[11px] text-indigo-900/80">
                {t.arrTotalFormula(`৳ ${signed(result.total_basic_difference)}`, tk(result.total_deduction))}
                {result.total_net_arrear < 0 ? t.arrNegative : ''}
              </p>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
