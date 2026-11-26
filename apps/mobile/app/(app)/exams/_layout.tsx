import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function ExamsLayout() {
  return (
    <Stack screenOptions={appStackHeaderOptions()}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Exam Programs',
          headerBackTitle: 'Home',
        }}
      />
      <Stack.Screen name="[id]" options={{ title: 'Exam Program' }} />
      <Stack.Screen name="subjects/[subjectId]" options={{ title: 'Syllabus' }} />
    </Stack>
  );
}
