import { Stack } from 'expo-router';
import { SCH_DARK } from '@/components/schedule/ScheduleBits';
import { colors } from '@/theme';

export default function ScheduleLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: SCH_DARK },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Schedule', headerBackTitle: 'Home' }} />
      <Stack.Screen name="[id]" options={{ title: 'Schedule' }} />
      <Stack.Screen name="new" options={{ title: 'Add personal schedule' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit personal schedule' }} />
    </Stack>
  );
}
