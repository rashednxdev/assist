import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { ArchiveOverview } from '@ibas/shared-types';
import { EmptyState } from '@/components/contacts/ContactBits';
import { fetchArchiveOverview } from '@/lib/policy-api';
import { colors, spacing } from '@/theme';

const GREEN = '#047857';
const GREEN_DARK = '#065f46';
const GREEN_SOFT = '#ecfdf5';

export default function PolicyArchiveScreen() {
  const router = useRouter();
  const [overview, setOverview] = useState<ArchiveOverview | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setOverview(await fetchArchiveOverview());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the archive');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <LinearGradient colors={[GREEN, '#059669', GREEN_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Ionicons name="library" size={140} color="rgba(255,255,255,0.08)" style={styles.heroBg} />
        <Text style={styles.kicker}>BOOKS & POLICY ARCHIVE</Text>
        <Text style={styles.heroTitle}>Read, download and know more</Text>
        <Text style={styles.heroSub}>Archived books with PDF download, and short answers to the questions people ask.</Text>
      </LinearGradient>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color="#991b1b" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {overview === null && !error ? (
        <ActivityIndicator size="large" color={GREEN} style={styles.loader} />
      ) : overview ? (
        <>
          <Text style={styles.sectionTitle}>Know, Because you asked any more</Text>
          {overview.areas.length === 0 ? (
            <Text style={styles.muted}>No questions have been added yet.</Text>
          ) : (
            <View style={styles.areaGrid}>
              {overview.areas.map((a) => (
                <Pressable
                  key={a.code}
                  onPress={() =>
                    router.push(`/(app)/policy/archive/know?area=${encodeURIComponent(a.code)}` as Href)
                  }
                  style={({ pressed }) => [styles.areaCard, { borderLeftColor: a.color }, pressed && styles.pressed]}
                >
                  <Ionicons name="help-circle" size={20} color={a.color} />
                  <View style={styles.flex}>
                    <Text style={styles.areaName} numberOfLines={2}>
                      {a.name_en}
                    </Text>
                    <Text style={styles.areaCount}>
                      {a.question_count} question{a.question_count === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Books</Text>
          {overview.books.length === 0 ? (
            <EmptyState icon="book-outline" title="No books yet" text="Archived books will appear here once the admin adds them." />
          ) : (
            overview.books.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => router.push(`/(app)/policy/archive/book/${b.id}` as Href)}
                style={({ pressed }) => [styles.book, pressed && styles.pressed]}
              >
                <View style={styles.bookIcon}>
                  <Ionicons name="book" size={18} color={GREEN} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.bookName} numberOfLines={2}>
                    {b.name}
                  </Text>
                  <Text style={styles.bookMeta} numberOfLines={1}>
                    {[b.name_bn, b.edition ? `Edition ${b.edition}` : '', `${b.chapter_count} chapter${b.chapter_count === 1 ? '' : 's'}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                {!b.is_published ? <Text style={styles.draft}>Draft</Text> : null}
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))
          )}
        </>
      ) : null}
    </ScrollView>
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
    paddingBottom: spacing.xl * 2,
  },
  pressed: {
    opacity: 0.85,
  },
  flex: {
    flex: 1,
  },
  loader: {
    marginTop: spacing.lg,
  },
  hero: {
    borderRadius: 22,
    padding: spacing.lg,
    gap: 6,
    overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute',
    right: -20,
    top: -20,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.75)',
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 25,
    color: colors.white,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xs,
  },
  muted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  areaGrid: {
    gap: spacing.sm,
  },
  areaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  areaName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  areaCount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  book: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  bookIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN_SOFT,
  },
  bookName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  bookMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  draft: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: spacing.sm + 4,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#991b1b',
  },
});
