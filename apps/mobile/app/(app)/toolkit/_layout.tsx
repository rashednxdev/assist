import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function ToolkitLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#134e4a' },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Checklists & templates', headerBackTitle: 'Home' }} />
      <Stack.Screen name="[id]" options={{ title: 'Toolkit' }} />
    </Stack>
  );
}
