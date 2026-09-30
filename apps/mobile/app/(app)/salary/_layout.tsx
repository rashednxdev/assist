import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function SalaryLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0b3d2e' },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Salary On 2026', headerBackTitle: 'Home' }} />
    </Stack>
  );
}
