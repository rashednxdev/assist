import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function LiveStreamLayout() {
  return (
    <Stack screenOptions={appStackHeaderOptions()}>
      <Stack.Screen name="index" options={{ title: 'Live Classes' }} />
      <Stack.Screen name="[id]" options={{ title: 'Live session' }} />
    </Stack>
  );
}
