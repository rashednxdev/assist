import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { PickerSheet, SelectField } from '@/components/ui/PickerSheet';
import { TextField } from '@/components/ui/TextField';
import { Badge, IbasCard, IbasError, IbasErrorScreen, IbasLoading, ibasStyles, SectionHead } from '@/components/ibas/IbasBits';
import { MyWorkflowRoles } from '@/components/ibas/MyWorkflowRoles';
import {
  areaHref,
  canStartProcess,
  currentFiscalYear,
  fetchMyRuns,
  fetchProcess,
  fetchRoleColors,
  MONTHS,
  RUN_STATUS,
  startProcessRun,
  startsOfficialRun,
  type ProcessDetail,
  type ProcessStep,
  type RunSummary,
} from '@/lib/ibas-api';
import { useIbasAreas } from '@/lib/ibas-areas';
import { useAuth } from '@/lib/auth-context';
import { formatDdMmYyyy } from '@/lib/date-format';
import { colors, spacing } from '@/theme';

const FIELD_TYPE: Record<string, string> = {
  text: 'Text',
  textarea: 'Long text',
  number: 'Number',
  date: 'Date',
  select: 'Choice',
  file: 'File',
  checkbox: 'Yes / No',
  amount: 'Amount',
};

function StepCard({ step, last, color, roleColor }: { step: ProcessStep; last: boolean; color: string; roleColor: (c: string) => string }) {
  const [open, setOpen] = useState(true);
  const rc = roleColor(step.role_code);
  return (
    <View style={styles.stepWrap}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: step.is_auto ? colors.textMuted : color }]}>
          {step.is_auto ? <Ionicons name="flash" size={13} color={colors.white} /> : <Text style={styles.dotText}>{step.step_number}</Text>}
        </View>
        {!last ? <View style={styles.line} /> : null}
      </View>
      <View style={styles.stepCard}>
        <Pressable onPress={() => setOpen(!open)} style={styles.stepHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
          <View style={styles.flex}>
            <Text style={styles.stepTitle}>{step.title_en}</Text>
            {step.title_bn ? <Text style={styles.stepTitleBn}>{step.title_bn}</Text> : null}
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        </Pressable>
        <View style={ibasStyles.row}>
          <Badge label={step.role_name_en ? `${step.role_code} · ${step.role_name_en}` : step.role_code} color={rc} filled />
          {step.is_auto ? <Badge label="Automatic" /> : null}
          {step.is_optional ? <Badge label="Optional" color={colors.warning} /> : null}
        </View>
        {open ? (
          <>
            {step.description_en ? <Text style={ibasStyles.body}>{step.description_en}</Text> : null}
            {step.condition_text ? (
              <View style={styles.condition}>
                <Ionicons name="git-compare-outline" size={14} color="#6d28d9" />
                <Text style={styles.conditionText}>{step.condition_text}</Text>
              </View>
            ) : null}
            {step.fields.length > 0 ? (
              <View style={styles.fields}>
                <Text style={ibasStyles.label}>Information to fill</Text>
                {step.fields.map((f) => (
                  <View key={f.name} style={styles.fieldRow}>
                    <Ionicons name="ellipse" size={6} color={colors.textMuted} />
                    <Text style={styles.fieldText}>
                      {f.label}
                      {f.required ? <Text style={styles.req}> *</Text> : null}
                    </Text>
                    <Text style={styles.fieldType}>{FIELD_TYPE[f.type] ?? f.type}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {step.handoff_msg || step.handoff_role ? (
              <View style={styles.handoff}>
                <Ionicons name="arrow-redo-outline" size={14} color="#0369a1" />
                <Text style={styles.handoffText}>
                  {step.handoff_role ? <Text style={styles.handoffRole}>Hand over to {step.handoff_role}. </Text> : null}
                  {step.handoff_msg ?? ''}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

function StartRunCard({ taskId, color, official, firstRole, onStarted }: { taskId: string; color: string; official: boolean; firstRole?: string; onStarted: (runId: string) => void }) {
  const [fiscalYear, setFiscalYear] = useState(currentFiscalYear);
  const [month, setMonth] = useState(() => MONTHS[new Date().getMonth()]!);
  const [reference, setReference] = useState('');
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function start() {
    if (!fiscalYear.trim()) {
      setError('Fiscal year is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const d = await startProcessRun(taskId, { fiscal_year: fiscalYear.trim(), month, reference_no: reference.trim() || undefined });
      onStarted(d.run.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start the run');
    } finally {
      setBusy(false);
    }
  }

  return (
    <IbasCard accent={color}>
      <SectionHead icon="play-circle-outline" title="Start interactive run" color={color} />
      {official ? (
        <Text style={ibasStyles.small}>Work through this process step by step. Each step is recorded, and the next office role is notified when you hand over.</Text>
      ) : (
        <View style={styles.info}>
          <Ionicons name="person-circle-outline" size={18} color="#0369a1" />
          <Text style={styles.infoText}>
            Personal run — you complete every step yourself and no one is notified.
            {firstRole ? ` An administrator-assigned ${firstRole} role is needed for an official run with handoffs.` : ''}
          </Text>
        </View>
      )}
      <TextField label="Fiscal year" value={fiscalYear} onChangeText={setFiscalYear} placeholder="2025-26" />
      <SelectField label="Month" display={month} onPress={() => setPicking(true)} />
      <TextField label="Reference no. (optional)" value={reference} onChangeText={setReference} placeholder="Bill / file / memo no." autoCapitalize="characters" />
      {error ? <IbasError message={error} /> : null}
      <Button title="Start run" onPress={() => void start()} loading={busy} disabled={busy} />
      <PickerSheet
        visible={picking}
        title="Month"
        options={MONTHS.map((m) => ({ value: m, label: m }))}
        value={month}
        onSelect={(o) => setMonth(o.value)}
        onClose={() => setPicking(false)}
      />
    </IbasCard>
  );
}

export default function AreaProcessScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { code, id } = useLocalSearchParams<{ code: string; id: string }>();
  const { areaColor } = useIbasAreas();
  const [detail, setDetail] = useState<ProcessDetail | null>(null);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadRuns = useCallback(async () => {
    if (!id) return;
    try {
      setRuns((await fetchMyRuns()).filter((r) => r.task_id === id));
    } catch {
      setRuns([]);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadRuns();
    }, [loadRuns]),
  );

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [d, r] = await Promise.all([fetchProcess(id), fetchRoleColors()]);
      setDetail(d);
      setRoles(r);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this process');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await Promise.all([load(), loadRuns()]);
    setRefreshing(false);
  }

  const accent = code ? areaColor(code) : colors.primary;
  if (!detail || !code) return error ? <IbasErrorScreen message={error} /> : <IbasLoading color={accent} />;

  const { task, steps } = detail;
  const roleColor = (c: string) => roles[c] || '#475569';
  const startable = canStartProcess(user, steps);
  const official = startsOfficialRun(user, steps);
  const firstRole = steps[0]?.role_code;

  return (
    <>
      <Stack.Screen options={{ title: 'Process' }} />
      <KeyboardAvoidingView style={ibasStyles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView
          style={ibasStyles.root}
          contentContainerStyle={ibasStyles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
        >
          <IbasCard accent={accent}>
            <Text style={ibasStyles.kicker}>STEP-BY-STEP PROCESS</Text>
            <Text style={ibasStyles.title} selectable>
              {task.name_en}
            </Text>
            {task.name_bn ? <Text style={ibasStyles.titleBn}>{task.name_bn}</Text> : null}
            {task.description_en ? <Text style={ibasStyles.body}>{task.description_en}</Text> : null}
            <View style={ibasStyles.row}>
              {task.module_name_en ? <Badge label={task.module_name_en} color={accent} /> : null}
              <Badge label={`${steps.length} step${steps.length === 1 ? '' : 's'}`} />
              {task.estimated_time ? <Badge label={`~${task.estimated_time} min`} /> : null}
              {startable ? <Badge label={official ? 'Official run' : 'Personal run'} color={official ? '#059669' : '#0369a1'} /> : null}
            </View>
          </IbasCard>

          {startable ? (
            <StartRunCard
              taskId={task.id}
              color={accent}
              official={official}
              firstRole={firstRole}
              onStarted={(runId) => router.push(areaHref(code, 'run', runId))}
            />
          ) : null}

          {steps.length > 0 ? <MyWorkflowRoles highlight={firstRole} /> : null}

          {runs.length > 0 ? (
            <IbasCard>
              <SectionHead icon="time-outline" title="Your runs" color={accent} />
              {runs.map((r) => {
                const st = RUN_STATUS[r.status] ?? RUN_STATUS.in_progress;
                return (
                  <Pressable key={r.id} onPress={() => router.push(areaHref(code, 'run', r.id))} style={({ pressed }) => [styles.runRow, pressed && styles.pressed]}>
                    <View style={styles.flex}>
                      <Text style={styles.runTitle}>{r.reference_no ? `Ref ${r.reference_no}` : `Run of ${formatDdMmYyyy(r.started_at.slice(0, 10))}`}</Text>
                      <Text style={ibasStyles.small}>
                        {[r.fiscal_year ? `FY ${r.fiscal_year}` : '', r.month ?? '', r.status === 'in_progress' ? `step ${r.current_step} · ${r.current_role}` : '']
                          .filter(Boolean)
                          .join('  ·  ')}
                      </Text>
                    </View>
                    <Badge label={st.label} color={st.color} filled />
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </IbasCard>
          ) : null}

          {task.roles_involved.length > 0 ? (
            <IbasCard>
              <SectionHead icon="people-outline" title="Who is involved" color={accent} />
              <View style={ibasStyles.row}>
                {task.roles_involved.map((r) => (
                  <Badge key={r} label={r} color={roleColor(r)} filled />
                ))}
              </View>
            </IbasCard>
          ) : null}

          <IbasCard>
            <SectionHead icon="git-branch-outline" title="Steps" color={accent} />
            {steps.length === 0 ? (
              <Text style={ibasStyles.small}>No steps have been added to this process yet.</Text>
            ) : (
              <View>
                {steps.map((s, i) => (
                  <StepCard key={s.id ?? s.step_number} step={s} last={i === steps.length - 1} color={accent} roleColor={roleColor} />
                ))}
              </View>
            )}
          </IbasCard>

          <Text style={ibasStyles.disclaimer}>Always verify against the latest official rules and circulars before acting on this guide.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
    padding: spacing.sm + 4,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#075985',
  },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 4,
  },
  runTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  stepWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rail: {
    alignItems: 'center',
    width: 28,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: 2,
    backgroundColor: colors.border,
  },
  stepCard: {
    flex: 1,
    gap: 6,
    marginBottom: spacing.md,
  },
  stepHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    minHeight: 28,
    paddingTop: 4,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  stepTitleBn: {
    fontSize: 13,
    color: colors.textMuted,
  },
  condition: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 8,
    backgroundColor: '#f5f3ff',
    padding: 8,
  },
  conditionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#4c1d95',
  },
  fields: {
    gap: 4,
    borderRadius: 8,
    backgroundColor: colors.background,
    padding: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  req: {
    color: colors.error,
    fontWeight: '700',
  },
  fieldType: {
    fontSize: 11,
    color: colors.textMuted,
  },
  handoff: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
    padding: 8,
  },
  handoffText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#0c4a6e',
  },
  handoffRole: {
    fontWeight: '700',
  },
});
