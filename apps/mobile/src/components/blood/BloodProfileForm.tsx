import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BloodGroup, BloodMe } from '@ibas/shared-types';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { TextField } from '@/components/ui/TextField';
import { ErrorNote, GroupPicker, PlaceFields, RED, RED_BORDER, RED_SOFT, type Place } from '@/components/blood/BloodBits';
import { saveBloodProfile } from '@/lib/blood-api';
import { showToast } from '@/lib/toast';
import { spacing } from '@/theme';

/** Blood group + donor settings, saved to /blood-bank/me. */
export function BloodProfileForm({
  me,
  submitLabel = 'Save',
  onSaved,
}: {
  me: BloodMe | null;
  submitLabel?: string;
  onSaved?: (m: BloodMe) => void;
}) {
  const d = me?.donor;
  const [group, setGroup] = useState<BloodGroup | ''>(me?.blood_group ?? '');
  const [isDonor, setIsDonor] = useState(d?.is_donor ?? false);
  const [available, setAvailable] = useState(d?.available ?? true);
  const [place, setPlace] = useState<Place>({ districtId: d?.district?.id ?? '', thanaId: d?.thana?.id ?? '' });
  const [area, setArea] = useState(d?.area ?? '');
  const [showPhone, setShowPhone] = useState(d?.show_phone ?? true);
  const [note, setNote] = useState(d?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const age = me?.age ?? null;
  const ageWarning = isDonor && age !== null && (age < 18 || age > 60);

  async function save() {
    setError('');
    if (!group) return setError('Choose your blood group.');
    if (isDonor && !place.districtId) return setError('Choose the district where you can donate.');
    setBusy(true);
    try {
      const m = await saveBloodProfile({
        blood_group: group,
        is_donor: isDonor,
        available,
        district_id: place.districtId,
        thana_id: place.thanaId,
        area: area.trim(),
        show_phone: showPhone,
        note: note.trim(),
      });
      showToast('Blood bank settings saved');
      onSaved?.(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Panel title="Your blood group" icon="water">
        <GroupPicker value={group} onChange={setGroup} />
      </Panel>

      <Panel>
        <SwitchRow
          label="I want to be a blood donor"
          hint="People who need your blood group can find you and send you requests."
          value={isDonor}
          onChange={setIsDonor}
        />
      </Panel>

      {isDonor ? (
        <View style={styles.donorBox}>
          <PlaceFields
            value={place}
            onChange={setPlace}
            requireDistrict
            districtLabel="Where you can donate"
            initialNames={{ district: d?.district?.name, thana: d?.thana?.name }}
          />
          <TextField
            label="Area / nearby hospital"
            value={area}
            onChangeText={setArea}
            maxLength={150}
            autoCapitalize="words"
            placeholder="e.g. Segunbagicha, near Dhaka Medical"
          />
          <SwitchRow
            label="Available to donate"
            hint="Turn off while you are ill, travelling or otherwise can't donate."
            value={available}
            onChange={setAvailable}
          />
          <SwitchRow
            label="Show my mobile number"
            hint="Lets people call you directly. When off, they can still send you requests."
            value={showPhone}
            onChange={setShowPhone}
          />
          <TextField
            label="Note for requesters"
            value={note}
            onChangeText={setNote}
            maxLength={300}
            autoCapitalize="sentences"
            placeholder="e.g. Call after 5 pm, weekdays only"
          />
          {ageWarning ? (
            <View style={styles.warn}>
              <Ionicons name="warning" size={16} color="#b45309" />
              <Text style={styles.warnText}>
                Donors are usually 18–60 years old. Your profile says you are {age}. Please check with a doctor before donating.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <ErrorNote text={error} />
      <Button title={submitLabel} loading={busy} onPress={() => void save()} style={{ backgroundColor: RED }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  donorBox: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RED_BORDER,
    backgroundColor: RED_SOFT,
  },
  warn: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  warnText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#92400e',
  },
});
