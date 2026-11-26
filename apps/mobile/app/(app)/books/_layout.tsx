import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';

export default function BooksLayout() {
  return (
    <Stack screenOptions={appStackHeaderOptions()}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Rules Library',
          headerBackTitle: 'Home',
        }}
      />
      <Stack.Screen name="[bookId]" options={{ headerShown: false }} />
      <Stack.Screen name="regulations/index" options={{ title: 'Regulations' }} />
      <Stack.Screen name="regulations/[id]" options={{ title: 'Regulation' }} />
    </Stack>
  );
}
