import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  NPS_2015,
  NPS_2026,
  PAY_GRADES,
  calculateEmployeeGross,
  calculateSalary2026AllPhases,
  formatTaka,
  isFixedPayGrade,
  salaryConversionRate,
  type ChargeType,
  type EducationChildren,
  type EmployeeGrossResult,
  type HousingStatus,
  type HraArea,
  type PayGrade,
  type Salary2026Result,
  type SubstantiveGrade,
} from '@ibas/shared-types';
import { LocaleToggle } from '@/components/calc/LocaleToggle';
import { PickerSheet, SelectField } from '@/components/ui/PickerSheet';
import { TextField } from '@/components/ui/TextField';
import type { CalcLocale } from '@/lib/calc-i18n';
import { webUrl } from '@/lib/web-href';
import {
  STAGE_COLOR,
  allowancesTotal,
  parseAmountInput,
  stage3Basics,
  trackSalaryCalculate,
} from '@/lib/salary-api';
import {
  HRA_AREAS,
  allowanceText,
  housingText,
  hraAreaText,
  localNum,
  localTaka,
  salaryCopy,
  stepText,
  type SalaryCopy,
  type Segments,
} from '@/lib/salary-i18n';
import { colors, spacing } from '@/theme';

const GREEN = '#047857';
const TEAL = '#0f766e';
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const EDUCATION_VALUES: EducationChildren[] = [0, 1, 2];
const SUBSTANTIVE: SubstantiveGrade[] = [11, 12, 13, 14, 15];
const STAGE_NO: Record<Salary2026Result['phase'], number> = { '2026-07-01': 1, '2027-01-01': 2, '2027-07-01': 3 };

type PickerKind = 'grade' | 'oldPay' | 'substantive' | 'hra' | 'education';

interface Ctx {
  t: SalaryCopy;
  locale: CalcLocale;
}

function RichText({ segments, style }: { segments: Segments; style: object }) {
  return (
    <Text style={style}>
      {segments.map(([text, bold], i) => (
        <Text key={i} style={bold ? styles.bold : undefined}>
          {text}
        </Text>
      ))}
    </Text>
  );
}

function Radio({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.radio, pressed && styles.pressed]}>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={selected ? TEAL : colors.textMuted}
      />
      <Text style={[styles.radioText, selected && styles.radioTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Pill({ label, tone = 'plain' }: { label: string; tone?: 'plain' | 'amber' }) {
  return (
    <View style={[styles.pill, tone === 'amber' && styles.pillAmber]}>
      <Text style={[styles.pillText, tone === 'amber' && styles.pillTextAmber]}>{label}</Text>
    </View>
  );
}

function Stat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <View style={[styles.stat, emphasize && styles.statEm]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, emphasize && styles.statValueEm]}>{value}</Text>
    </View>
  );
}

