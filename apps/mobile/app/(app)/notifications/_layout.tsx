import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function NotificationsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: 'Home',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Notifications' }} />
      <Stack.Screen name="sent" options={{ title: 'Sent notifications' }} />
    </Stack>
  );
}
