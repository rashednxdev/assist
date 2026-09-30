import { Stack } from 'expo-router';
import { RED_DARK } from '@/components/blood/BloodBits';
import { colors } from '@/theme';

export default function BloodBankLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: RED_DARK },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Blood bank', headerBackTitle: 'Home' }} />
      <Stack.Screen name="settings" options={{ title: 'Donor settings' }} />
      <Stack.Screen name="donate" options={{ title: 'Record a donation' }} />
      <Stack.Screen name="request-new" options={{ title: 'Request blood' }} />
      <Stack.Screen name="requests/[id]" options={{ title: 'Blood request' }} />
    </Stack>
  );
}
