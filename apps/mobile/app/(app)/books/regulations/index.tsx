import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookBadge } from '@/components/books/BookBadge';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { searchRegulations } from '@/lib/books-api';
import { regulationDetailHref } from '@/lib/book-routes';
import type { RegulationSearchRow } from '@/types/books';
import { colors, spacing } from '@/theme';

export default function RegulationsSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<RegulationSearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const search = useCallback(async (term?: string) => {
    setError('');
    setLoading(true);
    try {
      const data = await searchRegulations({ q: term });
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void search('');
  }, [search]);

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Regulation no, title, keyword..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={() => void search(query)}
          />
        </View>
        <Pressable style={styles.searchBtn} onPress={() => void search(query)}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>

      {loading && items.length === 0 ? (
        <BookLoading />
      ) : error ? (
        <BookError message={error} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <BookEmpty title="No regulations found" subtitle="Try a different search term." />
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => router.push(regulationDetailHref(item.id))}
            >
              <View style={styles.rowBody}>
                <Text style={styles.regNo}>{item.regulation_no}</Text>
                <Text style={styles.regTitle}>{item.title}</Text>
              </View>
              <View style={styles.badges}>
                <BookBadge label={item.regulation_type} variant="muted" />
                {item.is_amended ? <BookBadge label="Amended" variant="warning" /> : null}
                {item.payment_related ? <BookBadge label="Payment" variant="muted" /> : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowBody: {
    gap: 4,
  },
  regNo: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  regTitle: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pressed: {
    opacity: 0.9,
  },
});
