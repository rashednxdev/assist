import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BLOOD_URGENCIES, type BloodGroup, type BloodUrgency } from '@ibas/shared-types';
import { FormScroll } from '@/components/ui/FormScroll';
import { Panel } from '@/components/ui/Panel';
import { TextField } from '@/components/ui/TextField';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { Button } from '@/components/ui/Button';
import { ErrorNote, GroupPicker, PlaceFields, RED, URGENCY_STYLE, type Place } from '@/components/blood/BloodBits';
import { requestHref } from '@/components/blood/RequestList';
import { createRequest, useBloodMe } from '@/lib/blood-api';
import { useAuth } from '@/lib/auth-context';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

export default function NewBloodRequestScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { me } = useBloodMe();
  const [group, setGroup] = useState<BloodGroup | ''>('');
  const [units, setUnits] = useState('1');
  const [urgency, setUrgency] = useState<BloodUrgency>('urgent');
  const [hospital, setHospital] = useState('');
  const [place, setPlace] = useState<Place>(() => ({ districtId: me?.donor.district?.id ?? '', thanaId: '' }));
  const [address, setAddress] = useState('');
  const [neededOn, setNeededOn] = useState(() => new Date(Date.now() + 6 * 3600_000));
  const [patient, setPatient] = useState('');
  const [contactName, setContactName] = useState(user?.full_name_en ?? '');
  const [contactPhone, setContactPhone] = useState(user?.phone ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const myDistrict = me?.donor.district?.id;
  useEffect(() => {
    if (myDistrict) setPlace((p) => (p.districtId ? p : { districtId: myDistrict, thanaId: '' }));
  }, [myDistrict]);

  async function submit() {
    setError('');
    if (!group) return setError('Choose the patient’s blood group.');
    if (!place.districtId) return setError('Choose the district.');
    if (hospital.trim().length < 2) return setError('Enter the hospital or place.');
    const bags = Math.max(1, Math.min(10, Number(units) || 1));
    setBusy(true);
    try {
      const r = await createRequest({
        blood_group: group,
        units: bags,
        urgency,
        hospital: hospital.trim(),
        district_id: place.districtId,
        thana_id: place.thanaId,
        address: address.trim(),
        needed_on: neededOn.toISOString(),
        patient_name: patient.trim(),
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        note: note.trim(),
      });
      showToast('Request posted — matching donors are being notified');
      router.replace(requestHref(r.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post the request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormScroll>
      <Panel title="Patient’s blood group *" icon="water">
        <GroupPicker value={group} onChange={setGroup} />
      </Panel>

      <Panel>
        <View style={styles.row}>
          <View style={styles.units}>
            <TextField
              label="Bags needed"
              value={units}
              onChangeText={(t) => setUnits(t.replace(/\D/g, '').slice(0, 2))}
              onBlur={() => setUnits(String(Math.max(1, Math.min(10, Number(units) || 1))))}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <View style={styles.flex}>
            <DateTimeField label="Needed by" required value={neededOn} onChange={setNeededOn} minimumDate={new Date()} />
          </View>
        </View>
        <View style={styles.urgencyWrap}>
          <Text style={styles.label}>Urgency</Text>
          <View style={styles.urgencyRow}>
            {BLOOD_URGENCIES.map((u) => {
              const on = urgency === u;
              const s = URGENCY_STYLE[u];
              return (
                <Pressable
                  key={u}
                  onPress={() => setUrgency(u)}
                  style={[styles.urgencyBtn, on && { backgroundColor: s.bg, borderColor: s.bg }]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <Text style={[styles.urgencyText, on && { color: s.fg }]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Panel>

      <Panel title="Where" icon="location-outline">
        <TextField
          label="Hospital *"
          value={hospital}
          onChangeText={setHospital}
          maxLength={200}
          autoCapitalize="words"
          placeholder="e.g. Dhaka Medical College Hospital, Ward 5"
        />
        <PlaceFields value={place} onChange={setPlace} requireDistrict initialNames={{ district: me?.donor.district?.name }} />
        <TextField label="Address / directions" value={address} onChangeText={setAddress} maxLength={300} autoCapitalize="sentences" placeholder="Optional" />
      </Panel>

      <Panel title="Contact" icon="call-outline">
        <TextField label="Patient name" value={patient} onChangeText={setPatient} maxLength={120} autoCapitalize="words" placeholder="Optional" />
        <TextField label="Contact person *" value={contactName} onChangeText={setContactName} maxLength={120} autoCapitalize="words" />
        <TextField
          label="Contact mobile *"
          value={contactPhone}
          onChangeText={setContactPhone}
          keyboardType="phone-pad"
          maxLength={11}
          placeholder="01XXXXXXXXX"
        />
        <TextField
          label="Details"
          value={note}
          onChangeText={setNote}
          maxLength={1000}
          multiline
          autoCapitalize="sentences"
          style={styles.multiline}
          placeholder="Diagnosis, whole blood or platelets, anything donors should know"
        />
      </Panel>

      <Text style={styles.hint}>Eligible donors of compatible groups in the chosen district get a notification right away.</Text>
      <ErrorNote text={error} />
      <Button title="Post request" loading={busy} onPress={() => void submit()} style={{ backgroundColor: RED }} />
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    alignItems: 'flex-start',
  },
  units: {
    width: 96,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  urgencyWrap: {
    gap: spacing.xs,
  },
  urgencyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  urgencyBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  urgencyText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
});
