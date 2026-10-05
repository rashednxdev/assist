'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Calculator,
  ChevronDown,
  Download,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Share2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { logoutRequest } from '@/lib/auth';
import { isSalaryOnlyUser } from '@/lib/salary-only';
import { useSalaryUser } from '@/components/salary/salary-auth-gate';
import { useSalaryOffice } from '@/components/salary/salary-office-gate';
import {
  NPS_2015,
  NPS_2026,
  calculateSalary2026AllPhases,
  calculateEmployeeGross,
  calculateSalaryArrears,
  defaultArrearMonths,
  formatTaka,
  PAY_GRADES,
  isFixedPayGrade,
  type EducationChildren,
  type EmployeeGrossResult,
  type HousingStatus,
  type HraArea,
  type ChargeType,
  type SubstantiveGrade,
  type PayGrade,
  type Salary2026Result,
  type SalaryBillAccessRecord,
  type SalaryBillKind,
  SALARY_BILL_LIMIT_CODE,
} from '@ibas/shared-types';
import { ApiError, apiFetch } from '@/lib/api-client';
import { SalaryBillAccessPanel, SalaryBillContacts } from '@/components/salary/salary-bill-access';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { SalaryArrearsBill } from '@/components/salary/salary-arrears-bill';
import { TrForm13 } from '@/components/salary/tr-form-13';
import {
  EMPTY_PRINT_INFO,
  SalaryPrintDialog,
  SalaryPrintMeta,
  type SalaryPrintInfo,
} from '@/components/salary/salary-print-dialog';
import {
  HRA_AREAS,
  allowanceText,
  housingText,
  hraAreaText,
  localNum,
  localTaka,
  salaryCopy,
  stepText,
  type SalaryCopy,
  type SalaryLocale,
  type Segments,
} from '@/lib/salary-i18n';

type PrintTarget = 'salary' | 'arrears' | 'trform';

