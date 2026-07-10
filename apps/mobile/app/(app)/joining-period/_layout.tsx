import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function JoiningPeriodLayout() {
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
          title: 'Joining period',
          headerBackTitle: 'Home',
        }}
      />
    </Stack>
  );
}
