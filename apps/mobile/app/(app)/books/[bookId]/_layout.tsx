import { Stack, useLocalSearchParams } from 'expo-router';
import { BookReaderProvider } from '@/components/books/BookReaderContext';
import { colors } from '@/theme';

export default function BookLayout() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  return (
    <BookReaderProvider bookId={bookId}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primaryDark },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700' },
          headerBackTitle: '',
          headerTitleAlign: 'center',
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: ' ',
            headerBackTitle: 'Library',
          }}
        />
        <Stack.Screen
          name="chapter/[chapterId]"
          options={{
            title: 'Chapter',
          }}
        />
        <Stack.Screen
          name="rule/[topicId]"
          options={{
            title: 'Rule',
          }}
        />
      </Stack>
    </BookReaderProvider>
  );
}