/** Accept ASCII + Bangla digits from any keyboard; strip other characters. */
function parseAmountInput(raw: string): number {
  const bangla: Record<string, string> = {
    '০': '0',
    '১': '1',
    '২': '2',
    '৩': '3',
    '৪': '4',
    '৫': '5',
    '৬': '6',
    '৭': '7',
    '৮': '8',
    '৯': '9',
  };
  const normalized = String(raw)
    .split('')
    .map((ch) => bangla[ch] ?? ch)
    .join('')
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

interface Ctx {
  t: SalaryCopy;
  locale: SalaryLocale;
}

const STAGE_HEADER: Record<Salary2026Result['phase'], { bar: string; n: number }> = {
  '2026-07-01': { bar: 'bg-emerald-600', n: 1 },
  '2027-01-01': { bar: 'bg-amber-600', n: 2 },
  '2027-07-01': { bar: 'bg-violet-600', n: 3 },
};

function RichText({ segments }: { segments: Segments }) {
  return (
    <>
      {segments.map(([text, bold], i) => (bold ? <strong key={i}>{text}</strong> : <span key={i}>{text}</span>))}
    </>
  );
}

function SalaryLocaleToggle({ value, onChange }: { value: SalaryLocale; onChange: (v: SalaryLocale) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-white/30 bg-white/5 p-0.5 text-sm print:hidden" role="group" aria-label="Language">
      {(['en', 'bn'] as const).map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => onChange(loc)}
          aria-pressed={value === loc}
          className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
            value === loc ? 'bg-white text-[#0b3d2e]' : 'text-white/80 hover:text-white'
          }`}
        >
          {loc === 'en' ? 'EN' : 'বাং'}
        </button>
      ))}
    </div>
  );
}

function StageHeader({ ctx, result }: { ctx: Ctx; result: Salary2026Result }) {
  const { t, locale } = ctx;
  const { bar, n } = STAGE_HEADER[result.phase];
  return (
    <div className={`${bar} salary-print-stage-header px-4 py-2.5 text-white sm:px-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{t.stageTitle(n, localNum(locale, result.phase_label))}</span>
        {result.phase !== '2027-07-01' ? (
          <>
            <span className="text-white/50">|</span>
            <span className="text-sm text-white/90">{t.step5Rate(localNum(locale, result.rate_percent))}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ResultStat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`salary-print-stat rounded-xl border p-4 ${
        emphasize ? 'salary-print-stat-emphasis border-emerald-300 bg-emerald-50' : 'border-border bg-slate-50/80'
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 font-semibold ${emphasize ? 'text-2xl text-emerald-900' : 'text-lg'}`}>
        {value}
      </div>
    </div>
  );
}

/** Stage summary only — fixed allowances from 30 June 2026 (same every stage). */
function StageTotalAllowanceSummary({
  ctx,
  stageBasic,
  fixedAllowancesTotal,
  gpfDeduction,
}: {
  ctx: Ctx;
  stageBasic: number;
  fixedAllowancesTotal: number;
  gpfDeduction: number;
}) {
  const { t, locale } = ctx;
  const tk = (n: number) => localTaka(locale, n);
  const gpf = Number.isFinite(gpfDeduction) && gpfDeduction > 0 ? Math.round(gpfDeduction) : 0;
  const basicPlusAllowances = stageBasic + fixedAllowancesTotal;
  const netPayable = basicPlusAllowances - gpf;

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 sm:p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-white px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.basic}</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-slate-900">{tk(stageBasic)}</p>
          <p className="text-[11px] text-muted">{t.basicNote}</p>
        </div>
        <div className="rounded-lg border border-teal-300 bg-teal-100/80 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-900">{t.totalAllowance}</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-teal-950">{tk(fixedAllowancesTotal)}</p>
          <p className="text-[11px] text-teal-800/80">{t.fixedOnBasic}</p>
        </div>
      </div>
      <div className="mt-2 rounded-lg border border-emerald-300 bg-emerald-100/80 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">{t.basicPlusAllowance}</p>
        <p className="mt-0.5 font-mono text-lg font-bold text-emerald-950">{tk(basicPlusAllowances)}</p>
        <p className="text-[11px] text-emerald-800/80">
          {tk(stageBasic)} + {tk(fixedAllowancesTotal)}
        </p>
      </div>
      {gpf > 0 ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">{t.gpfDeduction}</p>
            <p className="mt-0.5 font-mono text-lg font-bold text-rose-900">− {tk(gpf)}</p>
          </div>
          <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t.netPayable}</p>
            <p className="mt-0.5 font-mono text-lg font-bold text-slate-900">{tk(netPayable)}</p>
            <p className="text-[11px] text-muted">{t.netFormula}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PhaseResultCard({
  ctx,
  result,
  stageClass,
  fixedAllowancesTotal,
  gpfDeduction,
}: {
  ctx: Ctx;
  result: Salary2026Result;
  stageClass?: string;
  fixedAllowancesTotal: number;
  gpfDeduction: number;
}) {
  const { t, locale } = ctx;
  const tk = (n: number) => localTaka(locale, n);

  if (result.phase === '2027-07-01') {
    const basic2026 = result.basic_on_2026_07 ?? result.matched_new_stage ?? result.new_pay;
    const basic2027 = result.basic_on_2027_07 ?? result.new_pay;
    const moved = basic2027 !== basic2026;
    const delta = basic2027 - basic2026;

    return (
      <Card
        className={`salary-print-stage overflow-hidden border border-border shadow-sm${stageClass ? ` ${stageClass}` : ''}`}
      >
        <StageHeader ctx={ctx} result={result} />
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="rounded-lg border border-border bg-slate-50 salary-print-stage3-box p-3">
              <p className="text-xs text-muted">{t.basic2026}</p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900">{tk(basic2026)}</p>
            </div>
            <ArrowRight className="salary-print-hide mx-auto h-5 w-5 text-violet-500" aria-hidden />
            <div
              className={`salary-print-stage3-box rounded-lg border p-3 ${
                moved ? 'border-violet-200 bg-violet-50' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <p className="text-xs text-muted">{t.basic2027}</p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900">{tk(basic2027)}</p>
              <p className="mt-1 text-xs font-medium text-muted">
                {moved ? t.nextStage(tk(delta)) : t.lastStage}
              </p>
            </div>
          </div>

          <StageTotalAllowanceSummary
            ctx={ctx}
            stageBasic={basic2027}
            fixedAllowancesTotal={fixedAllowancesTotal}
            gpfDeduction={gpfDeduction}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`salary-print-stage overflow-hidden border border-border shadow-sm${stageClass ? ` ${stageClass}` : ''}`}
    >
      <StageHeader ctx={ctx} result={result} />
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <ResultStat label={t.oldBasic} value={tk(result.old_pay)} />
          <ResultStat
            label={t.matched}
            value={result.matched_new_stage != null ? tk(result.matched_new_stage) : '—'}
          />
          <ResultStat
            label={t.newBasic(localNum(locale, result.phase_label))}
            value={tk(result.new_pay)}
            emphasize
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">{t.stepCol}</th>
                <th className="px-3 py-2 font-semibold">{t.descCol}</th>
                <th className="px-3 py-2 font-semibold">{t.calcCol}</th>
                <th className="px-3 py-2 text-right font-semibold">{t.amount}</th>
              </tr>
            </thead>
            <tbody>
              {result.steps.map((row) => {
                const text = stepText(locale, result, row);
                return (
                  <tr key={`${result.phase}-${row.step}-${row.label}`} className="border-t border-border">
                    <td className="px-3 py-2 font-semibold text-slate-700">{localNum(locale, row.step)}</td>
                    <td className="px-3 py-2">
                      <div>{text.label}</div>
                      {text.note ? <div className="text-xs text-muted">{text.note}</div> : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      {text.calculation?.trim() ? text.calculation : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {localNum(locale, formatTaka(row.value))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <StageTotalAllowanceSummary
          ctx={ctx}
          stageBasic={result.new_pay}
          fixedAllowancesTotal={fixedAllowancesTotal}
          gpfDeduction={gpfDeduction}
        />

        {result.increment_skipped && !result.fixed ? (
          <p className="text-xs text-amber-800">{t.lastStageWarn}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function GrossResultCard({ ctx, gross }: { ctx: Ctx; gross: EmployeeGrossResult }) {
  const { t, locale } = ctx;
  const num = (v: string | number) => localNum(locale, v);
  const allowanceLines = gross.monthly_lines.filter((row) => row.code !== 'basic');
  const allowanceOnlyTotal = allowanceLines.reduce((sum, row) => sum + row.amount, 0);

  return (
    <Card className="salary-print-avoid-break overflow-hidden border border-teal-200 shadow-sm">
      <div className="bg-teal-700 px-4 py-2.5 text-white sm:px-5">
        <div className="text-sm font-bold">{t.totalAllowance}</div>
        <p className="mt-0.5 text-xs text-teal-100/90">{t.grossSub(num(gross.grade), housingText(locale, gross))}</p>
      </div>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">{t.component}</th>
                <th className="px-3 py-2 font-semibold">{t.note}</th>
                <th className="px-3 py-2 text-right font-semibold">{t.amount}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border bg-slate-50/80">
                <td className="px-3 py-2 font-medium text-slate-800">{t.basicShown}</td>
                <td className="px-3 py-2 text-xs text-muted">{t.basicRef}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{num(formatTaka(gross.basic))}</td>
              </tr>
              {allowanceLines.map((row) => {
                const text = allowanceText(locale, row, gross);
                return (
                  <tr key={row.code} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-slate-800">{text.label}</td>
                    <td className="px-3 py-2 text-xs text-muted">{text.note ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{num(formatTaka(row.amount))}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-teal-200 bg-teal-50">
                <td className="px-3 py-2.5 font-bold text-teal-950" colSpan={2}>
                  {t.totalAllowance}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-lg font-bold text-teal-900">
                  {num(formatTaka(allowanceOnlyTotal))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-amber-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">{t.annualHead}</th>
                <th className="px-3 py-2 font-semibold">{t.note}</th>
                <th className="px-3 py-2 text-right font-semibold">{t.amount}</th>
              </tr>
            </thead>
            <tbody>
              {gross.annual_lines.map((row) => {
                const text = allowanceText(locale, row, gross);
                return (
                  <tr key={row.code} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-slate-800">{text.label}</td>
                    <td className="px-3 py-2 text-xs text-muted">{text.note ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{num(formatTaka(row.amount))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SalarySummaryCard({
  ctx,
  grade,
  oldPay,
  results,
  allowancesTotal,
  showDetails,
  onToggleDetails,
  onPdf,
}: {
  ctx: Ctx;
  grade: PayGrade;
  oldPay: number;
  results: Salary2026Result[];
  allowancesTotal: number;
  showDetails: boolean;
  onToggleDetails: () => void;
  onPdf: () => void;
}) {
  const { t, locale } = ctx;
  const tk = (n: number) => localTaka(locale, n);
  const stageBasic = (r: Salary2026Result) => (r.phase === '2027-07-01' ? r.basic_on_2027_07 ?? r.new_pay : r.new_pay);

  return (
    <Card className="salary-print-avoid-break overflow-hidden border border-emerald-300 shadow-sm">
      <div className="bg-emerald-700 px-4 py-2.5 text-white sm:px-5">
        <div className="text-sm font-bold">{t.summaryTitle}</div>
        <p className="mt-0.5 text-xs text-emerald-100/90">{t.summarySub(localNum(locale, grade), tk(oldPay))}</p>
      </div>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {results.map((r) => (
            <ResultStat
              key={r.phase}
              label={t.stageTitle(STAGE_HEADER[r.phase].n, localNum(locale, r.phase_label))}
              value={tk(stageBasic(r))}
              emphasize={r.phase === '2026-07-01'}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
          <span className="text-sm font-semibold text-teal-900">{t.summaryAllowance}</span>
          <span className="font-mono text-lg font-bold text-teal-950">{tk(allowancesTotal)}</span>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={onToggleDetails} className="gap-1.5">
            <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            {showDetails ? t.hideDetails : t.viewDetails}
          </Button>
          <Button type="button" onClick={onPdf} className="gap-2">
            <Download className="h-4 w-4" />
            {t.pdf}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SalaryOn2026Page() {
  const [locale, setLocale] = useState<SalaryLocale>('bn');
  const { office: salaryOffice, changeOffice } = useSalaryOffice();
  const [grade, setGrade] = useState<PayGrade | null>(null);
  const [oldPay, setOldPay] = useState(0);
  const [housingStatus, setHousingStatus] = useState<HousingStatus>('hra_eligible');
  const [hraArea, setHraArea] = useState<HraArea>('dhaka');
  const [educationChildren, setEducationChildren] = useState<EducationChildren>(0);
  const [washingAllowance, setWashingAllowance] = useState(false);
  const [chargeType, setChargeType] = useState<ChargeType>('regular');
  const [substantiveGrade, setSubstantiveGrade] = useState<SubstantiveGrade | null>(null);
  const [gpfDeductionInput, setGpfDeductionInput] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Salary2026Result[] | null>(null);
  const [gross, setGross] = useState<EmployeeGrossResult | null>(null);
  const [showArrears, setShowArrears] = useState(false);
  const [arrearMonths, setArrearMonths] = useState<string[]>(() => defaultArrearMonths());
  const [printDialog, setPrintDialog] = useState<PrintTarget | null>(null);
  const [printMode, setPrintMode] = useState<PrintTarget | null>(null);
  const [printInfo, setPrintInfo] = useState<SalaryPrintInfo>(EMPTY_PRINT_INFO);
  const [shareNote, setShareNote] = useState('');
  const [billAccess, setBillAccess] = useState<SalaryBillAccessRecord | null>(null);
  const [billAccessError, setBillAccessError] = useState(false);
  const [billError, setBillError] = useState('');
  const resultsRef = useRef<HTMLDivElement>(null);
  const arrearsRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const salaryOnly = isSalaryOnlyUser(useSalaryUser());
  const t = salaryCopy(locale);
  const ctx: Ctx = { t, locale };
  const num = (v: string | number) => localNum(locale, v);
  const tk = (n: number) => localTaka(locale, n);

  const gpfDeduction = useMemo(() => parseAmountInput(gpfDeductionInput), [gpfDeductionInput]);
  const stepNo = grade && oldPay > 0 ? NPS_2015[grade].indexOf(oldPay) + 1 : 0;
  const allowancesTotal = gross
    ? gross.monthly_lines.filter((row) => row.code !== 'basic').reduce((sum, row) => sum + row.amount, 0)
    : 0;
  const detailsVisible = showDetails || printMode === 'salary';
  const arrearResult = useMemo(() => {
    if (!showArrears || !grade || stepNo <= 0 || arrearMonths.length === 0) return null;
    try {
      return calculateSalaryArrears({
        grade,
        old_pay: oldPay,
        substantive_grade: substantiveGrade,
        housing_status: housingStatus,
        hra_area: hraArea,
        months: arrearMonths,
      });
    } catch {
      return null;
    }
  }, [showArrears, grade, stepNo, oldPay, substantiveGrade, housingStatus, hraArea, arrearMonths]);

  function resetResults() {
    setResults(null);
    setGross(null);
    setShowArrears(false);
    setError('');
  }

  function requireGrade(): PayGrade | null {
    if (!grade) setError(t.gradeRequired);
    else if (stepNo <= 0) setError(t.basicRequired);
    else {
      setError('');
      return grade;
    }
    return null;
  }

  function scrollTo(ref: React.RefObject<HTMLDivElement | null>) {
    requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function handleCalculate() {
    const g = requireGrade();
    if (!g) return;
    try {
      // Always compute on the client so Step 5–7 rules match the shipped web bundle.
      // Remote API images can lag after deploy; do not use their results for display.
      setResults(calculateSalary2026AllPhases({ grade: g, old_pay: oldPay }));
      setGross(
        calculateEmployeeGross({
          grade: g,
          basic: oldPay,
          housing_status: housingStatus,
          hra_area: hraArea,
          education_children: educationChildren,
          washing_allowance: washingAllowance,
          charge_type: chargeType,
          substantive_grade: substantiveGrade,
        }),
      );
      scrollTo(resultsRef);

      // Usage tracking only (ignore response body)
      void fetch('/api/proxy/v1/salary/calculate-all-phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: g, old_pay: oldPay }),
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : t.calcError);
    }
  }

  function handleArrears() {
    if (!requireGrade()) return;
    setShowArrears(true);
    scrollTo(arrearsRef);
  }

  function updatePrintPageBreaks() {
    const stage2 = document.querySelector('.salary-print-stage-2');
    if (!stage2) return;

    const printRoot = document.querySelector('.salary-print-root');
    if (!printRoot) return;

    // A4 printable height: 297mm − 16mm margins ≈ 281mm
    const printableHeightPx = 281 * 3.7795275591;
    const rootTop = printRoot.getBoundingClientRect().top;
    const stage2Bottom = stage2.getBoundingClientRect().bottom - rootTop;

    // Only force page 2 when Stage 2 fully ends on page 1; otherwise Stage 3 follows immediately
    stage2.classList.toggle('salary-print-break-after', stage2Bottom <= printableHeightPx + 4);
  }

  useEffect(() => {
    if (!printMode) return;
    const prevTitle = document.title;
    document.title =
      printMode === 'trform'
        ? `TR Form 13 — Arrears — Grade ${grade ?? ''}`
        : printMode === 'arrears'
          ? `ProAssist Arrears Bill — Grade ${grade ?? ''}`
          : `ProAssist Salary 2026 — Grade ${grade ?? ''}`;
    if (printMode === 'salary') {
      void fetch('/api/proxy/v1/salary/pdf', { method: 'POST' }).catch(() => {});
    }

    let done = false;
    const onBeforePrint = () => {
      if (printMode === 'salary') updatePrintPageBreaks();
    };
    const finish = () => {
      if (done) return;
      done = true;
      document.title = prevTitle;
      document.querySelector('.salary-print-stage-2')?.classList.remove('salary-print-break-after');
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', finish);
      setPrintMode(null);
    };

    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', finish);
    const timer = window.setTimeout(() => {
      onBeforePrint();
      window.print();
      window.setTimeout(finish, 1500);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [printMode, grade]);

  async function loadBillAccess() {
    setBillAccessError(false);
    try {
      const res = await apiFetch<{ data: SalaryBillAccessRecord }>('/salary/access');
      setBillAccess(res.data);
    } catch {
      setBillAccessError(true);
    }
  }

  useEffect(() => {
    void loadBillAccess();
  }, []);

  async function confirmPrint(info: SalaryPrintInfo) {
    const target = printDialog;
    setPrintInfo(info);
    setPrintDialog(null);
    if (target === 'arrears' || target === 'trform') {
      if (!arrearResult || !grade) return;
      const kind: SalaryBillKind = target === 'trform' ? 'tr_form_13' : 'arrears_pdf';
      setBillError('');
      try {
        const res = await apiFetch<{ data: SalaryBillAccessRecord }>('/salary/bills', {
          method: 'POST',
          body: JSON.stringify({
            kind,
            grade,
            old_pay: oldPay,
            months: arrearResult.rows.map((r) => r.month),
            net_total: arrearResult.total_net_arrear,
          }),
        });
        setBillAccess(res.data);
      } catch (err) {
        setBillError(err instanceof Error ? err.message : t.calcError);
        if (err instanceof ApiError && err.code === SALARY_BILL_LIMIT_CODE) void loadBillAccess();
        return;
      }
    }
    setPrintMode(target);
  }

  async function handleLogout() {
    await logoutRequest();
    router.replace('/login');
  }

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '/salary';
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${t.title} — ProAssist`,
          text: t.heroTitle,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote(t.linkCopied);
      setTimeout(() => setShareNote(''), 2500);
    } catch {
      setShareNote('');
    }
  }

  const preparedOn = num(
    new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-'),
  );

  return (
    <div
      lang={locale}
      className={`salary-print-root flex min-h-screen flex-col bg-[#f4f7f5] text-slate-900${
        printMode ? ` salary-print-mode-${printMode}` : ''
      }`}
    >
      <header className="border-b border-emerald-900/10 bg-[#0b3d2e] text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/salary" className="min-w-0">
            <div className="text-sm font-bold tracking-wide">ProAssist</div>
            <div className="text-[11px] text-emerald-100/80">{t.brandSub}</div>
          </Link>
          <div className="flex items-center gap-2">
            <SalaryLocaleToggle value={locale} onChange={setLocale} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleShare()}
              className="gap-1.5 border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white print:hidden"
            >
              <Share2 className="h-3.5 w-3.5" />
              {t.shareBtn}
            </Button>
            {salaryOnly ? null : (
              <Link
                href="/dashboard"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/30 bg-white/5 px-2.5 text-sm font-medium text-white hover:bg-white/15 print:hidden"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/30 bg-white/5 px-2.5 text-sm font-medium text-white hover:bg-white/15 print:hidden"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="salary-print-hero border-b border-emerald-200 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600">
        <div className="mx-auto max-w-5xl px-4 py-8 text-center sm:px-6 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100/90">{t.heroKicker}</p>
          <h1 className="mt-2 text-balance text-2xl font-extrabold leading-snug text-white sm:text-3xl">
            {t.heroTitle}
          </h1>
          <p className="mx-auto mt-4 inline-block rounded-full bg-emerald-200 px-4 py-1.5 text-sm font-extrabold text-emerald-950 shadow-sm ring-2 ring-emerald-100/80">
            {t.heroBadge}
          </p>
          <p className="salary-print-hide mx-auto mt-3 max-w-2xl text-sm text-emerald-50/90 sm:text-base">
            {t.heroIntro}
          </p>
          <p className="mx-auto mt-1 max-w-2xl text-sm font-semibold text-emerald-50 sm:text-base">
            <span className="whitespace-nowrap">{num('01-07-2026')}</span>
            {', '}
            <span className="whitespace-nowrap">{num('01-01-2027')}</span>
            {`, ${t.then} `}
            <span className="whitespace-nowrap">{num('01-07-2027')}</span>
            {locale === 'bn' ? '।' : '.'}
          </p>
          {shareNote ? <p className="mt-2 text-xs text-emerald-100 print:hidden">{shareNote}</p> : null}
          <p className="mx-auto mt-3 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full bg-white/10 px-3 py-1 text-xs text-emerald-50 ring-1 ring-white/20 print:hidden">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold">{t.officeYour}:</span>
            <span className="min-w-0 truncate">{salaryOffice?.label ?? t.officeNotSet}</span>
            <button type="button" onClick={changeOffice} className="font-semibold underline underline-offset-2 hover:text-white">
              {t.officeChange}
            </button>
          </p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <SalaryPrintMeta t={t} info={printInfo} preparedOn={preparedOn} />

        <Card className="salary-print-hide shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.currentPay}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <div className="space-y-1.5">
                  <Label htmlFor="grade" className="text-sm font-medium">
                    {t.grade}
                  </Label>
                  <select
                    id="grade"
                    className="flex h-11 w-full rounded-md border-2 border-emerald-400 bg-emerald-50/60 px-3 text-base font-semibold ring-2 ring-emerald-200 focus:border-emerald-500 focus:outline-none focus:ring-emerald-300"
                    value={grade ?? ''}
                    onChange={(e) => {
                      const g = e.target.value === '' ? null : (Number(e.target.value) as PayGrade);
                      setGrade(g);
                      setOldPay((prev) => (g && NPS_2015[g].includes(prev) ? prev : 0));
                      resetResults();
                    }}
                  >
                    <option value="">{t.gradePlaceholder}</option>
                    {PAY_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {`${t.grade} ${num(g)}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="basic" className="text-sm font-medium">
                    {t.basicJune}
                  </Label>
                  <select
                    id="basic"
                    disabled={!grade}
                    className="flex h-11 w-full rounded-md border-2 border-emerald-400 bg-emerald-50/60 px-3 text-base font-semibold tabular-nums ring-2 ring-emerald-200 focus:border-emerald-500 focus:outline-none focus:ring-emerald-300 disabled:cursor-not-allowed disabled:border-border disabled:bg-slate-100 disabled:ring-0"
                    value={oldPay > 0 ? oldPay : ''}
                    onChange={(e) => {
                      setOldPay(Number(e.target.value) || 0);
                      resetResults();
                    }}
                  >
                    <option value="">{grade ? t.basicPlaceholder : t.gradeFirst}</option>
                    {grade
                      ? NPS_2015[grade].map((amount, i) => (
                          <option key={amount} value={amount}>
                            {`${num(formatTaka(amount))} — ${t.stepOption(num(i + 1))}`}
                          </option>
                        ))
                      : null}
                  </select>
                </div>
              </div>
              {grade && stepNo > 0 ? (
                <p className="inline-flex items-center gap-2 rounded-md bg-emerald-100 px-2.5 py-1 text-sm font-semibold text-emerald-900">
                  {t.gradeFound(num(grade), num(stepNo))}
                  {isFixedPayGrade(grade) ? <span className="text-xs font-medium">{t.fixedPay}</span> : null}
                </p>
              ) : (
                <p className="text-xs text-muted">{t.basicHint}</p>
              )}
            </div>

            <div className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-800">{t.housing}</legend>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="housing"
                    className="mt-1"
                    checked={housingStatus === 'hra_eligible'}
                    onChange={() => {
                      setHousingStatus('hra_eligible');
                      resetResults();
                    }}
                  />
                  <span>{t.hraEligible}</span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="housing"
                    className="mt-1"
                    checked={housingStatus === 'govt_accommodation'}
                    onChange={() => {
                      setHousingStatus('govt_accommodation');
                      resetResults();
                    }}
                  />
                  <span>{t.govtAccommodation}</span>
                </label>
              </fieldset>

              {housingStatus === 'hra_eligible' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="hraArea" className="text-sm font-medium">
                    {t.hraArea}
                  </Label>
                  <select
                    id="hraArea"
                    className="flex h-10 w-full rounded-md border border-teal-300 bg-white px-3 text-sm font-medium focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    value={hraArea}
                    onChange={(e) => {
                      setHraArea(e.target.value as HraArea);
                      resetResults();
                    }}
                  >
                    {HRA_AREAS.map((a) => (
                      <option key={a} value={a}>
                        {hraAreaText(locale, a)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {grade != null && grade >= 7 && grade <= 10 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="substantiveGrade" className="text-sm font-medium">
                    {t.substantive}
                  </Label>
                  <select
                    id="substantiveGrade"
                    className="flex h-10 w-full rounded-md border border-teal-300 bg-white px-3 text-sm font-medium focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    value={substantiveGrade ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSubstantiveGrade(v === '' ? null : (Number(v) as SubstantiveGrade));
                      resetResults();
                    }}
                  >
                    <option value="">{t.substantiveNA}</option>
                    {([11, 12, 13, 14, 15] as const).map((g) => (
                      <option key={g} value={g}>
                        {t.grade} {num(g)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted">{t.substantiveHint}</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{t.moreOptions}</span>
                  <span className="block text-xs text-muted">{t.moreOptionsHint}</span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen ? (
                <div className="space-y-4 border-t border-border px-4 py-4">
                  {grade != null && grade >= 2 && grade <= 10 ? (
                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium text-slate-800">{t.postType}</legend>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="chargeType"
                          className="mt-0.5"
                          checked={chargeType === 'regular'}
                          onChange={() => {
                            setChargeType('regular');
                            resetResults();
                          }}
                        />
                        {t.regular}
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="chargeType"
                          className="mt-0.5"
                          checked={chargeType === 'current_charge'}
                          onChange={() => {
                            setChargeType('current_charge');
                            resetResults();
                          }}
                        />
                        {t.currentCharge}
                      </label>
                    </fieldset>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="educationChildren" className="text-sm font-medium">
                        {t.education}
                      </Label>
                      <select
                        id="educationChildren"
                        className="flex h-10 w-full rounded-md border border-teal-300 bg-white px-3 text-sm font-medium focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                        value={educationChildren}
                        onChange={(e) => {
                          setEducationChildren(Number(e.target.value) as EducationChildren);
                          resetResults();
                        }}
                      >
                        {t.educationOptions.map((label, i) => (
                          <option key={i} value={i}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium text-slate-800">{t.washing}</legend>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="washing"
                          checked={!washingAllowance}
                          onChange={() => {
                            setWashingAllowance(false);
                            resetResults();
                          }}
                        />
                        {t.no}
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="washing"
                          checked={washingAllowance}
                          onChange={() => {
                            setWashingAllowance(true);
                            resetResults();
                          }}
                        />
                        {t.washingYes}
                      </label>
                    </fieldset>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="gpf-deduction" className="text-sm font-medium">
                      {t.gpf}
                    </Label>
                    <Input
                      id="gpf-deduction"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={t.gpfPlaceholder}
                      className="border-teal-300 bg-white font-medium tabular-nums focus-visible:border-teal-500 focus-visible:ring-teal-200"
                      value={gpfDeductionInput}
                      onChange={(e) => setGpfDeductionInput(e.target.value)}
                    />
                    <p className="text-xs text-muted">{t.gpfHint(gpfDeduction > 0 ? tk(gpfDeduction) : null)}</p>
                  </div>

                  <p className="text-xs text-teal-900/80">{t.grossNote}</p>
                </div>
              ) : null}
            </div>

            {error ? <Alert variant="error">{error}</Alert> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleArrears} className="gap-2 bg-indigo-700 hover:bg-indigo-800">
                <ReceiptText className="h-4 w-4" />
                {t.calcArrears}
              </Button>
              <Button type="button" onClick={handleCalculate} className="gap-2">
                <Calculator className="h-4 w-4" />
                {t.calculate}
              </Button>
            </div>
          </CardContent>
        </Card>

        {results && gross && grade ? (
          <div ref={resultsRef} className="scroll-mt-4 space-y-6">
            <SalarySummaryCard
              ctx={ctx}
              grade={grade}
              oldPay={oldPay}
              results={results}
              allowancesTotal={allowancesTotal}
              showDetails={showDetails}
              onToggleDetails={() => setShowDetails((v) => !v)}
              onPdf={() => setPrintDialog('salary')}
            />

            {detailsVisible ? (
              <>
                <div className="salary-print-scale space-y-1 rounded-lg border border-dashed border-border bg-white p-3 text-xs text-muted">
                  <p className="font-semibold text-slate-800">{t.scaleDetails}</p>
                  <p>
                    <span className="font-semibold text-slate-700">{t.nps2015}</span>{' '}
                    {num(NPS_2015[grade].join('–'))}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">{t.nps2026}</span>{' '}
                    {num(NPS_2026[grade].join('–'))}
                  </p>
                </div>

                <GrossResultCard ctx={ctx} gross={gross} />

                {results.map((result, index) => (
                  <PhaseResultCard
                    key={result.phase}
                    ctx={ctx}
                    result={result}
                    fixedAllowancesTotal={allowancesTotal}
                    gpfDeduction={gpfDeduction}
                    stageClass={
                      index === 1 ? 'salary-print-stage-2' : index === 2 ? 'salary-print-stage-3' : undefined
                    }
                  />
                ))}
              </>
            ) : null}
          </div>
        ) : null}

        {showArrears && grade ? (
          <div ref={arrearsRef} className="salary-arrears-bill scroll-mt-4">
            <SalaryArrearsBill
              locale={locale}
              grade={grade}
              oldPay={oldPay}
              substantiveGrade={substantiveGrade}
              housingStatus={housingStatus}
              hraArea={hraArea}
              months={arrearMonths}
              onMonthsChange={setArrearMonths}
              onTrForm={() => setPrintDialog('trform')}
              canBill={Boolean(billAccess?.can_bill)}
              accessPanel={
                <>
                  <SalaryBillAccessPanel
                    locale={locale}
                    access={billAccess}
                    loadError={billAccessError}
                    onRetry={() => void loadBillAccess()}
                    onAccessChange={setBillAccess}
                  />
                  {billError ? (
                    <Alert variant="error" className="print:hidden">
                      {billError}
                    </Alert>
                  ) : null}
                </>
              }
              contactsPanel={<SalaryBillContacts locale={locale} contacts={billAccess?.contacts ?? []} />}
            />
          </div>
        ) : null}

        {results ? (
          <section
            aria-label={t.thanksTitle}
            className="salary-print-thanks relative overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-amber-50 px-5 py-8 text-center shadow-sm sm:px-8"
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-200/40 blur-2xl salary-print-hide" />
            <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-amber-200/50 blur-2xl salary-print-hide" />
            <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 ring-4 ring-rose-50">
                <HeartHandshake className="h-6 w-6" aria-hidden />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700/80">{t.thanksKicker}</p>
              <h2 className="text-balance text-xl font-extrabold text-slate-900 sm:text-2xl">{t.thanksTitle}</h2>
              <p className="text-pretty text-sm leading-relaxed text-slate-700 sm:text-base">
                <RichText segments={t.thanksText} />
              </p>
              <p className="text-sm font-semibold italic text-rose-800/90">{t.thanksSign}</p>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="mt-auto border-t border-emerald-900/10 bg-[#0b3d2e] text-emerald-50">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left sm:px-6">
          <div>
            <div className="text-sm font-bold text-white">ProAssist</div>
            <div className="text-xs text-emerald-100/75">{t.footerTagline}</div>
          </div>
          <div className="text-xs text-emerald-100/70">{t.footerNote}</div>
        </div>
      </footer>

      <p className="salary-print-footer hidden">{t.printFooter}</p>

      {arrearResult ? (
        <TrForm13 result={arrearResult} hraArea={hraArea} info={printInfo} preparedOn={localNum('bn', preparedOn)} />
      ) : null}

      {printDialog ? (
        <SalaryPrintDialog
          t={t}
          initial={printInfo}
          onCancel={() => setPrintDialog(null)}
          onConfirm={confirmPrint}
        />
      ) : null}
    </div>
  );
}
