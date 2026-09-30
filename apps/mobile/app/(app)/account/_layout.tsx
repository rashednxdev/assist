import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function AccountLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: 'Profile',
      }}
    >
      <Stack.Screen name="personal" options={{ title: 'Personal information' }} />
      <Stack.Screen name="work" options={{ title: 'Office & designation' }} />
      <Stack.Screen name="service" options={{ title: 'Service information' }} />
    </Stack>
  );
}
