'use client';

import { useMemo } from 'react';
import { Download, Printer } from 'lucide-react';
import {
  arrearMonthOptions,
  calculateSalaryArrears,
  defaultArrearMonths,
  formatTaka,
  type HousingStatus,
  type HraArea,
  type PayGrade,
  type SalaryArrearMonthRow,
  type SalaryArrearResult,
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
  type SalaryCopy,
  type SalaryLocale,
} from '@/lib/salary-i18n';
import { takaInWords } from '@/lib/amount-words';

const STAGE_NUMBER = { '2026-07-01': 1, '2027-01-01': 2, '2027-07-01': 3 } as const;

export interface Fmt {
  t: SalaryCopy;
  locale: SalaryLocale;
  num: (v: string | number) => string;
  amt: (n: number) => string;
  signed: (n: number) => string;
}

function BasisRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border px-3 py-1.5 first:border-t-0">
      <span className="text-slate-700">{label}</span>
      <span className="text-right font-mono font-semibold text-slate-900">{value}</span>
    </div>
  );
}

export interface MonthGroup {
  lead: SalaryArrearMonthRow;
  same: SalaryArrearMonthRow[];
}

function sameMath(a: SalaryArrearMonthRow, b: SalaryArrearMonthRow): boolean {
  return (
    a.new_basic === b.new_basic &&
    a.drawn_basic === b.drawn_basic &&
    a.special_allowance === b.special_allowance &&
    a.excess_hra === b.excess_hra
  );
}

export function groupMonths(rows: SalaryArrearMonthRow[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && sameMath(last.lead, row)) last.same.push(row);
    else groups.push({ lead: row, same: [] });
  }
  return groups;
}

