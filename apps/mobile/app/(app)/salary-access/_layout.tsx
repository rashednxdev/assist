import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function SalaryAccessLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: 'Home',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Salary bill access' }} />
    </Stack>
  );
}
