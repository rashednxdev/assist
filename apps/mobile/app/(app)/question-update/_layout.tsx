import { Stack } from 'expo-router';
import { QuestionUpdateCatalogsProvider } from '@/lib/question-update-catalogs';
import { colors } from '@/theme';

export default function QuestionUpdateLayout() {
  return (
    <QuestionUpdateCatalogsProvider>
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
            title: 'Question Update',
            headerBackTitle: 'Home',
          }}
        />
        <Stack.Screen
          name="[id]"
          options={{
            title: '',
            headerTitleAlign: 'center',
          }}
        />
      </Stack>
    </QuestionUpdateCatalogsProvider>
  );
}
