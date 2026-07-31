import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function ExamRoutineLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Exam Routine', headerBackTitle: 'Home' }} />
      <Stack.Screen name="[examNameId]" options={{ title: 'Routine', headerBackTitle: 'Exam Routine' }} />
    </Stack>
  );
}
