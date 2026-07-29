import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  JOINING_MAX_DAYS_INCLUDING_WEEKLY,
  JOINING_PREPARATION_DAYS,
  type JoiningCalcMethod,
  type JoiningHandoverTime,
  type JoiningTravelMode,
  type JoiningWeeklyHoliday,
} from '@ibas/shared-constants';
import type { JoiningPeriodResult } from '@ibas/shared-types';
import { MathRow } from '@/components/calc/MathRow';
import { PeriodCard } from '@/components/calc/PeriodCard';
import { SectionCard } from '@/components/calc/SectionCard';
import { ChipGroup } from '@/components/calc/ChipGroup';
import { LocaleToggle } from '@/components/calc/LocaleToggle';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { TextField } from '@/components/ui/TextField';
import { type CalcLocale, joiningCopy } from '@/lib/calc-i18n';
import { toBanglaDigits } from '@/lib/bangla-format';
import { formatDdMmYyyy } from '@/lib/date-format';
import { calculateJoiningPeriodApi } from '@/lib/joining-api';
import { KeyboardScrollProvider, useKeyboardScroll } from '@/lib/keyboard-scroll';
import { colors, spacing } from '@/theme';

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
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    mode: 'road',
    distance_km: '',
    actual_journey_days: '',
    approach_start_km: '',
    approach_end_km: '',
    steamer_delay_days: '',
  };
}

const MODES: JoiningTravelMode[] = ['rail', 'sea', 'river', 'bus', 'road', 'air'];

function d(locale: CalcLocale, n: number | string) {
  return locale === 'bn' ? toBanglaDigits(n) : String(n);
}

function displayDate(locale: CalcLocale, iso: string) {
  const formatted = formatDdMmYyyy(iso);
  return locale === 'bn' ? toBanglaDigits(formatted) : formatted;
}

export default function JoiningPeriodMobileScreen() {
  return (
    <KeyboardScrollProvider>
      <JoiningPeriodMobileScreenInner />
    </KeyboardScrollProvider>
  );
}

