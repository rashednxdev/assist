import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  NPS_2015,
  PAY_GRADES,
  arrearMonthOptions,
  arrearPeriodStart,
  asksJoiningDate,
  asksSubstantiveGrade,
  calculateSalaryArrears,
  defaultArrearMonths,
  formatTaka,
  isIsoDate,
  isPayGrade,
  roundSalaryTaka,
  salaryArrearTrGrade,
  salaryTrFormNo,
  specialAllowanceAmount,
  substantiveGradeOptions,
  type HousingStatus,
  type HraArea,
  type PayGrade,
  type SalaryArrearMonthRow,
  type SalaryArrearResult,
  type SalaryExceptionalIssues,
  type SubstantiveGrade,
} from '@ibas/shared-types';
import type { CalcLocale } from '@/lib/calc-i18n';
import { takaInWords } from '@/lib/amount-words';
import { hraAreaText, localNum, localTaka, monthRowLabel, monthText, salaryCopy, type SalaryCopy } from '@/lib/salary-i18n';
import { PickerSheet } from '@/components/ui/PickerSheet';
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
  joiningDate,
  onJoiningDate,
  issues,
  onIssues,
  downloading,
  onDownloadTr,
}: {
  locale: CalcLocale;
  grade: PayGrade;
  oldPay: number;
  substantiveGrade: SubstantiveGrade | null;
  housingStatus: HousingStatus;
  hraArea: HraArea;
  joiningDate: string;
  onJoiningDate: (next: string) => void;
  issues: SalaryExceptionalIssues;
  onIssues: (next: SalaryExceptionalIssues) => void;
  downloading?: boolean;
  onDownloadTr?: (payload: { result: SalaryArrearResult; stamp: number; formNo: 13 | 15 }) => void;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const tk = (n: number) => localTaka(locale, n);
  const amt = (n: number) => num(formatTaka(n));
  const signed = (n: number) => (n < 0 ? `− ${amt(-n)}` : amt(n));

  const fromMonth = arrearPeriodStart(
    grade,
    oldPay,
    isIsoDate(joiningDate) ? joiningDate : null,
    issues.arrear_start_date,
  )?.month;
  const monthOptions = useMemo(
    () => arrearMonthOptions().filter((month) => !fromMonth || month >= fromMonth),
    [fromMonth],
  );
  const [selected, setSelected] = useState<string[]>(() => defaultArrearMonths());
  const [deductStamp, setDeductStamp] = useState(true);
  const [extras, setExtras] = useState({ excess_rr: false, excess_puja: false });
  const [picker, setPicker] = useState<'payGrade' | 'payBasic' | 'paySub' | null>(null);
  const pay = issues.pay_change ?? null;
  const payGrade = pay && isPayGrade(pay.grade) ? pay.grade : grade;
  const payBasics = NPS_2015[payGrade];

  const { result, error } = useMemo(() => {
    const months = selected.filter((month) => !fromMonth || month >= fromMonth);
    if (months.length === 0) return { result: null, error: t.arrSelectMonth };
    if (pay && !isIsoDate(pay.effective_date)) return { result: null, error: t.exDateInvalid };
    if (issues.arrear_start_date && !isIsoDate(issues.arrear_start_date)) return { result: null, error: t.exDateInvalid };
    try {
      return {
        result: calculateSalaryArrears({
          grade,
          old_pay: oldPay,
          substantive_grade: substantiveGrade,
          housing_status: housingStatus,
          hra_area: hraArea,
          months,
          joining_date: isIsoDate(joiningDate) ? joiningDate : null,
          exceptional: issues,
          excess_rr: extras.excess_rr,
          excess_puja: extras.excess_puja,
        }),
        error: '',
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : t.calcError };
    }
  }, [grade, oldPay, substantiveGrade, housingStatus, hraArea, selected, fromMonth, joiningDate, issues, extras, pay, t]);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].sort()));
  }

  return (
    <View style={styles.card}>
      <View style={styles.bar}>
        <Text style={styles.barTitle}>{t.billTitle}</Text>
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

        {asksJoiningDate(grade, oldPay) ? (
          <View style={styles.exFields}>
            <Text style={styles.groupLabel}>{t.joiningDate}</Text>
            <Text style={styles.tiny}>{t.joiningHint}</Text>
            <TextInput
              value={joiningDate}
              onChangeText={onJoiningDate}
              placeholder="2026-03-01"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>
        ) : null}

        <View style={styles.exBox}>
          <Text style={styles.groupLabel}>{t.exTitle}</Text>
          <CheckRow
            label={t.exIncrement}
            value={Boolean(issues.increment_exempt)}
            onChange={(on) => onIssues({ ...issues, increment_exempt: on })}
          />
          <CheckRow
            label={t.exPay}
            value={pay != null}
            onChange={(on) =>
              onIssues({
                ...issues,
                pay_change: on
                  ? {
                      effective_date: pay?.effective_date ?? '',
                      grade: payGrade,
                      old_pay: pay?.old_pay && payBasics.includes(pay.old_pay) ? pay.old_pay : payBasics[0]!,
                      substantive_grade: asksSubstantiveGrade(payGrade) ? payGrade : null,
                    }
                  : null,
              })
            }
          />
          {pay ? (
            <View style={styles.exFields}>
              <Text style={styles.tiny}>{t.exPayDate}</Text>
              <TextInput
                value={pay.effective_date}
                onChangeText={(effective_date) => onIssues({ ...issues, pay_change: { ...pay, effective_date } })}
                placeholder="2026-08-01"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                style={styles.input}
              />
              <Pressable onPress={() => setPicker('payGrade')} style={styles.pick}>
                <Text style={styles.pickLabel}>{t.exPayGrade}</Text>
                <Text style={styles.pickValue}>{num(payGrade)}</Text>
              </Pressable>
              <Pressable onPress={() => setPicker('payBasic')} style={styles.pick}>
                <Text style={styles.pickLabel}>{t.exPayBasic}</Text>
                <Text style={styles.pickValue}>{tk(pay.old_pay)}</Text>
              </Pressable>
              {asksSubstantiveGrade(payGrade) ? (
                <Pressable onPress={() => setPicker('paySub')} style={styles.pick}>
                  <Text style={styles.pickLabel}>{t.exPaySub}</Text>
                  <Text style={styles.pickValue}>{num(pay.substantive_grade ?? payGrade)}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <CheckRow
            label={t.exStart}
            value={issues.arrear_start_date != null}
            onChange={(on) => onIssues({ ...issues, arrear_start_date: on ? issues.arrear_start_date || '' : null })}
          />
          {issues.arrear_start_date != null ? (
            <TextInput
              value={issues.arrear_start_date}
              onChangeText={(arrear_start_date) => onIssues({ ...issues, arrear_start_date })}
              placeholder="2026-09-01"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              style={styles.input}
            />
          ) : null}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {result ? (
          <BillBody
            locale={locale}
            t={t}
            num={num}
            amt={amt}
            signed={signed}
            tk={tk}
            result={result}
            hraArea={hraArea}
            extras={extras}
            onExtras={setExtras}
            deductStamp={deductStamp}
            onDeductStamp={setDeductStamp}
            downloading={Boolean(downloading)}
            onDownloadTr={() => {
              const stamp = deductStamp ? 10 : 0;
              onDownloadTr?.({
                result,
                stamp,
                formNo: salaryTrFormNo(salaryArrearTrGrade(result)),
              });
            }}
          />
        ) : null}
      </View>
      <PickerSheet
        visible={picker != null}
        title={picker === 'payGrade' ? t.exPayGrade : picker === 'paySub' ? t.exPaySub : t.exPayBasic}
        value={
          picker === 'payGrade'
            ? String(payGrade)
            : picker === 'paySub'
              ? String(pay?.substantive_grade ?? payGrade)
              : String(pay?.old_pay ?? '')
        }
        options={
          picker === 'payGrade'
            ? PAY_GRADES.map((g) => ({ value: String(g), label: `${t.grade} ${num(g)}` }))
            : picker === 'paySub'
              ? substantiveGradeOptions(payGrade).map((g) => ({ value: String(g), label: `${t.grade} ${num(g)}` }))
              : payBasics.map((amt) => ({ value: String(amt), label: tk(amt) }))
        }
        onClose={() => setPicker(null)}
        onSelect={(option) => {
          if (!pay) return;
          if (picker === 'payGrade') {
            const next = Number(option.value) as PayGrade;
            const basics = NPS_2015[next];
            onIssues({
              ...issues,
              pay_change: {
                ...pay,
                grade: next,
                old_pay: basics[0]!,
                substantive_grade: asksSubstantiveGrade(next) ? next : null,
              },
            });
          } else if (picker === 'payBasic') {
            onIssues({ ...issues, pay_change: { ...pay, old_pay: Number(option.value) } });
          } else if (picker === 'paySub') {
            onIssues({ ...issues, pay_change: { ...pay, substantive_grade: Number(option.value) } });
          }
          setPicker(null);
        }}
      />
    </View>
  );
}

function isoToDmy(iso: string): string {
  return iso.split('-').reverse().join('-');
}

function sameMath(a: SalaryArrearMonthRow, b: SalaryArrearMonthRow): boolean {
  return (
    a.new_basic === b.new_basic &&
    a.drawn_basic === b.drawn_basic &&
    a.special_allowance === b.special_allowance &&
    a.excess_hra === b.excess_hra &&
    a.hra_protection === b.hra_protection &&
    a.pay_change_segment === b.pay_change_segment &&
    a.segment_grade === b.segment_grade &&
    a.days === a.month_days &&
    b.days === b.month_days
  );
}

function BillBody({
  locale,
  t,
  num,
  amt,
  signed,
  tk,
  result,
  hraArea,
  extras,
  onExtras,
  deductStamp,
  onDeductStamp,
  downloading,
  onDownloadTr,
}: {
  locale: CalcLocale;
  t: SalaryCopy;
  num: (v: string | number) => string;
  amt: (n: number) => string;
  signed: (n: number) => string;
  tk: (n: number) => string;
  result: SalaryArrearResult;
  hraArea: HraArea;
  extras: { excess_rr: boolean; excess_puja: boolean };
  onExtras: (next: { excess_rr: boolean; excess_puja: boolean }) => void;
  deductStamp: boolean;
  onDeductStamp: (next: boolean) => void;
  downloading: boolean;
  onDownloadTr: () => void;
}) {
  const stamp = deductStamp ? 10 : 0;
  const payable = result.total_net_arrear - stamp;
  const increment = result.next_step - result.old_pay;
  const groups: Array<{ lead: SalaryArrearMonthRow; same: SalaryArrearMonthRow[] }> = [];
  for (const row of result.rows) {
    const last = groups[groups.length - 1];
    if (last && sameMath(last.lead, row)) last.same.push(row);
    else groups.push({ lead: row, same: [] });
  }
  const oneTime = [
    result.excess_rr > 0
      ? { key: 'rr', label: t.arrExcessRrShort, rule: t.arrExcessRrRule(amt(result.increment)), amount: result.excess_rr }
      : null,
    result.excess_puja > 0
      ? {
          key: 'puja',
          label: t.arrExcessPujaShort,
          rule: t.arrExcessPujaRule(amt(result.increment), amt(result.excess_puja)),
          amount: result.excess_puja,
        }
      : null,
  ].filter((row): row is { key: string; label: string; rule: string; amount: number } => row != null);
  const formNo = salaryTrFormNo(salaryArrearTrGrade(result));
  const basis: Array<[string, string]> = [[t.basisGrade, num(result.grade)]];
  if (result.substantive_grade !== result.grade || result.substantive_grade_after != null) {
    basis.push([t.basisSubstantive, num(result.substantive_grade)]);
  }
  if (result.substantive_grade_after != null) basis.push([t.basisSubstantiveAfter, num(result.substantive_grade_after)]);
  if (result.increment_withheld) {
    basis.push([t.basisIncrement, result.increment_exempt ? t.basisNoIncrementExempt : t.basisNoIncrement]);
  }
  if (result.pay_change) {
    basis.push([
      t.basisPayChange,
      `${num(isoToDmy(result.pay_change.effective_date))} · ${t.grade} ${num(result.pay_change.grade)} · ${tk(result.pay_change.old_pay)}`,
    ]);
    if (result.pay_change_origin_fixed_2026 != null) basis.push([t.basisPayChangeOriginFixed, tk(result.pay_change_origin_fixed_2026)]);
    if (result.pay_change_matched_basic != null) basis.push([t.basisPayChangeMatched, tk(result.pay_change_matched_basic)]);
    if (result.pay_change_scale_diff != null) basis.push([t.basisPayChangeScaleDiff, tk(result.pay_change_scale_diff)]);
  }
  if (result.hra_eligible) basis.push([t.basisHraEntitlement, tk(result.hra_entitlement_30_06)]);
  if (result.bill_grade !== result.grade) basis.push([t.basisBillGrade, num(result.bill_grade)]);
  if (result.arrear_from_date) {
    basis.push([
      result.increment_withheld && !result.increment_exempt ? t.basisJoining : t.basisArrearStart,
      num(isoToDmy(result.arrear_from_date)),
    ]);
  }
  basis.push([t.basisDrawn, tk(result.next_step)]);
  basis.push([
    t.basisSpecial,
    result.special_rate_fixed
      ? `${num(result.special_rate_percent)}%`
      : `${num(result.special_rate_percent)}% (${result.substantive_grade >= 10 ? t.arrBandHigh : t.arrBandLow})`,
  ]);
  if (
    result.special_rate_percent_after != null &&
    result.substantive_grade_after != null &&
    result.special_rate_percent_after !== result.special_rate_percent
  ) {
    basis.push([
      t.basisSpecialAfter,
      `${num(result.special_rate_percent_after)}% (${result.substantive_grade_after >= 10 ? t.arrBandHigh : t.arrBandLow})`,
    ]);
  }
  basis.push([t.basisHousing, result.hra_eligible ? hraAreaText(locale, hraArea) : t.govtHousing]);
  if (result.hra_protection > 0) basis.push([t.basisHraProtection, tk(result.hra_protection)]);
  basis.push([t.basisMonths, result.rows.map((row) => monthText(locale, row.month)).join(', ')]);

  return (
    <>
      <View style={styles.exBox}>
        <Text style={styles.groupLabel}>{t.arrExtraTitle}</Text>
        <CheckRow
          label={`${t.arrExcessRr}\n− ${increment > 0 ? t.arrExcessRrRule(amt(increment)) : t.arrNoIncrement}`}
          value={extras.excess_rr}
          onChange={(on) => onExtras({ ...extras, excess_rr: on })}
        />
        <CheckRow
          label={`${t.arrExcessPuja}\n− ${increment > 0 ? t.arrExcessPujaRule(amt(increment), amt(increment * 2)) : t.arrNoIncrement}`}
          value={extras.excess_puja}
          onChange={(on) => onExtras({ ...extras, excess_puja: on })}
        />
      </View>
      <View style={styles.exBox}>
        <CheckRow label={t.stampDeduct} value={deductStamp} onChange={onDeductStamp} />
        <Text style={styles.tiny}>{t.stampDeductHint}</Text>
      </View>

      <Text style={styles.section}>{t.billBasis}</Text>
      <View style={styles.table}>
        {basis.map(([label, value]) => (
          <View key={label} style={styles.basisRow}>
            <Text style={styles.flexLabel}>{label}</Text>
            <Text style={styles.basisValue}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.section}>{t.billMonthsHead}</Text>
      {groups.map((group) => (
        <MonthMath
          key={`${group.lead.month}-${group.lead.day_from ?? 'f'}-${group.lead.pay_change_segment ? 'p' : 'b'}`}
          locale={locale}
          t={t}
          num={num}
          amt={amt}
          signed={signed}
          result={result}
          group={group}
        />
      ))}

      <Text style={styles.section}>{t.billSummary}</Text>
      {result.rows.map((row, idx) => (
        <View key={`${row.month}-${row.day_from ?? 'f'}-${idx}`} style={styles.summaryRow}>
          <Text style={styles.rowTitle}>
            {monthRowLabel(locale, row)} · {t.stageName(STAGE_NUMBER[row.phase])}
          </Text>
          <Text style={styles.calc}>
            {t.arrColNewBasic} {amt(row.new_basic)} · {t.arrColDrawn} {amt(row.drawn_basic)}
          </Text>
          <Text style={styles.calc}>
            {t.arrColDiff} {signed(row.basic_difference)} · {t.arrColSpecial} − {amt(row.special_allowance)} ·{' '}
            {row.hra_protection > 0
              ? `${t.arrColHraProtection} + ${amt(row.hra_protection)}`
              : `${t.arrColHra} − ${amt(row.excess_hra)}`}
          </Text>
          <Text style={styles.rowAmount}>{signed(row.net_arrear)}</Text>
        </View>
      ))}
      {oneTime.map((row) => (
        <View key={row.key} style={styles.summaryRow}>
          <Text style={styles.rowTitle}>
            {row.label} ({t.arrOneTime})
          </Text>
          <Text style={styles.calc}>{row.rule}</Text>
          <Text style={[styles.rowAmount, styles.minus]}>− {amt(row.amount)}</Text>
        </View>
      ))}

      <View style={styles.due}>
        <Text style={[styles.label, { color: '#312e81' }]}>{t.arrMathTitle}</Text>
        <Text style={styles.tiny}>
          {t.arrMathTotal} ৳ {signed(result.total_basic_difference + result.total_hra_protection)}
        </Text>
        <Text style={[styles.tiny, styles.minus]}>
          {t.arrMathDeductions} − {tk(result.total_deduction)}
        </Text>
        {stamp > 0 ? (
          <Text style={[styles.tiny, styles.minus]}>
            {t.stampDeduct} − {tk(stamp)}
          </Text>
        ) : null}
        <Text style={styles.dueValue}>৳ {signed(payable)}</Text>
        <Text style={styles.tiny}>{t.inWords(takaInWords(locale, payable))}</Text>
        {result.total_net_arrear < 0 ? <Text style={styles.tiny}>{t.arrNegative}</Text> : null}
      </View>

      <Pressable
        onPress={onDownloadTr}
        disabled={downloading}
        style={({ pressed }) => [styles.downloadBtn, pressed && styles.pressed]}
      >
        {downloading ? <ActivityIndicator color={colors.white} /> : <Ionicons name="download-outline" size={18} color={colors.white} />}
        <Text style={styles.downloadText}>{downloading ? t.downloading : t.trFormDownload(String(formNo))}</Text>
      </Pressable>
    </>
  );
}

function MonthMath({
  locale,
  t,
  num,
  amt,
  signed,
  result,
  group,
}: {
  locale: CalcLocale;
  t: SalaryCopy;
  num: (v: string | number) => string;
  amt: (n: number) => string;
  signed: (n: number) => string;
  result: SalaryArrearResult;
  group: { lead: SalaryArrearMonthRow; same: SalaryArrearMonthRow[] };
}) {
  const row = group.lead;
  const specialRatePercent = row.special_rate_percent;
  const prorated = row.days < row.month_days;
  const fullDiff = row.new_basic - row.drawn_basic;
  const rawSpecial = Math.round((row.drawn_basic * specialRatePercent) / 100);
  const fullSpecial = specialAllowanceAmount(row.drawn_basic, specialRatePercent / 100);
  const specialCalc =
    fullSpecial > rawSpecial
      ? `${amt(row.drawn_basic)} × ${num(specialRatePercent)}% (${t.specialMin(amt(fullSpecial))})`
      : `${amt(row.drawn_basic)} × ${num(specialRatePercent)}%`;
  const scaleUp = (n: number) => (prorated && row.days > 0 ? roundSalaryTaka((n * row.month_days) / row.days) : n);
  const fullHra = scaleUp(row.excess_hra);
  const fullProtection = scaleUp(row.hra_protection);
  const protection = fullProtection > 0;
  const hraEntitlement = result.hra_entitlement_30_06;
  const hraDrawn = protection ? hraEntitlement - fullProtection : hraEntitlement + fullHra;
  const lines: Array<{ no: number; label: string; calc?: string; value: string; tone?: 'minus' | 'plus' | 'net' }> = [
    { no: 1, label: t.lineNewBasic, value: amt(row.new_basic) },
    { no: 2, label: t.lineDrawn, value: `− ${amt(row.drawn_basic)}`, tone: 'minus' },
    { no: 3, label: t.lineDiff, calc: `${amt(row.new_basic)} − ${amt(row.drawn_basic)}`, value: signed(fullDiff) },
    { no: 4, label: t.lineSpecial, calc: specialCalc, value: `− ${amt(fullSpecial)}`, tone: 'minus' },
    protection
      ? {
          no: 5,
          label: t.lineHraProtection,
          calc: `৳ ${amt(hraEntitlement)} − ৳ ${amt(hraDrawn)}`,
          value: `+ ${amt(fullProtection)}`,
          tone: 'plus',
        }
      : {
          no: 5,
          label: t.lineHra,
          calc: result.hra_eligible ? `৳ ${amt(hraDrawn)} − ৳ ${amt(hraEntitlement)}` : t.arrHraNone,
          value: `− ${amt(fullHra)}`,
          tone: 'minus',
        },
    {
      no: 6,
      label: protection ? t.lineNetProtection : t.lineNet,
      value: signed(row.full_net_arrear),
      tone: 'net',
    },
  ];
  if (prorated) {
    lines.push({
      no: 7,
      label: t.lineProrated(num(row.days), num(row.month_days)),
      calc: `${signed(row.full_net_arrear)} ÷ ${num(row.month_days)} × ${num(row.days)}`,
      value: signed(row.net_arrear),
      tone: 'net',
    });
  }
  const sameLabel =
    group.same.length > 0
      ? t.sameAs(group.same.map((item) => monthRowLabel(locale, item)).join(', '), monthRowLabel(locale, row))
      : '';

  return (
    <View style={styles.monthCard}>
      <Text style={styles.rowTitle}>{monthRowLabel(locale, row)}</Text>
      {lines.map((line) => (
        <View key={line.no} style={styles.line}>
          <Text style={styles.lineNo}>{num(line.no)}.</Text>
          <View style={styles.flex}>
            <Text style={styles.stepLabel}>{line.label}</Text>
            {line.calc ? <Text style={styles.calc}>{line.calc}</Text> : null}
          </View>
          <Text style={[styles.stepAmount, line.tone === 'minus' && styles.minus, line.tone === 'plus' && styles.plus]}>
            {line.value}
          </Text>
        </View>
      ))}
      {sameLabel ? <Text style={styles.tiny}>{sameLabel}</Text> : null}
    </View>
  );
}

function CheckRow({ label, value, onChange }: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.checkRow}>
      <Text style={styles.checkLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </Pressable>
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
  stepLabel: { fontSize: 13, color: colors.text },
  stepAmount: { fontSize: 12, fontWeight: '700', color: colors.text, fontFamily: MONO },
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
  section: { marginTop: 6, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, color: colors.textMuted, textTransform: 'uppercase' },
  basisRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  flexLabel: { flex: 1, fontSize: 13, color: colors.text },
  basisValue: { maxWidth: '52%', textAlign: 'right', fontSize: 13, fontWeight: '700', color: colors.text, fontFamily: MONO },
  monthCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 8, gap: 4 },
  line: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  lineNo: { width: 22, fontSize: 12, fontWeight: '700', color: colors.textMuted },
  summaryRow: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 8, gap: 2 },
  plus: { color: '#047857' },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: INDIGO,
    borderRadius: 12,
    paddingVertical: 12,
  },
  downloadText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  exBox: { gap: 8, borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fffbeb', borderRadius: 12, padding: spacing.sm },
  exFields: { gap: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  checkLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
  },
  pick: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pickLabel: { fontSize: 12, color: colors.textMuted },
  pickValue: { fontSize: 14, fontWeight: '700', color: colors.text },
});
