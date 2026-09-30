import { Stack } from 'expo-router';
import { CIR_DARK } from '@/components/circulars/CircularBits';
import { colors } from '@/theme';

export default function CircularsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: CIR_DARK },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Circular archive', headerBackTitle: 'Home' }} />
      <Stack.Screen name="[id]" options={{ title: 'Circular' }} />
    </Stack>
  );
}
