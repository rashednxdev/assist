import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SearchBar } from '@/components/ui/SearchBar';
import { Badge, IbasCard, IbasErrorScreen, IbasLoading, ibasStyles } from '@/components/ibas/IbasBits';
import { chapterHeading, ruleHeading } from '@/lib/book-display';
import { fetchBookReaderOutline } from '@/lib/books-api';
import { areaHref } from '@/lib/ibas-api';
import { useIbasAreas } from '@/lib/ibas-areas';
import type { BookReaderOutline } from '@/types/books';
import { colors, spacing } from '@/theme';

export default function AreaBookScreen() {
  const router = useRouter();
  const { code, bookId } = useLocalSearchParams<{ code: string; bookId: string }>();
  const { areaColor } = useIbasAreas();
  const [outline, setOutline] = useState<BookReaderOutline | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!bookId) return;
    try {
      const o = await fetchBookReaderOutline(bookId);
      setOutline(o);
      setError('');
      if (o.chapters.length === 1) setOpen(new Set([o.chapters[0]!.id]));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this book');
    }
  }, [bookId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const chapters = useMemo(() => {
    if (!outline) return [];
    const q = query.trim().toLowerCase();
    if (!q) return outline.chapters;
    return outline.chapters
      .map((c) => ({ ...c, topics: c.topics.filter((t) => ruleHeading(t).toLowerCase().includes(q)) }))
      .filter((c) => c.topics.length > 0 || chapterHeading(c).toLowerCase().includes(q));
  }, [outline, query]);

  const accent = code ? areaColor(code) : colors.primary;
  if (!outline || !code || !bookId) return error ? <IbasErrorScreen message={error} /> : <IbasLoading color={accent} />;

  const searching = query.trim().length > 0;
  const ruleCount = outline.chapters.reduce((n, c) => n + c.topics.length, 0);

  function toggle(id: string) {
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: outline.book.short_name || 'Book' }} />
      <ScrollView style={ibasStyles.root} contentContainerStyle={ibasStyles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        <IbasCard accent={accent}>
          <Text style={ibasStyles.kicker}>BOOK</Text>
          <Text style={ibasStyles.title}>{outline.book.name}</Text>
          {outline.book.name_bn ? <Text style={ibasStyles.titleBn}>{outline.book.name_bn}</Text> : null}
          <View style={ibasStyles.row}>
            <Badge label={`${outline.chapters.length} chapter${outline.chapters.length === 1 ? '' : 's'}`} />
            <Badge label={`${ruleCount} rule${ruleCount === 1 ? '' : 's'}`} />
            {outline.book.edition ? <Badge label={outline.book.edition} /> : null}
          </View>
          {outline.book.description ? <Text style={ibasStyles.small}>{outline.book.description}</Text> : null}
        </IbasCard>

        {ruleCount > 8 ? <SearchBar value={query} onChangeText={setQuery} placeholder="Find a rule in this book" /> : null}

        {chapters.length === 0 ? <Text style={styles.empty}>{searching ? 'No rules match your search.' : 'This book has no chapters yet.'}</Text> : null}

        {chapters.map((c) => {
          const expanded = searching || open.has(c.id);
          return (
            <View key={c.id} style={styles.chapter}>
              <Pressable onPress={() => toggle(c.id)} style={styles.chapterHead} accessibilityRole="button" accessibilityState={{ expanded }}>
                <View style={styles.flex}>
                  <Text style={styles.chapterTitle}>{chapterHeading(c)}</Text>
                  <Text style={ibasStyles.small}>
                    {c.topics.length} rule{c.topics.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </Pressable>
              {expanded
                ? c.topics.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => router.push(areaHref(code, 'rule', t.id, `book=${bookId}`))}
                      style={({ pressed }) => [styles.topic, pressed && styles.pressed]}
                    >
                      <Ionicons name="scale-outline" size={15} color={accent} />
                      <Text style={styles.topicText}>{ruleHeading(t)}</Text>
                      {t.is_amended ? <Badge label="Amended" color={colors.warning} /> : null}
                      <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                    </Pressable>
                  ))
                : null}
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  empty: {
    fontSize: 13,
    textAlign: 'center',
    color: colors.textMuted,
    paddingVertical: spacing.lg,
  },
  chapter: {
    overflow: 'hidden',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chapterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 6,
  },
  chapterTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  topic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.sm + 6,
    paddingVertical: 11,
  },
  topicText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
});
