import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function SavedLayout() {
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
          title: 'Saved on this device',
          headerBackTitle: 'Home',
        }}
      />
      <Stack.Screen
        name="books"
        options={{
          title: 'Books and Tools',
          headerBackTitle: 'Saved',
        }}
      />
      <Stack.Screen
        name="questions"
        options={{
          title: 'Question Bank',
          headerBackTitle: 'Saved',
        }}
      />
      <Stack.Screen
        name="marathon"
        options={{
          title: 'Marathon Review',
          headerBackTitle: 'Saved',
        }}
      />
    </Stack>
  );
}
