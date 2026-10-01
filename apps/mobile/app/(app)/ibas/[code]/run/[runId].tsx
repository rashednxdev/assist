import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Badge, IbasCard, IbasError, IbasErrorScreen, IbasLoading, ibasStyles, SectionHead } from '@/components/ibas/IbasBits';
import { RunFieldInput } from '@/components/ibas/RunFieldInput';
import { cancelProcessRun, fetchRoleColors, fetchRun, respondRunStep, RUN_STATUS, type RunDetail } from '@/lib/ibas-api';
import { useIbasAreas } from '@/lib/ibas-areas';
import { formatDdMmYyyy } from '@/lib/date-format';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${formatDdMmYyyy(iso.slice(0, 10))} ${time}`;
}

function responseValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDdMmYyyy(v);
  return String(v);
}

export default function AreaRunScreen() {
  const { code, runId } = useLocalSearchParams<{ code: string; runId: string }>();
  const { areaColor } = useIbasAreas();
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!runId) return;
    try {
      const [d, r] = await Promise.all([fetchRun(runId), fetchRoleColors()]);
      setDetail(d);
      setRoles(r);
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load this run');
    }
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const accent = code ? areaColor(code) : colors.primary;
  if (!detail) return loadError ? <IbasErrorScreen message={loadError} /> : <IbasLoading color={accent} />;

  const { run, steps, responses, current_step: step } = detail;
  const terminal = run.status !== 'in_progress';
  const status = RUN_STATUS[run.status] ?? RUN_STATUS.in_progress;
  const doneSteps = run.status === 'completed' ? steps.length : Math.max(0, run.current_step - 1);
  const pct = steps.length ? Math.round((doneSteps / steps.length) * 100) : 0;
  const roleColor = (c: string) => roles[c] || '#475569';

  function applyResult(d: RunDetail, message: string) {
    setDetail(d);
    setValues({});
    setRemarks('');
    setShowReject(false);
    setShowCancel(false);
    setCancelReason('');
    setError('');
    showToast(message);
  }

  async function doSubmit() {
    if (!step) return;
    setBusy(true);
    try {
      const d = await respondRunStep(run.id, step.step_number, { action: 'submit', field_responses: values });
      applyResult(
        d,
        d.run.status === 'completed' ? 'Process completed.' : d.current_step ? `Step ${d.current_step.step_number} is ready.` : 'Step submitted.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit step');
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (!step) return;
    const missing = step.fields.filter((f) => f.required && !values[f.name]?.trim()).map((f) => f.label);
    if (missing.length) {
      setError(`Please fill: ${missing.join(', ')}`);
      return;
    }
    const last = step.step_number >= steps.length;
    Alert.alert(
      `Submit step ${step.step_number}?`,
      last
        ? 'This is the last step — the process will be marked completed.'
        : run.personal
          ? 'Personal run — the next step stays with you. No one is notified.'
          : 'The office role for the next step will be notified to continue.',
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Submit', onPress: () => void doSubmit() },
      ],
    );
  }

  async function reject() {
    if (!step) return;
    if (!remarks.trim()) {
      setError('Remarks are required when rejecting.');
      return;
    }
    setBusy(true);
    try {
      applyResult(await respondRunStep(run.id, step.step_number, { action: 'reject', remarks: remarks.trim() }), 'Run rejected.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      applyResult(await cancelProcessRun(run.id, cancelReason.trim()), 'Run cancelled.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel run');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Interactive run' }} />
      <KeyboardAvoidingView style={ibasStyles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView
          style={ibasStyles.root}
          contentContainerStyle={ibasStyles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
        >
          <IbasCard accent={accent}>
            <View style={styles.headRow}>
              <Text style={ibasStyles.kicker}>INTERACTIVE RUN</Text>
              <Badge label={status.label} color={status.color} filled />
            </View>
            <Text style={ibasStyles.title}>{run.task_name_en}</Text>
            <View style={ibasStyles.row}>
              {run.fiscal_year ? <Badge label={`FY ${run.fiscal_year}`} /> : null}
              {run.month ? <Badge label={run.month} /> : null}
              {run.reference_no ? <Badge label={`Ref ${run.reference_no}`} /> : null}
              {run.personal ? <Badge label="Personal run" color="#0369a1" /> : null}
            </View>
            <View style={styles.progressHead}>
              <Text style={ibasStyles.small}>{run.status === 'completed' ? `All ${steps.length} steps done` : `Step ${run.current_step} of ${steps.length}`}</Text>
              <Text style={ibasStyles.small}>{pct}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: status.color }]} />
            </View>
            <Text style={ibasStyles.small}>Started {formatWhen(run.started_at)}</Text>
          </IbasCard>

          {run.status === 'completed' ? (
            <View style={[styles.banner, styles.bannerOk]}>
              <Ionicons name="checkmark-circle" size={20} color="#047857" />
              <Text style={[styles.bannerText, { color: '#047857' }]}>Process completed successfully{run.completed_at ? ` on ${formatWhen(run.completed_at)}` : ''}.</Text>
            </View>
          ) : null}
          {run.status === 'rejected' || run.status === 'cancelled' ? (
            <View style={[styles.banner, run.status === 'rejected' ? styles.bannerBad : styles.bannerMuted]}>
              <Ionicons name={run.status === 'rejected' ? 'close-circle' : 'ban'} size={20} color={run.status === 'rejected' ? '#b91c1c' : colors.textMuted} />
              <Text style={styles.bannerText}>
                Run {run.status}
                {run.rejection_reason ? `: ${run.rejection_reason}` : '.'}
              </Text>
            </View>
          ) : null}

          {error ? <IbasError message={error} /> : null}

          {!terminal && step ? (
            <IbasCard>
              <View style={ibasStyles.row}>
                <Badge label={`Step ${step.step_number}`} color={accent} filled />
                <Badge label={step.role_code} color={roleColor(step.role_code)} filled />
              </View>
              <Text style={styles.stepTitle}>{step.title_en}</Text>
              {step.description_en ? <Text style={ibasStyles.body}>{step.description_en}</Text> : null}
              {step.condition_text ? (
                <View style={styles.condition}>
                  <Ionicons name="git-compare-outline" size={14} color="#6d28d9" />
                  <Text style={styles.conditionText}>Condition: {step.condition_text}</Text>
                </View>
              ) : null}

              {step.fields.map((f) => (
                <RunFieldInput key={f.name} field={f} value={values[f.name] ?? ''} disabled={!detail.can_act || busy} onChange={(v) => setValues((cur) => ({ ...cur, [f.name]: v }))} />
              ))}

              {step.handoff_msg ? (
                <View style={styles.handoff}>
                  <Text style={styles.handoffLabel}>After this step</Text>
                  <Text style={styles.handoffText}>{step.handoff_msg}</Text>
                </View>
              ) : null}

              {detail.can_act ? (
                <>
                  <Button title="Submit step" onPress={submit} loading={busy && !showReject} disabled={busy} />
                  {detail.can_reject ? (
                    <Pressable onPress={() => setShowReject(!showReject)} style={styles.linkBtn} hitSlop={6}>
                      <Ionicons name="close-circle-outline" size={16} color={colors.error} />
                      <Text style={[styles.linkBtnText, { color: colors.error }]}>{showReject ? 'Keep working' : 'Reject this run'}</Text>
                    </Pressable>
                  ) : null}
                  {showReject ? (
                    <View style={styles.panel}>
                      <TextField label="Rejection remarks *" value={remarks} onChangeText={setRemarks} placeholder="Reason for rejection" multiline autoCapitalize="sentences" style={styles.textarea} />
                      <Pressable onPress={() => void reject()} disabled={busy} style={({ pressed }) => [styles.dangerBtn, (pressed || busy) && styles.pressed]}>
                        <Text style={styles.dangerText}>Confirm reject</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.waiting}>
                  <Ionicons name="hourglass-outline" size={16} color={colors.textMuted} />
                  {run.personal ? (
                    <Text style={styles.waitingText}>This personal run is completed only by the person who started it.</Text>
                  ) : (
                    <Text style={styles.waitingText}>
                      Waiting for role <Text style={styles.bold}>{run.current_role}</Text> to act. Pull down to refresh.
                    </Text>
                  )}
                </View>
              )}
            </IbasCard>
          ) : null}

          <IbasCard>
            <SectionHead icon="git-branch-outline" title="All steps" color={accent} />
            {steps.map((s, i) => {
              const resp = responses.find((r) => r.step_number === s.step_number);
              const rejected = resp?.action === 'reject';
              const done = !!resp && !rejected;
              const current = !terminal && s.step_number === run.current_step;
              const icon: keyof typeof Ionicons.glyphMap = rejected ? 'close-circle' : done ? 'checkmark-circle' : current ? 'radio-button-on' : 'ellipse-outline';
              const tint = rejected ? colors.error : done ? '#059669' : current ? accent : colors.border;
              const shownFields = done ? s.fields.filter((f) => resp?.field_responses && f.name in resp.field_responses) : [];
              return (
                <View key={s.id ?? s.step_number} style={styles.histRow}>
                  <View style={styles.rail}>
                    <Ionicons name={icon} size={20} color={tint} />
                    {i < steps.length - 1 ? <View style={styles.line} /> : null}
                  </View>
                  <View style={styles.histBody}>
                    <Text style={[styles.histTitle, !done && !current && !rejected && styles.muted]}>
                      {s.step_number}. {s.title_en}
                    </Text>
                    <Text style={ibasStyles.small}>
                      {s.is_auto ? 'Automatic' : s.role_code}
                      {resp ? `  ·  ${formatWhen(resp.performed_at)}` : current ? '  ·  current step' : ''}
                    </Text>
                    {shownFields.map((f) => (
                      <Text key={f.name} style={styles.histField}>
                        <Text style={styles.bold}>{f.label}: </Text>
                        {responseValue(resp?.field_responses?.[f.name])}
                      </Text>
                    ))}
                    {resp?.remarks && resp.remarks !== 'Auto-processed' ? <Text style={styles.histRemark}>“{resp.remarks}”</Text> : null}
                  </View>
                </View>
              );
            })}
          </IbasCard>

          {!terminal && detail.can_cancel ? (
            <IbasCard>
              {!showCancel ? (
                <Pressable onPress={() => setShowCancel(true)} style={styles.linkBtn} hitSlop={6}>
                  <Ionicons name="ban-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.linkBtnText}>Cancel this run</Text>
                </Pressable>
              ) : (
                <>
                  <TextField label="Cancel reason (optional)" value={cancelReason} onChangeText={setCancelReason} autoCapitalize="sentences" />
                  <View style={styles.row}>
                    <Pressable onPress={() => void cancel()} disabled={busy} style={({ pressed }) => [styles.dangerBtn, styles.flex, (pressed || busy) && styles.pressed]}>
                      <Text style={styles.dangerText}>Confirm cancel</Text>
                    </Pressable>
                    <Pressable onPress={() => setShowCancel(false)} style={[styles.ghostBtn, styles.flex]}>
                      <Text style={styles.ghostText}>Back</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </IbasCard>
          ) : null}
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
    opacity: 0.75,
  },
  bold: {
    fontWeight: '700',
  },
  muted: {
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.sm + 4,
  },
  bannerOk: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
  },
  bannerBad: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  bannerMuted: {
    borderColor: colors.border,
    backgroundColor: '#f8fafc',
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: colors.text,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
    color: colors.text,
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
  handoff: {
    gap: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
    padding: 10,
  },
  handoffLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369a1',
  },
  handoffText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#0c4a6e',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 4,
  },
  linkBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  panel: {
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: spacing.sm + 2,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dangerBtn: {
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.error,
    paddingVertical: 12,
  },
  dangerText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  ghostBtn: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
  },
  ghostText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 10,
    backgroundColor: colors.background,
    padding: 10,
  },
  waitingText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  histRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rail: {
    alignItems: 'center',
    width: 22,
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: 2,
    backgroundColor: colors.border,
  },
  histBody: {
    flex: 1,
    gap: 2,
    paddingBottom: spacing.md,
  },
  histTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  histField: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
  },
  histRemark: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.textMuted,
  },
});
