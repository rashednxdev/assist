import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function QotdLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Question of the Day', headerBackTitle: 'Home' }} />
      <Stack.Screen name="[subjectId]/index" options={{ title: 'Dates', headerBackTitle: 'Subjects' }} />
      <Stack.Screen name="[subjectId]/[entryId]" options={{ title: 'Questions', headerBackTitle: 'Dates' }} />
    </Stack>
  );
}