function JoiningPeriodMobileScreenInner() {
  const keyboardScroll = useKeyboardScroll();
  const [locale, setLocale] = useState<CalcLocale>('en');
  const t = joiningCopy(locale);
  const [residenceChange, setResidenceChange] = useState(true);
  const [handoverDate, setHandoverDate] = useState('');
  const [handoverTime, setHandoverTime] = useState<JoiningHandoverTime>('unspecified');
  const [weeklyHoliday, setWeeklyHoliday] = useState<JoiningWeeklyHoliday>('friday');
  const [calcMethod, setCalcMethod] = useState<JoiningCalcMethod>('actual');
  const [hodExtension, setHodExtension] = useState('');
  const [journeys, setJourneys] = useState<JourneyRow[]>([emptyJourney()]);
  const [result, setResult] = useState<JoiningPeriodResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function updateJourney(key: string, patch: Partial<JourneyRow>) {
    setJourneys((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function handleCalculate() {
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const data = await calculateJoiningPeriodApi({
        residence_change: residenceChange,
        handover_date: handoverDate.trim() || undefined,
        handover_time: handoverTime,
        weekly_holiday: weeklyHoliday,
        calc_method: calcMethod,
        hod_extension_days: Number(hodExtension) > 0 ? Number(hodExtension) : 0,
        government_holiday_dates: [],
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
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorCalc);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      ref={keyboardScroll?.scrollRef}
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + (keyboardScroll?.keyboardInset ?? 0) }]}
      onScroll={keyboardScroll?.onScroll}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <View style={styles.topText}>
          <Text style={styles.heading}>{t.title}</Text>
          <Text style={styles.subheading}>{t.subtitle}</Text>
        </View>
        <LocaleToggle value={locale} onChange={setLocale} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SectionCard title={t.transfer}>
        <Text style={styles.fieldLabel}>{t.residence}</Text>
        <ChipGroup
          value={residenceChange ? 'yes' : 'no'}
          onChange={(v) => setResidenceChange(v === 'yes')}
          options={[
            { value: 'yes', label: t.yesStation },
            { value: 'no', label: t.noSame },
          ]}
        />

        {!residenceChange ? <Text style={styles.hint}>{t.sameStationNote}</Text> : null}

        {residenceChange ? (
          <>
            <DateField
              label={t.handoverDate}
              value={handoverDate}
              onChange={setHandoverDate}
            />

            <Text style={styles.fieldLabel}>{t.handoverTime}</Text>
            <ChipGroup
              value={handoverTime}
              onChange={setHandoverTime}
              options={[
                { value: 'unspecified', label: t.unspecified },
                { value: 'morning', label: t.morning },
                { value: 'afternoon', label: t.afternoon },
              ]}
            />

            <Text style={styles.fieldLabel}>{t.weekly}</Text>
            <ChipGroup
              value={weeklyHoliday}
              onChange={setWeeklyHoliday}
              options={[
                { value: 'friday', label: t.friday },
                { value: 'friday_saturday', label: t.friSat },
                { value: 'sunday', label: t.sunday },
              ]}
            />

            <Text style={styles.fieldLabel}>{t.method}</Text>
            <ChipGroup
              value={calcMethod}
              onChange={setCalcMethod}
              options={[
                { value: 'actual', label: t.actual },
                { value: 'distance', label: t.distance },
              ]}
            />

            <TextField
              label={t.hod}
              value={hodExtension}
              onChangeText={setHodExtension}
              keyboardType="numeric"
              placeholder="0"
            />
          </>
        ) : null}
      </SectionCard>

      {residenceChange ? (
        <SectionCard
          title={t.journeys}
          headerRight={
            <Pressable
              style={styles.addBtn}
              onPress={() => setJourneys((rows) => [...rows, emptyJourney()])}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.addBtnText}>{t.addJourney}</Text>
            </Pressable>
          }
        >
          {journeys.map((j, idx) => (
            <View key={j.key} style={styles.journeyCard}>
              <View style={styles.journeyHeader}>
                <Text style={styles.journeyTitle}>
                  {t.journeyN} {d(locale, idx + 1)}
                </Text>
                {journeys.length > 1 ? (
                  <Pressable onPress={() => setJourneys((rows) => rows.filter((r) => r.key !== j.key))}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.fieldLabel}>{t.mode}</Text>
              <ChipGroup
                value={j.mode}
                onChange={(mode) => updateJourney(j.key, { mode })}
                options={MODES.map((m) => ({ value: m, label: t.modes[m] ?? m }))}
              />

              {calcMethod === 'distance' && j.mode !== 'air' ? (
                <Field
                  label={t.distanceKm}
                  value={j.distance_km}
                  onChange={(v) => updateJourney(j.key, { distance_km: v })}
                />
              ) : null}

              {calcMethod === 'actual' || j.mode === 'air' ? (
                <Field
                  label={t.actualDays}
                  value={j.actual_journey_days}
                  onChange={(v) => updateJourney(j.key, { actual_journey_days: v })}
                />
              ) : null}

              {calcMethod === 'distance' && j.mode === 'road' ? (
                <View style={styles.dateRow}>
                  <View style={styles.flex}>
                    <Field
                      label={t.approachStart}
                      value={j.approach_start_km}
                      onChange={(v) => updateJourney(j.key, { approach_start_km: v })}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Field
                      label={t.approachEnd}
                      value={j.approach_end_km}
                      onChange={(v) => updateJourney(j.key, { approach_end_km: v })}
                    />
                  </View>
                </View>
              ) : null}

              {j.mode === 'sea' || j.mode === 'river' ? (
                <Field
                  label={t.steamer}
                  value={j.steamer_delay_days}
                  onChange={(v) => updateJourney(j.key, { steamer_delay_days: v })}
                />
              ) : null}
            </View>
          ))}
        </SectionCard>
      ) : null}

      <Button
        title={loading ? t.calculating : t.calculate}
        loading={loading}
        onPress={() => void handleCalculate()}
      />

      {result ? (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>{t.results}</Text>

          {result.capped ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {t.capped.replace('30', d(locale, JOINING_MAX_DAYS_INCLUDING_WEEKLY))}
              </Text>
            </View>
          ) : null}

          <View style={styles.periodRow}>
            <PeriodCard
              title={t.allowed}
              value={`${d(locale, result.allowed_calendar_days)} ${locale === 'bn' ? 'দিন' : 'days'}`}
            />
            {result.start_date && result.end_date ? (
              <PeriodCard
                title={t.period}
                value={`${displayDate(locale, result.start_date)} → ${displayDate(locale, result.end_date)}`}
              />
            ) : null}
          </View>

          <SectionCard title={t.mathTitle}>
            <View style={styles.mathBlock}>
              {!result.residence_change ? (
                <MathRow
                  label={t.allowed}
                  emphasize
                  operator="="
                  value={`${d(locale, 1)} ${locale === 'bn' ? 'দিন' : 'day'}`}
                  note={t.sameStationNote}
                />
              ) : (
                <>
                  <MathRow
                    label={t.preparation}
                    note={`${locale === 'bn' ? 'মূল' : 'base'} ${d(locale, JOINING_PREPARATION_DAYS)}`}
                    value={`${d(locale, result.preparation_days)}`}
                  />
                  <MathRow label={t.travel} operator="+" value={`${d(locale, result.travel_days)}`} />
                  {result.steamer_delay_days > 0 ? (
                    <MathRow
                      label={t.steamerDelay}
                      operator="+"
                      value={`${d(locale, result.steamer_delay_days)}`}
                    />
                  ) : null}
                  {result.hod_extension_days > 0 ? (
                    <MathRow
                      label={t.extension}
                      operator="+"
                      value={`${d(locale, result.hod_extension_days)}`}
                    />
                  ) : null}
                  <MathRow
                    label={t.credit}
                    emphasize
                    operator="="
                    value={`${d(locale, result.joining_period_days)}`}
                  />
                  <MathRow
                    label={t.weeklyDays}
                    operator="+"
                    value={`${d(locale, result.weekly_holiday_days)}`}
                    note={locale === 'bn' ? 'ক্রেডিটে গণ্য নয়' : 'not in credit'}
                  />
                  {result.government_holiday_days_in_span > 0 ? (
                    <MathRow
                      label={t.govDays}
                      value={`${d(locale, result.government_holiday_days_in_span)}`}
                    />
                  ) : null}
                  <MathRow
                    label={t.calendar}
                    value={`${d(locale, result.calendar_days)}`}
                  />
                  <MathRow
                    label={t.allowed}
                    emphasize
                    operator="="
                    value={`${d(locale, result.allowed_calendar_days)} ${locale === 'bn' ? 'দিন' : 'days'}`}
                  />
                </>
              )}
            </View>
          </SectionCard>

          {result.journeys.length > 0 ? (
            <SectionCard title={t.journeys}>
              {result.journeys.map((j, i) => (
                <View key={`${j.mode}-${i}`} style={styles.journeyResult}>
                  <Text style={styles.journeyResultTitle}>
                    {t.modes[j.mode] ?? j.mode} — {d(locale, j.travel_days)}{' '}
                    {locale === 'bn' ? 'দিন' : 'days'}
                  </Text>
                  {j.notes.slice(0, 2).map((n) => (
                    <Text key={n} style={styles.hint}>
                      {n}
                    </Text>
                  ))}
                </View>
              ))}
            </SectionCard>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  topText: { flex: 1, gap: 2 },
  heading: { fontSize: 22, fontWeight: '800', color: colors.text },
  subheading: { fontSize: 13, color: colors.textMuted },
  error: { color: colors.error, fontSize: 14 },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 4 },
  fieldWrap: { gap: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  journeyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  journeyTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  results: { gap: spacing.md },
  resultsTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.warning },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mathBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: '#eef6fb',
  },
  journeyResult: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: 4,
  },
  journeyResultTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
});
