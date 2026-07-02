import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function QuestionsLayout() {
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
