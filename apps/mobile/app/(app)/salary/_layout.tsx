import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function SalaryLayout() {
  return (
    <Stack
      screenOptions={appStackHeaderOptions({
        headerStyle: { backgroundColor: '#0b3d2e' },
      })}
    >
      <Stack.Screen name="index" options={{ title: 'Salary On 2026', headerBackTitle: 'Home' }} />
    </Stack>
  );
}
