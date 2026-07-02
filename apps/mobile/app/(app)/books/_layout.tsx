import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function BooksLayout() {
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
          title: 'Library & Tools',
          headerBackTitle: 'Home',
        }}
      />
      <Stack.Screen name="[bookId]" options={{ headerShown: false }} />
      <Stack.Screen
        name="regulations/index"
        options={{
          title: 'Regulations',
        }}
      />
      <Stack.Screen
        name="regulations/[id]"
        options={{
          title: 'Regulation',
        }}
      />
    </Stack>
  );
}
