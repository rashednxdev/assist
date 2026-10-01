import { Stack } from 'expo-router';
import { DED_DARK } from '@/lib/deductions-api';
import { colors } from '@/theme';

export default function DeductionsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: DED_DARK },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'VAT, IT, Tax & Deductions', headerBackTitle: 'Home' }} />
      <Stack.Screen name="[id]" options={{ title: 'Deductions' }} />
      <Stack.Screen name="circular/[id]" options={{ title: 'Circular' }} />
    </Stack>
  );
}