function AllowanceSummary({ ctx, basic, allowances, gpf }: { ctx: Ctx; basic: number; allowances: number; gpf: number }) {
  const { t, locale } = ctx;
  const tk = (n: number) => localTaka(locale, n);
  const total = basic + allowances;
  return (
    <View style={styles.summary}>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryBox, styles.flex]}>
          <Text style={styles.statLabel}>{t.basic}</Text>
          <Text style={styles.summaryValue}>{tk(basic)}</Text>
          <Text style={styles.tiny}>{t.basicNote}</Text>
        </View>
        <View style={[styles.summaryBox, styles.summaryTeal, styles.flex]}>
          <Text style={[styles.statLabel, { color: '#134e4a' }]}>{t.totalAllowance}</Text>
          <Text style={styles.summaryValue}>{tk(allowances)}</Text>
          <Text style={styles.tiny}>{t.fixedOnBasic}</Text>
        </View>
      </View>
      <View style={[styles.summaryBox, styles.summaryGreen]}>
        <Text style={[styles.statLabel, { color: '#064e3b' }]}>{t.basicPlusAllowance}</Text>
        <Text style={styles.summaryValue}>{tk(total)}</Text>
        <Text style={styles.tiny}>
          {tk(basic)} + {tk(allowances)}
        </Text>
      </View>
      {gpf > 0 ? (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryBox, styles.summaryRose, styles.flex]}>
            <Text style={[styles.statLabel, { color: '#9f1239' }]}>{t.gpfDeduction}</Text>
            <Text style={[styles.summaryValue, { color: '#9f1239' }]}>− {tk(gpf)}</Text>
          </View>
          <View style={[styles.summaryBox, styles.summarySlate, styles.flex]}>
            <Text style={styles.statLabel}>{t.netPayable}</Text>
            <Text style={styles.summaryValue}>{tk(total - gpf)}</Text>
            <Text style={styles.tiny}>{t.netFormula}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function StageCard({ ctx, result, allowances, gpf }: { ctx: Ctx; result: Salary2026Result; allowances: number; gpf: number }) {
  const { t, locale } = ctx;
  const tk = (n: number) => localTaka(locale, n);
  const color = STAGE_COLOR[result.phase];
  const stage3 = result.phase === '2027-07-01';
  const { from, to } = stage3Basics(result);
  const moved = to !== from;
  const date = localNum(locale, result.phase_label);

  return (
    <View style={styles.card}>
      <View style={[styles.cardBar, { backgroundColor: color }]}>
        <Text style={styles.cardBarTitle}>{t.stageTitle(STAGE_NO[result.phase], date)}</Text>
        {!stage3 ? <Text style={styles.cardBarSub}>{t.step5Rate(localNum(locale, result.rate_percent))}</Text> : null}
      </View>
      <View style={styles.cardBody}>
        {stage3 ? (
          <View style={styles.stage3Row}>
            <View style={[styles.stat, styles.flex]}>
              <Text style={styles.statLabel}>{t.basic2026}</Text>
              <Text style={styles.statValue}>{tk(from)}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={color} />
            <View style={[styles.stat, styles.flex, moved ? styles.statViolet : styles.statAmber]}>
              <Text style={styles.statLabel}>{t.basic2027}</Text>
              <Text style={styles.statValue}>{tk(to)}</Text>
              <Text style={styles.tiny}>{moved ? t.nextStage(tk(to - from)) : t.lastStage}</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.statGrid}>
              <Stat label={t.oldBasic} value={tk(result.old_pay)} />
              <Stat label={t.matched} value={result.matched_new_stage != null ? tk(result.matched_new_stage) : '—'} />
            </View>
            <Stat label={t.newBasic(date)} value={tk(result.new_pay)} emphasize />
            <View style={styles.steps}>
              {result.steps.map((row) => {
                const text = stepText(locale, result, row);
                return (
                  <View key={`${result.phase}-${row.step}`} style={styles.stepRow}>
                    <View style={[styles.stepNo, { backgroundColor: `${color}1f` }]}>
                      <Text style={[styles.stepNoText, { color }]}>{localNum(locale, row.step)}</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.stepLabel}>{text.label}</Text>
                      {text.note ? <Text style={styles.tiny}>{text.note}</Text> : null}
                      {text.calculation?.trim() ? <Text style={styles.stepCalc}>{text.calculation}</Text> : null}
                    </View>
                    <Text style={styles.stepAmount}>{localNum(locale, formatTaka(row.value))}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <AllowanceSummary ctx={ctx} basic={stage3 ? to : result.new_pay} allowances={allowances} gpf={gpf} />

        {!stage3 && result.increment_skipped && !result.fixed ? (
          <Text style={styles.warnText}>{t.lastStageWarn}</Text>
        ) : null}
      </View>
    </View>
  );
}

function LineTable({
  ctx,
  head,
  tone,
  rows,
}: {
  ctx: Ctx;
  head: string;
  tone: string;
  rows: Array<{ key: string; label: string; note?: string; amount: number; muted?: boolean }>;
}) {
  return (
    <View style={styles.table}>
      <View style={[styles.tableHead, { backgroundColor: tone }]}>
        <Text style={styles.tableHeadText}>{head}</Text>
        <Text style={styles.tableHeadText}>{ctx.t.amount}</Text>
      </View>
      {rows.map((row) => (
        <View key={row.key} style={[styles.tableRow, row.muted && styles.tableRowMuted]}>
          <View style={styles.flex}>
            <Text style={styles.stepLabel}>{row.label}</Text>
            {row.note ? <Text style={styles.tiny}>{row.note}</Text> : null}
          </View>
          <Text style={styles.stepAmount}>{localNum(ctx.locale, formatTaka(row.amount))}</Text>
        </View>
      ))}
    </View>
  );
}

function GrossCard({ ctx, gross }: { ctx: Ctx; gross: EmployeeGrossResult }) {
  const { t, locale } = ctx;
  const lines = gross.monthly_lines.filter((row) => row.code !== 'basic');
  const toRow = (row: EmployeeGrossResult['monthly_lines'][number]) => {
    const text = allowanceText(locale, row, gross);
    return { key: row.code, label: text.label, note: text.note, amount: row.amount };
  };
  return (
    <View style={[styles.card, { borderColor: '#99f6e4' }]}>
      <View style={[styles.cardBar, styles.cardBarColumn, { backgroundColor: TEAL }]}>
        <Text style={styles.cardBarTitle}>{t.totalAllowance}</Text>
        <Text style={styles.cardBarSub}>{t.grossSub(localNum(locale, gross.grade), housingText(locale, gross))}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t.totalAllowance}</Text>
          <Text style={styles.totalValue}>{localTaka(locale, allowancesTotal(gross))}</Text>
        </View>
        <LineTable
          ctx={ctx}
          head={t.component}
          tone="#f8fafc"
          rows={[
            { key: 'basic', label: t.basicShown, note: t.basicRef, amount: gross.basic, muted: true },
            ...lines.map(toRow),
          ]}
        />
        <LineTable ctx={ctx} head={t.annualHead} tone="#fffbeb" rows={gross.annual_lines.map(toRow)} />
      </View>
    </View>
  );
}

export default function SalaryOn2026Screen() {
  const scrollRef = useRef<ScrollView>(null);
  const inputsY = useRef(0);
  const [locale, setLocale] = useState<CalcLocale>('bn');
  const [grade, setGrade] = useState<PayGrade>(5);
  const [oldPay, setOldPay] = useState<number>(NPS_2015[5][5]!);
  const [housingStatus, setHousingStatus] = useState<HousingStatus>('hra_eligible');
  const [hraArea, setHraArea] = useState<HraArea>('dhaka');
  const [educationChildren, setEducationChildren] = useState<EducationChildren>(0);
  const [washingAllowance, setWashingAllowance] = useState(false);
  const [chargeType, setChargeType] = useState<ChargeType>('regular');
  const [substantiveGrade, setSubstantiveGrade] = useState<SubstantiveGrade | null>(null);
  const [gpfInput, setGpfInput] = useState('');
  const [results, setResults] = useState<Salary2026Result[] | null>(null);
  const [gross, setGross] = useState<EmployeeGrossResult | null>(null);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState<PickerKind | null>(null);

  const t = salaryCopy(locale);
  const ctx: Ctx = { t, locale };
  const num = (v: string | number) => localNum(locale, v);
  const tk = (n: number) => localTaka(locale, n);

  const oldStages = NPS_2015[grade];
  const newStages = NPS_2026[grade];
  const fixed = isFixedPayGrade(grade);
  const rate2026 = Math.round(salaryConversionRate(grade, '2026-07-01') * 100);
  const rate2027 = Math.round(salaryConversionRate(grade, '2027-01-01') * 100);
  const gpf = useMemo(() => parseAmountInput(gpfInput), [gpfInput]);
  const allowances = allowancesTotal(gross);
  const oldIdx = oldStages.indexOf(oldPay);

  function stageSuffix(i: number): string {
    if (i === 0) return t.minimum;
    if (i === oldStages.length - 1 && oldStages.length > 1) return t.last;
    return '';
  }

  const gradeLabel = (g: PayGrade) => `${t.grade} ${num(g)}${isFixedPayGrade(g) ? t.fixedSuffix : ''}`;

  function clearResults() {
    setResults(null);
    setGross(null);
    setError('');
  }

  function update<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      clearResults();
    };
  }

  function onGradeChange(next: PayGrade) {
    setGrade(next);
    setOldPay(NPS_2015[next][0]!);
    setChargeType('regular');
    setSubstantiveGrade(null);
    clearResults();
  }

  function calculate() {
    setError('');
    try {
      setResults(calculateSalary2026AllPhases({ grade, old_pay: oldPay }));
      setGross(
        calculateEmployeeGross({
          grade,
          basic: oldPay,
          housing_status: housingStatus,
          hra_area: hraArea,
          education_children: educationChildren,
          washing_allowance: washingAllowance,
          charge_type: chargeType,
          substantive_grade: substantiveGrade,
        }),
      );
      trackSalaryCalculate(grade, oldPay);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.calcError);
    }
  }

  function editInputs() {
    scrollRef.current?.scrollTo({ y: Math.max(0, inputsY.current - spacing.sm), animated: true });
  }

  function shareLink() {
    void Share.share({
      title: `${t.title} — ProAssist`,
      message: `${t.heroTitle}\n${webUrl('/salary')}`,
    }).catch(() => {});
  }

  const pickerConfig = (() => {
    switch (picker) {
      case 'grade':
        return {
          title: t.grade,
          value: String(grade),
          options: PAY_GRADES.map((g) => ({ value: String(g), label: gradeLabel(g) })),
          onSelect: (v: string) => onGradeChange(Number(v) as PayGrade),
        };
      case 'oldPay':
        return {
          title: t.basicJune,
          value: String(oldPay),
          options: oldStages.map((amt, i) => ({ value: String(amt), label: `${tk(amt)}${stageSuffix(i)}` })),
          onSelect: (v: string) => update(setOldPay)(Number(v)),
        };
      case 'substantive':
        return {
          title: t.substantive,
          value: substantiveGrade != null ? String(substantiveGrade) : '',
          options: [
            { value: '', label: t.substantiveNA },
            ...SUBSTANTIVE.map((g) => ({ value: String(g), label: `${t.grade} ${num(g)}` })),
          ],
          onSelect: (v: string) => update(setSubstantiveGrade)(v === '' ? null : (Number(v) as SubstantiveGrade)),
        };
      case 'hra':
        return {
          title: t.hraArea,
          value: hraArea,
          options: HRA_AREAS.map((a) => ({ value: a, label: hraAreaText(locale, a) })),
          onSelect: (v: string) => update(setHraArea)(v as HraArea),
        };
      case 'education':
        return {
          title: t.education,
          value: String(educationChildren),
          options: EDUCATION_VALUES.map((e) => ({ value: String(e), label: t.educationOptions[e]! })),
          onSelect: (v: string) => update(setEducationChildren)(Number(v) as EducationChildren),
        };
      default:
        return null;
    }
  })();

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: t.title,
          headerRight: () => (
            <View style={styles.headerRight}>
              <LocaleToggle value={locale} onChange={setLocale} />
              <Pressable onPress={shareLink} hitSlop={10}>
                <Ionicons name="share-social-outline" size={20} color={colors.white} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        ref={scrollRef}
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {results && gross ? (
          <View style={styles.results}>
            <View style={styles.resultHead}>
              <View style={styles.flex}>
                <Text style={styles.resultKicker}>{t.resultKicker}</Text>
                <Text style={styles.resultSummary}>{t.resultSummary(num(grade), tk(oldPay))}</Text>
              </View>
              <Pressable onPress={editInputs} style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}>
                <Ionicons name="create-outline" size={15} color={GREEN} />
                <Text style={styles.editBtnText}>{t.editInputs}</Text>
              </Pressable>
            </View>

            <GrossCard ctx={ctx} gross={gross} />

            {results.map((result) => (
              <StageCard key={result.phase} ctx={ctx} result={result} allowances={allowances} gpf={gpf} />
            ))}

            <View style={styles.draft}>
              <Ionicons name="alert-circle-outline" size={18} color="#92400e" />
              <Text style={styles.draftText}>{t.draft}</Text>
            </View>
          </View>
        ) : null}

        <LinearGradient colors={[GREEN, '#059669', TEAL]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroKicker}>{t.heroKicker}</Text>
          <Text style={styles.heroTitle}>{t.heroTitle}</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{t.heroBadge}</Text>
          </View>
          <Text style={styles.heroText}>{t.heroText}</Text>
        </LinearGradient>

        <View style={styles.rules}>
          {t.rules.map((rule, i) => (
            <RichText key={i} segments={rule} style={styles.rule} />
          ))}
        </View>

        <View
          style={styles.inputCard}
          onLayout={(e) => {
            inputsY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.kicker}>{t.startHere}</Text>
          <Text style={styles.cardTitle}>{t.currentPay}</Text>

          <SelectField label={t.grade} display={gradeLabel(grade)} onPress={() => setPicker('grade')} />
          <SelectField
            label={t.basicJune}
            display={`${tk(oldPay)}${oldIdx >= 0 ? stageSuffix(oldIdx) : ''}`}
            onPress={() => setPicker('oldPay')}
          />

          <View style={styles.pills}>
            <Pill label={`${t.grade} ${num(grade)}`} />
            <Pill label={`${num('01-07-26')} · ${num(rate2026)}%`} />
            <Pill label={`${num('01-01-27')} · ${num(rate2027)}%`} />
            {fixed ? <Pill label={t.fixedPay} tone="amber" /> : null}
          </View>

          <View style={styles.scale}>
            <Text style={styles.scaleText}>
              <Text style={styles.bold}>{t.nps2015}</Text>
              {num(oldStages.join('–'))}
            </Text>
            <Text style={styles.scaleText}>
              <Text style={styles.bold}>{t.nps2026}</Text>
              {num(newStages.join('–'))}
            </Text>
          </View>

          <View style={styles.grossBox}>
            <Text style={[styles.kicker, { color: '#115e59' }]}>{t.confirmGross}</Text>
            <Text style={styles.cardTitle}>{t.allowancesWithBasic}</Text>

            {grade >= 2 && grade <= 10 ? (
              <View style={styles.group}>
                <Text style={styles.groupLabel}>{t.postType}</Text>
                <Radio label={t.regular} selected={chargeType === 'regular'} onPress={() => update(setChargeType)('regular')} />
                <Radio
                  label={t.currentCharge}
                  selected={chargeType === 'current_charge'}
                  onPress={() => update(setChargeType)('current_charge')}
                />
              </View>
            ) : null}

            {grade >= 7 && grade <= 10 ? (
              <SelectField
                label={t.substantive}
                display={substantiveGrade != null ? `${t.grade} ${num(substantiveGrade)}` : t.substantiveNA}
                hint={t.substantiveHint}
                onPress={() => setPicker('substantive')}
              />
            ) : null}

            <View style={styles.group}>
              <Text style={styles.groupLabel}>{t.housing}</Text>
              <Radio
                label={t.hraEligible}
                selected={housingStatus === 'hra_eligible'}
                onPress={() => update(setHousingStatus)('hra_eligible')}
              />
              <Radio
                label={t.govtAccommodation}
                selected={housingStatus === 'govt_accommodation'}
                onPress={() => update(setHousingStatus)('govt_accommodation')}
              />
            </View>

            {housingStatus === 'hra_eligible' ? (
              <SelectField label={t.hraArea} display={hraAreaText(locale, hraArea)} onPress={() => setPicker('hra')} />
            ) : null}

            <SelectField
              label={t.education}
              display={t.educationOptions[educationChildren]!}
              onPress={() => setPicker('education')}
            />

            <View style={styles.group}>
              <Text style={styles.groupLabel}>{t.washing}</Text>
              <Radio label={t.no} selected={!washingAllowance} onPress={() => update(setWashingAllowance)(false)} />
              <Radio label={t.washingYes} selected={washingAllowance} onPress={() => update(setWashingAllowance)(true)} />
            </View>

            <TextField
              label={t.gpf}
              placeholder={t.gpfPlaceholder}
              keyboardType="numeric"
              value={gpfInput}
              onChangeText={setGpfInput}
              hint={t.gpfHint(gpf > 0 ? tk(gpf) : null)}
            />

            <Text style={styles.grossNote}>{t.grossNote}</Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable onPress={calculate} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
            <Ionicons name="calculator-outline" size={18} color={colors.white} />
            <Text style={styles.primaryBtnText}>{t.calculate}</Text>
          </Pressable>
        </View>

        {results && gross ? (
          <>
            <View style={styles.thanks}>
              <View style={styles.thanksIcon}>
                <Ionicons name="heart-outline" size={24} color="#be123c" />
              </View>
              <Text style={styles.thanksKicker}>{t.thanksKicker}</Text>
              <Text style={styles.thanksTitle}>{t.thanksTitle}</Text>
              <RichText segments={t.thanksText} style={styles.thanksText} />
              <Text style={styles.thanksSign}>{t.thanksSign}</Text>
            </View>

            <Pressable onPress={shareLink} style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}>
              <Ionicons name="share-social-outline" size={18} color={GREEN} />
              <Text style={styles.shareBtnText}>{t.share}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      {pickerConfig ? (
        <PickerSheet
          visible
          title={pickerConfig.title}
          options={pickerConfig.options}
          value={pickerConfig.value}
          onSelect={(opt) => {
            pickerConfig.onSelect(opt.value);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: '#f4f7f5' },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  pressed: { opacity: 0.75 },
  bold: { fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  results: { gap: spacing.md },
  resultHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: spacing.md,
  },
  resultKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: GREEN },
  resultSummary: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#6ee7b7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editBtnText: { color: GREEN, fontWeight: '700', fontSize: 12 },

  hero: { borderRadius: 18, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  heroKicker: { color: '#d1fae5', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  heroTitle: { color: colors.white, fontSize: 21, fontWeight: '800', textAlign: 'center', lineHeight: 30 },
  heroBadge: { backgroundColor: '#a7f3d0', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  heroBadgeText: { color: '#022c22', fontWeight: '800', fontSize: 13 },
  heroText: { color: '#ecfdf5', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  rules: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: spacing.md,
    gap: 6,
  },
  rule: { fontSize: 13, lineHeight: 20, color: '#064e3b' },

  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textMuted },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: -8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillAmber: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.text },
  pillTextAmber: { color: '#78350f' },
  scale: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    gap: 4,
    backgroundColor: '#f8fafc',
  },
  scaleText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },

  grossBox: {
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#f0fdfa',
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.md,
  },
  group: { gap: 4 },
  groupLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  radio: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 5 },
  radioText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  radioTextOn: { fontWeight: '600', color: '#134e4a' },
  grossNote: { fontSize: 12, lineHeight: 19, color: '#134e4a' },
  errorText: { color: colors.error, fontSize: 13 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardBarColumn: { flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
  cardBarTitle: { color: colors.white, fontWeight: '800', fontSize: 14 },
  cardBarSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12 },
  cardBody: { padding: spacing.md, gap: spacing.sm },

  statGrid: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: spacing.sm,
    gap: 2,
  },
  statEm: { borderColor: '#6ee7b7', backgroundColor: '#ecfdf5' },
  statViolet: { borderColor: '#ddd6fe', backgroundColor: '#f5f3ff' },
  statAmber: { borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: colors.textMuted, textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  statValueEm: { fontSize: 22, color: '#064e3b' },
  stage3Row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  steps: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stepNo: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNoText: { fontSize: 12, fontWeight: '800' },
  stepLabel: { fontSize: 13, color: colors.text, lineHeight: 19 },
  stepCalc: { fontSize: 11, color: '#475569', fontFamily: MONO, marginTop: 2 },
  stepAmount: { fontSize: 13, fontWeight: '700', color: colors.text, fontFamily: MONO },
  tiny: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  warnText: { fontSize: 12, color: '#92400e' },

  summary: {
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#f0fdfa',
    borderRadius: 12,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryBox: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.sm,
    gap: 2,
  },
  summaryTeal: { borderColor: '#5eead4', backgroundColor: '#ccfbf1' },
  summaryGreen: { borderColor: '#6ee7b7', backgroundColor: '#d1fae5' },
  summaryRose: { borderColor: '#fecdd3', backgroundColor: '#fff1f2' },
  summarySlate: { borderColor: '#cbd5e1', backgroundColor: '#f1f5f9' },
  summaryValue: { fontSize: 16, fontWeight: '800', color: colors.text, fontFamily: MONO },

  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  tableHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingVertical: 8 },
  tableHeadText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: colors.textMuted, textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tableRowMuted: { backgroundColor: '#f8fafc' },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#ccfbf1',
    borderWidth: 1,
    borderColor: '#5eead4',
    borderRadius: 12,
    padding: spacing.sm,
  },
  totalLabel: { flex: 1, fontSize: 13, fontWeight: '800', color: '#042f2e' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#134e4a', fontFamily: MONO },

  draft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 12,
    padding: spacing.md,
  },
  draftText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#78350f', lineHeight: 21 },

  thanks: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 18,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  thanksIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thanksKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: '#be123c' },
  thanksTitle: { fontSize: 19, fontWeight: '800', color: colors.text, textAlign: 'center' },
  thanksText: { fontSize: 14, lineHeight: 22, color: '#334155', textAlign: 'center' },
  thanksSign: { fontSize: 13, fontWeight: '600', fontStyle: 'italic', color: '#9f1239' },

  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#6ee7b7',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
  },
  shareBtnText: { color: GREEN, fontWeight: '700', fontSize: 14 },
});
