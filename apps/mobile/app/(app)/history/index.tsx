import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookEmpty, BookLoading } from '@/components/books/BookStates';
import { SwipeToRemove } from '@/components/saved/SwipeToRemove';
import { useAnswerHistory } from '@/hooks/useAnswerHistory';
import {
  formatRelativeTime,
  groupAnswerHistoryByDate,
  groupAnswerHistoryBySubject,
  HISTORY_DATE_FILTERS,
  HISTORY_SORTS,
  matchesDateFilter,
  removeAnswerHistoryEntry,
  type AnswerHistoryDateFilter,
  type AnswerHistorySort,
} from '@/lib/answer-history';
import { questionDetailHref } from '@/lib/question-routes';
import { useAuth } from '@/lib/auth-context';
import { AnswerPdfDownloadSheet } from '@/components/questions/AnswerPdfDownloadSheet';
import { colors, spacing } from '@/theme';

export default function AnswerHistoryScreen() {
  const router = useRouter();
  const { items, ready } = useAnswerHistory();
  const { canAccess } = useAuth();
  const canDownloadPdf = canAccess('ANSWER_PDF');
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfIds, setPdfIds] = useState<string[]>([]);
  const [pdfScopeLabel, setPdfScopeLabel] = useState('');
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<AnswerHistoryDateFilter>('all');
  const [sort, setSort] = useState<AnswerHistorySort>('date');
  const [source, setSource] = useState('');
  const [subject, setSubject] = useState('');

  const sources = useMemo(() => {
    const names = [...new Set(items.map((row) => row.subtitle?.trim()).filter((v): v is string => Boolean(v)))];
    return names.sort((a, b) => a.localeCompare(b));
  }, [items]);

  const subjects = useMemo(() => {
    const names = [...new Set(items.map((row) => row.subject?.trim()).filter((v): v is string => Boolean(v)))];
    return names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((row) => {
      if (!matchesDateFilter(row.viewed_at, dateFilter)) return false;
      if (source && (row.subtitle ?? '') !== source) return false;
      if (subject && (row.subject ?? '') !== subject) return false;
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q) ||
        (row.subtitle ?? '').toLowerCase().includes(q) ||
        (row.subject ?? '').toLowerCase().includes(q)
      );
    });
  }, [items, query, dateFilter, source, subject]);

  const groups = useMemo(
    () => (sort === 'subject' ? groupAnswerHistoryBySubject(visible) : groupAnswerHistoryByDate(visible)),
    [visible, sort],
  );

  if (!ready) return <BookLoading />;

  if (items.length === 0) {
    return (
      <BookEmpty
        title="No answer reading history yet"
        subtitle="Questions you spend at least 6 seconds reading the answer of will show up here, grouped by date."
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

      <View style={styles.chipBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {HISTORY_DATE_FILTERS.map((item) => {
            const active = dateFilter === item.id;
            return (
              <Pressable
                key={item.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setDateFilter(item.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.chipBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {HISTORY_SORTS.map((item) => {
            const active = sort === item.id;
            return (
              <Pressable
                key={item.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSort(item.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {subjects.length > 1 ? (
        <View style={styles.chipBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Pressable
              style={[styles.chip, !subject && styles.chipActive]}
              onPress={() => setSubject('')}
            >
              <Text style={[styles.chipText, !subject && styles.chipTextActive]} numberOfLines={1}>
                All subjects
              </Text>
            </Pressable>
            {subjects.map((name) => {
              const active = subject === name;
              return (
                <Pressable
                  key={name}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSubject(active ? '' : name)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {sources.length > 1 ? (
        <View style={styles.chipBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Pressable
              style={[styles.chip, !source && styles.chipActive]}
              onPress={() => setSource('')}
            >
              <Text style={[styles.chipText, !source && styles.chipTextActive]} numberOfLines={1}>
                All sources
              </Text>
            </Pressable>
            {sources.map((name) => {
              const active = source === name;
              return (
                <Pressable
                  key={name}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSource(active ? '' : name)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <Text style={styles.countLabel}>
        {visible.length} of {items.length} shown
      </Text>

      {canDownloadPdf && visible.length > 0 ? (
        <Pressable
          style={styles.pdfBar}
          onPress={() => {
            setPdfIds(visible.map((row) => row.id));
            setPdfScopeLabel(
              `${Math.min(visible.length, 40)} of ${visible.length} in current history filter`,
            );
            setPdfOpen(true);
          }}
        >
          <Ionicons name="download-outline" size={16} color={colors.primary} />
          <Text style={styles.pdfBarText}>Download answers PDF (current list)</Text>
        </Pressable>
      ) : null}

      {visible.length === 0 ? (
        <BookEmpty title="No matches" subtitle="Try a different date filter or search term." />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                <Text style={styles.groupCount}>
                  {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                </Text>
              </View>
              {group.items.map((item) => (
                <SwipeToRemove
                  key={item.id}
                  confirmTitle="Remove from history?"
                  confirmMessage="Remove this entry from Answer Reading History?"
                  onConfirmRemove={() => removeAnswerHistoryEntry(item.id)}
                >
                  <Pressable
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    onPress={() => router.push(questionDetailHref(item.id))}
                    onLongPress={
                      canDownloadPdf
                        ? () => {
                            setPdfIds([item.id]);
                            setPdfScopeLabel('This history item');
                            setPdfOpen(true);
                          }
                        : undefined
                    }
                    delayLongPress={350}
                  >
                    <View style={styles.iconWrap}>
                      <Ionicons name="time-outline" size={20} color="#0f5c8c" />
                    </View>
                    <View style={styles.body}>
                      <Text style={styles.title} numberOfLines={3}>
                        {item.title}
                      </Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.subtitle} numberOfLines={1}>
                          {[item.subject, item.subtitle].filter(Boolean).join(' · ') || ' '}
                        </Text>
                        <Text style={styles.time}>{formatRelativeTime(item.viewed_at)}</Text>
                      </View>
                    </View>
                    {canDownloadPdf ? (
                      <Pressable
                        hitSlop={8}
                        onPress={() => {
                          setPdfIds([item.id]);
                          setPdfScopeLabel('This history item');
                          setPdfOpen(true);
                        }}
                        accessibilityLabel="Download answer PDF"
                      >
                        <Ionicons name="download-outline" size={18} color={colors.primary} />
                      </Pressable>
                    ) : null}
                  </Pressable>
                </SwipeToRemove>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {canDownloadPdf ? (
        <AnswerPdfDownloadSheet
          visible={pdfOpen}
          questionIds={pdfIds}
          scopeLabel={pdfScopeLabel}
          onClose={() => setPdfOpen(false)}
        />
      ) : null}
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
  chipBar: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: 168,
    alignSelf: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.white,
  },
  countLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  pdfBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pdfBarText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  list: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  group: {
    gap: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  groupCount: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
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
