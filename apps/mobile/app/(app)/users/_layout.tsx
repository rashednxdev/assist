import { Stack } from 'expo-router';
import { HeaderTitle } from '@/components/ui/HeaderTitle';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function UsersLayout() {
  return (
    <Stack screenOptions={appStackHeaderOptions()}>
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
        name="blocked"
        options={{
          title: 'Suspended accounts',
          headerTitle: () => <HeaderTitle text="Suspended accounts" />,
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
