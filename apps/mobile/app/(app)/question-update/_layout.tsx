import { Stack } from 'expo-router';
import { appStackHeaderOptions } from '@/components/navigation/AppMenu';
import { QuestionUpdateCatalogsProvider } from '@/lib/question-update-catalogs';

export default function QuestionUpdateLayout() {
  return (
    <QuestionUpdateCatalogsProvider>
      <Stack screenOptions={appStackHeaderOptions()}>
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
