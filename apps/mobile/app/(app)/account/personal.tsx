import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BLOOD_GROUPS, type BloodGroup, type GeoOption } from '@ibas/shared-types';
import { FormScroll } from '@/components/ui/FormScroll';
import { Panel } from '@/components/ui/Panel';
import { TextField } from '@/components/ui/TextField';
import { DateField } from '@/components/ui/DateField';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/calc/ChipGroup';
import { PickerSheet, SelectField } from '@/components/ui/PickerSheet';
import { useAuth } from '@/lib/auth-context';
import {
  fetchDistricts,
  fetchPersonalProfile,
  updatePersonalProfile,
  type Gender,
  type PersonalProfile,
} from '@/lib/profile-api';
import { resetBloodMe } from '@/lib/blood-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

const EMPTY = {
  full_name_en: '',
  full_name_bn: '',
  phone: '',
  alternate_phone: '',
  nid: '',
  employee_id: '',
  dob: '',
  gender: '' as Gender | '',
  blood_group: '' as BloodGroup | '',
  father_name: '',
  mother_name: '',
  home_district_id: '',
  emergency_contact_name: '',
  emergency_contact_relation: '',
  emergency_contact_phone: '',
  bio: '',
};
type Form = typeof EMPTY;

function toForm(p: PersonalProfile): Form {
  return {
    full_name_en: p.full_name_en ?? '',
    full_name_bn: p.full_name_bn ?? '',
    phone: p.phone ?? '',
    alternate_phone: p.alternate_phone ?? '',
    nid: p.nid ?? '',
    employee_id: p.employee_id ?? '',
    dob: p.dob ? p.dob.slice(0, 10) : '',
    gender: p.gender ?? '',
    blood_group: p.blood_group ?? '',
    father_name: p.father_name ?? '',
    mother_name: p.mother_name ?? '',
    home_district_id: p.home_district_id ?? '',
    emergency_contact_name: p.emergency_contact_name ?? '',
    emergency_contact_relation: p.emergency_contact_relation ?? '',
    emergency_contact_phone: p.emergency_contact_phone ?? '',
    bio: p.bio ?? '',
  };
}

