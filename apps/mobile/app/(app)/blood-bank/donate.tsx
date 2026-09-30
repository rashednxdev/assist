import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BLOOD_DONATION_GAP_MONTHS, defaultNextEligible } from '@ibas/shared-types';
import { FormScroll } from '@/components/ui/FormScroll';
import { Panel } from '@/components/ui/Panel';
import { DateField } from '@/components/ui/DateField';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { ErrorNote, RED, RED_SOFT } from '@/components/blood/BloodBits';
import { addDonation } from '@/lib/blood-api';
import { parseIsoDate, toIsoDate } from '@/lib/date-format';
import { formatDate } from '@/lib/profile-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

export default function RecordDonationScreen() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  const [donatedOn, setDonatedOn] = useState<string>(() => toIsoDate(new Date()));
  const [customNext, setCustomNext] = useState('');
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const minNext = useMemo(
    () => (donatedOn ? defaultNextEligible(new Date(`${donatedOn}T00:00:00Z`)).toISOString().slice(0, 10) : ''),
    [donatedOn],
  );
  const nextOn = customNext && customNext >= minNext ? customNext : minNext;

  async function save() {
    setError('');
    if (!donatedOn) return setError('Enter the donation date.');
    setBusy(true);
    try {
      await addDonation({ donated_on: donatedOn, next_eligible_on: nextOn, place: place.trim(), note: note.trim(), request_id: requestId });
      showToast('Donation recorded — thank you!');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormScroll>
      <View style={styles.thanks}>
        <Ionicons name="water" size={20} color={RED} />
        <Text style={styles.thanksText}>Thank you for donating! Keeping this up to date lets people know when you can donate again.</Text>
      </View>
      <Panel>
        <DateField label="Donation date *" value={donatedOn} onChange={setDonatedOn} maximumDate={new Date()} />
        <DateField label="Next eligible date" value={nextOn} onChange={setCustomNext} minimumDate={parseIsoDate(minNext) ?? undefined} />
        <Text style={styles.hint}>
          Set to {BLOOD_DONATION_GAP_MONTHS} months after the donation ({formatDate(minNext ? `${minNext}T00:00:00Z` : null)}). Choose a later date if your
          doctor advised it.
        </Text>
        <TextField label="Hospital / blood bank" value={place} onChangeText={setPlace} maxLength={150} autoCapitalize="words" placeholder="e.g. Sandhani, DMCH" />
        <TextField label="Note" value={note} onChangeText={setNote} maxLength={300} autoCapitalize="sentences" placeholder="Optional" />
      </Panel>
      <ErrorNote text={error} />
      <Button title="Save donation" loading={busy} onPress={() => void save()} style={{ backgroundColor: RED }} />
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  thanks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    borderRadius: 14,
    backgroundColor: RED_SOFT,
    padding: spacing.md,
  },
  thanksText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#7f1d1d',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: -spacing.sm,
  },
});
