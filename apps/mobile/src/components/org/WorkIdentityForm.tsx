import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DesignationRecord, OfficeOption, WorkIdentity } from '@ibas/shared-types';
import { Button } from '@/components/ui/Button';
import { PickerSheet, SelectField } from '@/components/ui/PickerSheet';
import { OfficePickerField } from '@/components/org/OfficePickerField';
import { designationLabel, fetchDesignations, saveWorkIdentity, useWorkIdentity } from '@/lib/org-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

/** Pick office + designation and save them to the signed-in user's profile. */
export function WorkIdentityForm({
  submitLabel = 'Save office & designation',
  onSaved,
}: {
  submitLabel?: string;
  onSaved?: (w: WorkIdentity) => void;
}) {
  const { identity } = useWorkIdentity();
  const [designations, setDesignations] = useState<DesignationRecord[]>([]);
  const [office, setOffice] = useState<OfficeOption | null>(identity?.office ?? null);
  const [designationId, setDesignationId] = useState(identity?.designation?.id ?? '');
  const [pickDesignation, setPickDesignation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDesignations()
      .then(setDesignations)
      .catch(() => setDesignations([]));
  }, []);

  useEffect(() => {
    if (!identity) return;
    setOffice((cur) => cur ?? identity.office ?? null);
    setDesignationId((cur) => cur || identity.designation?.id || '');
  }, [identity]);

  const current = designations.find((d) => d.id === designationId) ?? (identity?.designation?.id === designationId ? identity.designation : null);

  async function save() {
    setError('');
    if (!designationId) return setError('Choose your designation.');
    if (!office) return setError('Choose your office.');
    setBusy(true);
    try {
      const w = await saveWorkIdentity(office.id, designationId);
      showToast('Office and designation saved');
      onSaved?.(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <SelectField
        label="Designation"
        required
        display={current ? designationLabel(current) : ''}
        placeholder="Select designation"
        onPress={() => setPickDesignation(true)}
      />
      <OfficePickerField value={office} onChange={setOffice} required />
      {designations.length === 0 ? (
        <Text style={styles.hint}>No designations have been added yet. Please ask an administrator.</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={submitLabel} onPress={() => void save()} loading={busy} />
      <PickerSheet
        visible={pickDesignation}
        title="Choose designation"
        searchable
        searchPlaceholder="Search designation"
        value={designationId}
        options={designations.map((d) => ({
          value: d.id,
          label: d.name,
          hint: [d.short_name !== d.name ? d.short_name : '', d.grade ? `Grade ${d.grade}` : ''].filter(Boolean).join(' · ') || undefined,
        }))}
        onSelect={(o) => setDesignationId(o.value)}
        onClose={() => setPickDesignation(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  error: {
    fontSize: 13,
    color: colors.error,
  },
});
