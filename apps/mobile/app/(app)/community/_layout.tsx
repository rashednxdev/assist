import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function CommunityLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#115e59' },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Community', headerBackTitle: 'Home' }} />
      <Stack.Screen name="new" options={{ title: 'Start a discussion' }} />
      <Stack.Screen name="[id]" options={{ title: 'Discussion' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit discussion' }} />
    </Stack>
  );
}
