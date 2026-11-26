import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function HistoryLayout() {
  return (
    <Stack
      screenOptions={appStackHeaderOptions()}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Answer Reading History',
          headerBackTitle: 'Home',
        }}
      />
    </Stack>
  );
}
