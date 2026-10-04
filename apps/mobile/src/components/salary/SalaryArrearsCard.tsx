import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  arrearMonthOptions,
  calculateSalaryArrears,
  defaultArrearMonths,
  formatTaka,
  type HousingStatus,
  type HraArea,
  type PayGrade,
  type SubstantiveGrade,
} from '@ibas/shared-types';
import type { CalcLocale } from '@/lib/calc-i18n';
import { hraAreaText, localNum, localTaka, monthText, salaryCopy } from '@/lib/salary-i18n';
import { colors, spacing } from '@/theme';

const INDIGO = '#4338ca';
const ROSE = '#be123c';
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const STAGE_NUMBER = { '2026-07-01': 1, '2027-01-01': 2, '2027-07-01': 3 } as const;

export function SalaryArrearsCard({
  locale,
  grade,
  oldPay,
  substantiveGrade,
  housingStatus,
  hraArea,
}: {
  locale: CalcLocale;
  grade: PayGrade;
  oldPay: number;
  substantiveGrade: SubstantiveGrade | null;
  housingStatus: HousingStatus;
  hraArea: HraArea;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const tk = (n: number) => localTaka(locale, n);
  const amt = (n: number) => num(formatTaka(n));
  const signed = (n: number) => (n < 0 ? `− ${amt(-n)}` : amt(n));

  const monthOptions = useMemo(() => arrearMonthOptions(), []);
  const [selected, setSelected] = useState<string[]>(() => defaultArrearMonths());

  const { result, error } = useMemo(() => {
    if (selected.length === 0) return { result: null, error: t.arrSelectMonth };
    try {
      return {
        result: calculateSalaryArrears({
          grade,
          old_pay: oldPay,
          substantive_grade: substantiveGrade,
          housing_status: housingStatus,
          hra_area: hraArea,
          months: selected,
        }),
        error: '',
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : t.calcError };
    }
  }, [grade, oldPay, substantiveGrade, housingStatus, hraArea, selected, t]);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].sort()));
  }

  return (
    <View style={styles.card}>
      <View style={styles.bar}>
        <Text style={styles.barTitle}>{t.arrTitle}</Text>
        <Text style={styles.barSub}>{t.arrSub}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.monthHead}>
          <Text style={styles.groupLabel}>{t.arrMonths}</Text>
          <View style={styles.quickRow}>
            {[
              { label: t.arrPast, onPress: () => setSelected(defaultArrearMonths()) },
              { label: t.arrAll, onPress: () => setSelected(monthOptions) },
              { label: t.arrClear, onPress: () => setSelected([]) },
            ].map((b) => (
              <Pressable
                key={b.label}
                onPress={b.onPress}
                hitSlop={4}
                style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}
              >
                <Text style={styles.quickBtnText}>{b.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.chips}>
          {monthOptions.map((key) => {
            const on = selected.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => toggle(key)}
                style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{monthText(locale, key)}</Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {result ? (
          <>
            <View style={styles.box}>
              <Text style={styles.label}>{t.arrSpecialHead}</Text>
              <Text style={styles.boxValue}>{tk(result.special_allowance)}</Text>
              <Text style={styles.tiny}>
                {t.arrSpecialCalc(
                  amt(result.next_step),
                  num(result.special_rate_percent),
                  num(result.substantive_grade),
                  result.substantive_grade >= 10 ? t.arrBandHigh : t.arrBandLow,
                )}
              </Text>
              <Text style={styles.tiny}>
                {result.next_step_is_last ? t.arrSpecialLast(tk(result.old_pay)) : t.arrSpecialNext(tk(result.old_pay))}
              </Text>
            </View>
            <View style={styles.box}>
              <Text style={styles.label}>{t.arrHraHead}</Text>
              <Text style={styles.boxValue}>{tk(result.excess_hra)}</Text>
              {result.hra_eligible ? (
                <>
                  <Text style={styles.tiny}>
                    {t.arrHraCalc(
                      amt(result.hra_on_next_step),
                      amt(result.next_step),
                      num(result.hra_rate_percent_next_step),
                      amt(result.hra_on_old_pay),
                      amt(result.old_pay),
                      num(result.hra_rate_percent_old_pay),
                    )}
                  </Text>
                  <Text style={styles.tiny}>{hraAreaText(locale, hraArea)}</Text>
                </>
              ) : (
                <Text style={styles.tiny}>{t.arrHraNone}</Text>
              )}
            </View>

            <View style={styles.table}>
              <View style={styles.tableHead}>
                <Text style={styles.label}>{t.arrColDiff}</Text>
                <Text style={styles.label}>{t.arrColNet}</Text>
              </View>
              {result.rows.map((row) => (
                <View key={row.month} style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>
                      {monthText(locale, row.month)}
                      <Text style={styles.rowStage}>{`  ·  ${t.stageName(STAGE_NUMBER[row.phase])}`}</Text>
                    </Text>
                    <Text style={styles.calc}>
                      {t.arrRowCalc(amt(row.new_basic), amt(result.old_pay))} = {signed(row.basic_difference)}
                    </Text>
                    <Text style={[styles.calc, styles.minus]}>
                      − {amt(row.special_allowance)} ({t.arrColSpecial}) − {amt(row.excess_hra)} ({t.arrColHra})
                    </Text>
                  </View>
                  <Text style={styles.rowAmount}>{signed(row.net_arrear)}</Text>
                </View>
              ))}
              <View style={[styles.row, styles.totalRow]}>
                <View style={styles.flex}>
                  <Text style={styles.totalTitle}>
                    {t.arrTotalRow(num(result.rows.length), result.rows.length === 1)}
                  </Text>
                  <Text style={styles.calc}>
                    {t.arrColDiff} {signed(result.total_basic_difference)}
                  </Text>
                  <Text style={[styles.calc, styles.minus]}>
                    − {amt(result.total_special_allowance)} ({t.arrColSpecial}) − {amt(result.total_excess_hra)} (
                    {t.arrColHra})
                  </Text>
                </View>
                <Text style={[styles.rowAmount, styles.totalAmount]}>{signed(result.total_net_arrear)}</Text>
              </View>
            </View>

            <View style={styles.due}>
              <Text style={[styles.label, { color: '#312e81' }]}>{t.arrTotalDue}</Text>
              <Text style={styles.dueValue}>৳ {signed(result.total_net_arrear)}</Text>
              <Text style={styles.tiny}>
                {t.arrTotalFormula(`৳ ${signed(result.total_basic_difference)}`, tk(result.total_deduction))}
                {result.total_net_arrear < 0 ? t.arrNegative : ''}
              </Text>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    overflow: 'hidden',
  },
  bar: { backgroundColor: INDIGO, paddingHorizontal: spacing.md, paddingVertical: 10, gap: 2 },
  barTitle: { color: colors.white, fontWeight: '800', fontSize: 14 },
  barSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12, lineHeight: 17 },
  body: { padding: spacing.md, gap: spacing.sm },

  monthHead: { gap: 6 },
  groupLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  quickRow: { flexDirection: 'row', gap: 6 },
  quickBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickBtnText: { fontSize: 12, fontWeight: '600', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: INDIGO, borderColor: INDIGO },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextOn: { color: colors.white },
  errorText: { color: colors.error, fontSize: 13 },

  box: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: spacing.sm,
    gap: 2,
  },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: colors.textMuted, textTransform: 'uppercase' },
  boxValue: { fontSize: 16, fontWeight: '800', color: colors.text, fontFamily: MONO },
  tiny: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },

  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  tableHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  rowStage: { fontSize: 11, fontWeight: '500', color: colors.textMuted },
  calc: { fontSize: 11, color: '#475569', fontFamily: MONO, marginTop: 2, lineHeight: 16 },
  minus: { color: ROSE },
  rowAmount: { fontSize: 14, fontWeight: '800', color: colors.text, fontFamily: MONO },
  totalRow: { backgroundColor: '#eef2ff', borderTopWidth: 1, borderTopColor: '#c7d2fe' },
  totalTitle: { fontSize: 13, fontWeight: '800', color: '#1e1b4b' },
  totalAmount: { fontSize: 16, color: '#312e81' },

  due: {
    borderWidth: 1,
    borderColor: '#a5b4fc',
    backgroundColor: '#e0e7ff',
    borderRadius: 12,
    padding: spacing.sm,
    gap: 2,
  },
  dueValue: { fontSize: 22, fontWeight: '800', color: '#1e1b4b', fontFamily: MONO },
});
