import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function ExamRoutineLayout() {
  return (
    <Stack
      screenOptions={appStackHeaderOptions()}
    >
      <Stack.Screen name="index" options={{ title: 'Exam Routine', headerBackTitle: 'Home' }} />
      <Stack.Screen name="[examNameId]" options={{ title: 'Routine', headerBackTitle: 'Exam Routine' }} />
    </Stack>
  );
}
