import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function UserQuestionsLayout() {
  return (
    <Stack
      screenOptions={appStackHeaderOptions()}
    >
      <Stack.Screen name="index" options={{ title: 'My Submitted Questions', headerBackTitle: 'Home' }} />
      <Stack.Screen name="new" options={{ title: 'Submit a Question', headerBackTitle: 'Back' }} />
    </Stack>
  );
}
