import { Stack } from 'expo-router';
import { HeaderTitle } from '@/components/ui/HeaderTitle';
import { colors } from '@/theme';

const POLICY_DARK = '#1e3a8a';

export default function PolicyLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: POLICY_DARK },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Policy library', headerBackTitle: 'Home' }} />
      <Stack.Screen name="archive/index" options={{ title: 'Books & Query' }} />
      <Stack.Screen
        name="archive/know"
        options={{
          title: 'Know, Because you asked',
          headerTitle: () => <HeaderTitle text="Know, Because you asked" />,
        }}
      />
      <Stack.Screen name="archive/book/[id]" options={{ title: 'Archive book' }} />
    </Stack>
  );
}
