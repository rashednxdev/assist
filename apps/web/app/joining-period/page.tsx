'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
import { joiningModeLabel, buildJoiningRulesLocalized } from '@/lib/joining-i18n';
import { CalcLocaleProvider } from '@/components/shared/calc-locale-provider';
import { LocaleSwitcher } from '@/components/shared/locale-switcher';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const TRAVEL_MODES: JoiningTravelMode[] = ['rail', 'sea', 'river', 'bus', 'road', 'air'];

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
  return (
    <CalcLocaleProvider>
      <JoiningPeriodInner />
    </CalcLocaleProvider>
  );
}

function JoiningPeriodInner() {
  const t = useTranslations('joining');
  const tc = useTranslations('common');
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
      setError(err instanceof Error ? err.message : t('calcFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <LocaleSwitcher />
            <Button asChild variant="outline" size="sm">
              <Link href="/pension">
                <Calculator className="h-4 w-4" />
                {t('pensionLink')}
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('instructions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted">
          <p>
            <strong className="text-foreground">{t('sameStationIntro')}</strong>
          </p>
          <p>
            <strong className="text-foreground">
              {t('changeResidenceIntro', { prep: JOINING_PREPARATION_DAYS })}
            </strong>
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {t('railRate', {
                miles: JOINING_TRAVEL_PER_DAY.rail.miles,
                km: JOINING_TRAVEL_PER_DAY.rail.km,
              })}
            </li>
            <li>
              {t('seaRate', {
                miles: JOINING_TRAVEL_PER_DAY.sea.miles,
                km: JOINING_TRAVEL_PER_DAY.sea.km,
              })}
            </li>
            <li>
              {t('riverRate', {
                miles: JOINING_TRAVEL_PER_DAY.river.miles,
                km: JOINING_TRAVEL_PER_DAY.river.km,
              })}
            </li>
            <li>
              {t('busRate', {
                miles: JOINING_TRAVEL_PER_DAY.bus.miles,
                km: JOINING_TRAVEL_PER_DAY.bus.km,
              })}
            </li>
            <li>
              {t('roadRate', {
                miles: JOINING_TRAVEL_PER_DAY.road.miles,
                km: JOINING_TRAVEL_PER_DAY.road.km,
              })}
            </li>
            <li>{t('fractionRule')}</li>
            <li>{t('approachRule', { km: JOINING_APPROACH_EXCLUDE_KM })}</li>
            <li>{t('airRule', { prep: JOINING_PREPARATION_DAYS })}</li>
            <li>{t('steamerRule')}</li>
            <li>{t('multiJourneyRule')}</li>
            <li>{t('maxRule', { max: JOINING_MAX_DAYS_INCLUDING_WEEKLY })}</li>
            <li>{t('handoverRule')}</li>
          </ul>
          <p>
            <strong className="text-foreground">{t('currentPractice')}</strong>
          </p>
        </CardContent>
      </Card>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('transferDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('residenceChange')}</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={residenceChange ? 'default' : 'outline'}
                onClick={() => setResidenceChange(true)}
              >
                {t('yesStation')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!residenceChange ? 'default' : 'outline'}
                onClick={() => setResidenceChange(false)}
              >
                {t('noSameStation')}
              </Button>
            </div>
          </div>

          {residenceChange ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="handover_date">{t('handoverDate')}</Label>
                  <Input
                    id="handover_date"
                    type="date"
                    value={handoverDate}
                    onChange={(e) => setHandoverDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="handover_time">{t('handoverTime')}</Label>
                  <select
                    id="handover_time"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={handoverTime}
                    onChange={(e) => setHandoverTime(e.target.value as JoiningHandoverTime)}
                  >
                    <option value="unspecified">{t('handoverUnspecified')}</option>
                    <option value="morning">{t('handoverMorning')}</option>
                    <option value="afternoon">{t('handoverAfternoon')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weekly_holiday">{t('weeklyHoliday')}</Label>
                  <select
                    id="weekly_holiday"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={weeklyHoliday}
                    onChange={(e) => setWeeklyHoliday(e.target.value as JoiningWeeklyHoliday)}
                  >
                    <option value="friday">{t('weeklyFriday')}</option>
                    <option value="friday_saturday">{t('weeklyFriSat')}</option>
                    <option value="sunday">{t('weeklySunday')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calc_method">{t('calcMethod')}</Label>
                  <select
                    id="calc_method"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={calcMethod}
                    onChange={(e) => setCalcMethod(e.target.value as JoiningCalcMethod)}
                  >
                    <option value="actual">{t('methodActual')}</option>
                    <option value="distance">{t('methodDistance')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hod_extension">{t('hodExtension')}</Label>
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
                <Label htmlFor="gov_holidays">{t('govHolidays')}</Label>
                <textarea
                  id="gov_holidays"
                  className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="2026-02-21&#10;2026-03-26"
                  value={govHolidaysText}
                  onChange={(e) => setGovHolidaysText(e.target.value)}
                />
                <p className="text-xs text-muted">{t('govHolidaysHint')}</p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {residenceChange ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">{t('journeys')}</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setJourneys((r) => [...r, emptyJourney()])}
            >
              <Plus className="h-4 w-4" />
              {t('addJourney')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {journeys.map((j, idx) => (
              <div key={j.key} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{t('journeyN', { n: idx + 1 })}</span>
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
                    <Label>{t('mode')}</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={j.mode}
                      onChange={(e) =>
                        updateJourney(j.key, { mode: e.target.value as JoiningTravelMode })
                      }
                    >
                      {TRAVEL_MODES.map((m) => (
                        <option key={m} value={m}>
                          {joiningModeLabel(t, m)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {calcMethod === 'distance' && j.mode !== 'air' ? (
                    <div className="space-y-2">
                      <Label>{t('distanceKm')}</Label>
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
                      <Label>{t('actualDays')}</Label>
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
                        <Label>{t('approachStart')}</Label>
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
                        <Label>{t('approachEnd')}</Label>
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
                      <Label>{t('steamerDelay')}</Label>
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
        {loading ? tc('calculating') : t('calculateBtn')}
      </Button>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('results')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {result.capped ? (
                <Badge variant="warning">
                  {t('capped', { max: JOINING_MAX_DAYS_INCLUDING_WEEKLY })}
                </Badge>
              ) : null}
              <Badge variant="secondary">
                {result.residence_change ? t('badgeResidence') : t('badgeSame')}
              </Badge>
              <Badge variant="secondary">
                {result.calc_method === 'actual' ? t('badgeActual') : t('badgeDistance')}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ResultStat
                label={t('allowedPeriod')}
                value={t('daysUnit', { n: result.allowed_calendar_days })}
                note={t('allowedNote')}
              />
              {result.residence_change ? (
                <>
                  <ResultStat
                    label={t('preparation')}
                    value={t('daysUnit', { n: result.preparation_days })}
                  />
                  <ResultStat
                    label={t('travel')}
                    value={t('daysUnit', { n: result.travel_days })}
                  />
                  <ResultStat
                    label={t('joiningCredit')}
                    value={t('daysUnit', { n: result.joining_period_days })}
                    note={t('joiningCreditNote')}
                  />
                  <ResultStat
                    label={t('weeklyInSpan')}
                    value={t('daysUnit', { n: result.weekly_holiday_days })}
                    note={t('weeklyNote')}
                  />
                  <ResultStat
                    label={t('govInSpan')}
                    value={t('daysUnit', { n: result.government_holiday_days_in_span })}
                  />
                </>
              ) : null}
            </div>

            {result.start_date && result.end_date ? (
              <p className="text-sm text-muted">
                {t('periodRange', { start: result.start_date, end: result.end_date })}
              </p>
            ) : null}

            {result.journeys.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">{t('journeyBreakdown')}</h3>
                <ul className="space-y-2">
                  {result.journeys.map((j, i) => (
                    <li key={i} className="rounded-lg border border-border p-3 text-sm">
                      <div className="font-medium">
                        {t('travelDays', {
                          mode: joiningModeLabel(t, j.mode),
                          days: j.travel_days,
                        })}
                        {j.steamer_delay_days > 0
                          ? ` ${t('steamerExtra', { days: j.steamer_delay_days })}`
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
              <h3 className="text-sm font-semibold">{t('rulesApplied')}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                {buildJoiningRulesLocalized(result, t).map((r) => (
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
