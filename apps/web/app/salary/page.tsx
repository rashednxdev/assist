'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Calculator, Download, HeartHandshake, Share2, ArrowRight } from 'lucide-react';
import {
  PAY_GRADES,
  NPS_2015,
  NPS_2026,
  calculateSalary2026AllPhases,
  calculateEmployeeGross,
  formatTaka,
  hraAreaLabel,
  isFixedPayGrade,
  salaryConversionRate,
  type EducationChildren,
  type EmployeeGrossResult,
  type HousingStatus,
  type HraArea,
  type ChargeType,
  type SubstantiveGrade,
  type PayGrade,
  type Salary2026Result,
} from '@ibas/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

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

const STAGE_HEADER: Record<
  Salary2026Result['phase'],
  { bar: string; title: string }
> = {
  '2026-07-01': { bar: 'bg-emerald-600', title: 'Stage-1 · 01-07-2026' },
  '2027-01-01': { bar: 'bg-amber-600', title: 'Stage-2 · 01-01-2027' },
  '2027-07-01': { bar: 'bg-violet-600', title: 'Stage-3 · 01-07-2027' },
};

function StageHeader({ result }: { result: Salary2026Result }) {
  const { bar, title } = STAGE_HEADER[result.phase];
  return (
    <div className={`${bar} salary-print-stage-header px-4 py-2.5 text-white sm:px-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{title}</span>
        {result.phase !== '2027-07-01' ? (
          <>
            <span className="text-white/50">|</span>
            <span className="text-sm text-white/90">{result.rate_percent}% Step 6</span>
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
  stageBasic,
  fixedAllowancesTotal,
  gpfDeduction,
}: {
  stageBasic: number;
  fixedAllowancesTotal: number;
  gpfDeduction: number;
}) {
  const gpf = Number.isFinite(gpfDeduction) && gpfDeduction > 0 ? Math.round(gpfDeduction) : 0;
  const basicPlusAllowances = stageBasic + fixedAllowancesTotal;
  const netPayable = basicPlusAllowances - gpf;

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 sm:p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-white px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Basic</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-slate-900">
            ৳ {formatTaka(stageBasic)}
          </p>
          <p className="text-[11px] text-muted">This stage — not included in Total Allowance</p>
        </div>
        <div className="rounded-lg border border-teal-300 bg-teal-100/80 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-900">
            Total Allowance (01 June to 31-12-2027)
          </p>
          <p className="mt-0.5 font-mono text-lg font-bold text-teal-950">
            ৳ {formatTaka(fixedAllowancesTotal)}
          </p>
          <p className="text-[11px] text-teal-800/80">Fixed on Basic 30 June 2026</p>
        </div>
      </div>
      <div className="mt-2 rounded-lg border border-emerald-300 bg-emerald-100/80 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
          Basic + Total Allowance
        </p>
        <p className="mt-0.5 font-mono text-lg font-bold text-emerald-950">
          ৳ {formatTaka(basicPlusAllowances)}
        </p>
        <p className="text-[11px] text-emerald-800/80">
          ৳ {formatTaka(stageBasic)} + ৳ {formatTaka(fixedAllowancesTotal)}
        </p>
      </div>
      {gpf > 0 ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">
              GPF deduction
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold text-rose-900">
              − ৳ {formatTaka(gpf)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Net payable
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold text-slate-900">
              ৳ {formatTaka(netPayable)}
            </p>
            <p className="text-[11px] text-muted">Basic + Total Allowance − GPF</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PhaseResultCard({
  result,
  stageClass,
  fixedAllowancesTotal,
  gpfDeduction,
}: {
  result: Salary2026Result;
  stageClass?: string;
  fixedAllowancesTotal: number;
  gpfDeduction: number;
}) {
  if (result.phase === '2027-07-01') {
    const basic2026 = result.basic_on_2026_07 ?? result.matched_new_stage ?? result.new_pay;
    const basic2027 = result.basic_on_2027_07 ?? result.new_pay;
    const moved = basic2027 !== basic2026;
    const delta = basic2027 - basic2026;

    return (
      <Card
        className={`salary-print-stage overflow-hidden border border-border shadow-sm${stageClass ? ` ${stageClass}` : ''}`}
      >
        <StageHeader result={result} />
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="rounded-lg border border-border bg-slate-50 salary-print-stage3-box p-3">
              <p className="text-xs text-muted">01-07-2026 basic</p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900">
                ৳ {formatTaka(basic2026)}
              </p>
            </div>
            <ArrowRight className="salary-print-hide mx-auto h-5 w-5 text-violet-500" aria-hidden />
            <div
              className={`salary-print-stage3-box rounded-lg border p-3 ${
                moved ? 'border-violet-200 bg-violet-50' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <p className="text-xs text-muted">01-07-2027 basic</p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900">
                ৳ {formatTaka(basic2027)}
              </p>
              <p className="mt-1 text-xs font-medium text-muted">
                {moved ? `+ ৳ ${formatTaka(delta)} (next stage)` : 'Last stage — no change'}
              </p>
            </div>
          </div>

          <StageTotalAllowanceSummary
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
      <StageHeader result={result} />
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <ResultStat label="Old basic (30-06-26)" value={`৳ ${formatTaka(result.old_pay)}`} />
          <ResultStat
            label="Matched 2026 stage"
            value={
              result.matched_new_stage != null ? `৳ ${formatTaka(result.matched_new_stage)}` : '—'
            }
          />
          <ResultStat
            label={`New basic (${result.phase_label})`}
            value={`৳ ${formatTaka(result.new_pay)}`}
            emphasize
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Step</th>
                <th className="px-3 py-2 font-semibold">Description</th>
                <th className="px-3 py-2 font-semibold">Calculation</th>
                <th className="px-3 py-2 text-right font-semibold">Amount (৳)</th>
              </tr>
            </thead>
            <tbody>
              {result.steps.map((row) => (
                <tr key={`${result.phase}-${row.step}-${row.label}`} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold text-slate-700">{row.step}</td>
                  <td className="px-3 py-2">
                    <div>{row.label}</div>
                    {row.note ? <div className="text-xs text-muted">{row.note}</div> : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">
                    {row.calculation?.trim() ? row.calculation : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {formatTaka(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <StageTotalAllowanceSummary
          stageBasic={result.new_pay}
          fixedAllowancesTotal={fixedAllowancesTotal}
          gpfDeduction={gpfDeduction}
        />

        {result.increment_skipped && !result.fixed ? (
          <p className="text-xs text-amber-800">
            Matched stage is the last stage on the 2026 scale — Step 5 = 0 (no next stage).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function GrossResultCard({ gross }: { gross: EmployeeGrossResult }) {
  const allowanceLines = gross.monthly_lines.filter((row) => row.code !== 'basic');
  const allowanceOnlyTotal = allowanceLines.reduce((sum, row) => sum + row.amount, 0);

  return (
    <Card className="salary-print-avoid-break overflow-hidden border border-teal-200 shadow-sm">
      <div className="bg-teal-700 px-4 py-2.5 text-white sm:px-5">
        <div className="text-sm font-bold">Total Allowance (01 June to 31-12-2027)</div>
        <p className="mt-0.5 text-xs text-teal-100/90">
          Fixed on Basic 30 June 2026 · Grade {gross.grade} · Housing:{' '}
          {gross.housing_status === 'govt_accommodation'
            ? 'Government accommodation'
            : hraAreaLabel(gross.hra_area)}
        </p>
      </div>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Component</th>
                <th className="px-3 py-2 font-semibold">Note</th>
                <th className="px-3 py-2 text-right font-semibold">Amount (৳)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border bg-slate-50/80">
                <td className="px-3 py-2 font-medium text-slate-800">
                  Basic pay (30 June 2026) — shown, not summed
                </td>
                <td className="px-3 py-2 text-xs text-muted">Reference basic for allowances</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">
                  {formatTaka(gross.basic)}
                </td>
              </tr>
              {allowanceLines.map((row) => (
                <tr key={row.code} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-slate-800">{row.label}</td>
                  <td className="px-3 py-2 text-xs text-muted">{row.note ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {formatTaka(row.amount)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-teal-200 bg-teal-50">
                <td className="px-3 py-2.5 font-bold text-teal-950" colSpan={2}>
                  Total Allowance (01 June to 31-12-2027)
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-lg font-bold text-teal-900">
                  {formatTaka(allowanceOnlyTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-amber-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Annual / periodic benefit</th>
                <th className="px-3 py-2 font-semibold">Note</th>
                <th className="px-3 py-2 text-right font-semibold">Amount (৳)</th>
              </tr>
            </thead>
            <tbody>
              {gross.annual_lines.map((row) => (
                <tr key={row.code} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-slate-800">{row.label}</td>
                  <td className="px-3 py-2 text-xs text-muted">{row.note ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {formatTaka(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SalaryOn2026Page() {
  const [grade, setGrade] = useState<PayGrade>(5);
  const [oldPay, setOldPay] = useState<number>(NPS_2015[5][5]!);
  const [housingStatus, setHousingStatus] = useState<HousingStatus>('hra_eligible');
  const [hraArea, setHraArea] = useState<HraArea>('dhaka');
  const [educationChildren, setEducationChildren] = useState<EducationChildren>(0);
  const [washingAllowance, setWashingAllowance] = useState(false);
  const [chargeType, setChargeType] = useState<ChargeType>('regular');
  const [substantiveGrade, setSubstantiveGrade] = useState<SubstantiveGrade | null>(null);
  const [gpfDeductionInput, setGpfDeductionInput] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<Salary2026Result[] | null>(null);
  const [gross, setGross] = useState<EmployeeGrossResult | null>(null);
  const [shareNote, setShareNote] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const oldStages = NPS_2015[grade];
  const newStages = NPS_2026[grade];
  const fixed = isFixedPayGrade(grade);
  const ratePct2026 = Math.round(salaryConversionRate(grade, '2026-07-01') * 100);
  const ratePct2027 = Math.round(salaryConversionRate(grade, '2027-01-01') * 100);
  const gpfDeduction = useMemo(() => parseAmountInput(gpfDeductionInput), [gpfDeductionInput]);

  const scalePreview = useMemo(
    () => ({
      old: oldStages.join('–'),
      neu: newStages.join('–'),
    }),
    [oldStages, newStages],
  );

  const oldPayLabel = useMemo(() => {
    const idx = oldStages.indexOf(oldPay);
    const suffix =
      idx === 0
        ? ' (minimum)'
        : idx === oldStages.length - 1 && oldStages.length > 1
          ? ' (last)'
          : '';
    return `৳ ${formatTaka(oldPay)}${suffix}`;
  }, [oldPay, oldStages]);

  function onGradeChange(next: PayGrade) {
    setGrade(next);
    setOldPay(NPS_2015[next][0]!);
    setChargeType('regular');
    setSubstantiveGrade(null);
    setResults(null);
    setGross(null);
    setError('');
  }

  function buildGross() {
    return calculateEmployeeGross({
      grade,
      basic: oldPay,
      housing_status: housingStatus,
      hra_area: hraArea,
      education_children: educationChildren,
      washing_allowance: washingAllowance,
      charge_type: chargeType,
      substantive_grade: substantiveGrade,
    });
  }

  async function handleCalculate() {
    setError('');
    setResults(null);
    setGross(null);
    setCalculating(true);
    try {
      let phaseResults: Salary2026Result[];
      const res = await fetch('/api/proxy/v1/salary/calculate-all-phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, old_pay: oldPay }),
      });
      if (res.ok) {
        const json = (await res.json()) as { data: { results: Salary2026Result[] } };
        phaseResults = json.data.results;
      } else {
        phaseResults = calculateSalary2026AllPhases({ grade, old_pay: oldPay });
      }
      setResults(phaseResults);
      setGross(buildGross());
    } catch {
      try {
        setResults(calculateSalary2026AllPhases({ grade, old_pay: oldPay }));
        setGross(buildGross());
      } catch (inner) {
        setError(inner instanceof Error ? inner.message : 'Could not calculate');
      }
    } finally {
      setCalculating(false);
    }
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

  function handleGivePdf() {
    setPdfLoading(true);
    const prevTitle = document.title;
    document.title = `ProAssist Salary 2026 — Grade ${grade}`;

    void fetch('/api/proxy/v1/salary/pdf', { method: 'POST' }).catch(() => {});

    const onBeforePrint = () => updatePrintPageBreaks();

    const finish = () => {
      document.title = prevTitle;
      setPdfLoading(false);
      document.querySelector('.salary-print-stage-2')?.classList.remove('salary-print-break-after');
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', finish);
    };

    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', finish);
    updatePrintPageBreaks();
    window.print();
    window.setTimeout(finish, 1500);
  }

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '/salary';
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Salary On 2026 — ProAssist',
          text: 'Your Basic on Proposed National Pay scale-2026',
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote('Link copied — share it with anyone.');
      setTimeout(() => setShareNote(''), 2500);
    } catch {
      setShareNote('');
    }
  }

  return (
    <div className="salary-print-root flex min-h-screen flex-col bg-[#f4f7f5] text-slate-900">
      <div className="salary-print-watermark" aria-hidden>
        <span>ProAssist. Developed by Rashed. Office of the Controller General of Accounts.</span>
        <span>ProAssist. Developed by Rashed. Office of the Controller General of Accounts.</span>
        <span>ProAssist. Developed by Rashed. Office of the Controller General of Accounts.</span>
        <span>ProAssist. Developed by Rashed. Office of the Controller General of Accounts.</span>
      </div>
      <header className="border-b border-emerald-900/10 bg-[#0b3d2e] text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/salary" className="min-w-0">
            <div className="text-sm font-bold tracking-wide">ProAssist</div>
            <div className="text-[11px] text-emerald-100/80">Salary calculator</div>
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleShare()}
            className="gap-1.5 border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white print:hidden"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
        </div>
      </header>

      <div className="salary-print-hero border-b border-emerald-200 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600">
        <div className="mx-auto max-w-5xl px-4 py-8 text-center sm:px-6 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100/90">
            National Pay Scale
          </p>
          <h1 className="mt-2 text-balance text-2xl font-extrabold leading-snug text-white sm:text-3xl">
            Your Basic on Proposed National Pay scale-2026
          </h1>
          <p className="mx-auto mt-4 inline-block rounded-full bg-emerald-200 px-4 py-1.5 text-sm font-extrabold text-emerald-950 shadow-sm ring-2 ring-emerald-100/80">
            Published calculation
          </p>
          <p className="salary-print-hide mx-auto mt-3 max-w-2xl text-sm text-emerald-50/90 sm:text-base">
            Public calculator — no login required. Three conversions shown in order:
          </p>
          <p className="mx-auto mt-1 max-w-2xl text-sm font-semibold text-emerald-50 sm:text-base">
            <span className="whitespace-nowrap">01-07-2026</span>
            {', '}
            <span className="whitespace-nowrap">01-01-2027</span>
            {', then '}
            <span className="whitespace-nowrap">01-07-2027</span>
            {'.'}
          </p>
          {shareNote ? <p className="mt-2 text-xs text-emerald-100 print:hidden">{shareNote}</p> : null}
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <Alert className="salary-print-hide border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm">
          <p className="text-sm leading-relaxed">
            <span className="rounded bg-emerald-200 px-1.5 py-0.5 font-extrabold text-emerald-950">
              Published calculation
            </span>{' '}
            Based on the National Pay Scale 2026 conversion stages shown below.
          </p>
        </Alert>

        <Alert className="salary-print-rules border-emerald-200 bg-white text-emerald-950 shadow-sm">
          <ol className="list-decimal space-y-1.5 pl-4 text-sm leading-relaxed">
            <li>
              <strong>Stage-1 (01-07-2026):</strong> Step 5 = next stage − Step 4; Step 6 = (Step 4 −
              old pay) × <strong>40%</strong> (grades 1–9) / <strong>50%</strong> (grades 10–20);
              Step 7 = old pay + Step 5 + Step 6.
            </li>
            <li>
              <strong>Stage-2 (01-01-2027):</strong> Same steps; Step 6 rate <strong>70%</strong>{' '}
              (grades 1–9) / <strong>75%</strong> (grades 10–20).
            </li>
            <li>
              <strong>Stage-3:</strong> 01-07-2026 basic = next stage after matched Step 4; 01-07-2027
              basic = next stage after that.
            </li>
          </ol>
        </Alert>

        <Card className="salary-print-input shadow-sm">
          <CardHeader className="space-y-0.5 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Start here</p>
            <CardTitle className="text-base">Your current pay (NPS 2015)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="grade" className="text-sm font-medium">
                  Grade
                </Label>
                <select
                  id="grade"
                  className="flex h-10 w-full rounded-md border-2 border-amber-400 bg-amber-50/60 px-3 text-sm font-semibold ring-2 ring-amber-200 focus:border-amber-500 focus:outline-none focus:ring-amber-300 print:hidden"
                  value={grade}
                  onChange={(e) => onGradeChange(Number(e.target.value) as PayGrade)}
                >
                  {PAY_GRADES.map((g) => (
                    <option key={g} value={g}>
                      Grade {g}
                      {isFixedPayGrade(g) ? ' (Fixed)' : ''}
                    </option>
                  ))}
                </select>
                <p className="hidden rounded-md border border-amber-300 bg-amber-50/80 px-3 py-2 text-sm font-semibold print:block">
                  Grade {grade}
                  {fixed ? ' (Fixed)' : ''}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oldPay" className="text-sm font-medium">
                  Basic on 30 June 2026
                </Label>
                <select
                  id="oldPay"
                  className="flex h-10 w-full rounded-md border-2 border-emerald-400 bg-emerald-50/60 px-3 text-sm font-semibold ring-2 ring-emerald-200 focus:border-emerald-500 focus:outline-none focus:ring-emerald-300 print:hidden"
                  value={oldPay}
                  onChange={(e) => {
                    setOldPay(Number(e.target.value));
                    setResults(null);
                    setGross(null);
                    setError('');
                  }}
                >
                  {oldStages.map((amt, i) => (
                    <option key={`${amt}-${i}`} value={amt}>
                      ৳ {formatTaka(amt)}
                      {i === 0 ? ' (minimum)' : ''}
                      {i === oldStages.length - 1 && oldStages.length > 1 ? ' (last)' : ''}
                    </option>
                  ))}
                </select>
                <p className="hidden rounded-md border border-emerald-300 bg-emerald-50/80 px-3 py-2 text-sm font-semibold print:block">
                  {oldPayLabel}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Grade {grade}</Badge>
              <Badge variant="outline">01-07-26 · {ratePct2026}%</Badge>
              <Badge variant="outline">01-01-27 · {ratePct2027}%</Badge>
              {fixed ? (
                <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Fixed pay</Badge>
              ) : null}
            </div>

            <div className="salary-print-scale space-y-1 rounded-lg border border-dashed border-border bg-slate-50/50 p-3 text-xs text-muted">
              <p>
                <span className="font-semibold text-slate-700">NPS 2015:</span> {scalePreview.old}
              </p>
              <p>
                <span className="font-semibold text-slate-700">NPS 2026:</span> {scalePreview.neu}
              </p>
            </div>

            <div className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">
                  Confirm for gross pay
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  Allowances with Basic (30 June 2026)
                </p>
              </div>

              {grade >= 2 && grade <= 10 ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-slate-800">
                    Post type (Grades 2–10)
                  </legend>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="chargeType"
                      className="mt-0.5"
                      checked={chargeType === 'regular'}
                      onChange={() => {
                        setChargeType('regular');
                        setGross(null);
                        setResults(null);
                      }}
                    />
                    Regular (default)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="chargeType"
                      className="mt-0.5"
                      checked={chargeType === 'current_charge'}
                      onChange={() => {
                        setChargeType('current_charge');
                        setGross(null);
                        setResults(null);
                      }}
                    />
                    Current charge — extra ৳ 1,500 / month
                  </label>
                </fieldset>
              ) : null}

              {grade >= 7 && grade <= 10 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="substantiveGrade" className="text-sm font-medium">
                    Substantive grade (for tiffin &amp; conveyance)
                  </Label>
                  <select
                    id="substantiveGrade"
                    className="flex h-10 w-full rounded-md border border-teal-300 bg-white px-3 text-sm font-medium focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    value={substantiveGrade ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSubstantiveGrade(
                        v === '' ? null : (Number(v) as SubstantiveGrade),
                      );
                      setGross(null);
                      setResults(null);
                    }}
                  >
                    <option value="">Not applicable / not Grade 11–15</option>
                    <option value={11}>Grade 11</option>
                    <option value={12}>Grade 12</option>
                    <option value={13}>Grade 13</option>
                    <option value={14}>Grade 14</option>
                    <option value={15}>Grade 15</option>
                  </select>
                  <p className="text-xs text-muted">
                    Grades 7–10: if substantive grade is 11–15, tiffin ৳ 200 and conveyance ৳ 300
                    apply.
                  </p>
                </div>
              ) : null}

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-800">Housing</legend>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="housing"
                    className="mt-1"
                    checked={housingStatus === 'hra_eligible'}
                    onChange={() => {
                      setHousingStatus('hra_eligible');
                      setGross(null);
                      setResults(null);
                    }}
                  />
                  <span>Eligible for House Rent Allowance (select posting area)</span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="housing"
                    className="mt-1"
                    checked={housingStatus === 'govt_accommodation'}
                    onChange={() => {
                      setHousingStatus('govt_accommodation');
                      setGross(null);
                      setResults(null);
                    }}
                  />
                  <span>
                    Government-provided accommodation (HRA not payable; house-rent deduction may
                    apply)
                  </span>
                </label>
              </fieldset>

              {housingStatus === 'hra_eligible' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="hraArea" className="text-sm font-medium">
                    Posting / HRA area
                  </Label>
                  <select
                    id="hraArea"
                    className="flex h-10 w-full rounded-md border border-teal-300 bg-white px-3 text-sm font-medium focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    value={hraArea}
                    onChange={(e) => {
                      setHraArea(e.target.value as HraArea);
                      setGross(null);
                      setResults(null);
                    }}
                  >
                    <option value="dhaka">Dhaka Metropolitan Area</option>
                    <option value="major_city">
                      Chittagong, Khulna, Rajshahi, Sylhet, Barisal, Rangpur, Narayanganj, Gazipur,
                      Savar
                    </option>
                    <option value="other">Other areas (District / Upazila)</option>
                  </select>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="educationChildren" className="text-sm font-medium">
                    Education assistance (children)
                  </Label>
                  <select
                    id="educationChildren"
                    className="flex h-10 w-full rounded-md border border-teal-300 bg-white px-3 text-sm font-medium focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    value={educationChildren}
                    onChange={(e) => {
                      setEducationChildren(Number(e.target.value) as EducationChildren);
                      setGross(null);
                      setResults(null);
                    }}
                  >
                    <option value={0}>None — ৳ 0</option>
                    <option value={1}>1 child — ৳ 500 / month</option>
                    <option value={2}>2 children (max) — ৳ 1,000 / month</option>
                  </select>
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-slate-800">
                    Washing allowance (uniformed 4th Class)
                  </legend>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="washing"
                      checked={!washingAllowance}
                      onChange={() => {
                        setWashingAllowance(false);
                        setGross(null);
                        setResults(null);
                      }}
                    />
                    No
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="washing"
                      checked={washingAllowance}
                      onChange={() => {
                        setWashingAllowance(true);
                        setGross(null);
                        setResults(null);
                      }}
                    />
                    Yes — ৳ 100 / month
                  </label>
                </fieldset>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gpf-deduction" className="text-sm font-medium">
                  GPF deduction (optional)
                </Label>
                <Input
                  id="gpf-deduction"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="Type GPF amount, e.g. 5000"
                  className="border-teal-300 bg-white font-medium tabular-nums focus-visible:border-teal-500 focus-visible:ring-teal-200"
                  value={gpfDeductionInput}
                  onChange={(e) => setGpfDeductionInput(e.target.value)}
                />
                <p className="text-xs text-muted">
                  Applied on each of the 3 stages only (Basic + Total Allowance − GPF → Net payable)
                  {gpfDeduction > 0 ? (
                    <span className="font-semibold text-teal-800">
                      {' '}
                      (GPF ৳ {formatTaka(gpfDeduction)})
                    </span>
                  ) : null}
                  .
                </p>
              </div>

              <p className="text-xs text-teal-900/80">
                Medical ৳ 1,500 is included for all. Tiffin ৳ 200 and Conveyance ৳ 300 apply for
                Grades 11–15 (or substantive Grade 11–15 when pay grade is 7–10). Grades 2–10 may
                add Current charge ৳ 1,500. Festival (2× basic / year), Pahela Baishakh (20%), and
                Rest &amp; Recreation (1× basic every 3 years) are shown separately after
                calculation.
              </p>
            </div>

            {error ? (
              <Alert variant="error" className="print:hidden">
                {error}
              </Alert>
            ) : null}

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 print:hidden">
                <Button type="button" onClick={() => void handleCalculate()} disabled={calculating} className="gap-2">
                  <Calculator className="h-4 w-4" />
                  {calculating ? 'Calculating…' : 'Calculate by ProAssist'}
                </Button>
              </div>
              <p className="text-xs font-medium text-teal-700">
                Developed by Rashed. Office of the Controller General of Accounts.
              </p>
            </div>
          </CardContent>
        </Card>

        {results ? (
          <div className="flex justify-center print:hidden">
            <Button
              type="button"
              size="lg"
              onClick={handleGivePdf}
              disabled={pdfLoading}
              className="gap-2 px-8"
            >
              <Download className="h-4 w-4" />
              {pdfLoading ? 'Opening print…' : 'Give me a PDF'}
            </Button>
          </div>
        ) : null}

        {gross ? <GrossResultCard gross={gross} /> : null}

        {results?.map((result, index) => (
          <PhaseResultCard
            key={result.phase}
            result={result}
            fixedAllowancesTotal={
              gross
                ? gross.monthly_lines
                    .filter((row) => row.code !== 'basic')
                    .reduce((sum, row) => sum + row.amount, 0)
                : 0
            }
            gpfDeduction={gpfDeduction}
            stageClass={
              index === 1 ? 'salary-print-stage-2' : index === 2 ? 'salary-print-stage-3' : undefined
            }
          />
        ))}

        {results ? (
          <>
            <Alert className="border-amber-300 bg-amber-50 text-amber-950 shadow-sm">
              <p className="text-sm font-semibold leading-relaxed">
                This is a draft. Final calculation will be fixed by iBASS++.
              </p>
            </Alert>

            <section
              aria-label="Thanks to Government"
              className="salary-print-thanks relative overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-amber-50 px-5 py-8 text-center shadow-sm sm:px-8"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-200/40 blur-2xl salary-print-hide" />
              <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-amber-200/50 blur-2xl salary-print-hide" />
              <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 ring-4 ring-rose-50">
                  <HeartHandshake className="h-6 w-6" aria-hidden />
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700/80">
                  With gratitude
                </p>
                <h2 className="text-balance text-xl font-extrabold text-slate-900 sm:text-2xl">
                  Thank you, Government of Bangladesh
                </h2>
                <p className="text-pretty text-sm leading-relaxed text-slate-700 sm:text-base">
                  From <strong>all government employees</strong> — we gratefully acknowledge the
                  proposed National Pay Scale 2026 and the continued efforts to improve the
                  livelihood and dignity of public servants across the country.
                </p>
                <p className="text-sm font-semibold italic text-rose-800/90">
                  — All Government Employees
                </p>
              </div>
            </section>
          </>
        ) : null}
      </main>

      <footer className="mt-auto border-t border-emerald-900/10 bg-[#0b3d2e] text-emerald-50">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left sm:px-6">
          <div>
            <div className="text-sm font-bold text-white">ProAssist</div>
            <div className="text-xs text-emerald-100/75">
              Rules, exams, and compliance assistant
            </div>
          </div>
          <div className="text-xs text-emerald-100/70">
            Salary On 2026 · Free public tool · Share the link with anyone
          </div>
        </div>
      </footer>
    </div>
  );
}
