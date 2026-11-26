import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function PricingLayout() {
  return (
    <Stack screenOptions={appStackHeaderOptions()}>
      <Stack.Screen name="index" options={{ title: 'Courses', headerBackTitle: 'Home' }} />
      <Stack.Screen name="checkout/[orderId]" options={{ title: 'Checkout' }} />
      <Stack.Screen name="payments" options={{ title: 'My Courses' }} />
    </Stack>
  );
}
