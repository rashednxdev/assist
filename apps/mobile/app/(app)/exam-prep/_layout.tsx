import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function ExamPrepLayout() {
  return (
    <Stack screenOptions={appStackHeaderOptions()}>
      <Stack.Screen name="index" options={{ title: 'Exam Preparations', headerBackTitle: 'Home' }} />
      <Stack.Screen name="[subjectId]" options={{ title: 'Subject Workspace', headerBackTitle: 'Back' }} />
    </Stack>
  );
}
