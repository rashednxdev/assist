import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function QuestionUpdateLayout() {
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
          title: 'Question Update',
          headerBackTitle: 'Home',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Edit question',
        }}
      />
    </Stack>
  );
}
