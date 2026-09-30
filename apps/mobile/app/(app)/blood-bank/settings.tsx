import { ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { FormScroll } from '@/components/ui/FormScroll';
import { BloodProfileForm } from '@/components/blood/BloodProfileForm';
import { ErrorNote, RED } from '@/components/blood/BloodBits';
import { useBloodMe } from '@/lib/blood-api';
import { spacing } from '@/theme';

export default function BloodSettingsScreen() {
  const router = useRouter();
  const { me, error } = useBloodMe();
  return (
    <FormScroll>
      {me ? (
        <BloodProfileForm me={me} onSaved={() => router.back()} />
      ) : error ? (
        <ErrorNote text={error} />
      ) : (
        <ActivityIndicator color={RED} style={styles.loader} />
      )}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginVertical: spacing.xl,
  },
});
