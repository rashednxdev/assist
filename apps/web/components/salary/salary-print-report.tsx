'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Download } from 'lucide-react';
import type { SalaryPrintDayDetail, SalaryPrintReport, SalaryUserPrintReport, SalaryUserPrintRow } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { localNum, salaryCopy, type SalaryLocale } from '@/lib/salary-i18n';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Bangladesh date `days` before today, as YYYY-MM-DD. */
function dhakaDate(daysAgo = 0): string {
  return new Date(Date.now() + DHAKA_OFFSET_MS - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

type PrintSort = 'total' | 'free' | 'approved';

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function variationLabel(current: number, previous: number): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (previous === 0 && current === 0) return { text: '0%', tone: 'flat' };
  if (previous === 0) return { text: 'New', tone: 'up' };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: '0%', tone: 'flat' };
  return { text: `${pct > 0 ? '+' : ''}${pct}%`, tone: pct > 0 ? 'up' : 'down' };
}

function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number>>) {
  const body = [header, ...rows].map((line) => line.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** All users who have printed, with today, yesterday, and the all-time total. */
export function SalaryUserPrintReportView({ path, locale }: { path: string; locale: SalaryLocale }) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const [report, setReport] = useState<SalaryUserPrintReport | null>(null);
  const [sort, setSort] = useState<PrintSort>('total');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ data: SalaryUserPrintReport }>(path);
      setReport(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.reportLoadError);
    } finally {
      setLoading(false);
    }
  }, [path, t.reportLoadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const showDate = (iso: string) => num(iso.split('-').reverse().join('-'));
  const rows = useMemo(() => {
    if (!report) return [];
    const list = [...report.rows];
    const key: keyof Pick<SalaryUserPrintRow, 'total' | 'free' | 'approved'> = sort;
    list.sort((a, b) => b[key] - a[key] || b.total - a.total || a.name.localeCompare(b.name));
    return list;
  }, [report, sort]);

  function download() {
    if (!report) return;
    downloadCsv(
      `salary-prints-${report.today}.csv`,
      ['User', 'Phone', 'Office', 'Today', 'Yesterday', 'Total', 'Free', 'Approved'],
      [
        ...rows.map((row) => [row.name, row.phone, row.office, row.today, row.yesterday, row.total, row.free, row.approved]),
        ['Total', '', '', report.today_total, report.yesterday_total, report.all_time, report.free_total, report.approved_total],
      ],
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{t.reportByUser}</p>
          <p className="text-xs text-muted">{t.reportByUserHint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['total', t.reportTotal],
              ['free', t.reportFree],
              ['approved', t.reportApproved],
            ] as const
          ).map(([id, label]) => (
            <Button key={id} type="button" size="sm" variant={sort === id ? 'default' : 'outline'} onClick={() => setSort(id)}>
              {label}
            </Button>
          ))}
          <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={!report || report.rows.length === 0} onClick={download}>
            <Download className="h-3.5 w-3.5" />
            {t.reportDownload}
          </Button>
        </div>
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {report ? (
        report.rows.length === 0 ? (
          <p className="text-sm text-muted">{t.reportPrintsNone}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2">{t.reportUser}</th>
                  <th className="px-3 py-2">{t.officeYour}</th>
                  <th className="px-3 py-2 text-right">
                    {t.reportToday}
                    <span className="block font-normal text-muted">{showDate(report.today)}</span>
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t.reportYesterday}
                    <span className="block font-normal text-muted">{showDate(report.yesterday)}</span>
                  </th>
                  <th className="px-3 py-2 text-right">{t.reportTotal}</th>
                  <th className="px-3 py-2 text-right">{t.reportFree}</th>
                  <th className="px-3 py-2 text-right">{t.reportApproved}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.user_id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <span className="block font-semibold text-slate-900">{row.name}</span>
                      {row.phone ? <span className="block text-xs text-muted">{row.phone}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{row.office || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(row.today)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(row.yesterday)}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{num(row.total)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(row.free)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(row.approved)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border bg-slate-50 font-bold">
                <tr>
                  <td className="px-3 py-2" colSpan={2}>
                    {t.reportTotal}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(report.today_total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(report.yesterday_total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(report.all_time)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(report.free_total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(report.approved_total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      ) : loading ? (
        <p className="text-sm text-muted">…</p>
      ) : null}
    </div>
  );
}

/** Date-wise download counts from `path` (`?from=&to=`); `showUsers` adds the users-per-day column. */
export function SalaryPrintReportView({
  path,
  locale,
  showUsers = false,
}: {
  path: string;
  locale: SalaryLocale;
  showUsers?: boolean;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const [from, setFrom] = useState(dhakaDate(29));
  const [to, setTo] = useState(dhakaDate());
  const [report, setReport] = useState<SalaryPrintReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, SalaryPrintDayDetail>>({});
  const [detailLoading, setDetailLoading] = useState('');
  const [detailError, setDetailError] = useState('');

  const load = useCallback(
    async (f: string, tt: string) => {
      setLoading(true);
      setError('');
      setOpenDate(null);
      setDetails({});
      setDetailError('');
      try {
        const params = new URLSearchParams({ from: f, to: tt });
        const res = await apiFetch<{ data: SalaryPrintReport }>(`${path}?${params.toString()}`);
        setReport(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t.reportLoadError);
      } finally {
        setLoading(false);
      }
    },
    [path, t.reportLoadError],
  );

  async function toggleDay(date: string) {
    if (!showUsers) return;
    if (openDate === date) {
      setOpenDate(null);
      return;
    }
    setOpenDate(date);
    setDetailError('');
    if (details[date]) return;
    setDetailLoading(date);
    try {
      const res = await apiFetch<{ data: SalaryPrintDayDetail }>(`${path}/day?date=${encodeURIComponent(date)}`);
      setDetails((prev) => ({ ...prev, [date]: res.data }));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : t.reportLoadError);
    } finally {
      setDetailLoading('');
    }
  }

  useEffect(() => {
    void load(dhakaDate(29), dhakaDate());
  }, [load]);

  const showPdf = Boolean(report?.days.some((d) => d.arrears_pdf > 0));
  const sum = (key: 'tr_form_13' | 'tr_form_15' | 'staff_tr_form_15' | 'arrears_pdf') =>
    report ? report.days.reduce((s, d) => s + d[key], 0) : 0;
  const showDate = (iso: string) => num(iso.split('-').reverse().join('-'));

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load(from, to);
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="report-from" className="text-xs font-bold">
            {t.reportFrom}
          </Label>
          <Input id="report-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="report-to" className="text-xs font-bold">
            {t.reportTo}
          </Label>
          <Input id="report-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Button type="submit" disabled={loading || !from || !to}>
          {loading ? '…' : t.reportShow}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          disabled={!report || report.days.length === 0}
          onClick={() => {
            if (!report) return;
            downloadCsv(
              `salary-prints-${report.from}-to-${report.to}.csv`,
              ['Date', 'Free', 'Other', 'T.R. Form 13', 'T.R. Form 15', 'Staff T.R. Form 15', 'Arrears PDF', 'Users', 'Total'],
              [
                ...report.days.map((d) => [
                  d.date,
                  d.free,
                  d.approved,
                  d.tr_form_13,
                  d.tr_form_15,
                  d.staff_tr_form_15,
                  d.arrears_pdf,
                  d.users,
                  d.total,
                ]),
                ['Total', report.free, report.approved, sum('tr_form_13'), sum('tr_form_15'), sum('staff_tr_form_15'), sum('arrears_pdf'), report.users, report.total],
              ],
            );
          }}
        >
          <Download className="h-3.5 w-3.5" />
          {t.reportDownload}
        </Button>
      </form>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                [t.reportTotal, report.total, report.previous_total, 'border-slate-200 bg-slate-50 text-slate-900'],
                [t.reportFree, report.free, report.previous_free, 'border-emerald-200 bg-emerald-50 text-emerald-900'],
                [t.reportOther, report.approved, report.previous_approved, 'border-amber-200 bg-amber-50 text-amber-950'],
              ] as const
            ).map(([label, current, previous, tone]) => {
              const change = variationLabel(current, previous);
              return (
                <div key={label} className={`rounded-xl border p-3 ${tone}`}>
                  <p className="text-xs font-semibold">
                    {label}
                    <span className="mt-0.5 block font-normal opacity-70">
                      {showDate(report.from)} – {showDate(report.to)}
                    </span>
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{num(current)}</p>
                  <p
                    className={`text-xs font-semibold tabular-nums ${
                      change.tone === 'up' ? 'text-emerald-700' : change.tone === 'down' ? 'text-rose-700' : 'text-slate-500'
                    }`}
                  >
                    {change.text} {t.reportVsPrevious}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted">
            {t.reportAllTime}: <span className="font-semibold tabular-nums text-slate-700">{num(report.all_time)}</span>
            {showUsers ? ` · ${t.reportUsers}: ${num(report.users)}` : ''}
            {showUsers ? ` · ${t.reportDayHint}` : ''}
          </p>

          {report.days.length === 0 ? (
            <p className="text-sm text-muted">{t.reportNone}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-3 py-2">{t.reportDate}</th>
                    <th className="px-3 py-2 text-right">{t.reportFree}</th>
                    <th className="px-3 py-2 text-right">{t.reportOther}</th>
                    {!showUsers ? <th className="px-3 py-2 text-right">{t.reportTr13}</th> : null}
                    {!showUsers ? <th className="px-3 py-2 text-right">{t.reportTr15}</th> : null}
                    {!showUsers ? <th className="px-3 py-2 text-right">{t.reportStaff}</th> : null}
                    {!showUsers && showPdf ? <th className="px-3 py-2 text-right">{t.reportPdf}</th> : null}
                    {showUsers ? <th className="px-3 py-2 text-right">{t.reportUsers}</th> : null}
                    <th className="px-3 py-2 text-right">{t.reportTotal}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.days.map((d) => {
                    const open = showUsers && openDate === d.date;
                    const detail = details[d.date];
                    return (
                      <Fragment key={d.date}>
                        <tr className={`border-t border-border ${showUsers ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
                          <td className="px-3 py-2 font-medium tabular-nums">
                            {showUsers ? (
                              <button type="button" className="inline-flex items-center gap-1" onClick={() => void toggleDay(d.date)}>
                                <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                                {showDate(d.date)}
                              </button>
                            ) : (
                              showDate(d.date)
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-800">{num(d.free)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{num(d.approved)}</td>
                          {!showUsers ? <td className="px-3 py-2 text-right tabular-nums">{num(d.tr_form_13)}</td> : null}
                          {!showUsers ? <td className="px-3 py-2 text-right tabular-nums">{num(d.tr_form_15)}</td> : null}
                          {!showUsers ? <td className="px-3 py-2 text-right tabular-nums">{num(d.staff_tr_form_15)}</td> : null}
                          {!showUsers && showPdf ? <td className="px-3 py-2 text-right tabular-nums">{num(d.arrears_pdf)}</td> : null}
                          {showUsers ? <td className="px-3 py-2 text-right tabular-nums">{num(d.users)}</td> : null}
                          <td className="px-3 py-2 text-right font-bold tabular-nums">{num(d.total)}</td>
                        </tr>
                        {open ? (
                          <tr key={`${d.date}-detail`} className="border-t border-border bg-slate-50/80">
                            <td colSpan={5} className="px-3 py-3">
                              {detailLoading === d.date ? (
                                <p className="text-xs text-muted">…</p>
                              ) : detailError && !detail ? (
                                <p className="text-xs text-destructive">{detailError}</p>
                              ) : !detail || detail.users.length === 0 ? (
                                <p className="text-xs text-muted">{t.reportDayEmpty}</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead className="text-left font-semibold text-slate-500">
                                    <tr>
                                      <th className="py-1 pr-2">{t.reportUser}</th>
                                      <th className="py-1 pr-2">{t.officeYour}</th>
                                      <th className="py-1 text-right">{t.reportFree}</th>
                                      <th className="py-1 text-right">{t.reportOther}</th>
                                      <th className="py-1 text-right">{t.reportTotal}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.users.map((user) => (
                                      <tr key={user.user_id} className="border-t border-slate-200">
                                        <td className="py-1.5 pr-2">
                                          <span className="block font-semibold text-slate-900">{user.name}</span>
                                          {user.phone ? <span className="block text-muted">{user.phone}</span> : null}
                                        </td>
                                        <td className="py-1.5 pr-2 text-slate-600">{user.office || '—'}</td>
                                        <td className="py-1.5 text-right tabular-nums text-emerald-800">{num(user.free)}</td>
                                        <td className="py-1.5 text-right tabular-nums">{num(user.approved)}</td>
                                        <td className="py-1.5 text-right font-bold tabular-nums">{num(user.total)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border bg-slate-50 font-bold">
                  <tr>
                    <td className="px-3 py-2">{t.reportTotal}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(report.free)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(report.approved)}</td>
                    {!showUsers ? <td className="px-3 py-2 text-right tabular-nums">{num(sum('tr_form_13'))}</td> : null}
                    {!showUsers ? <td className="px-3 py-2 text-right tabular-nums">{num(sum('tr_form_15'))}</td> : null}
                    {!showUsers ? <td className="px-3 py-2 text-right tabular-nums">{num(sum('staff_tr_form_15'))}</td> : null}
                    {!showUsers && showPdf ? <td className="px-3 py-2 text-right tabular-nums">{num(sum('arrears_pdf'))}</td> : null}
                    {showUsers ? <td className="px-3 py-2 text-right tabular-nums">{num(report.users)}</td> : null}
                    <td className="px-3 py-2 text-right tabular-nums">{num(report.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      ) : loading ? (
        <p className="text-sm text-muted">…</p>
      ) : null}
    </div>
  );
}
