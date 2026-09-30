import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BATCH_WINDOW_MONTHS,
  CADRE_GRADE_MAX,
  bcsBatchLabel,
  type DesignationRecord,
  type ServiceInfo,
  type ServiceType,
} from '@ibas/shared-types';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { PickerSheet, SelectField } from '@/components/ui/PickerSheet';
import { designationLabel, fetchDesignations, fetchServiceInfo, saveServiceInfo, useWorkIdentity } from '@/lib/org-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

const CHOICES: Array<{ value: ServiceType; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'cadre', label: 'Yes, BCS cadre', hint: 'Grouped with your BCS batch', icon: 'ribbon-outline' },
  { value: 'non_cadre', label: 'No, non-cadre', hint: 'Grouped by joining post and date', icon: 'briefcase-outline' },
];

/** Cadre (BCS batch + joining date) or non-cadre (joining post + joining date). */
export function ServiceInfoForm({
  submitLabel = 'Save service information',
  onSaved,
}: {
  submitLabel?: string;
  onSaved?: (info: ServiceInfo) => void;
}) {
  const [info, setInfo] = useState<ServiceInfo | null>(null);
  const [designations, setDesignations] = useState<DesignationRecord[]>([]);
  const [type, setType] = useState<ServiceType | ''>('');
  const [batch, setBatch] = useState('');
  const [postId, setPostId] = useState('');
  const [joined, setJoined] = useState('');
  const [pickPost, setPickPost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { identity } = useWorkIdentity();
  const currentDesignationId = identity?.designation?.id ?? null;
  const loaded = useRef(false);

  useEffect(() => {
    fetchDesignations()
      .then(setDesignations)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetchServiceInfo()
      .then((i) => {
        setInfo(i);
        if (!loaded.current) {
          loaded.current = true;
          setType(i.service_type ?? (i.cadre_allowed ? '' : 'non_cadre'));
          setBatch(i.bcs_batch ? String(i.bcs_batch) : '');
          setPostId(i.joining_designation?.id ?? '');
          setJoined(i.joining_date ? i.joining_date.slice(0, 10) : '');
        } else if (!i.cadre_allowed) {
          setType('non_cadre');
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load service information'));
  }, [currentDesignationId]);

  async function save() {
    setError('');
    if (!type) return setError('Tell us whether you are a BCS cadre officer.');
    if (type === 'cadre' && !batch) return setError('Enter your BCS batch.');
    if (type === 'non_cadre' && !postId) return setError('Choose the post you joined in.');
    if (!joined) return setError('Enter your joining date.');
    setBusy(true);
    try {
      const saved = await saveServiceInfo(
        type === 'cadre'
          ? { service_type: 'cadre', bcs_batch: Number(batch), joining_date: new Date(joined) }
          : { service_type: 'non_cadre', joining_designation_id: postId, joining_date: new Date(joined) },
      );
      setInfo(saved);
      showToast('Service information saved');
      onSaved?.(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  if (!info) {
    return error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} style={styles.loader} />;
  }

  const current = info.current_designation;
  const post = designations.find((d) => d.id === postId) ?? (info.joining_designation?.id === postId ? info.joining_designation : null);
  const batchNo = Number(batch);

  return (
    <View style={styles.wrap}>
      {info.cadre_allowed ? (
        <View style={styles.block}>
          <Text style={styles.question}>
            Are you a BCS cadre officer?<Text style={styles.required}> *</Text>
          </Text>
          {CHOICES.map((c) => {
            const active = type === c.value;
            return (
              <Pressable
                key={c.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => setType(c.value)}
                style={[styles.choice, active && styles.choiceActive]}
              >
                <Ionicons name={c.icon} size={22} color={active ? colors.primary : colors.textMuted} />
                <View style={styles.choiceText}>
                  <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>{c.label}</Text>
                  <Text style={styles.choiceHint}>{c.hint}</Text>
                </View>
                <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.primary : colors.border} />
              </Pressable>
            );
          })}
          {!current ? (
            <Text style={styles.hint}>
              Cadre service applies to grades 1–{CADRE_GRADE_MAX}. Add your designation so we can check.
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <Text style={styles.noticeText}>
            Your designation ({current?.name}, grade {current?.grade}) is a non-cadre post. BCS cadre applies to grades 1–{CADRE_GRADE_MAX}.
          </Text>
        </View>
      )}

      {type === 'cadre' ? (
        <View style={styles.block}>
          <View style={styles.batchWrap}>
            <Text style={styles.label}>
              BCS batch<Text style={styles.required}> *</Text>
            </Text>
            <View style={styles.batchRow}>
              <TextInput
                value={batch}
                onChangeText={(t) => setBatch(t.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                placeholder="e.g. 27"
                placeholderTextColor={colors.textMuted}
                style={styles.batchInput}
                maxLength={2}
              />
              {batchNo > 0 ? <Text style={styles.batchLabel}>{bcsBatchLabel(batchNo)}</Text> : null}
            </View>
          </View>
          <DateField label="Service joining date *" value={joined} onChange={setJoined} maximumDate={new Date()} minimumDate={new Date(1950, 0, 1)} />
        </View>
      ) : null}

      {type === 'non_cadre' ? (
        <View style={styles.block}>
          <SelectField
            label="Joining post"
            required
            display={post ? designationLabel(post) : ''}
            placeholder="Select the post you joined in"
            onPress={() => setPickPost(true)}
          />
          <DateField label="Joining date in that post *" value={joined} onChange={setJoined} maximumDate={new Date()} minimumDate={new Date(1950, 0, 1)} />
          <Text style={styles.hint}>
            People who joined the same post within {BATCH_WINDOW_MONTHS} months of each other are grouped as one batch.
          </Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={submitLabel} onPress={() => void save()} loading={busy} disabled={!type} />

      <PickerSheet
        visible={pickPost}
        title="Joining post"
        searchable
        searchPlaceholder="Search designation"
        value={postId}
        options={designations.map((d) => ({
          value: d.id,
          label: d.name,
          hint: [d.short_name !== d.name ? d.short_name : '', d.grade ? `Grade ${d.grade}` : ''].filter(Boolean).join(' · ') || undefined,
        }))}
        onSelect={(o) => setPostId(o.value)}
        onClose={() => setPickPost(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  loader: {
    paddingVertical: spacing.lg,
  },
  block: {
    gap: spacing.sm + 4,
  },
  question: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  required: {
    color: colors.error,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.sm + 4,
    backgroundColor: colors.surface,
  },
  choiceActive: {
    borderColor: colors.primary,
    backgroundColor: '#e8f2fa',
  },
  choiceText: {
    flex: 1,
    gap: 2,
  },
  choiceLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  choiceLabelActive: {
    color: colors.primaryDark,
  },
  choiceHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.sm + 4,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  batchWrap: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  batchInput: {
    width: 110,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  batchLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  error: {
    fontSize: 13,
    color: colors.error,
  },
});
