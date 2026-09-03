'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Calculator, Download, HeartHandshake, Share2, ArrowRight } from 'lucide-react';
import {
  PAY_GRADES,
  NPS_2015,
  NPS_2026,
  calculateSalary2026AllPhases,
  formatTaka,
  isFixedPayGrade,
  salaryConversionRate,
  type PayGrade,
  type Salary2026Result,
} from '@ibas/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

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

function PhaseResultCard({
  result,
  stageClass,
}: {
  result: Salary2026Result;
  stageClass?: string;
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

        {result.increment_skipped && !result.fixed ? (
          <p className="text-xs text-amber-800">
            Matched stage is the last stage on the 2026 scale — Step 5 uses the Step 4 amount (no
            next stage).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function SalaryOn2026Page() {
  const [grade, setGrade] = useState<PayGrade>(5);
  const [oldPay, setOldPay] = useState<number>(NPS_2015[5][5]!);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Salary2026Result[] | null>(null);
  const [shareNote, setShareNote] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const oldStages = NPS_2015[grade];
  const newStages = NPS_2026[grade];
  const fixed = isFixedPayGrade(grade);
  const ratePct2026 = Math.round(salaryConversionRate(grade, '2026-07-01') * 100);
  const ratePct2027 = Math.round(salaryConversionRate(grade, '2027-01-01') * 100);

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
    setResults(null);
    setError('');
  }

  async function handleCalculate() {
    setError('');
    setResults(null);
    setCalculating(true);
    try {
      const res = await fetch('/api/proxy/v1/salary/calculate-all-phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, old_pay: oldPay }),
      });
      if (res.ok) {
        const json = (await res.json()) as { data: { results: Salary2026Result[] } };
        setResults(json.data.results);
        return;
      }
      const local = calculateSalary2026AllPhases({ grade, old_pay: oldPay });
      setResults(local);
    } catch {
      try {
        setResults(calculateSalary2026AllPhases({ grade, old_pay: oldPay }));
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
          <p className="mx-auto mt-4 inline-block rounded-full bg-amber-300 px-4 py-1.5 text-sm font-extrabold text-amber-950 shadow-sm ring-2 ring-amber-100/80">
            Draft calculation. It may vary.
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
        <Alert className="salary-print-hide border-amber-200 bg-amber-50 text-amber-950 shadow-sm">
          <p className="text-sm leading-relaxed">
            <span className="rounded bg-amber-200 px-1.5 py-0.5 font-extrabold text-amber-950">
              Draft calculation. It may vary.
            </span>{' '}
            This is an indicative tool only — final pay is decided by Government orders.
          </p>
        </Alert>

        <Alert className="salary-print-rules border-emerald-200 bg-white text-emerald-950 shadow-sm">
          <ol className="list-decimal space-y-1.5 pl-4 text-sm leading-relaxed">
            <li>
              <strong>Stage-1 (01-07-2026):</strong> Step 5 = next stage after matched stage; Step 6
              rate <strong>40%</strong> (grades 1–9) / <strong>50%</strong> (grades 10–20).
            </li>
            <li>
              <strong>Stage-2 (01-01-2027):</strong> Same steps; Step 6 rate <strong>70%</strong>{' '}
              (grades 1–9) / <strong>75%</strong> (grades 10–20).
            </li>
            <li>
              <strong>Stage-3:</strong> 01-07-2026 basic = Step 5 amount; 01-07-2027 basic = next
              stage after that.
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

            {error ? (
              <Alert variant="error" className="print:hidden">
                {error}
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-2 print:hidden">
              <Button type="button" onClick={() => void handleCalculate()} disabled={calculating} className="gap-2">
                <Calculator className="h-4 w-4" />
                {calculating ? 'Calculating…' : 'Calculate all phases'}
              </Button>
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

        {results?.map((result, index) => (
          <PhaseResultCard
            key={result.phase}
            result={result}
            stageClass={
              index === 1 ? 'salary-print-stage-2' : index === 2 ? 'salary-print-stage-3' : undefined
            }
          />
        ))}

        {results ? (
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
