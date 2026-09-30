import { Stack } from 'expo-router';
import { colors } from '@/theme';

const POLICY_DARK = '#1e3a8a';

export default function PolicyLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: POLICY_DARK },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Policy library', headerBackTitle: 'Home' }} />
    </Stack>
  );
}
