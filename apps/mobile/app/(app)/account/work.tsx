import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ADDITIONAL_CHARGE_GRADE_MAX } from '@ibas/shared-types';
import { FormScroll } from '@/components/ui/FormScroll';
import { Panel } from '@/components/ui/Panel';
import { WorkIdentityForm } from '@/components/org/WorkIdentityForm';
import { DirectoryPrivacy } from '@/components/contacts/DirectoryPrivacy';
import { AdditionalCharges } from '@/components/contacts/AdditionalCharges';
import { colors } from '@/theme';

export default function WorkIdentityScreen() {
  const router = useRouter();
  return (
    <FormScroll>
      <Text style={styles.intro}>
        Shown with your name in the community and the contacts directory. Required before you post in the community or open contacts. Update it on
        every new posting or promotion.
      </Text>
      <Panel title="Posting: office, designation & section" icon="business-outline">
        <WorkIdentityForm submitLabel="Save posting" onSaved={() => router.back()} />
      </Panel>
      <Panel
        title="Additional charge"
        icon="briefcase-outline"
        subtitle={`Posts you hold in addition to your own, in this or another office (grade 1–${ADDITIONAL_CHARGE_GRADE_MAX}).`}
      >
        <AdditionalCharges />
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
