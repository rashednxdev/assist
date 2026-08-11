import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function UsersLayout() {
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
          title: 'Users',
          headerBackTitle: 'Home',
        }}
      />
      <Stack.Screen
        name="new"
        options={{
          title: 'Add user',
          headerBackTitle: 'Users',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'User',
          headerBackTitle: 'Users',
        }}
      />
    </Stack>
  );
}
