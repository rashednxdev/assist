import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookEmpty, BookLoading } from '@/components/books/BookStates';
import { SwipeToRemove } from '@/components/saved/SwipeToRemove';
import { useAnswerHistory } from '@/hooks/useAnswerHistory';
import { formatRelativeTime, removeAnswerHistoryEntry } from '@/lib/answer-history';
import { questionDetailHref } from '@/lib/question-routes';
import { colors, spacing } from '@/theme';

export default function AnswerHistoryScreen() {
  const router = useRouter();
  const { items, ready } = useAnswerHistory();
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => row.title.toLowerCase().includes(q));
  }, [items, query]);

  if (!ready) return <BookLoading />;

  if (items.length === 0) {
    return (
      <BookEmpty
        title="No answer reading history yet"
        subtitle="Questions you spend at least 6 seconds reading the answer of will show up here, most recent first."
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search history"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.countLabel}>
        {visible.length} of {items.length} shown
      </Text>

      {visible.length === 0 ? (
        <BookEmpty title="No matches" subtitle="Try a different search term." />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {visible.map((item) => (
            <SwipeToRemove
              key={item.id}
              confirmTitle="Remove from history?"
              confirmMessage="Remove this entry from Answer Reading History?"
              onConfirmRemove={() => removeAnswerHistoryEntry(item.id)}
            >
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => router.push(questionDetailHref(item.id))}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name="time-outline" size={20} color="#0f5c8c" />
                </View>
                <View style={styles.body}>
                  <Text style={styles.title} numberOfLines={3}>
                    {item.title}
                  </Text>
                  <View style={styles.metaRow}>
                    {item.subtitle ? (
                      <Text style={styles.subtitle} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                    <Text style={styles.time}>{formatRelativeTime(item.viewed_at)}</Text>
                  </View>
                </View>
              </Pressable>
            </SwipeToRemove>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  countLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowPressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#eef4f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  subtitle: {
    flex: 1,
    fontSize: 11,
    color: colors.textMuted,
  },
  time: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
