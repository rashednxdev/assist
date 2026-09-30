import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function ExamPrepLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Exam Preparation', headerBackTitle: 'Home' }} />
    </Stack>
  );
}
