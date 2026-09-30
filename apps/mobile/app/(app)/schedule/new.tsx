import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ScheduleEventForm } from '@/components/schedule/ScheduleEventForm';
import { showToast } from '@/lib/toast';

export default function NewScheduleScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();
  return (
    <ScheduleEventForm
      editing={null}
      initialDate={typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined}
      onSaved={(rec) => {
        showToast('Schedule saved');
        router.replace(`/(app)/schedule/${rec.id}` as Href);
      }}
    />
  );
}
