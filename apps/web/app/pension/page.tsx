'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, Plus, Trash2 } from 'lucide-react';
import { breakdownFromDays, formatPeriodLabel, type PensionCalculateResult } from '@ibas/shared-types';
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
  pay_category: 'average_salary' | 'half_average_salary' | 'without_pay' | 'rest';
  deduction_rule: 'leave_earning_only' | 'both' | 'none';
  is_auto_entitlement?: boolean;
}

interface EnjoyedRow {
  key: string;
  leave_type_id: string;
  days: string;
}

function PeriodCard({ title, period }: { title: string; period: { years: number; months: number; days: number } }) {
  return (
    <div className="rounded-lg border border-border bg-slate-50/80 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <div className="mt-1 text-lg font-semibold">{formatPeriodLabel(period)}</div>
    </div>
  );
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
  const manualLeaveTypes = leaveTypes.filter(
    (t) => !t.is_auto_entitlement && t.code !== 'REST' && t.pay_category !== 'rest',
  );
  const pensionAccountTypes = leaveTypes.filter(
    (t) => t.pay_category !== 'rest' && !t.is_auto_entitlement && t.code !== 'REST',
  );
  const autoLeaveTypes = leaveTypes.filter(
    (t) => t.pay_category === 'rest' || t.is_auto_entitlement || t.code === 'REST',
  );

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

  function addEnjoyedRow() {
    const defaultType = manualLeaveTypes[0];
    setEnjoyed((rows) => [
      ...rows,
      { key: crypto.randomUUID(), leave_type_id: defaultType?.id ?? '', days: '' },
    ]);
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
          enjoyed_leaves: enjoyed
            .filter((r) => r.leave_type_id && Number(r.days) > 0)
            .map((r) => ({ leave_type_id: r.leave_type_id, days: Number(r.days) })),
        }),
      });
      setResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setCalculating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pension leave account & lamp grant"
        description="Calculate government pension leave balances and lamp grant from service and enjoyed leave."
        action={
          isAdmin ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/setup/pension-leaves">
                <Settings className="h-4 w-4" />
                Leave type setup
              </Link>
            </Button>
          ) : null
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
                  Leave is of three account types: <em>on average salary</em>, <em>on half-average salary</em>,
                  and <em>without pay</em>, with sub-types under each.
                </li>
                <li>
                  When enjoyed, some leave is deducted from the <strong>leave-earning period only</strong> (still
                  counts as working), some from <strong>both</strong> leave-earning and working period, and some
                  from <strong>neither</strong>.
                </li>
                <li>
                  Join date is included. Service is counted in days; earned average-salary leave = days ÷ 11;
                  earned half-average leave = days ÷ 12.
                </li>
                <li>
                  Subtract enjoyed days from each account, show balances as years, months, and days (30 days =
                  1 month, 360 days = 1 year).
                </li>
                <li>
                  Total average-salary leave = remaining average leave + (remaining half-average leave ÷ 2).
                </li>
                <li>
                  <strong>REST leave</strong> is a <strong>separate benefit</strong> — not part of the average or
                  half-average pension leave account. It is calculated automatically from service (15 days every 3
                  years + one month&apos;s basic salary allowance per cycle). Do not add REST in the enjoyed-leave
                  list; that list is only for pension account leave types.
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

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Service & salary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="join_date">Date of joining service</Label>
              <Input
                id="join_date"
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
              />
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
            <CardTitle>Enjoyed leave</CardTitle>
            <Button type="button" size="sm" variant="outline" disabled={!manualLeaveTypes.length} onClick={addEnjoyedRow}>
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
                Add rows for other leave enjoyed during service. REST leave is calculated automatically from your
                service period — you do not add it here.
              </p>
            ) : (
              enjoyed.map((row, idx) => (
                <div key={row.key} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
                  <div className="min-w-[180px] flex-1 space-y-1">
                    <Label>Leave type</Label>
                    <select
                      className="ibas-select"
                      value={row.leave_type_id}
                      onChange={(e) =>
                        setEnjoyed((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, leave_type_id: e.target.value } : r)),
                        )
                      }
                    >
                      {manualLeaveTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28 space-y-1">
                    <Label>Days</Label>
                    <Input
                      type="number"
                      min={1}
                      value={row.days}
                      onChange={(e) =>
                        setEnjoyed((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, days: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEnjoyed((rows) => rows.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave type reference</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">Pension leave account (÷11 / ÷12)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {pensionAccountTypes.map((t) => (
                <div key={t.id} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">{t.name_en}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline">{PAY_CATEGORY_LABELS[t.pay_category]}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted">{DEDUCTION_RULE_LABELS[t.deduction_rule]}</p>
                </div>
              ))}
            </div>
          </div>
          {autoLeaveTypes.length > 0 ? (
            <div>
              <p className="mb-3 text-sm font-semibold text-foreground">Separate auto-calculated benefit</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {autoLeaveTypes.map((t) => (
                  <div key={t.id} className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                    <div className="font-medium">{t.name_en}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="secondary">Auto-calculated from service</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Not part of average or half-average pension leave account.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Button
        size="lg"
        disabled={calculating || !joinDate || !endDate || !lastBasic}
        onClick={() => void calculate()}
      >
        {calculating ? 'Calculating…' : 'Calculate leave account & lamp grant'}
      </Button>

      {result ? (() => {
        const autoLeaves = result.auto_leaves ?? [];
        const restLeave = autoLeaves.find((a) => a.code === 'REST') ?? autoLeaves[0];
        return (
        <div className="space-y-6">
          {restLeave ? (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle>REST leave (separate — auto-calculated)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted">
                  Based on service period only. Not reduced by entries in the enjoyed-leave list above.
                </p>
                <div className="rounded-lg border border-border p-4">
                  <div className="font-medium">{restLeave.name_en}</div>
                  <p className="mt-1 text-sm text-muted">
                    {restLeave.cycles > 0
                      ? `${restLeave.cycles} complete cycle${restLeave.cycles === 1 ? '' : 's'} of service (15 days every 3 years)`
                      : 'At least 3 full years of service are required for the first REST cycle.'}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <PeriodCard title="Entitled" period={breakdownFromDays(restLeave.entitled_days)} />
                    <PeriodCard title="Remaining" period={restLeave.remaining} />
                    <div className="rounded-lg border border-border bg-slate-50/80 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Allowance ({restLeave.cycles} × basic)
                      </div>
                      <div className="mt-1 text-lg font-semibold">
                        ৳ {restLeave.total_allowance.toLocaleString('en-BD', { minimumFractionDigits: 2 })}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        ৳ {restLeave.allowance_per_cycle.toLocaleString('en-BD', { minimumFractionDigits: 2 })} per
                        cycle
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

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
              <CardTitle>Pension leave account balances (÷11 / ÷12)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PeriodCard title="On average salary — remaining" period={result.average_salary_leave} />
              <PeriodCard title="On half-average salary — remaining" period={result.half_average_leave} />
              <PeriodCard title="Without pay — enjoyed" period={result.without_pay_leave} />
              <PeriodCard title="Total average-salary equivalent" period={result.total_average_salary_leave} />
            </CardContent>
            <CardContent className="border-t pt-4 text-sm text-muted">
              <p>
                Earned before deductions: {result.average_salary_leave_earned_days.toFixed(2)} days (÷11) and{' '}
                {result.half_average_leave_earned_days.toFixed(2)} days (÷12).
              </p>
              {((result.enjoyed_average_salary_days ?? 0) > 0 ||
                (result.enjoyed_half_average_days ?? 0) > 0 ||
                (result.enjoyed_without_pay_days ?? 0) > 0) && (
                <p className="mt-2 font-medium text-foreground">
                  Enjoyed leave deducted from pension account:{' '}
                  {(result.enjoyed_average_salary_days ?? 0) > 0
                    ? `${result.enjoyed_average_salary_days} days on average salary`
                    : null}
                  {(result.enjoyed_average_salary_days ?? 0) > 0 && (result.enjoyed_half_average_days ?? 0) > 0
                    ? '; '
                    : null}
                  {(result.enjoyed_half_average_days ?? 0) > 0
                    ? `${result.enjoyed_half_average_days} days on half-average salary`
                    : null}
                  {((result.enjoyed_average_salary_days ?? 0) > 0 || (result.enjoyed_half_average_days ?? 0) > 0) &&
                  (result.enjoyed_without_pay_days ?? 0) > 0
                    ? '; '
                    : null}
                  {(result.enjoyed_without_pay_days ?? 0) > 0
                    ? `${result.enjoyed_without_pay_days} days without pay`
                    : null}
                </p>
              )}
              <p className="mt-1">
                Total average-salary equivalent: {result.average_salary_leave_months.toFixed(2)} months.
              </p>
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
        );
      })() : null}
    </div>
  );
}
