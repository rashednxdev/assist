import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function LiveStreamLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Live class' }} />
      <Stack.Screen name="[id]" options={{ title: 'Live session' }} />
    </Stack>
  );
}
