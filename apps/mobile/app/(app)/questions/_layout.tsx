import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function QuestionsLayout() {
  return (
    <Stack screenOptions={appStackHeaderOptions()}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Question Bank',
          headerBackTitle: 'Home',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: '',
          headerTitleAlign: 'center',
        }}
      />
    </Stack>
  );
}