export function MonthMath({ f, result, group }: { f: Fmt; result: SalaryArrearResult; group: MonthGroup }) {
  const { t, locale, num, amt, signed } = f;
  const row = group.lead;
  const leadMonth = monthText(locale, row.month);
  const specialCalc = `${amt(result.next_step)} × ${num(result.special_rate_percent)}%`;
  const hraCalc = result.hra_eligible
    ? `${amt(result.hra_on_next_step)} − ${amt(result.hra_on_old_pay)}`
    : t.arrHraNone;

  const lines: Array<{ no: number; label: string; calc?: string; value: string; tone?: 'minus' | 'sum' | 'net' }> = [
    { no: 1, label: t.lineNewBasic, value: amt(row.new_basic) },
    { no: 2, label: t.lineDrawn, value: `− ${amt(row.drawn_basic)}`, tone: 'minus' },
    {
      no: 3,
      label: t.lineDiff,
      calc: `${amt(row.new_basic)} − ${amt(row.drawn_basic)}`,
      value: signed(row.basic_difference),
      tone: 'sum',
    },
    { no: 4, label: t.lineSpecial, calc: specialCalc, value: `− ${amt(row.special_allowance)}`, tone: 'minus' },
    { no: 5, label: t.lineHra, calc: hraCalc, value: `− ${amt(row.excess_hra)}`, tone: 'minus' },
    {
      no: 6,
      label: t.lineNet,
      calc: `${signed(row.basic_difference)} − ${amt(row.special_allowance)} − ${amt(row.excess_hra)}`,
      value: signed(row.net_arrear),
      tone: 'net',
    },
  ];

  return (
    <div className="salary-bill-month overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-800">
        <span>{leadMonth}</span>
        <span className="text-xs font-semibold text-muted">{t.amountHead}</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {lines.map((line) => (
            <tr
              key={line.no}
              className={`border-t border-border ${
                line.tone === 'net' ? 'bg-indigo-50 font-bold' : line.tone === 'sum' ? 'bg-slate-50/60 font-semibold' : ''
              }`}
            >
              <td className="w-8 px-3 py-1.5 align-top text-xs font-semibold text-muted">{num(line.no)}.</td>
              <td className="px-1 py-1.5">
                <div>{line.label}</div>
                {line.calc ? <div className="font-mono text-xs text-slate-500">{line.calc}</div> : null}
              </td>
              <td
                className={`whitespace-nowrap px-3 py-1.5 text-right align-top font-mono ${
                  line.tone === 'minus' ? 'text-rose-700' : 'text-slate-900'
                }`}
              >
                {line.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {group.same.length > 0 ? (
        <div className="border-t border-border bg-amber-50/70 px-3 py-1.5 text-xs font-medium text-amber-900">
          {t.sameAs(group.same.map((r) => monthText(locale, r.month)).join(', '), leadMonth)}
        </div>
      ) : null}
    </div>
  );
}

export function SalaryArrearsBill({
  locale,
  grade,
  oldPay,
  substantiveGrade,
  housingStatus,
  hraArea,
  months,
  onMonthsChange,
  onPdf,
  onTrForm,
}: {
  locale: SalaryLocale;
  grade: PayGrade;
  oldPay: number;
  substantiveGrade: SubstantiveGrade | null;
  housingStatus: HousingStatus;
  hraArea: HraArea;
  months: string[];
  onMonthsChange: (months: string[]) => void;
  onPdf: () => void;
  onTrForm: () => void;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const amt = (n: number) => num(formatTaka(n));
  const signed = (n: number) => (n < 0 ? `− ${amt(-n)}` : amt(n));
  const tk = (n: number) => localTaka(locale, n);
  const f: Fmt = { t, locale, num, amt, signed };

  const monthOptions = useMemo(() => arrearMonthOptions(), []);

  const { result, error } = useMemo(() => {
    if (months.length === 0) return { result: null, error: t.arrSelectMonth };
    try {
      return {
        result: calculateSalaryArrears({
          grade,
          old_pay: oldPay,
          substantive_grade: substantiveGrade,
          housing_status: housingStatus,
          hra_area: hraArea,
          months,
        }),
        error: '',
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : t.calcError };
    }
  }, [grade, oldPay, substantiveGrade, housingStatus, hraArea, months, t]);

  function toggle(key: string) {
    onMonthsChange(months.includes(key) ? months.filter((k) => k !== key) : [...months, key].sort());
  }

  return (
    <Card className="overflow-hidden border border-indigo-200 shadow-sm">
      <div className="bg-indigo-700 px-4 py-2.5 text-white sm:px-5">
        <div className="text-sm font-bold">{t.billTitle}</div>
      </div>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="space-y-2 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-800">{t.arrMonths}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onMonthsChange(defaultArrearMonths())}>
                {t.arrPast}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onMonthsChange(monthOptions)}>
                {t.arrAll}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onMonthsChange([])}>
                {t.arrClear}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {monthOptions.map((key) => {
              const on = months.includes(key);
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

        {error ? <Alert variant="error">{error}</Alert> : null}

        {result ? (
          <>
            <section className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.billBasis}</h3>
              <div className="overflow-hidden rounded-xl border border-border text-sm">
                <BasisRow label={t.basisGrade} value={num(result.grade)} />
                {result.substantive_grade !== result.grade ? (
                  <BasisRow label={t.basisSubstantive} value={num(result.substantive_grade)} />
                ) : null}
                <BasisRow label={t.basisDrawn} value={tk(result.next_step)} />
                <BasisRow
                  label={t.basisSpecial}
                  value={`${num(result.special_rate_percent)}% (${
                    result.substantive_grade >= 10 ? t.arrBandHigh : t.arrBandLow
                  })`}
                />
                <BasisRow
                  label={t.basisHousing}
                  value={result.hra_eligible ? hraAreaText(locale, hraArea) : t.govtHousing}
                />
                <BasisRow
                  label={t.basisMonths}
                  value={result.rows.map((r) => monthText(locale, r.month)).join(', ')}
                />
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.billMonthsHead}</h3>
              <div className="space-y-3">
                {groupMonths(result.rows).map((group) => (
                  <MonthMath key={group.lead.month} f={f} result={result} group={group} />
                ))}
              </div>
            </section>

            <section className="salary-bill-summary space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.billSummary}</h3>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2 font-semibold">{t.arrColMonth}</th>
                      <th className="px-3 py-2 text-right font-semibold">{t.arrColNewBasic}</th>
                      <th className="px-3 py-2 text-right font-semibold">{t.arrColDrawn}</th>
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
                        <td className="px-3 py-2 text-right font-mono">{amt(row.drawn_basic)}</td>
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
            </section>

            <div className="rounded-xl border border-indigo-300 bg-indigo-100/70 px-4 py-3">
              <p className="text-base font-bold text-indigo-950">
                {t.arrTotalLine(
                  `৳ ${signed(result.total_basic_difference)}`,
                  tk(result.total_deduction),
                  `৳ ${signed(result.total_net_arrear)}`,
                )}
              </p>
              <p className="mt-1 text-sm font-semibold text-indigo-900">
                {t.inWords(takaInWords(locale, result.total_net_arrear))}
              </p>
              {result.total_net_arrear < 0 ? (
                <p className="text-[11px] text-indigo-900/80">{t.arrNegative}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-center gap-3 print:hidden">
              <Button type="button" size="lg" onClick={onPdf} className="gap-2 bg-indigo-700 px-8 hover:bg-indigo-800">
                <Download className="h-4 w-4" />
                {t.billPdf}
              </Button>
              <Button type="button" size="lg" variant="outline" onClick={onTrForm} className="gap-2 border-indigo-300 px-8 text-indigo-800">
                <Printer className="h-4 w-4" />
                {t.trForm}
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
