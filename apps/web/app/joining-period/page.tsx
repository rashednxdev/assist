'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Calculator } from 'lucide-react';
import {
  calculateJoiningPeriod,
  type JoiningPeriodResult,
} from '@ibas/shared-types';
import {
  JOINING_APPROACH_EXCLUDE_KM,
  JOINING_MAX_DAYS_INCLUDING_WEEKLY,
  JOINING_PREPARATION_DAYS,
  JOINING_TRAVEL_PER_DAY,
  type JoiningCalcMethod,
  type JoiningHandoverTime,
  type JoiningTravelMode,
  type JoiningWeeklyHoliday,
} from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface JourneyRow {
  key: string;
  mode: JoiningTravelMode;
  distance_km: string;
  actual_journey_days: string;
  approach_start_km: string;
  approach_end_km: string;
  steamer_delay_days: string;
}

function emptyJourney(): JourneyRow {
  return {
    key: crypto.randomUUID(),
    mode: 'road',
    distance_km: '',
    actual_journey_days: '',
    approach_start_km: '',
    approach_end_km: '',
    steamer_delay_days: '',
  };
}

const MODE_LABELS: Record<JoiningTravelMode, string> = {
  rail: 'Rail',
  sea: 'Sea / steamer',
  river: 'River',
  bus: 'Bus',
  road: 'Road / other',
  air: 'Air',
};

function ResultStat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-slate-50/80 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

