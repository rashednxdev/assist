import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ScheduleEventRecord } from '@ibas/shared-types';
import { ScheduleEventForm } from '@/components/schedule/ScheduleEventForm';
import { ErrorBox, SCH } from '@/components/schedule/ScheduleBits';
import { fetchScheduleEvent } from '@/lib/schedule-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

export default function EditScheduleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ev, setEv] = useState<ScheduleEventRecord | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchScheduleEvent(id)
      .then((r) => {
        if (r.scope !== 'personal' || !r.can_edit) setError('Only your own personal schedules can be edited here.');
        else setEv(r);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load schedule'));
  }, [id]);

  if (!ev) {
    return <View style={styles.center}>{error ? <ErrorBox text={error} /> : <ActivityIndicator size="large" color={SCH} />}</View>;
  }
  return (
    <ScheduleEventForm
      editing={ev}
      onSaved={() => {
        showToast('Changes saved');
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
});
