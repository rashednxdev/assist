import { useCallback, useEffect, useMemo, useState } from 'react';
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
  breakdownFromDays,
  calculateBoyServiceDays,
  calculatePensionGratuity,
  calculateQualifyingPensionService,
  daysBetweenInclusive,
  formatPeriodLabel,
  isMaternityLeaveCode,
  isSuspensionLeaveCode,
  maternityDaysFromStartDate,
  roundHalfUp,
  type PensionCalculateResult,
  type PensionGratuityResult,
  type QualifyingPensionServiceResult,
} from '@ibas/shared-types';
import { PENSION_LAMP_GRANT_MONTHS } from '@ibas/shared-constants';
import { MathRow } from '@/components/calc/MathRow';
import { PeriodCard } from '@/components/calc/PeriodCard';
import { SectionCard } from '@/components/calc/SectionCard';
import { ChipGroup } from '@/components/calc/ChipGroup';
import { LocaleToggle } from '@/components/calc/LocaleToggle';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { TextField } from '@/components/ui/TextField';
import { type CalcLocale, pensionCopy } from '@/lib/calc-i18n';
import { toBanglaDigits } from '@/lib/bangla-format';
import {
  calculatePensionApi,
  fetchPensionLeaveTypes,
  type PensionLeaveTypeRow,
} from '@/lib/pension-api';
import { colors, spacing } from '@/theme';

type InputMode = 'days' | 'dates';

interface EnjoyedRow {
  key: string;
  leave_type_id: string;
  input_mode: InputMode;
  days: string;
  from_date: string;
  to_date: string;
  /** SUSPENSION rows only: regularized as duty by order -> not excluded, contributes 0. */
  regularized?: boolean;
}

function emptyRow(leaveTypeId = ''): EnjoyedRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    leave_type_id: leaveTypeId,
    input_mode: 'days',
    days: '',
    from_date: '',
    to_date: '',
    regularized: false,
  };
}

