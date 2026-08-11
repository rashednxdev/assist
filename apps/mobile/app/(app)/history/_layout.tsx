import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function HistoryLayout() {
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
          title: 'Answer Reading History',
          headerBackTitle: 'Home',
        }}
      />
    </Stack>
  );
}
