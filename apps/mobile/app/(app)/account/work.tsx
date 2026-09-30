import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { FormScroll } from '@/components/ui/FormScroll';
import { Panel } from '@/components/ui/Panel';
import { WorkIdentityForm } from '@/components/org/WorkIdentityForm';
import { DirectoryPrivacy } from '@/components/contacts/DirectoryPrivacy';
import { colors } from '@/theme';

export default function WorkIdentityScreen() {
  const router = useRouter();
  return (
    <FormScroll>
      <Text style={styles.intro}>
        Shown with your name in the community and the contacts directory. Required before you post in the community or open contacts.
      </Text>
      <Panel title="Office & designation" icon="business-outline">
        <WorkIdentityForm onSaved={() => router.back()} />
      </Panel>
      <Panel title="Directory privacy" icon="eye-off-outline" subtitle="Your name, designation and office are always listed so colleagues can find you.">
        <DirectoryPrivacy />
      </Panel>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
});
