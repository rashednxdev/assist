import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function QotdLayout() {
  return (
    <Stack
      screenOptions={appStackHeaderOptions()}
    >
      <Stack.Screen name="index" options={{ title: 'Questions of the Day', headerBackTitle: 'Home' }} />
      <Stack.Screen name="[date]/index" options={{ title: 'Questions', headerBackTitle: 'Dates' }} />
    </Stack>
  );
}
