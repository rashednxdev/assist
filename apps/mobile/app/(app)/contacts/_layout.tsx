import { Stack } from 'expo-router';
import { ContactAccessProvider } from '@/components/contacts/ContactAccess';
import { colors } from '@/theme';

export default function ContactsLayout() {
  return (
    <ContactAccessProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primaryDark },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700' },
          headerBackTitle: '',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Contacts', headerBackTitle: 'Home' }} />
        <Stack.Screen name="office/[id]" options={{ title: 'Office' }} />
      </Stack>
    </ContactAccessProvider>
  );
}
