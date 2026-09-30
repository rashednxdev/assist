import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function IbasLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0c4a6e' },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'iBAS++ Workspace', headerBackTitle: 'Home' }} />
      <Stack.Screen name="[code]/index" options={{ title: 'iBAS++ area' }} />
      <Stack.Screen name="[code]/process/[id]" options={{ title: 'Process' }} />
      <Stack.Screen name="[code]/run/[runId]" options={{ title: 'Interactive run' }} />
      <Stack.Screen name="[code]/kit/[id]" options={{ title: 'Toolkit' }} />
      <Stack.Screen name="[code]/rule/[topicId]" options={{ title: 'Rule' }} />
      <Stack.Screen name="[code]/book/[bookId]" options={{ title: 'Book' }} />
      <Stack.Screen name="[code]/circular/[id]" options={{ title: 'Circular' }} />
    </Stack>
  );
}
