import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function PapersLayout() {
  return (
    <Stack screenOptions={appStackHeaderOptions()}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Exam Papers',
          headerBackTitle: 'Home',
        }}
      />
      <Stack.Screen name="[id]" options={{ title: 'Paper' }} />
    </Stack>
  );
}
