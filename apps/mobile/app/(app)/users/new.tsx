import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { canManageUsers, createAdminUser } from '@/lib/users-api';
import { colors, spacing } from '@/theme';

const USER_TYPES = [
  { id: 'applicant', label: 'Applicant' },
  { id: 'officer', label: 'Officer' },
  { id: 'admin', label: 'Admin' },
  { id: 'system_admin', label: 'System admin' },
];

export default function NewUserScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = canManageUsers(user);

  const [fullName, setFullName] = useState('');
  const [fullNameBn, setFullNameBn] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState('applicant');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Admin only</Text>
      </View>
    );
  }

  async function submit() {
    setError('');
    if (!fullName.trim() || !email.trim() || !phone.trim() || password.length < 8) {
      setError('Name, email, phone, and password (8+ chars) are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await createAdminUser({
        full_name_en: fullName.trim(),
        full_name_bn: fullNameBn.trim() || undefined,
        email: email.trim(),
        phone: phone.trim(),
        password,
        user_type: userType,
      });
      router.replace(`/(app)/users/${res.data.id}` as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
      <TextField label="Full name (EN)" value={fullName} onChangeText={setFullName} />
      <TextField label="Full name (BN)" value={fullNameBn} onChangeText={setFullNameBn} />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextField
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="01700000000"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        secureToggle
      />
      <Text style={styles.label}>User type</Text>
      <View style={styles.chips}>
        {USER_TYPES.map((t) => (
          <Pressable
            key={t.id}
            style={[styles.chip, userType === t.id && styles.chipActive]}
            onPress={() => setUserType(t.id)}
          >
            <Text style={[styles.chipText, userType === t.id && styles.chipTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Create user" onPress={() => void submit()} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.white },
  error: { color: colors.error, fontSize: 13 },
});