function resolveDays(row: EnjoyedRow, types: PensionLeaveTypeRow[]): number {
  const type = types.find((t) => t.id === row.leave_type_id);
  if (isSuspensionLeaveCode(type?.code) && row.regularized) return 0;
  if (isMaternityLeaveCode(type?.code)) {
    return maternityDaysFromStartDate(row.from_date);
  }
  if (row.input_mode === 'dates') {
    if (!row.from_date || !row.to_date) return 0;
    return daysBetweenInclusive(row.from_date, row.to_date);
  }
  const n = Number(row.days);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function typeName(locale: CalcLocale, t: PensionLeaveTypeRow) {
  if (locale === 'bn' && t.name_bn?.trim()) return t.name_bn.trim();
  return t.name_en;
}

function fmtDays(locale: CalcLocale, days: number) {
  const rounded = roundHalfUp(days);
  const period = formatPeriodLabel(breakdownFromDays(rounded), locale);
  const label = locale === 'bn' ? `${rounded}দি (${period})` : `${rounded}d (${period})`;
  return locale === 'bn' ? toBanglaDigits(label) : label;
}

function fmtPeriod(locale: CalcLocale, p: { years: number; months: number; days: number; total_days: number }) {
  const label = formatPeriodLabel(p, locale);
  return locale === 'bn' ? toBanglaDigits(label) : label;
}

function fmtMoney(locale: CalcLocale, amount: number) {
  const label = amount.toLocaleString('en-BD', { minimumFractionDigits: 2 });
  return `৳ ${locale === 'bn' ? toBanglaDigits(label) : label}`;
}

export default function PensionMobileScreen() {
  const [locale, setLocale] = useState<CalcLocale>('en');
  const t = pensionCopy(locale);
  const [leaveTypes, setLeaveTypes] = useState<PensionLeaveTypeRow[]>([]);
  const [joinDate, setJoinDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastBasic, setLastBasic] = useState('');
  const [dob, setDob] = useState('');
  const [contractualDays, setContractualDays] = useState('');
  const [enjoyed, setEnjoyed] = useState<EnjoyedRow[]>([]);
  const [result, setResult] = useState<PensionCalculateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  useEffect(() => {
    fetchPensionLeaveTypes()
      .then((data) => {
        setLeaveTypes(data);
        if (data[0]) setEnjoyed([emptyRow(data[0].id)]);
      })
      .catch(() => setError(t.errorLoad))
      .finally(() => setLoading(false));
  }, []);

  const updateRow = useCallback((key: string, patch: Partial<EnjoyedRow>) => {
    setEnjoyed((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  async function handleCalculate() {
    setError('');
    setCalculating(true);
    setResult(null);
    try {
      const basic = Number(lastBasic);
      if (!joinDate || !endDate || !Number.isFinite(basic) || basic <= 0) {
        throw new Error(t.errorCalc);
      }
      const enjoyed_leaves = enjoyed
        .map((r) => ({ leave_type_id: r.leave_type_id, days: resolveDays(r, leaveTypes) }))
        .filter((r) => r.leave_type_id && r.days > 0);

      const data = await calculatePensionApi({
        join_date: joinDate.trim(),
        end_date: endDate.trim(),
        last_basic_salary: basic,
        enjoyed_leaves,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorCalc);
    } finally {
      setCalculating(false);
    }
  }

  const canCalculate = Boolean(joinDate && endDate && lastBasic) && !calculating;

  const halfConverted = useMemo(() => {
    if (!result) return 0;
    return roundHalfUp(result.half_average_leave.total_days / 2);
  }, [result]);

  const boyServiceDays = calculateBoyServiceDays(dob, joinDate, endDate);
  const suspensionDaysTotal = enjoyed
    .filter((r) => isSuspensionLeaveCode(leaveTypes.find((lt) => lt.id === r.leave_type_id)?.code))
    .reduce((sum, r) => sum + resolveDays(r, leaveTypes), 0);
  const qualifyingService: QualifyingPensionServiceResult | null =
    result && joinDate && endDate
      ? calculateQualifyingPensionService(joinDate, endDate, {
          leave_without_pay_days: result.enjoyed_without_pay_days,
          suspension_days: suspensionDaysTotal,
          boy_service_days: boyServiceDays,
          contractual_part_time_days: Number(contractualDays) || 0,
        })
      : null;
  const gratuityResult: PensionGratuityResult | null =
    qualifyingService && Number(lastBasic) > 0
      ? calculatePensionGratuity({
          qualifying_years: qualifyingService.qualifying_service_years,
          last_basic_salary: Number(lastBasic),
        })
      : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <View style={styles.topText}>
          <Text style={styles.heading}>{t.title}</Text>
          <Text style={styles.subheading}>{t.subtitle}</Text>
        </View>
        <LocaleToggle value={locale} onChange={setLocale} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SectionCard title={t.service}>
        <DateField label={t.dob} value={dob} onChange={setDob} />
        {dob && joinDate ? (
          <Text style={styles.muted}>
            {t.boyServiceAuto}: {locale === 'bn' ? toBanglaDigits(boyServiceDays) : boyServiceDays} {t.days}
          </Text>
        ) : (
          <Text style={styles.muted}>{t.dobHint}</Text>
        )}
        <DateField label={t.joinDate} value={joinDate} onChange={setJoinDate} />
        <DateField label={t.endDate} value={endDate} onChange={setEndDate} />
        <TextField
          label={t.lastBasic}
          value={lastBasic}
          onChangeText={setLastBasic}
          keyboardType="numeric"
          placeholder="45000"
        />
        <TextField
          label={t.contractual}
          value={contractualDays}
          onChangeText={setContractualDays}
          keyboardType="numeric"
        />
      </SectionCard>

      <SectionCard
        title={t.enjoyed}
        subtitle={t.enjoyedHint}
        headerRight={
          <Pressable
            style={styles.addBtn}
            onPress={() => setEnjoyed((rows) => [...rows, emptyRow(leaveTypes[0]?.id ?? '')])}
            disabled={!leaveTypes.length}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.addBtnText}>{t.addRow}</Text>
          </Pressable>
        }
      >
        {loading ? <Text style={styles.muted}>{t.calculating}</Text> : null}
        {!loading && leaveTypes.length === 0 ? <Text style={styles.muted}>{t.emptyTypes}</Text> : null}

        {enjoyed.map((row) => {
          const selected = leaveTypes.find((lt) => lt.id === row.leave_type_id);
          const maternity = isMaternityLeaveCode(selected?.code);
          const suspension = isSuspensionLeaveCode(selected?.code);
          const resolved = resolveDays(row, leaveTypes);
          return (
            <View key={row.key} style={styles.leaveCard}>
              <Pressable
                style={styles.typeBtn}
                onPress={() => setPickerFor(pickerFor === row.key ? null : row.key)}
              >
                <Text style={styles.typeBtnLabel}>{t.leaveType}</Text>
                <Text style={styles.typeBtnValue}>
                  {selected ? typeName(locale, selected) : t.selectType}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </Pressable>

              {pickerFor === row.key ? (
                <ScrollView
                  style={styles.picker}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  {leaveTypes.map((lt) => (
                    <Pressable
                      key={lt.id}
                      style={styles.pickerItem}
                      onPress={() => {
                        updateRow(row.key, {
                          leave_type_id: lt.id,
                          input_mode: isMaternityLeaveCode(lt.code) ? 'dates' : row.input_mode,
                        });
                        setPickerFor(null);
                      }}
                    >
                      <Text style={styles.pickerText}>{typeName(locale, lt)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              {!maternity ? (
                <ChipGroup
                  value={row.input_mode}
                  onChange={(v) => updateRow(row.key, { input_mode: v })}
                  options={[
                    { value: 'days', label: t.modeDays },
                    { value: 'dates', label: t.modeDates },
                  ]}
                />
              ) : null}

              {maternity || row.input_mode === 'dates' ? (
                <View style={styles.dateRow}>
                  <View style={styles.dateField}>
                    <DateField
                      label={t.from}
                      value={row.from_date}
                      onChange={(v) => updateRow(row.key, { from_date: v })}
                    />
                  </View>
                  {!maternity ? (
                    <View style={styles.dateField}>
                      <DateField
                        label={t.to}
                        value={row.to_date}
                        onChange={(v) => updateRow(row.key, { to_date: v })}
                      />
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>{t.days}</Text>
                  <TextInput
                    style={styles.input}
                    value={row.days}
                    onChangeText={(v) => updateRow(row.key, { days: v })}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              )}

              {suspension ? (
                <ChipGroup
                  value={row.regularized ? 'yes' : 'no'}
                  onChange={(v) => updateRow(row.key, { regularized: v === 'yes' })}
                  options={[
                    { value: 'no', label: t.regularizedNo },
                    { value: 'yes', label: t.regularizedYes },
                  ]}
                />
              ) : null}

              <View style={styles.rowFooter}>
                <Text style={styles.resolved}>
                  {t.days}: {locale === 'bn' ? toBanglaDigits(resolved) : resolved}
                </Text>
                <Pressable onPress={() => setEnjoyed((rows) => rows.filter((r) => r.key !== row.key))}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </SectionCard>

      <Button
        title={calculating ? t.calculating : t.calculate}
        loading={calculating}
        disabled={!canCalculate}
        onPress={() => void handleCalculate()}
      />

      {result ? (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>{t.results}</Text>

          <SectionCard title={t.servicePeriods}>
            <View style={styles.periodRow}>
              <PeriodCard title={t.totalService} value={fmtPeriod(locale, result.service_period)} />
              <PeriodCard title={t.working} value={fmtPeriod(locale, result.working_period)} />
              <PeriodCard title={t.leaveEarning} value={fmtPeriod(locale, result.leave_earning_period)} />
              {qualifyingService ? (
                <PeriodCard
                  title={t.qualifyingService}
                  value={fmtPeriod(locale, qualifyingService.breakdown)}
                  subtitle={`${
                    locale === 'bn' ? toBanglaDigits(qualifyingService.total_exclusion_days) : qualifyingService.total_exclusion_days
                  } ${t.days} ${t.excludedNote}`}
                />
              ) : null}
            </View>
          </SectionCard>

          <SectionCard title={t.balances}>
            <View style={styles.mathBlock}>
              <Text style={styles.mathHeading}>{t.average}</Text>
              <MathRow
                label={t.earning}
                note={t.halfNote}
                value={fmtDays(locale, result.average_salary_leave_earned_days)}
              />
              <MathRow
                label={t.deduction}
                note={
                  result.rest_leave?.auto_applied
                    ? `${t.restAuto} ${locale === 'bn' ? toBanglaDigits(result.rest_leave.enjoyed_days) : result.rest_leave.enjoyed_days}`
                    : undefined
                }
                operator="−"
                value={fmtDays(locale, result.enjoyed_average_salary_days)}
              />
              <MathRow
                label={t.balance}
                emphasize
                operator="="
                value={fmtPeriod(locale, result.average_salary_leave)}
              />
            </View>

            <View style={styles.mathBlock}>
              <Text style={styles.mathHeading}>{t.halfAverage}</Text>
              <MathRow
                label={t.earning}
                note={t.halfAvgNote}
                value={fmtDays(locale, result.half_average_leave_earned_days)}
              />
              <MathRow
                label={t.deduction}
                operator="−"
                value={fmtDays(locale, result.enjoyed_half_average_days)}
              />
              <MathRow
                label={t.balance}
                emphasize
                operator="="
                value={fmtPeriod(locale, result.half_average_leave)}
              />
            </View>

            {result.enjoyed_without_pay_days > 0 ? (
              <View style={styles.mathBlock}>
                <Text style={styles.mathHeading}>{t.withoutPay}</Text>
                <MathRow label={t.earning} value="—" note={t.notEarned} />
                <MathRow
                  label={t.deduction}
                  value={fmtDays(locale, result.enjoyed_without_pay_days)}
                />
                <MathRow
                  label={t.recorded}
                  emphasize
                  value={fmtPeriod(locale, result.without_pay_leave)}
                />
              </View>
            ) : null}

            {result.enjoyed_regular_working_days > 0 ? (
              <View style={styles.mathBlock}>
                <Text style={styles.mathHeading}>{t.regular}</Text>
                <MathRow label={t.earning} value="—" note={t.notEarned} />
                <MathRow
                  label={t.deduction}
                  value={fmtDays(locale, result.enjoyed_regular_working_days)}
                />
                <MathRow
                  label={t.recorded}
                  emphasize
                  value={fmtPeriod(locale, result.regular_working_period)}
                />
              </View>
            ) : null}

            <View style={[styles.mathBlock, styles.totalBlock]}>
              <Text style={styles.mathHeading}>{t.totalBalance}</Text>
              <MathRow label={t.avgPay} value={fmtPeriod(locale, result.average_salary_leave)} />
              <MathRow
                label={t.halfToAvg}
                note={t.halfToAvgNote}
                operator="+"
                value={fmtDays(locale, halfConverted)}
              />
              <MathRow
                label={t.total}
                emphasize
                operator="="
                value={`${fmtPeriod(locale, result.total_average_salary_leave)} · ${
                  locale === 'bn'
                    ? toBanglaDigits(result.average_salary_leave_months.toFixed(2))
                    : result.average_salary_leave_months.toFixed(2)
                } ${t.months}`}
              />
            </View>
          </SectionCard>

          <SectionCard title={t.lampGrant}>
            <Text style={styles.lampAmount}>
              ৳{' '}
              {locale === 'bn'
                ? toBanglaDigits(
                    result.lamp_grant.toLocaleString('en-BD', { minimumFractionDigits: 2 }),
                  )
                : result.lamp_grant.toLocaleString('en-BD', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.muted}>
              {result.lamp_grant_uses_bonus_salary ? t.lampBonus : t.lampPlain}
            </Text>
          </SectionCard>

          <SectionCard title={t.gratuityTitle} subtitle={t.gratuityDescription}>
            {!gratuityResult?.eligible ? (
              <Text style={styles.error}>{t.notEligible}</Text>
            ) : (
              <>
                <View style={styles.periodRow}>
                  <PeriodCard title={t.gratuityAmount} value={fmtMoney(locale, gratuityResult.gratuity_amount)} />
                  <PeriodCard title={t.monthlyNet} value={fmtMoney(locale, gratuityResult.monthly_net_pension)} />
                </View>
                <View style={styles.mathBlock}>
                  <MathRow
                    label={t.rate}
                    value={`${locale === 'bn' ? toBanglaDigits(gratuityResult.pension_rate_percent ?? 0) : gratuityResult.pension_rate_percent}%`}
                  />
                  <MathRow label={t.halfPension} value={fmtMoney(locale, gratuityResult.half_pension_amount)} />
                  <MathRow
                    label={t.multiplier}
                    value={
                      locale === 'bn'
                        ? toBanglaDigits(gratuityResult.gratuity_multiplier ?? 0)
                        : String(gratuityResult.gratuity_multiplier)
                    }
                  />
                  <MathRow label={t.medical} value={fmtMoney(locale, gratuityResult.medical_allowance)} />
                  <MathRow label={t.festival} value={fmtMoney(locale, gratuityResult.festival_allowance_per_occasion)} />
                  <MathRow label={t.baishakhi} value={fmtMoney(locale, gratuityResult.baishakhi_allowance)} />
                  <MathRow
                    label={`${t.leaveEncashmentCap} (${
                      locale === 'bn' ? toBanglaDigits(PENSION_LAMP_GRANT_MONTHS) : PENSION_LAMP_GRANT_MONTHS
                    } ${t.months})`}
                    value={fmtMoney(locale, gratuityResult.leave_encashment_cap)}
                  />
                </View>
              </>
            )}
          </SectionCard>
        </View>
      ) : null}
    </ScrollView>
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
  muted: { fontSize: 13, color: colors.textMuted },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  leaveCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeBtnLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  typeBtnValue: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  picker: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    maxHeight: 240,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerText: { fontSize: 14, color: colors.text },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateField: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.text },
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
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resolved: { fontSize: 13, fontWeight: '600', color: colors.primary },
  results: { gap: spacing.md },
  resultsTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mathBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  totalBlock: {
    borderColor: colors.primaryLight,
    backgroundColor: '#eef6fb',
  },
  mathHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    paddingTop: spacing.sm,
    paddingBottom: 4,
  },
  lampAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
  },
});
