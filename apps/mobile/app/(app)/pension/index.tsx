import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  breakdownFromDays,
  calculateBoyServiceDays,
  calculatePensionGratuity,
  calculatePrl,
  calculateQualifyingPensionService,
  daysBetweenInclusive,
  formatPeriodLabel,
  isMaternityLeaveCode,
  isSuspensionLeaveCode,
  maternityDaysFromStartDate,
  roundHalfUp,
  type PensionCalculateResult,
  type PensionGratuityResult,
  type PrlCalculateResult,
  type QualifyingPensionServiceResult,
} from '@ibas/shared-types';
import {
  PENSION_DAYS_PER_YEAR,
  PENSION_GRATUITY_MULTIPLIER_TABLE,
  PENSION_LAMP_GRANT_MONTHS,
  PENSION_REST_CYCLE_YEARS,
  PENSION_REST_DAYS_PER_CYCLE,
  PENSION_REST_LEAVE_CODE,
} from '@ibas/shared-constants';
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
import { KeyboardScrollProvider, useKeyboardScroll } from '@/lib/keyboard-scroll';
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

/** ISO date + N calendar years, as an ISO date string (empty if the input isn't a valid date). */
function addYearsIso(iso: string, years: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/**
 * When one REST row's date is pushed forward, every later cycle (by array order, since REST
 * rows are only ever appended in cycle order by the auto-generator) shifts to keep the same
 * 3-year spacing, cascading from the edited row onward.
 */
function cascadeRestDates(rows: EnjoyedRow[], editedKey: string, restTypeId: string): EnjoyedRow[] {
  const restKeysInOrder = rows.filter((r) => r.leave_type_id === restTypeId).map((r) => r.key);
  const editedIndex = restKeysInOrder.indexOf(editedKey);
  const editedRow = rows.find((r) => r.key === editedKey);
  if (editedIndex === -1 || !editedRow) return rows;

  const updates = new Map<string, string>();
  let cursorDate = editedRow.from_date;
  for (let i = editedIndex + 1; i < restKeysInOrder.length; i++) {
    cursorDate = addYearsIso(cursorDate, PENSION_REST_CYCLE_YEARS);
    updates.set(restKeysInOrder[i]!, cursorDate);
  }
  if (updates.size === 0) return rows;
  return rows.map((r) => (updates.has(r.key) ? { ...r, from_date: updates.get(r.key)! } : r));
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

/** One-line summary for a leave card: resolved days, plus the date(s) that produced it, if any. */
function rowSummary(
  locale: CalcLocale,
  t: ReturnType<typeof pensionCopy>,
  row: EnjoyedRow,
  type: PensionLeaveTypeRow | undefined,
  leaveTypes: PensionLeaveTypeRow[],
): string {
  const days = fmtDays(locale, resolveDays(row, leaveTypes));
  if (!type) return days;
  if (isMaternityLeaveCode(type.code)) {
    return row.from_date ? `${row.from_date} · ${days}` : days;
  }
  if (type.code === PENSION_REST_LEAVE_CODE) {
    return row.from_date ? `${row.from_date} · ${days}` : days;
  }
  if (row.input_mode === 'dates' && row.from_date && row.to_date) {
    return `${row.from_date} → ${row.to_date} · ${days}`;
  }
  if (isSuspensionLeaveCode(type.code) && row.regularized) {
    return t.regularizedYes;
  }
  return days;
}

function fmtMoney(locale: CalcLocale, amount: number) {
  const label = amount.toLocaleString('en-BD', { minimumFractionDigits: 2 });
  return `৳ ${locale === 'bn' ? toBanglaDigits(label) : label}`;
}

/** Band label for a row in a descending min-years table — "25+" for the top row, "20–24" otherwise. */
function yearsBandLabel(locale: CalcLocale, table: readonly { min_years: number }[], index: number): string {
  const row = table[index]!;
  const label =
    index === 0 ? `${row.min_years}+` : `${row.min_years}–${table[index - 1]!.min_years - 1}`;
  return locale === 'bn' ? toBanglaDigits(label) : label;
}

function InfoModal({
  title,
  visible,
  onClose,
  children,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

function InfoSection({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.infoSection}>
      <Text style={styles.infoSectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <Text key={i} style={styles.infoBullet}>
          {'•'} {item}
        </Text>
      ))}
    </View>
  );
}

export default function PensionMobileScreen() {
  return (
    <KeyboardScrollProvider>
      <PensionMobileScreenInner />
    </KeyboardScrollProvider>
  );
}

function PensionMobileScreenInner() {
  const keyboardScroll = useKeyboardScroll();
  const [locale, setLocale] = useState<CalcLocale>('en');
  const t = pensionCopy(locale);
  const [leaveTypes, setLeaveTypes] = useState<PensionLeaveTypeRow[]>([]);
  const [joinDate, setJoinDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastBasic, setLastBasic] = useState('');
  const [dob, setDob] = useState('');
  const [contractualDays, setContractualDays] = useState('');
  const [chosenLumpSumMonths, setChosenLumpSumMonths] = useState('');
  const [editingSplit, setEditingSplit] = useState(false);
  const [appliedLumpSumMonths, setAppliedLumpSumMonths] = useState<number | undefined>(undefined);
  const [enjoyed, setEnjoyed] = useState<EnjoyedRow[]>([]);
  const [result, setResult] = useState<PensionCalculateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [showRulesApplied, setShowRulesApplied] = useState(false);
  const [serviceLocked, setServiceLocked] = useState(false);
  const [enjoyedLocked, setEnjoyedLocked] = useState(false);
  const [contractualEnabled, setContractualEnabled] = useState(false);
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [isNewRow, setIsNewRow] = useState(false);
  const [rowDraft, setRowDraft] = useState<EnjoyedRow | null>(null);
  const [rowEditError, setRowEditError] = useState('');
  const [showRestList, setShowRestList] = useState(false);

  useEffect(() => {
    fetchPensionLeaveTypes()
      .then((data) => setLeaveTypes(data))
      .catch(() => setError(t.errorLoad))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!joinDate || !endDate || !leaveTypes.length) return;
    const restType = leaveTypes.find((lt) => lt.code === PENSION_REST_LEAVE_CODE);
    if (!restType) return;
    const serviceDays = daysBetweenInclusive(joinDate, endDate);
    const cycles = Math.floor(serviceDays / PENSION_DAYS_PER_YEAR / PENSION_REST_CYCLE_YEARS);
    if (cycles <= 0) return;
    setEnjoyed((rows) => {
      const existingRest = rows.filter((r) => r.leave_type_id === restType.id).length;
      if (existingRest >= cycles) return rows;
      const additions: EnjoyedRow[] = [];
      for (let i = existingRest; i < cycles; i++) {
        additions.push({
          ...emptyRow(restType.id),
          input_mode: 'days',
          days: String(PENSION_REST_DAYS_PER_CYCLE),
          from_date: addYearsIso(joinDate, (i + 1) * PENSION_REST_CYCLE_YEARS),
        });
      }
      return [...rows, ...additions];
    });
  }, [joinDate, endDate, leaveTypes]);

  function openRowEditor(row: EnjoyedRow, isNew: boolean) {
    setRowDraft({ ...row });
    setEditingRowKey(row.key);
    setIsNewRow(isNew);
    setRowEditError('');
  }

  function addNewRowAndEdit() {
    const firstSelectable = leaveTypes.find((lt) => lt.code !== PENSION_REST_LEAVE_CODE);
    openRowEditor(emptyRow(firstSelectable?.id ?? ''), true);
  }

  function closeRowEditor() {
    setEditingRowKey(null);
    setIsNewRow(false);
    setRowDraft(null);
    setRowEditError('');
  }

  function saveRowEditor() {
    if (!rowDraft) return;
    const type = leaveTypes.find((lt) => lt.id === rowDraft.leave_type_id);
    const isRest = type?.code === PENSION_REST_LEAVE_CODE;
    const original = isNewRow ? undefined : enjoyed.find((r) => r.key === rowDraft.key);
    if (isRest && original?.from_date && rowDraft.from_date && rowDraft.from_date <= original.from_date) {
      setRowEditError(`${t.restDateForwardOnly} ${original.from_date}`);
      return;
    }
    setEnjoyed((rows) => {
      const updatedRows = isNewRow
        ? [...rows, rowDraft]
        : rows.map((r) => (r.key === rowDraft.key ? rowDraft : r));
      if (isRest && original && original.from_date !== rowDraft.from_date) {
        return cascadeRestDates(updatedRows, rowDraft.key, type!.id);
      }
      return updatedRows;
    });
    closeRowEditor();
  }

  function deleteRow(key: string) {
    setEnjoyed((rows) => rows.filter((r) => r.key !== key));
  }

  function updateDraft(patch: Partial<EnjoyedRow>) {
    setRowDraft((d) => (d ? { ...d, ...patch } : d));
  }

  async function handleCalculate() {
    setError('');
    setCalculating(true);
    setResult(null);
    try {
      const basic = Number(lastBasic);
      if (!dob || !joinDate || !endDate || !Number.isFinite(basic) || basic <= 0) {
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
      setServiceLocked(true);
      setEnjoyedLocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorCalc);
    } finally {
      setCalculating(false);
    }
  }

  const canCalculate = Boolean(dob && joinDate && endDate && lastBasic) && !calculating;

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
  const prlResult: PrlCalculateResult | null =
    dob && result && Number(lastBasic) > 0
      ? calculatePrl({
          dob,
          total_leave_months: result.average_salary_leave_months,
          last_basic_salary: Number(lastBasic),
          chosen_lump_sum_months: appliedLumpSumMonths,
        })
      : null;
  // Monthly pension + gratuity are computed on the PRL-adjusted (July-1, +5%) basic when it applies.
  const pensionRateBasic = prlResult?.pension_basic_salary ?? Number(lastBasic);
  const gratuityResult: PensionGratuityResult | null =
    qualifyingService && pensionRateBasic > 0
      ? calculatePensionGratuity({
          qualifying_years: qualifyingService.qualifying_service_years,
          last_basic_salary: pensionRateBasic,
        })
      : null;

  const editingSelectedType = rowDraft ? leaveTypes.find((lt) => lt.id === rowDraft.leave_type_id) : undefined;
  const editingIsRest = editingSelectedType?.code === PENSION_REST_LEAVE_CODE;
  const editingOriginalRow =
    rowDraft && !isNewRow ? enjoyed.find((r) => r.key === rowDraft.key) : undefined;

  const selectableLeaveTypes = leaveTypes.filter((lt) => lt.code !== PENSION_REST_LEAVE_CODE);

  const restType = leaveTypes.find((lt) => lt.code === PENSION_REST_LEAVE_CODE);
  const restRows = enjoyed.filter((r) => r.leave_type_id === restType?.id);
  const nonRestRows = enjoyed.filter((r) => r.leave_type_id !== restType?.id);
  const restTotalDays = restRows.reduce((sum, r) => sum + resolveDays(r, leaveTypes), 0);

  const ruleStages: { title: string; items: string[] }[] = [];

  if (joinDate && endDate) {
    const serviceDays = result?.service_period.total_days ?? daysBetweenInclusive(joinDate, endDate);
    ruleStages.push({ title: t.ruleService, items: [fmtDays(locale, serviceDays)] });
  }

  const enjoyedRows = enjoyed
    .map((r) => ({ type: leaveTypes.find((lt) => lt.id === r.leave_type_id), days: resolveDays(r, leaveTypes) }))
    .filter((r): r is { type: PensionLeaveTypeRow; days: number } => Boolean(r.type) && r.days > 0);
  if (enjoyedRows.length > 0) {
    ruleStages.push({
      title: t.ruleDeduction,
      items: enjoyedRows.map((r) => `${typeName(locale, r.type)}: ${fmtDays(locale, r.days)}`),
    });
  } else if (joinDate && endDate) {
    ruleStages.push({ title: t.ruleInput, items: [t.ruleInputNone] });
  }

  if (result) {
    ruleStages.push({
      title: t.ruleEarning,
      items: [
        `${t.ruleTotalAvgLeave}: ${fmtPeriod(locale, result.total_average_salary_leave)} (${
          locale === 'bn'
            ? toBanglaDigits(result.average_salary_leave_months.toFixed(2))
            : result.average_salary_leave_months.toFixed(2)
        } ${t.months})`,
        `${t.ruleLampFormulaLabel}: ${fmtMoney(locale, Number(lastBasic) || 0)} × ${
          locale === 'bn'
            ? toBanglaDigits(result.lamp_grant_months_used.toFixed(2))
            : result.lamp_grant_months_used.toFixed(2)
        } ${t.months} = ${fmtMoney(locale, result.lamp_grant)}`,
      ],
    });
  }

  if (qualifyingService) {
    ruleStages.push({
      title: t.ruleQualifying,
      items: [
        `${fmtPeriod(locale, qualifyingService.breakdown)} (${
          locale === 'bn'
            ? toBanglaDigits(qualifyingService.total_exclusion_days)
            : qualifyingService.total_exclusion_days
        } ${t.days} ${t.ruleQualifyingExcluded})`,
      ],
    });
  }

  if (gratuityResult) {
    if (!gratuityResult.eligible) {
      ruleStages.push({ title: t.ruleGratuity, items: [t.ruleGratuityNotEligible] });
    } else {
      ruleStages.push({
        title: t.ruleGratuity,
        items: [
          `${t.ruleMonthlyPensionFormulaLabel}: (${fmtMoney(locale, pensionRateBasic)} × ${
            locale === 'bn'
              ? toBanglaDigits(gratuityResult.pension_rate_percent ?? 0)
              : gratuityResult.pension_rate_percent
          }%) ÷ 2 = ${fmtMoney(locale, gratuityResult.half_pension_amount)}; + ${fmtMoney(
            locale,
            gratuityResult.medical_allowance,
          )} = ${fmtMoney(locale, gratuityResult.monthly_net_pension)}`,
          `${t.ruleGratuityFormulaLabel}: ${fmtMoney(locale, gratuityResult.half_pension_amount)} × ${
            locale === 'bn'
              ? toBanglaDigits(gratuityResult.gratuity_multiplier ?? 0)
              : gratuityResult.gratuity_multiplier
          } = ${fmtMoney(locale, gratuityResult.gratuity_amount)}`,
        ],
      });
    }
  }

  if (prlResult) {
    ruleStages.push({
      title: t.rulePrl,
      items: [
        `${t.rulePrlPeriod}: ${prlResult.prl_start_date} → ${prlResult.final_retirement_date}`,
        `${t.rulePrlMonths}: ${
          locale === 'bn' ? toBanglaDigits(prlResult.prl_salary_months) : prlResult.prl_salary_months
        } + ${locale === 'bn' ? toBanglaDigits(prlResult.lump_sum_months) : prlResult.lump_sum_months}`,
      ],
    });
  }

  function renderRowEditorFields() {
    if (!rowDraft) return null;
    return (
      <>
        {!editingIsRest ? (
          <View style={styles.typeListWrap}>
            <Text style={styles.fieldLabel}>{t.leaveType}</Text>
            <View style={styles.typeList}>
              {selectableLeaveTypes.map((lt) => {
                const isSelected = rowDraft.leave_type_id === lt.id;
                return (
                  <Pressable
                    key={lt.id}
                    style={[styles.typeListItem, isSelected && styles.typeListItemSelected]}
                    onPress={() =>
                      updateDraft({
                        leave_type_id: lt.id,
                        input_mode: isMaternityLeaveCode(lt.code) ? 'dates' : rowDraft.input_mode,
                      })
                    }
                  >
                    <Text style={[styles.typeListItemText, isSelected && styles.typeListItemTextSelected]}>
                      {typeName(locale, lt)}
                    </Text>
                    {isSelected ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {editingIsRest ? (
          <View style={styles.dateField}>
            <DateField
              label={t.restDateLabel}
              value={rowDraft.from_date}
              onChange={(v) => updateDraft({ from_date: v })}
              minimumDate={editingOriginalRow?.from_date ? new Date(editingOriginalRow.from_date) : undefined}
            />
          </View>
        ) : null}

        {!isMaternityLeaveCode(editingSelectedType?.code) && !editingIsRest ? (
          <ChipGroup
            value={rowDraft.input_mode}
            onChange={(v) => updateDraft({ input_mode: v })}
            options={[
              { value: 'days', label: t.modeDays },
              { value: 'dates', label: t.modeDates },
            ]}
          />
        ) : null}

        {isMaternityLeaveCode(editingSelectedType?.code) || (!editingIsRest && rowDraft.input_mode === 'dates') ? (
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <DateField label={t.from} value={rowDraft.from_date} onChange={(v) => updateDraft({ from_date: v })} />
            </View>
            {!isMaternityLeaveCode(editingSelectedType?.code) ? (
              <View style={styles.dateField}>
                <DateField label={t.to} value={rowDraft.to_date} onChange={(v) => updateDraft({ to_date: v })} />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>{t.days}</Text>
            <TextInput
              style={styles.input}
              value={rowDraft.days}
              onChangeText={(v) => updateDraft({ days: v })}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              editable={!editingIsRest}
            />
          </View>
        )}

        {editingIsRest && editingOriginalRow?.from_date ? (
          <Text style={styles.muted}>
            {t.restDateForwardOnlyHint} {editingOriginalRow.from_date}
          </Text>
        ) : null}

        {isSuspensionLeaveCode(editingSelectedType?.code) ? (
          <ChipGroup
            value={rowDraft.regularized ? 'yes' : 'no'}
            onChange={(v) => updateDraft({ regularized: v === 'yes' })}
            options={[
              { value: 'no', label: t.regularizedNo },
              { value: 'yes', label: t.regularizedYes },
            ]}
          />
        ) : null}

        <Text style={styles.resolved}>
          {t.days}:{' '}
          {locale === 'bn' ? toBanglaDigits(resolveDays(rowDraft, leaveTypes)) : resolveDays(rowDraft, leaveTypes)}
        </Text>

        {rowEditError ? <Text style={styles.error}>{rowEditError}</Text> : null}

        <View style={styles.splitRow}>
          <Pressable style={styles.saveBtn} onPress={saveRowEditor}>
            <Text style={styles.saveBtnText}>{t.saveRowBtn}</Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={closeRowEditor}>
            <Text style={styles.linkBtnText}>{t.prlCancelBtn}</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
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

      <View style={styles.linkRow}>
        <Pressable style={styles.linkBtn} onPress={() => setShowInstructions(true)}>
          <Ionicons name="book-outline" size={16} color={colors.primary} />
          <Text style={styles.linkBtnText}>{t.instructions}</Text>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={() => setShowRulesApplied(true)}>
          <Ionicons name="checkmark-done-outline" size={16} color={colors.primary} />
          <Text style={styles.linkBtnText}>{t.rulesApplied}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SectionCard
        title={t.service}
        headerRight={
          serviceLocked ? (
            <Pressable style={styles.iconBtn} onPress={() => setServiceLocked(false)} hitSlop={8}>
              <Ionicons name="pencil-outline" size={18} color={colors.primary} />
            </Pressable>
          ) : undefined
        }
      >
        {serviceLocked ? (
          <View style={styles.mathBlock}>
            <MathRow label={t.dob} value={dob || '—'} />
            <MathRow label={t.joinDate} value={joinDate || '—'} />
            <MathRow label={t.endDate} value={endDate || '—'} />
            <MathRow label={t.lastBasic} value={fmtMoney(locale, Number(lastBasic) || 0)} />
            {contractualEnabled && contractualDays ? (
              <MathRow label={t.contractual} value={locale === 'bn' ? toBanglaDigits(contractualDays) : contractualDays} />
            ) : null}
          </View>
        ) : (
          <>
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
              placeholder="00000"
            />
            {!contractualEnabled ? (
              <Pressable style={styles.collapsedRow} onPress={() => setContractualEnabled(true)}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                <Text style={styles.collapsedRowText}>
                  {t.contractual}
                  {contractualDays
                    ? `: ${locale === 'bn' ? toBanglaDigits(contractualDays) : contractualDays}`
                    : ''}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ) : (
              <View style={styles.contractualRow}>
                <View style={styles.contractualField}>
                  <TextField
                    label={t.contractual}
                    value={contractualDays}
                    onChangeText={setContractualDays}
                    keyboardType="numeric"
                  />
                </View>
                <Pressable style={styles.iconBtn} onPress={() => setContractualEnabled(false)} hitSlop={8}>
                  <Ionicons name="lock-open-outline" size={20} color={colors.primary} />
                </Pressable>
              </View>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard
        title={t.enjoyed}
        subtitle={t.enjoyedHint}
        headerRight={
          enjoyedLocked ? (
            <Pressable style={styles.iconBtn} onPress={() => setEnjoyedLocked(false)} hitSlop={8}>
              <Ionicons name="pencil-outline" size={18} color={colors.primary} />
            </Pressable>
          ) : !isNewRow ? (
            <Pressable style={styles.addBtn} onPress={addNewRowAndEdit} disabled={!selectableLeaveTypes.length}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.addBtnText}>{t.addRow}</Text>
            </Pressable>
          ) : undefined
        }
      >
        {loading ? <Text style={styles.muted}>{t.calculating}</Text> : null}
        {!loading && leaveTypes.length === 0 ? <Text style={styles.muted}>{t.emptyTypes}</Text> : null}
        {!loading && leaveTypes.length > 0 && enjoyed.length === 0 ? (
          <Text style={styles.muted}>{t.noEnjoyedRows}</Text>
        ) : null}

        {nonRestRows.map((row) => {
          const selected = leaveTypes.find((lt) => lt.id === row.leave_type_id);
          return (
            <View key={row.key} style={styles.leaveSummaryCard}>
              <View style={styles.leaveSummaryText}>
                <Text style={styles.leaveSummaryName}>
                  {selected ? typeName(locale, selected) : t.selectType}
                </Text>
                <Text style={styles.leaveSummaryDetail}>
                  {rowSummary(locale, t, row, selected, leaveTypes)}
                </Text>
              </View>
              {!enjoyedLocked ? (
                <View style={styles.leaveSummaryActions}>
                  <Pressable onPress={() => openRowEditor(row, false)} hitSlop={8}>
                    <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                  </Pressable>
                  <Pressable onPress={() => deleteRow(row.key)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}

        {restType && restRows.length > 0 ? (
          <Pressable style={styles.leaveSummaryCard} onPress={() => setShowRestList(true)}>
            <View style={styles.leaveSummaryText}>
              <Text style={styles.leaveSummaryName}>{typeName(locale, restType)}</Text>
              <Text style={styles.leaveSummaryDetail}>
                {`${locale === 'bn' ? toBanglaDigits(restRows.length) : restRows.length} ${t.restEntriesLabel} · ${fmtDays(locale, restTotalDays)}`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {!enjoyedLocked && isNewRow && rowDraft ? (
          <View style={styles.inlineEditor}>{renderRowEditorFields()}</View>
        ) : null}
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
            <Text style={styles.muted}>{t.lampRule}</Text>
          </SectionCard>

          <SectionCard title={t.gratuityTitle} subtitle={t.gratuityDescription}>
            {!prlResult ? (
              <Text style={styles.muted}>{t.prlNoInput}</Text>
            ) : (
              <>
                <View style={styles.mathBlock}>
                  <MathRow label={t.finalRetirementDate} value={prlResult.final_retirement_date} />
                  <MathRow label={t.finalRetirementBasic} value={fmtMoney(locale, prlResult.pension_basic_salary)} />
                  <MathRow
                    label={t.postRetirementLeaveMonths}
                    value={
                      locale === 'bn' ? toBanglaDigits(prlResult.prl_salary_months) : String(prlResult.prl_salary_months)
                    }
                  />
                </View>

                <Text style={styles.muted}>
                  {prlResult.july_first_falls_within_prl ? t.prlJulyFirstYes : t.prlJulyFirstNo}
                </Text>

                {!prlResult.is_fixed_split ? (
                  <View style={styles.splitBox}>
                    {!editingSplit ? (
                      <View style={styles.splitRow}>
                        <Text style={[styles.muted, styles.splitText]}>
                          {(appliedLumpSumMonths === undefined
                            ? `${t.prlSplitSuggested}: `
                            : `${t.prlSplitCustom}: `) +
                            (locale === 'bn' ? toBanglaDigits(prlResult.prl_salary_months) : prlResult.prl_salary_months) +
                            ` + ` +
                            (locale === 'bn' ? toBanglaDigits(prlResult.lump_sum_months) : prlResult.lump_sum_months)}
                        </Text>
                        <Pressable
                          style={styles.linkBtn}
                          onPress={() => {
                            setChosenLumpSumMonths(String(prlResult.lump_sum_months));
                            setEditingSplit(true);
                          }}
                        >
                          <Text style={styles.linkBtnText}>{t.prlChangeSplitBtn}</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        <TextField
                          label={t.prlChosenLumpSumLabel}
                          value={chosenLumpSumMonths}
                          onChangeText={setChosenLumpSumMonths}
                          keyboardType="numeric"
                        />
                        <Text style={styles.muted}>{t.prlChosenLumpSumHint}</Text>
                        <View style={styles.splitRow}>
                          <Pressable
                            style={styles.linkBtn}
                            onPress={() => {
                              setAppliedLumpSumMonths(Number(chosenLumpSumMonths) || 0);
                              setEditingSplit(false);
                            }}
                          >
                            <Text style={styles.linkBtnText}>{t.prlApplySplitBtn}</Text>
                          </Pressable>
                          <Pressable
                            style={styles.linkBtn}
                            onPress={() => {
                              setEditingSplit(false);
                              setChosenLumpSumMonths('');
                            }}
                          >
                            <Text style={styles.linkBtnText}>{t.prlCancelBtn}</Text>
                          </Pressable>
                          {appliedLumpSumMonths !== undefined ? (
                            <Pressable
                              style={styles.linkBtn}
                              onPress={() => {
                                setAppliedLumpSumMonths(undefined);
                                setChosenLumpSumMonths('');
                                setEditingSplit(false);
                              }}
                            >
                              <Text style={styles.linkBtnText}>{t.prlResetSplitBtn}</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </>
                    )}
                  </View>
                ) : (
                  <Text style={styles.muted}>{t.prlFixedSplitNote}</Text>
                )}

                <View style={styles.periodRow}>
                  <PeriodCard title={t.prlLumpSumGrant} value={fmtMoney(locale, prlResult.lump_sum_grant_amount)} />
                </View>
              </>
            )}

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

    <InfoModal title={t.editLeaveTitle} visible={!isNewRow && editingRowKey !== null} onClose={closeRowEditor}>
      {renderRowEditorFields()}
    </InfoModal>

    <InfoModal
      title={restType ? typeName(locale, restType) : t.enjoyed}
      visible={showRestList}
      onClose={() => setShowRestList(false)}
    >
      {restRows.length === 0 ? <Text style={styles.muted}>{t.noEnjoyedRows}</Text> : null}

      {restRows.map((row) => (
        <View key={row.key} style={styles.leaveSummaryCard}>
          <View style={styles.leaveSummaryText}>
            <Text style={styles.leaveSummaryName}>{row.from_date || '—'}</Text>
            <Text style={styles.leaveSummaryDetail}>{fmtDays(locale, resolveDays(row, leaveTypes))}</Text>
          </View>
          {!enjoyedLocked ? (
            <View style={styles.leaveSummaryActions}>
              <Pressable onPress={() => openRowEditor(row, false)} hitSlop={8}>
                <Ionicons name="pencil-outline" size={18} color={colors.primary} />
              </Pressable>
              <Pressable onPress={() => deleteRow(row.key)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}
    </InfoModal>

    <InfoModal title={t.instructions} visible={showInstructions} onClose={() => setShowInstructions(false)}>
      <Text style={styles.infoIntro}>{t.instructionsIntro}</Text>
      <InfoSection
        title={t.instrLeaveAccountTitle}
        items={[
          t.instrLeaveAccount1,
          t.instrLeaveAccount2,
          t.instrLeaveAccount3,
          t.instrLeaveAccount4,
          t.instrLeaveAccount5,
        ]}
      />
      <InfoSection title={t.instrLampGrantTitle} items={[t.instrLampGrant1, t.instrLampGrant2]} />
      <InfoSection
        title={t.instrQualifyingTitle}
        items={[t.instrQualifying1, t.instrQualifying2, t.instrQualifying3]}
      />
      <InfoSection
        title={t.instrGratuityTitle}
        items={[t.instrGratuity1, t.instrGratuity2, t.instrGratuity3, t.instrGratuity4]}
      />
      <View style={styles.multiplierTable}>
        <Text style={styles.infoSectionTitle}>{t.instrMultiplierTitle}</Text>
        <View style={styles.multiplierRow}>
          <Text style={[styles.multiplierCell, styles.multiplierHeaderCell]}>{t.instrMultiplierYears}</Text>
          <Text style={[styles.multiplierCell, styles.multiplierHeaderCell]}>{t.instrMultiplierValue}</Text>
        </View>
        {PENSION_GRATUITY_MULTIPLIER_TABLE.map((row, i) => (
          <View key={row.min_years} style={styles.multiplierRow}>
            <Text style={styles.multiplierCell}>
              {yearsBandLabel(locale, PENSION_GRATUITY_MULTIPLIER_TABLE, i)}
            </Text>
            <Text style={styles.multiplierCell}>
              {locale === 'bn' ? toBanglaDigits(row.multiplier) : row.multiplier}
            </Text>
          </View>
        ))}
      </View>
      <InfoSection title={t.instrPrlTitle} items={[t.instrPrl1, t.instrPrl2, t.instrPrl3, t.instrPrl4]} />
    </InfoModal>

    <InfoModal title={t.rulesApplied} visible={showRulesApplied} onClose={() => setShowRulesApplied(false)}>
      {ruleStages.length === 0 ? (
        <Text style={styles.muted}>{!joinDate || !endDate ? t.rulesEmpty : t.rulePending}</Text>
      ) : (
        ruleStages.map((stage, i) => <InfoSection key={i} title={stage.title} items={stage.items} />)
      )}
    </InfoModal>
    </>
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
  linkRow: { flexDirection: 'row', gap: spacing.sm },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  splitBox: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
  },
  splitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  splitText: { flex: 1 },
  modalRoot: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  infoIntro: { fontSize: 14, color: colors.text, fontWeight: '600' },
  infoSection: { gap: 4 },
  infoSectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  infoBullet: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  multiplierTable: {
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
  },
  multiplierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  multiplierCell: { flex: 1, fontSize: 13, color: colors.text },
  multiplierHeaderCell: { fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contractualRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  contractualField: { flex: 1 },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  collapsedRowText: { flex: 1, fontSize: 14, color: colors.textMuted },
  leaveSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    backgroundColor: colors.background,
  },
  leaveSummaryText: { flex: 1, gap: 2 },
  leaveSummaryName: { fontSize: 14, fontWeight: '700', color: colors.text },
  leaveSummaryDetail: { fontSize: 13, color: colors.textMuted },
  leaveSummaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  inlineEditor: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  typeListWrap: { gap: 6 },
  typeList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  typeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  typeListItemSelected: { backgroundColor: '#e6f1f8' },
  typeListItemText: { fontSize: 14, color: colors.text },
  typeListItemTextSelected: { fontWeight: '700', color: colors.primary },
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
