import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function UserQuestionsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'My Submitted Questions', headerBackTitle: 'Home' }} />
      <Stack.Screen name="new" options={{ title: 'Submit a Question', headerBackTitle: 'Back' }} />
    </Stack>
  );
}
