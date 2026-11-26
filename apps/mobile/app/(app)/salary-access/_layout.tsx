import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function SalaryAccessLayout() {
  return (
    <Stack screenOptions={appStackHeaderOptions()}>
      <Stack.Screen name="index" options={{ title: 'Salary bill access' }} />
    </Stack>
  );
}
