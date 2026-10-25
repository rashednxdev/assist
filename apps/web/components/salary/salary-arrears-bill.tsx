'use client';

import { useMemo } from 'react';
import { Download, Loader2 } from 'lucide-react';
import {
  arrearPeriodStart,
  arrearMonthOptions,
  calculateSalaryArrears,
  defaultArrearMonths,
  formatTaka,
  roundSalaryTaka,
  specialAllowanceAmount,
  salaryArrearTrGrade,
  salaryTrFormNo,
  type HousingStatus,
  type HraArea,
  type PayGrade,
  type SalaryArrearMonthRow,
  type SalaryArrearResult,
  type SalaryExceptionalIssues,
  type SubstantiveGrade,
} from '@ibas/shared-types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import {
  hraAreaText,
  localNum,
  localTaka,
  monthRowLabel,
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

/** YYYY-MM-DD → DD-MM-YYYY. */
export function isoToDmy(iso: string): string {
  return iso.split('-').reverse().join('-');
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
    a.excess_hra === b.excess_hra &&
    a.hra_protection === b.hra_protection &&
    a.pay_change_segment === b.pay_change_segment &&
    a.segment_grade === b.segment_grade &&
    a.days === a.month_days &&
    b.days === b.month_days
  );
}

/** "(26 of 30 days)" / day-range note for joining or promotion-split months. */
export function daysNote(t: SalaryCopy, num: (v: string | number) => string, row: SalaryArrearMonthRow): string {
  return row.days < row.month_days ? ` (${t.arrDaysNote(num(row.days), num(row.month_days))})` : '';
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
  const leadMonth = monthRowLabel(locale, row);
  /** Dedicated % for this segment (pre- vs post-promotion), from the arrears engine. */
  const specialRatePercent = row.special_rate_percent;
  const prorated = row.days < row.month_days;
  const fullDiff = row.new_basic - row.drawn_basic;
  /** Whole-month figures for lines 1–6; line 7 prorates when the segment is a partial month. */
  const rawSpecial = Math.round((row.drawn_basic * specialRatePercent) / 100);
  const fullSpecial = specialAllowanceAmount(row.drawn_basic, specialRatePercent / 100);
  const specialCalc =
    fullSpecial > rawSpecial
      ? `${amt(row.drawn_basic)} × ${num(specialRatePercent)}% (${t.specialMin(amt(fullSpecial))})`
      : `${amt(row.drawn_basic)} × ${num(specialRatePercent)}%`;
  const scaleUp = (n: number) =>
    prorated && row.days > 0 ? roundSalaryTaka((n * row.month_days) / row.days) : n;
  const fullHra = scaleUp(row.excess_hra);
  const fullProtection = scaleUp(row.hra_protection);
  const protection = fullProtection > 0;
  const hraEntitlement = result.hra_entitlement_30_06;
  /** Drawn HRA for this segment = entitlement ± excess/protection (whole-month). */
  const hraDrawn = protection ? hraEntitlement - fullProtection : hraEntitlement + fullHra;
  const hraLine = protection
    ? {
        no: 5,
        label: t.lineHraProtection,
        calc: `৳ ${amt(hraEntitlement)} (${t.basisHraEntitlement}) − ৳ ${amt(hraDrawn)} (${t.lineHraDrawn})`,
        value: `+ ${amt(fullProtection)}`,
        tone: 'plus' as const,
      }
    : {
        no: 5,
        label: t.lineHra,
        calc: result.hra_eligible
          ? `৳ ${amt(hraDrawn)} (${t.lineHraDrawn}) − ৳ ${amt(hraEntitlement)} (${t.basisHraEntitlement})`
          : t.arrHraNone,
        value: `− ${amt(fullHra)}`,
        tone: 'minus' as const,
      };

  const lines: Array<{
    no: number;
    label: string;
    calc?: string;
    value: string;
    tone?: 'minus' | 'plus' | 'sum' | 'net';
  }> = [
    { no: 1, label: t.lineNewBasic, value: amt(row.new_basic) },
    { no: 2, label: t.lineDrawn, value: `− ${amt(row.drawn_basic)}`, tone: 'minus' },
    {
      no: 3,
      label: t.lineDiff,
      calc: `${amt(row.new_basic)} − ${amt(row.drawn_basic)}`,
      value: signed(fullDiff),
      tone: 'sum',
    },
    { no: 4, label: t.lineSpecial, calc: specialCalc, value: `− ${amt(fullSpecial)}`, tone: 'minus' },
    hraLine,
    {
      no: 6,
      label: protection ? t.lineNetProtection : t.lineNet,
      calc: protection
        ? `${signed(fullDiff)} − ${amt(fullSpecial)} + ${amt(fullProtection)}`
        : `${signed(fullDiff)} − ${amt(fullSpecial)} − ${amt(fullHra)}`,
      value: signed(row.full_net_arrear),
      tone: prorated ? 'sum' : 'net',
    },
  ];
  if (prorated) {
    lines.push({
      no: 7,
      label: t.lineProrated(num(row.days), num(row.month_days)),
      calc: `${signed(row.full_net_arrear)} ÷ ${num(row.month_days)} × ${num(row.days)}`,
      value: signed(row.net_arrear),
      tone: 'net',
    });
  }

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
                  line.tone === 'minus' ? 'text-rose-700' : line.tone === 'plus' ? 'text-emerald-700' : 'text-slate-900'
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

export interface ArrearExtras {
  excess_rr: boolean;
  excess_puja: boolean;
}

export const NO_ARREAR_EXTRAS: ArrearExtras = { excess_rr: false, excess_puja: false };

/** One-time Rest & Recreation / Puja deductions chosen on the bill, with the working shown on the bill. */
export function oneTimeDeductions(
  t: SalaryCopy,
  amt: (n: number) => string,
  result: SalaryArrearResult,
): Array<{ key: string; label: string; rule: string; amount: number }> {
  const rows: Array<{ key: string; label: string; rule: string; amount: number }> = [];
  if (result.excess_rr > 0) {
    rows.push({ key: 'rr', label: t.arrExcessRrShort, rule: t.arrExcessRrRule(amt(result.increment)), amount: result.excess_rr });
  }
  if (result.excess_puja > 0) {
    rows.push({
      key: 'puja',
      label: t.arrExcessPujaShort,
      rule: t.arrExcessPujaRule(amt(result.increment), amt(result.excess_puja)),
      amount: result.excess_puja,
    });
  }
  return rows;
}

/** Tick boxes for the excess Rest & Recreation (1 increment) and Puja bonus (2 increments) deductions. */
export function ArrearExtraDeductions({
  locale,
  oldPay,
  nextStep,
  value,
  onChange,
}: {
  locale: SalaryLocale;
  oldPay: number;
  nextStep: number;
  value: ArrearExtras;
  onChange: (value: ArrearExtras) => void;
}) {
  const t = salaryCopy(locale);
  const amt = (n: number) => localNum(locale, formatTaka(n));
  const increment = nextStep - oldPay;
  const options: Array<{ key: keyof ArrearExtras; label: string; rule: string }> = [
    { key: 'excess_rr', label: t.arrExcessRr, rule: t.arrExcessRrRule(amt(increment)) },
    { key: 'excess_puja', label: t.arrExcessPuja, rule: t.arrExcessPujaRule(amt(increment), amt(increment * 2)) },
  ];
  return (
    <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2.5 print:hidden">
      <p className="text-sm font-semibold text-rose-900">{t.arrExtraTitle}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.key}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border bg-white px-3 py-2 text-sm ${
              value[o.key] ? 'border-rose-400 ring-1 ring-rose-300' : 'border-rose-100'
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-rose-600"
              checked={value[o.key]}
              onChange={(e) => onChange({ ...value, [o.key]: e.target.checked })}
            />
            <span>
              <span className="block font-medium text-slate-800">{o.label}</span>
              <span className="block font-mono text-xs text-rose-800">− {o.rule}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-600">
        {increment > 0 ? t.arrIncrementCalc(amt(nextStep), amt(oldPay), amt(increment)) : t.arrNoIncrement}
      </p>
    </div>
  );
}

/** Arrear month chips with Past / All / Clear shortcuts. */
export function ArrearMonthPicker({
  locale,
  months,
  onMonthsChange,
  fromMonth,
}: {
  locale: SalaryLocale;
  months: string[];
  onMonthsChange: (months: string[]) => void;
  /** Month of joining when the arrears start after July 2026; earlier months are hidden. */
  fromMonth?: string;
}) {
  const t = salaryCopy(locale);
  const monthOptions = useMemo(
    () => arrearMonthOptions().filter((m) => !fromMonth || m >= fromMonth),
    [fromMonth],
  );
  const pastMonths = () => {
    const past = defaultArrearMonths().filter((m) => !fromMonth || m >= fromMonth);
    return past.length > 0 ? past : monthOptions;
  };

  function toggle(key: string) {
    onMonthsChange(months.includes(key) ? months.filter((k) => k !== key) : [...months, key].sort());
  }

  return (
    <div className="space-y-2 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{t.arrMonths}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onMonthsChange(pastMonths())}>
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
  );
}

export function SalaryArrearsBill({
  locale,
  grade,
  oldPay,
  substantiveGrade,
  joiningDate,
  exceptional = null,
  housingStatus,
  hraArea,
  months,
  onMonthsChange,
  extras,
  onExtrasChange,
  deductStamp,
  onDeductStampChange,
  onTrForm,
  accessReady,
  downloading,
  accessPanel,
  contactsPanel,
}: {
  locale: SalaryLocale;
  grade: PayGrade;
  oldPay: number;
  substantiveGrade: SubstantiveGrade | null;
  joiningDate: string;
  exceptional?: SalaryExceptionalIssues | null;
  housingStatus: HousingStatus;
  hraArea: HraArea;
  months: string[];
  onMonthsChange: (months: string[]) => void;
  extras: ArrearExtras;
  onExtrasChange: (extras: ArrearExtras) => void;
  /** Stamp duty ৳ 10 is deducted unless the user clears this. */
  deductStamp: boolean;
  onDeductStampChange: (deduct: boolean) => void;
  onTrForm: () => void;
  accessReady: boolean;
  downloading: boolean;
  accessPanel: React.ReactNode;
  contactsPanel: React.ReactNode;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const amt = (n: number) => num(formatTaka(n));
  const signed = (n: number) => (n < 0 ? `− ${amt(-n)}` : amt(n));
  const tk = (n: number) => localTaka(locale, n);
  const f: Fmt = { t, locale, num, amt, signed };

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
          joining_date: joiningDate,
          exceptional,
          ...extras,
        }),
        error: '',
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : t.calcError };
    }
  }, [grade, oldPay, substantiveGrade, joiningDate, exceptional, housingStatus, hraArea, months, extras, t]);
  const oneTime = result ? oneTimeDeductions(t, amt, result) : [];
  const stamp = deductStamp ? 10 : 0;
  const payable = result ? result.total_net_arrear - stamp : 0;
  const fromMonth = arrearPeriodStart(grade, oldPay, joiningDate, exceptional?.arrear_start_date)?.month;

  return (
    <Card className="overflow-hidden border border-indigo-200 shadow-sm">
      <div className="bg-indigo-700 px-4 py-2.5 text-white sm:px-5">
        <div className="text-sm font-bold">{t.billTitle}</div>
      </div>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <ArrearMonthPicker locale={locale} months={months} onMonthsChange={onMonthsChange} fromMonth={fromMonth} />

        {error ? <Alert variant="error">{error}</Alert> : null}

        {result ? (
          <>
            <ArrearExtraDeductions
              locale={locale}
              oldPay={result.old_pay}
              nextStep={result.next_step}
              value={extras}
              onChange={onExtrasChange}
            />
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm print:hidden">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-amber-700"
                checked={deductStamp}
                onChange={(e) => onDeductStampChange(e.target.checked)}
              />
              <span>
                <span className="block font-semibold text-amber-950">{t.stampDeduct}</span>
                <span className="block text-xs text-amber-900/80">{t.stampDeductHint}</span>
              </span>
            </label>

            <section className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.billBasis}</h3>
              <div className="overflow-hidden rounded-xl border border-border text-sm">
                <BasisRow label={t.basisGrade} value={num(result.grade)} />
                {result.substantive_grade !== result.grade || result.substantive_grade_after != null ? (
                  <BasisRow label={t.basisSubstantive} value={num(result.substantive_grade)} />
                ) : null}
                {result.substantive_grade_after != null ? (
                  <BasisRow label={t.basisSubstantiveAfter} value={num(result.substantive_grade_after)} />
                ) : null}
                {result.increment_withheld ? (
                  <BasisRow
                    label={t.basisIncrement}
                    value={result.increment_exempt ? t.basisNoIncrementExempt : t.basisNoIncrement}
                  />
                ) : null}
                {result.pay_change ? (
                  <>
                    <BasisRow
                      label={t.basisPayChange}
                      value={`${num(result.pay_change.effective_date.split('-').reverse().join('-'))} · ${t.grade} ${num(result.pay_change.grade)} · ${t.lineDrawn} ৳ ${amt(result.pay_change.old_pay)}`}
                    />
                    {result.pay_change_origin_fixed_2026 != null ? (
                      <BasisRow label={t.basisPayChangeOriginFixed} value={tk(result.pay_change_origin_fixed_2026)} />
                    ) : null}
                    {result.pay_change_matched_basic != null ? (
                      <BasisRow label={t.basisPayChangeMatched} value={tk(result.pay_change_matched_basic)} />
                    ) : null}
                    {result.pay_change_scale_diff != null ? (
                      <BasisRow label={t.basisPayChangeScaleDiff} value={tk(result.pay_change_scale_diff)} />
                    ) : null}
                  </>
                ) : null}
                {result.hra_eligible ? (
                  <BasisRow label={t.basisHraEntitlement} value={tk(result.hra_entitlement_30_06)} />
                ) : null}
                {result.bill_grade !== result.grade ? (
                  <BasisRow label={t.basisBillGrade} value={num(result.bill_grade)} />
                ) : null}
                {result.arrear_from_date ? (
                  <BasisRow
                    label={
                      result.increment_withheld && !result.increment_exempt ? t.basisJoining : t.basisArrearStart
                    }
                    value={num(isoToDmy(result.arrear_from_date))}
                  />
                ) : null}
                <BasisRow label={t.basisDrawn} value={tk(result.next_step)} />
                <BasisRow
                  label={t.basisSpecial}
                  value={
                    result.special_rate_fixed
                      ? `${num(result.special_rate_percent)}%`
                      : `${num(result.special_rate_percent)}% (${
                          result.substantive_grade >= 10 ? t.arrBandHigh : t.arrBandLow
                        })`
                  }
                />
                {result.special_rate_percent_after != null &&
                result.substantive_grade_after != null &&
                result.special_rate_percent_after !== result.special_rate_percent ? (
                  <BasisRow
                    label={t.basisSpecialAfter}
                    value={`${num(result.special_rate_percent_after)}% (${
                      result.substantive_grade_after >= 10 ? t.arrBandHigh : t.arrBandLow
                    })`}
                  />
                ) : null}
                <BasisRow
                  label={t.basisHousing}
                  value={result.hra_eligible ? hraAreaText(locale, hraArea) : t.govtHousing}
                />
                {result.hra_protection > 0 ? (
                  <BasisRow label={t.basisHraProtection} value={tk(result.hra_protection)} />
                ) : null}
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
                  <MonthMath
                    key={`${group.lead.month}-${group.lead.day_from ?? 'f'}-${group.lead.pay_change_segment ? 'p' : 'b'}`}
                    f={f}
                    result={result}
                    group={group}
                  />
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
                      <th className="px-3 py-2 text-right font-semibold">
                        {result.hra_protection > 0 ? t.arrColHraProtection : t.arrColHra}
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">{t.arrColNet}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, idx) => (
                      <tr key={`${row.month}-${row.day_from ?? 'f'}-${idx}`} className="border-t border-border">
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{monthRowLabel(locale, row)}</div>
                          <div className="text-xs text-muted">{t.stageName(STAGE_NUMBER[row.phase])}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{amt(row.new_basic)}</td>
                        <td className="px-3 py-2 text-right font-mono">{amt(row.drawn_basic)}</td>
                        <td className="px-3 py-2 text-right font-mono">{signed(row.basic_difference)}</td>
                        <td className="px-3 py-2 text-right font-mono text-rose-700">− {amt(row.special_allowance)}</td>
                        {row.hra_protection > 0 ? (
                          <td className="px-3 py-2 text-right font-mono text-emerald-700">+ {amt(row.hra_protection)}</td>
                        ) : (
                          <td className="px-3 py-2 text-right font-mono text-rose-700">− {amt(row.excess_hra)}</td>
                        )}
                        <td className="px-3 py-2 text-right font-mono font-semibold">{signed(row.net_arrear)}</td>
                      </tr>
                    ))}
                    {oneTime.map((d) => (
                      <tr key={d.key} className="border-t border-border bg-rose-50/50">
                        <td className="px-3 py-2" colSpan={6}>
                          <div className="font-medium text-slate-800">
                            {d.label} ({t.arrOneTime})
                          </div>
                          <div className="font-mono text-xs text-muted">{d.rule}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-rose-700">− {amt(d.amount)}</td>
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
                      {result.total_hra_protection > 0 ? (
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-700">
                          + {amt(result.total_hra_protection)}
                        </td>
                      ) : (
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-rose-700">
                          − {amt(result.total_excess_hra)}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-right font-mono text-lg font-bold text-indigo-900">
                        {signed(result.total_net_arrear)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <div className="rounded-xl border border-indigo-300 bg-indigo-100/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">{t.arrMathTitle}</p>
              <div className="mt-2 max-w-xl space-y-2 text-indigo-950">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{t.arrMathTotal}</p>
                    {result.total_hra_protection > 0 ? (
                      <p className="text-xs text-indigo-900/80">
                        {t.arrColDiff} ৳ {signed(result.total_basic_difference)} + {t.arrColHraProtection}{' '}
                        {tk(result.total_hra_protection)}
                      </p>
                    ) : null}
                  </div>
                  <p className="whitespace-nowrap font-mono font-semibold">
                    ৳ {signed(result.total_basic_difference + result.total_hra_protection)}
                  </p>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{t.arrMathDeductions}</p>
                    <p className="text-xs text-indigo-900/80">
                      {t.arrColSpecial} {tk(result.total_special_allowance)} + {t.arrColHra} {tk(result.total_excess_hra)}
                      {oneTime.map((d) => ` + ${d.label} ${tk(d.amount)}`).join('')}
                    </p>
                  </div>
                  <p className="whitespace-nowrap font-mono font-semibold text-rose-700">− {tk(result.total_deduction)}</p>
                </div>
                {stamp > 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold">{t.stampDeduct}</p>
                    <p className="whitespace-nowrap font-mono font-semibold text-rose-700">− {tk(stamp)}</p>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4 border-t-2 border-indigo-300 pt-2">
                  <p className="text-base font-bold">{t.arrMathNet}</p>
                  <p className="whitespace-nowrap font-mono text-lg font-bold text-indigo-900">
                    ৳ {signed(payable)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-sm font-semibold text-indigo-900">
                {t.inWords(takaInWords(locale, payable))}
              </p>
              {result.total_net_arrear < 0 ? (
                <p className="text-[11px] text-indigo-900/80">{t.arrNegative}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-center gap-3 print:hidden">
              <Button
                type="button"
                size="lg"
                onClick={onTrForm}
                disabled={!accessReady || downloading}
                className="gap-2 bg-indigo-700 px-8 hover:bg-indigo-800"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloading
                  ? t.downloading
                  : t.trFormDownload(String(salaryTrFormNo(salaryArrearTrGrade(result))))}
              </Button>
            </div>

            {accessPanel}

            {contactsPanel}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
