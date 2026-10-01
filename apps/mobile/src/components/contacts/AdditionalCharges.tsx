import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ADDITIONAL_CHARGE_GRADE_MAX,
  ADDITIONAL_CHARGE_MAX,
  type AdditionalChargeRecord,
  type DesignationRecord,
  type MyAdditionalCharges,
  type OfficeOption,
} from '@ibas/shared-types';
import { Button } from '@/components/ui/Button';
import { PickerSheet, SelectField } from '@/components/ui/PickerSheet';
import { OfficePickerField } from '@/components/org/OfficePickerField';
import { addMyCharge, answerChargeHandover, fetchMyCharges, removeMyCharge } from '@/lib/contacts-api';
import { designationLabel, fetchDesignations } from '@/lib/org-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

function officeName(o: AdditionalChargeRecord['office']): string {
  return o.short_name && o.short_name !== o.name ? `${o.name} (${o.short_name})` : o.name;
}

/** Posts the user holds as additional charge, with hand-over prompts when someone joins one substantively. */
export function AdditionalCharges() {
  const [data, setData] = useState<MyAdditionalCharges | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await fetchMyCharges());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load additional charges');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(id: string, fn: () => Promise<MyAdditionalCharges>, done: string) {
    setBusyId(id);
    try {
      setData(await fn());
      showToast(done);
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusyId('');
    }
  }

  function confirmRemove(c: AdditionalChargeRecord) {
    Alert.alert('Remove additional charge?', `${c.designation.name}, ${officeName(c.office)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void run(c.id, () => removeMyCharge(c.id), 'Additional charge removed') },
    ]);
  }

  if (!data) {
    return error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} style={styles.loader} />;
  }

  const pending = data.items.filter((c) => c.handover);
  const canAdd = data.eligible && data.items.length < ADDITIONAL_CHARGE_MAX;

  return (
    <View style={styles.wrap}>
      {pending.map((c) => (
        <View key={`h:${c.id}`} style={styles.handover}>
          <View style={styles.handoverHead}>
            <Ionicons name="swap-horizontal" size={18} color="#b45309" />
            <Text style={styles.handoverTitle}>Did you hand over this charge?</Text>
          </View>
          <Text style={styles.handoverText}>
            {c.handover!.new_holder.name}
            {c.handover!.new_holder.designation ? ` (${c.handover!.new_holder.designation})` : ''} has joined {c.designation.name}, {officeName(c.office)}.
          </Text>
          <View style={styles.handoverActions}>
            <Button
              title="Yes, handed over"
              onPress={() => void run(c.id, () => answerChargeHandover(c.id, true), 'Charge handed over')}
              loading={busyId === c.id}
              style={styles.flex}
            />
            <Button
              title="Still holding"
              variant="secondary"
              onPress={() => void run(c.id, () => answerChargeHandover(c.id, false), 'Kept as additional charge')}
              disabled={busyId === c.id}
              style={styles.flex}
            />
          </View>
        </View>
      ))}

      {data.items.length === 0 ? (
        <Text style={styles.muted}>You don't hold any additional charge.</Text>
      ) : (
        data.items.map((c) => (
          <View key={c.id} style={styles.item}>
            <View style={styles.itemIcon}>
              <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.itemTitle}>{c.designation.name}</Text>
              <Text style={styles.itemSub}>{officeName(c.office)}</Text>
              {c.office.parent_path ? (
                <Text style={styles.itemSub} numberOfLines={1}>
                  Under {c.office.parent_path}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => confirmRemove(c)} disabled={busyId === c.id} hitSlop={8} accessibilityLabel="Remove additional charge">
              {busyId === c.id ? <ActivityIndicator color={colors.error} /> : <Ionicons name="trash-outline" size={20} color={colors.error} />}
            </Pressable>
          </View>
        ))
      )}

      {!data.eligible ? (
        <Text style={styles.muted}>{data.reason ?? `Additional charge is for grade 1–${ADDITIONAL_CHARGE_GRADE_MAX} officers.`}</Text>
      ) : adding ? (
        <AddChargeForm
          onCancel={() => setAdding(false)}
          onAdded={(next) => {
            setData(next);
            setAdding(false);
            showToast('Additional charge added');
          }}
        />
      ) : canAdd ? (
        <Button title="Add additional charge" variant="secondary" onPress={() => setAdding(true)} />
      ) : (
        <Text style={styles.muted}>You can hold up to {ADDITIONAL_CHARGE_MAX} additional charges.</Text>
      )}
    </View>
  );
}

function AddChargeForm({ onCancel, onAdded }: { onCancel: () => void; onAdded: (d: MyAdditionalCharges) => void }) {
  const [designations, setDesignations] = useState<DesignationRecord[]>([]);
  const [office, setOffice] = useState<OfficeOption | null>(null);
  const [designationId, setDesignationId] = useState('');
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDesignations()
      .then((all) => setDesignations(all.filter((d) => !!d.grade && d.grade >= 1 && d.grade <= ADDITIONAL_CHARGE_GRADE_MAX)))
      .catch(() => setDesignations([]));
  }, []);

  const current = designations.find((d) => d.id === designationId);

  async function save() {
    setError('');
    if (!office) return setError('Choose the office.');
    if (!designationId) return setError('Choose the post.');
    setBusy(true);
    try {
      onAdded(await addMyCharge(office.id, designationId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <OfficePickerField label="Office" value={office} onChange={setOffice} required placeholder="Same or another office" />
      <SelectField
        label="Post"
        required
        display={current ? designationLabel(current) : ''}
        placeholder={`Select post (grade 1–${ADDITIONAL_CHARGE_GRADE_MAX})`}
        onPress={() => setPick(true)}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.handoverActions}>
        <Button title="Add" onPress={() => void save()} loading={busy} style={styles.flex} />
        <Button title="Cancel" variant="ghost" onPress={onCancel} disabled={busy} style={styles.flex} />
      </View>
      <PickerSheet
        visible={pick}
        title="Choose post"
        searchable
        searchPlaceholder="Search designation"
        value={designationId}
        options={designations.map((d) => ({
          value: d.id,
          label: d.name,
          hint: [d.short_name !== d.name ? d.short_name : '', d.grade ? `Grade ${d.grade}` : ''].filter(Boolean).join(' · ') || undefined,
        }))}
        onSelect={(o) => setDesignationId(o.value)}
        onClose={() => setPick(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm + 4,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  loader: {
    paddingVertical: spacing.md,
  },
  error: {
    fontSize: 13,
    color: colors.error,
  },
  muted: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  handover: {
    gap: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    padding: spacing.sm + 4,
  },
  handoverHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  handoverTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400e',
  },
  handoverText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#92400e',
  },
  handoverActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.sm + 4,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#e8f2fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  itemSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  form: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
});