export default function JoiningPeriodPage() {
  const [residenceChange, setResidenceChange] = useState(true);
  const [handoverDate, setHandoverDate] = useState('');
  const [handoverTime, setHandoverTime] = useState<JoiningHandoverTime>('unspecified');
  const [weeklyHoliday, setWeeklyHoliday] = useState<JoiningWeeklyHoliday>('friday');
  const [calcMethod, setCalcMethod] = useState<JoiningCalcMethod>('actual');
  const [journeys, setJourneys] = useState<JourneyRow[]>([emptyJourney()]);
  const [govHolidaysText, setGovHolidaysText] = useState('');
  const [hodExtension, setHodExtension] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<JoiningPeriodResult | null>(null);

  function updateJourney(key: string, patch: Partial<JourneyRow>) {
    setJourneys((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function handleCalculate() {
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const government_holiday_dates = govHolidaysText
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const body = {
        residence_change: residenceChange,
        handover_date: handoverDate.trim() || undefined,
        handover_time: handoverTime,
        weekly_holiday: weeklyHoliday,
        calc_method: calcMethod,
        hod_extension_days: Number(hodExtension) > 0 ? Number(hodExtension) : 0,
        government_holiday_dates,
        journeys: residenceChange
          ? journeys.map((j) => ({
              mode: j.mode,
              distance_km: j.distance_km.trim() ? Number(j.distance_km) : undefined,
              actual_journey_days: j.actual_journey_days.trim()
                ? Number(j.actual_journey_days)
                : undefined,
              approach_start_km: j.approach_start_km.trim()
                ? Number(j.approach_start_km)
                : undefined,
              approach_end_km: j.approach_end_km.trim() ? Number(j.approach_end_km) : undefined,
              steamer_delay_days: j.steamer_delay_days.trim()
                ? Number(j.steamer_delay_days)
                : undefined,
            }))
          : [],
      };

      try {
        const res = await apiFetch<{ data: JoiningPeriodResult }>('/joining-period/calculate', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setResult(res.data);
      } catch {
        // Offline / API unavailable — still compute locally from shared package
        setResult(calculateJoiningPeriod(body));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Joining period calculator"
        description="Calculate joining time (যোগদানকাল) for transfer or posting under Bangladesh service rules."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/pension">
              <Calculator className="h-4 w-4" />
              Pension calculator
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted">
          <p>
            <strong className="text-foreground">Same station</strong> (no change of residence): only{' '}
            <strong className="text-foreground">1 day</strong> of joining period (leave is counted in
            that day).
          </p>
          <p>
            <strong className="text-foreground">Change of residence</strong>: preparation{' '}
            {JOINING_PREPARATION_DAYS} days (weekly holidays excluded from the{' '}
            {JOINING_PREPARATION_DAYS}; government/optional holidays count) + travel days.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Rail: {JOINING_TRAVEL_PER_DAY.rail.miles} miles / {JOINING_TRAVEL_PER_DAY.rail.km} km per
              day
            </li>
            <li>
              Sea: {JOINING_TRAVEL_PER_DAY.sea.miles} miles / {JOINING_TRAVEL_PER_DAY.sea.km} km per day
            </li>
            <li>
              River: {JOINING_TRAVEL_PER_DAY.river.miles} miles / {JOINING_TRAVEL_PER_DAY.river.km} km
              per day
            </li>
            <li>
              Bus: {JOINING_TRAVEL_PER_DAY.bus.miles} miles / {JOINING_TRAVEL_PER_DAY.bus.km} km per
              day
            </li>
            <li>
              Road: {JOINING_TRAVEL_PER_DAY.road.miles} miles / {JOINING_TRAVEL_PER_DAY.road.km} km per
              day
            </li>
            <li>Any fraction of a travel day counts as a full day</li>
            <li>
              Approach ≤ {JOINING_APPROACH_EXCLUDE_KM} km (5 miles) to/from station or ghat is not
              counted
            </li>
            <li>Air: {JOINING_PREPARATION_DAYS} days preparation + actual journey time</li>
            <li>Steamer delay for unavoidable reasons counts as preparation</li>
            <li>Multiple similar journeys are added together</li>
            <li>
              Maximum {JOINING_MAX_DAYS_INCLUDING_WEEKLY} days including weekly holidays; HoD may
              extend for unavoidable delay within that cap
            </li>
            <li>
              If handover time is not mentioned as morning/afternoon, morning is assumed
            </li>
          </ul>
          <p>
            <strong className="text-foreground">Current practice:</strong> travel is usually taken
            from actual journey time instead of the legacy distance formula.
          </p>
        </CardContent>
      </Card>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transfer details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Change of residence required?</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={residenceChange ? 'default' : 'outline'}
                onClick={() => setResidenceChange(true)}
              >
                Yes — station to station
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!residenceChange ? 'default' : 'outline'}
                onClick={() => setResidenceChange(false)}
              >
                No — same station
              </Button>
            </div>
          </div>

          {residenceChange ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="handover_date">Handover / charge date</Label>
                  <Input
                    id="handover_date"
                    type="date"
                    value={handoverDate}
                    onChange={(e) => setHandoverDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="handover_time">Handover time</Label>
                  <select
                    id="handover_time"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={handoverTime}
                    onChange={(e) => setHandoverTime(e.target.value as JoiningHandoverTime)}
                  >
                    <option value="unspecified">Not mentioned (assume morning)</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weekly_holiday">Weekly holiday</Label>
                  <select
                    id="weekly_holiday"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={weeklyHoliday}
                    onChange={(e) => setWeeklyHoliday(e.target.value as JoiningWeeklyHoliday)}
                  >
                    <option value="friday">Friday</option>
                    <option value="friday_saturday">Friday + Saturday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calc_method">Travel calculation</Label>
                  <select
                    id="calc_method"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={calcMethod}
                    onChange={(e) => setCalcMethod(e.target.value as JoiningCalcMethod)}
                  >
                    <option value="actual">Actual journey time (current practice)</option>
                    <option value="distance">Distance formula (legacy)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hod_extension">HoD extension (days)</Label>
                  <Input
                    id="hod_extension"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={hodExtension}
                    onChange={(e) => setHodExtension(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gov_holidays">
                  Government / optional holidays (YYYY-MM-DD, comma or new line)
                </Label>
                <textarea
                  id="gov_holidays"
                  className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="2026-02-21&#10;2026-03-26"
                  value={govHolidaysText}
                  onChange={(e) => setGovHolidaysText(e.target.value)}
                />
                <p className="text-xs text-muted">
                  These dates count within the joining period (unlike weekly holidays).
                </p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {residenceChange ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Journeys</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={() => setJourneys((r) => [...r, emptyJourney()])}>
              <Plus className="h-4 w-4" />
              Add journey
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {journeys.map((j, idx) => (
              <div key={j.key} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Journey {idx + 1}</span>
                  {journeys.length > 1 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setJourneys((rows) => rows.filter((r) => r.key !== j.key))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Mode</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={j.mode}
                      onChange={(e) =>
                        updateJourney(j.key, { mode: e.target.value as JoiningTravelMode })
                      }
                    >
                      {(Object.keys(MODE_LABELS) as JoiningTravelMode[]).map((m) => (
                        <option key={m} value={m}>
                          {MODE_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {calcMethod === 'distance' && j.mode !== 'air' ? (
                    <div className="space-y-2">
                      <Label>Distance (km)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={j.distance_km}
                        onChange={(e) => updateJourney(j.key, { distance_km: e.target.value })}
                      />
                    </div>
                  ) : null}
                  {calcMethod === 'actual' || j.mode === 'air' ? (
                    <div className="space-y-2">
                      <Label>Actual journey days</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.5"
                        value={j.actual_journey_days}
                        onChange={(e) =>
                          updateJourney(j.key, { actual_journey_days: e.target.value })
                        }
                      />
                    </div>
                  ) : null}
                  {calcMethod === 'distance' && j.mode === 'road' ? (
                    <>
                      <div className="space-y-2">
                        <Label>Approach start (km)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={j.approach_start_km}
                          onChange={(e) =>
                            updateJourney(j.key, { approach_start_km: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Approach end (km)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={j.approach_end_km}
                          onChange={(e) => updateJourney(j.key, { approach_end_km: e.target.value })}
                        />
                      </div>
                    </>
                  ) : null}
                  {j.mode === 'sea' || j.mode === 'river' ? (
                    <div className="space-y-2">
                      <Label>Steamer delay (days)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={j.steamer_delay_days}
                        onChange={(e) =>
                          updateJourney(j.key, { steamer_delay_days: e.target.value })
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Button type="button" onClick={() => void handleCalculate()} disabled={loading}>
        {loading ? 'Calculating…' : 'Calculate joining period'}
      </Button>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {result.capped ? <Badge variant="warning">Capped at {JOINING_MAX_DAYS_INCLUDING_WEEKLY} days</Badge> : null}
              <Badge variant="secondary">
                {result.residence_change ? 'Residence change' : 'Same station'}
              </Badge>
              <Badge variant="secondary">
                {result.calc_method === 'actual' ? 'Actual journey' : 'Distance formula'}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ResultStat
                label="Allowed joining period"
                value={`${result.allowed_calendar_days} day(s)`}
                note="Calendar span including weekly holidays (max 30)"
              />
              {result.residence_change ? (
                <>
                  <ResultStat label="Preparation" value={`${result.preparation_days} day(s)`} />
                  <ResultStat label="Travel" value={`${result.travel_days} day(s)`} />
                  <ResultStat
                    label="Joining credit"
                    value={`${result.joining_period_days} day(s)`}
                    note="Prep + travel + delays + HoD extension"
                  />
                  <ResultStat
                    label="Weekly holidays in span"
                    value={`${result.weekly_holiday_days} day(s)`}
                    note="Additional — not counted in joining credit"
                  />
                  <ResultStat
                    label="Gov. holidays in span"
                    value={`${result.government_holiday_days_in_span} day(s)`}
                  />
                </>
              ) : null}
            </div>

            {result.start_date && result.end_date ? (
              <p className="text-sm text-muted">
                Period: <strong className="text-foreground">{result.start_date}</strong> →{' '}
                <strong className="text-foreground">{result.end_date}</strong>
              </p>
            ) : null}

            {result.journeys.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Journey breakdown</h3>
                <ul className="space-y-2">
                  {result.journeys.map((j, i) => (
                    <li key={i} className="rounded-lg border border-border p-3 text-sm">
                      <div className="font-medium">
                        {MODE_LABELS[j.mode]} — {j.travel_days} travel day(s)
                        {j.steamer_delay_days > 0
                          ? ` + ${j.steamer_delay_days} steamer delay`
                          : ''}
                      </div>
                      {j.notes.map((n) => (
                        <p key={n} className="text-xs text-muted">
                          {n}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Rules applied</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                {result.rules_applied.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
