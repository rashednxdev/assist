import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookBadge } from '@/components/books/BookBadge';
import { BookContentsFull } from '@/components/books/BookContentsFull';
import { BookRichText } from '@/components/books/BookRichText';
import { BookPdfDownloadSheet } from '@/components/books/BookPdfDownloadSheet';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { bookNavTitle, stripHtml } from '@/lib/book-display';
import { fetchArchiveBook, type ArchiveBookData } from '@/lib/policy-api';
import { colors, spacing } from '@/theme';

export default function ArchiveBookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [data, setData] = useState<ArchiveBookData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await fetchArchiveBook(id));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the book');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasChapters = (data?.chapters.length ?? 0) > 0;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: data?.book.name ? bookNavTitle(data.book.name) : 'Archive book',
      headerRight: hasChapters
        ? () => (
            <Pressable onPress={() => setPdfOpen(true)} hitSlop={8} style={styles.headerBtn} accessibilityLabel="Download book PDF">
              <Ionicons name="download-outline" size={18} color={colors.white} />
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, data?.book.name, hasChapters]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading && !data) return <BookLoading />;
  if (error && !data) return <BookError message={error} />;
  if (!data) return <BookEmpty title="Book not found" />;

  const { book } = data;
  const descriptionPlain = stripHtml(book.description);

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <Text style={styles.title}>{book.name}</Text>
        {book.name_bn ? <Text style={styles.titleBn}>{book.name_bn}</Text> : null}

        <View style={styles.badges}>
          {book.short_name ? <BookBadge label={book.short_name} /> : null}
          {book.edition ? <BookBadge label={`Edition ${book.edition}`} variant="muted" /> : null}
          {book.book_type_name ? <BookBadge label={book.book_type_name} variant="muted" /> : null}
        </View>

        {hasChapters ? (
          <Pressable style={styles.downloadBtn} onPress={() => setPdfOpen(true)} accessibilityRole="button">
            <Ionicons name="download-outline" size={16} color={colors.white} />
            <Text style={styles.downloadBtnText}>Download PDF</Text>
          </Pressable>
        ) : null}

        {descriptionPlain ? (
          <View style={styles.panel}>
            {detailsOpen ? (
              <BookRichText html={book.description} />
            ) : (
              <Text style={styles.descriptionPreview} numberOfLines={2}>
                {descriptionPlain}
              </Text>
            )}
            <Pressable onPress={() => setDetailsOpen((v) => !v)}>
              <Text style={styles.detailsBtnText}>{detailsOpen ? 'Hide details' : 'Details'}</Text>
            </Pressable>
          </View>
        ) : null}

        <BookContentsFull chapters={data.chapters} loading={false} />
      </ScrollView>

      {hasChapters ? (
        <BookPdfDownloadSheet
          visible={pdfOpen}
          bookId={book.id}
          bookName={book.name}
          shortName={book.short_name}
          edition={book.edition}
          language={book.language}
          chapters={data.chapters}
          onClose={() => setPdfOpen(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerBtn: {
    marginRight: spacing.sm,
    width: 34,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  titleBn: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: -spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    minHeight: 42,
  },
  downloadBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  descriptionPreview: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  detailsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
