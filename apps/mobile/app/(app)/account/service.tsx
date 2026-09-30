import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { FormScroll } from '@/components/ui/FormScroll';
import { Panel } from '@/components/ui/Panel';
import { ServiceInfoForm } from '@/components/org/ServiceInfoForm';
import { colors } from '@/theme';

export default function ServiceInfoScreen() {
  const router = useRouter();
  return (
    <FormScroll>
      <Text style={styles.intro}>
        Cadre officers are grouped by BCS batch; others by the post they joined and when. Find your batchmates in Contacts.
      </Text>
      <Panel title="How did you join the service?" icon="school-outline">
        <ServiceInfoForm onSaved={() => router.back()} />
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
