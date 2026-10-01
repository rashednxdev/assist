import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function VerifyColleagueLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Verify a colleague', headerBackTitle: 'Home' }} />
    </Stack>
  );
}
