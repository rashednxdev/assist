import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function PricingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Pricing', headerBackTitle: 'Home' }} />
      <Stack.Screen name="checkout/[orderId]" options={{ title: 'Checkout' }} />
      <Stack.Screen name="payments" options={{ title: 'Payments & access' }} />
    </Stack>
  );
}
