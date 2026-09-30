import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function CalculationsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0b3d2e' },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Salary & Calculations', headerBackTitle: 'Home' }} />
    </Stack>
  );
}