const GENDERS: Array<{ value: Gender | ''; label: string }> = [
  { value: '', label: 'Not set' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const BLOOD: Array<{ value: BloodGroup | ''; label: string }> = [
  { value: '', label: 'Not set' },
  ...BLOOD_GROUPS.map((g) => ({ value: g, label: g })),
];

export default function PersonalInfoScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState<Form | null>(null);
  const [districts, setDistricts] = useState<GeoOption[]>([]);
  const [pickDistrict, setPickDistrict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPersonalProfile()
      .then((p) => setForm(toForm(p)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your profile'));
    fetchDistricts()
      .then(setDistricts)
      .catch(() => setDistricts([]));
  }, []);

  if (!form) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const district = districts.find((d) => d.id === form.home_district_id);

  async function save() {
    if (!form) return;
    setError('');
    if (form.full_name_en.trim().length < 2) return setError('Enter your full name in English.');
    setBusy(true);
    try {
      await updatePersonalProfile({
        full_name_en: form.full_name_en.trim(),
        full_name_bn: form.full_name_bn.trim() || undefined,
        phone: form.phone.trim(),
        nid: form.nid.trim() || undefined,
        employee_id: form.employee_id.trim() || undefined,
        dob: form.dob,
        gender: form.gender,
        blood_group: form.blood_group,
        father_name: form.father_name,
        mother_name: form.mother_name,
        home_district_id: form.home_district_id,
        alternate_phone: form.alternate_phone.trim(),
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_relation: form.emergency_contact_relation,
        emergency_contact_phone: form.emergency_contact_phone.trim(),
        bio: form.bio,
      });
      void refreshUser().catch(() => undefined);
      resetBloodMe();
      showToast('Profile updated');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormScroll>
      <Text style={styles.intro}>
        Only you and administrators see personal details such as NID, parents’ names and emergency contact.
      </Text>

      <Panel title="Account" icon="person-circle-outline">
        <TextField label="Full name (English) *" value={form.full_name_en} onChangeText={set('full_name_en')} autoCapitalize="words" />
        <TextField label="Full name (Bengali)" value={form.full_name_bn} onChangeText={set('full_name_bn')} />
        <TextField
          label="Mobile *"
          hint="Changing it needs verification again"
          value={form.phone}
          onChangeText={set('phone')}
          keyboardType="phone-pad"
          maxLength={11}
        />
        <TextField
          label="Alternate mobile"
          value={form.alternate_phone}
          onChangeText={set('alternate_phone')}
          keyboardType="phone-pad"
          maxLength={11}
          placeholder="01XXXXXXXXX"
        />
        <TextField label="NID" hint="Optional — for exam eligibility" value={form.nid} onChangeText={set('nid')} keyboardType="number-pad" />
        <TextField label="Employee ID" hint="Optional — for iBAS / office users" value={form.employee_id} onChangeText={set('employee_id')} />
      </Panel>

      <Panel title="Basic information" icon="id-card-outline">
        <DateField label="Date of birth" value={form.dob} onChange={set('dob')} maximumDate={new Date()} minimumDate={new Date(1940, 0, 1)} />
        <View style={styles.field}>
          <Text style={styles.label}>Gender</Text>
          <ChipGroup options={GENDERS} value={form.gender} onChange={set('gender')} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Blood group</Text>
          <ChipGroup options={BLOOD} value={form.blood_group} onChange={set('blood_group')} />
          <Text style={styles.hint}>Opens the community blood bank.</Text>
        </View>
        <TextField label="Father’s name" value={form.father_name} onChangeText={set('father_name')} maxLength={120} autoCapitalize="words" />
        <TextField label="Mother’s name" value={form.mother_name} onChangeText={set('mother_name')} maxLength={120} autoCapitalize="words" />
        <SelectField
          label="Home district"
          display={district?.name ?? ''}
          placeholder="Not set"
          icon="location-outline"
          onPress={() => setPickDistrict(true)}
        />
      </Panel>

      <Panel title="Emergency contact" icon="medkit-outline">
        <TextField label="Name" value={form.emergency_contact_name} onChangeText={set('emergency_contact_name')} maxLength={120} autoCapitalize="words" />
        <TextField
          label="Relation"
          value={form.emergency_contact_relation}
          onChangeText={set('emergency_contact_relation')}
          maxLength={60}
          placeholder="e.g. Spouse"
          autoCapitalize="words"
        />
        <TextField
          label="Mobile"
          value={form.emergency_contact_phone}
          onChangeText={set('emergency_contact_phone')}
          keyboardType="phone-pad"
          maxLength={11}
          placeholder="01XXXXXXXXX"
        />
      </Panel>

      <Panel title="About" icon="chatbox-ellipses-outline">
        <TextField
          label="Short bio"
          hint={`${form.bio.length}/500`}
          value={form.bio}
          onChangeText={set('bio')}
          maxLength={500}
          multiline
          style={styles.bio}
          placeholder="Your role, experience or interests"
          autoCapitalize="sentences"
        />
      </Panel>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Save profile" onPress={() => void save()} loading={busy} />

      <PickerSheet
        visible={pickDistrict}
        title="Home district"
        searchable
        searchPlaceholder="Search district"
        clearLabel="Not set"
        value={form.home_district_id}
        options={districts.map((d) => ({ value: d.id, label: d.name, hint: d.name_bn }))}
        onSelect={(o) => set('home_district_id')(o.value)}
        onClose={() => setPickDistrict(false)}
      />
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  intro: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  field: {
    gap: spacing.xs + 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  bio: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 13,
    color: colors.error,
  },
});
