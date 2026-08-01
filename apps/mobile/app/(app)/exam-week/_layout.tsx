import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function ExamWeekLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Exams of the Week', headerBackTitle: 'Home' }} />
      <Stack.Screen name="[weekStart]" options={{ title: 'Papers', headerBackTitle: 'Weeks' }} />
    </Stack>
  );
}
