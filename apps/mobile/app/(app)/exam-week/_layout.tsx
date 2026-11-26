import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function ExamWeekLayout() {
  return (
    <Stack
      screenOptions={appStackHeaderOptions()}
    >
      <Stack.Screen name="index" options={{ title: 'Exams of the Week', headerBackTitle: 'Home' }} />
      <Stack.Screen name="[weekStart]" options={{ title: 'Papers', headerBackTitle: 'Weeks' }} />
    </Stack>
  );
}
