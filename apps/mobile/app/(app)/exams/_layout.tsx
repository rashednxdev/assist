import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function ExamsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Exam Programs',
          headerBackTitle: 'Home',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Exam Program',
        }}
      />
      <Stack.Screen
        name="subjects/[subjectId]"
        options={{
          title: 'Syllabus',
        }}
      />
    </Stack>
  );
}
