import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DesignationRecord, OfficeOption, WorkIdentity } from '@ibas/shared-types';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { PickerSheet, SelectField } from '@/components/ui/PickerSheet';
import { OfficePickerField } from '@/components/org/OfficePickerField';
import { designationLabel, fetchDesignations, saveWorkIdentity, useWorkIdentity } from '@/lib/org-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

/** Pick department, office and designation and save them to the signed-in user's profile. */
export function WorkIdentityForm({
  submitLabel = 'Save office & designation',
  onSaved,
}: {
  submitLabel?: string;
  onSaved?: (w: WorkIdentity) => void;
}) {
  const { identity } = useWorkIdentity();
  const [designations, setDesignations] = useState<DesignationRecord[]>([]);
  const [department, setDepartment] = useState<OfficeOption | null>(identity?.department ?? null);
  const [office, setOffice] = useState<OfficeOption | null>(identity?.office ?? null);
  const [designationId, setDesignationId] = useState(identity?.designation?.id ?? '');
  const [section, setSection] = useState(identity?.section ?? '');
  const [telephone, setTelephone] = useState(identity?.telephone ?? '');
  const [pabx, setPabx] = useState(identity?.pabx ?? '');
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
    setDepartment((cur) => cur ?? identity.department ?? null);
    setOffice((cur) => cur ?? identity.office ?? null);
    setDesignationId((cur) => cur || identity.designation?.id || '');
    setSection((cur) => cur || identity.section || '');
    setTelephone((cur) => cur || identity.telephone || '');
    setPabx((cur) => cur || identity.pabx || '');
  }, [identity]);

  const current = designations.find((d) => d.id === designationId) ?? (identity?.designation?.id === designationId ? identity.designation : null);

  function chooseDepartment(d: OfficeOption | null) {
    setDepartment(d);
    if (d?.id !== department?.id) setOffice(d);
  }

  async function save() {
    setError('');
    if (!designationId) return setError('Choose your designation.');
    if (!department) return setError('Choose your department.');
    if (!office) return setError('Choose your office.');
    setBusy(true);
    try {
      const w = await saveWorkIdentity(office.id, designationId, { section: section.trim(), telephone: telephone.trim(), pabx: pabx.trim() });
      showToast('Posting saved');
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
      <OfficePickerField
        label="Department"
        title="Choose department"
        value={department}
        onChange={chooseDepartment}
        topLevel
        required
        placeholder="Choose your department"
      />
      <OfficePickerField
        value={office}
        onChange={setOffice}
        departmentId={department?.id}
        disabled={!department}
        required
        placeholder={department ? 'Search offices in this department' : 'Choose the department first'}
      />
      <Text style={styles.hint}>A department is a top-level office. Keep the department itself as your office if you work at its head office.</Text>
      <TextField label="Section / branch" value={section} onChangeText={setSection} placeholder="e.g. Budget Section" maxLength={120} />
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField label="Telephone" value={telephone} onChangeText={setTelephone} placeholder="02-9512345" keyboardType="phone-pad" maxLength={40} />
        </View>
        <View style={styles.flex}>
          <TextField label="PABX" value={pabx} onChangeText={setPabx} placeholder="Ext. 210" keyboardType="phone-pad" maxLength={40} />
        </View>
      </View>
      <Text style={styles.hint}>Section, telephone and PABX belong to this posting — update them when you are transferred or promoted.</Text>
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
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
