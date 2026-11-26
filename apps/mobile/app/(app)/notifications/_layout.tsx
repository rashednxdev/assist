import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function NotificationsLayout() {
  return (
    <Stack
      screenOptions={appStackHeaderOptions()}
    >
      <Stack.Screen name="index" options={{ title: 'Notifications' }} />
      <Stack.Screen name="sent" options={{ title: 'Sent notifications' }} />
    </Stack>
  );
}
