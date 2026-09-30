import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { PolicyCollectionSummary } from '@ibas/shared-types';
import { EmptyState } from '@/components/contacts/ContactBits';
import { fetchPolicyCollections } from '@/lib/policy-api';
import { colors, spacing } from '@/theme';

const BLUE = '#1e40af';
const BLUE_DARK = '#1e3a8a';
const BLUE_SOFT = '#eff6ff';

function Shortcut({
  icon,
  tint,
  bg,
  title,
  text,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bg: string;
  title: string;
  text: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}>
      <View style={[styles.shortcutIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.shortcutTitle}>{title}</Text>
        <Text style={styles.shortcutText}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function CollectionCard({ col, onBook, onCirculars }: { col: PolicyCollectionSummary; onBook: (id: string) => void; onCirculars: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Ionicons name="library" size={20} color={BLUE} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{col.name_en}</Text>
          {col.name_bn ? <Text style={styles.cardTitleBn}>{col.name_bn}</Text> : null}
        </View>
      </View>
      {col.description_en ? <Text style={styles.cardDesc}>{col.description_en}</Text> : null}

      {col.books.length === 0 ? (
        <Text style={styles.muted}>No books added to this collection yet.</Text>
      ) : (
        <View style={styles.books}>
          {col.books.map((b) => (
            <Pressable key={b.id} onPress={() => onBook(b.id)} style={({ pressed }) => [styles.book, pressed && styles.pressed]}>
              <Ionicons name="book-outline" size={18} color={colors.textMuted} />
              <View style={styles.flex}>
                <Text style={styles.bookName} numberOfLines={2}>
                  {b.name}
                </Text>
                {b.name_bn ? (
                  <Text style={styles.bookNameBn} numberOfLines={1}>
                    {b.name_bn}
                  </Text>
                ) : null}
              </View>
              {b.book_type_name ? <Text style={styles.badge}>{b.book_type_name}</Text> : null}
              {!b.is_published ? <Text style={[styles.badge, styles.badgeDraft]}>Draft</Text> : null}
            </Pressable>
          ))}
        </View>
      )}

      <Pressable onPress={onCirculars} style={({ pressed }) => [styles.circLink, pressed && styles.pressed]}>
        <Ionicons name="archive-outline" size={16} color={BLUE} />
        <Text style={styles.circLinkText}>
          {col.circular_count} circular{col.circular_count === 1 ? '' : 's'} in this collection
        </Text>
        <Ionicons name="chevron-forward" size={16} color={BLUE} />
      </Pressable>
    </View>
  );
}

export default function PolicyLibraryScreen() {
  const router = useRouter();
  const [collections, setCollections] = useState<PolicyCollectionSummary[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setCollections(await fetchPolicyCollections());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the policy library');
      setCollections((cur) => cur ?? []);
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
    <ScrollView style={styles.root} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      <LinearGradient colors={[BLUE, '#2563eb', BLUE_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Ionicons name="library" size={140} color="rgba(255,255,255,0.08)" style={styles.heroBg} />
        <Text style={styles.kicker}>POLICY LIBRARY</Text>
        <Text style={styles.heroTitle}>Acts, rules and circulars grouped by subject</Text>
        <Text style={styles.heroSub}>Procurement, financial rules, service rules, tax and audit.</Text>
      </LinearGradient>

      <Shortcut
        icon="archive"
        tint="#6d28d9"
        bg="#f5f3ff"
        title="Digital Circular Archive"
        text="Search circulars, SROs, gazettes and office orders by number, subject or year."
        onPress={() => router.push('/(app)/circulars' as Href)}
      />
      <Shortcut
        icon="briefcase"
        tint={BLUE_DARK}
        bg={BLUE_SOFT}
        title="iBAS++ Workspace"
        text="Procedures, rules, circulars and tools for each iBAS++ area in one place."
        onPress={() => router.push('/(app)/ibas' as Href)}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color="#991b1b" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {collections === null ? (
        <ActivityIndicator size="large" color={BLUE} style={styles.loader} />
      ) : collections.length === 0 && !error ? (
        <EmptyState icon="library-outline" title="No collections yet" text="Policy collections will appear here once the admin sets them up." />
      ) : (
        collections.map((col) => (
          <CollectionCard
            key={col.code}
            col={col}
            onBook={(id) => router.push(`/(app)/books/${id}` as Href)}
            onCirculars={() => router.push(`/(app)/circulars?collection=${col.code}` as Href)}
          />
        ))
      )}
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
  shortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  shortcutIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  shortcutText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  card: {
    gap: spacing.sm + 2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 4,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_SOFT,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  cardTitleBn: {
    fontSize: 13,
    color: colors.textMuted,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  muted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  books: {
    gap: 6,
  },
  book: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
  },
  bookName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  bookNameBn: {
    fontSize: 12,
    color: colors.textMuted,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  badgeDraft: {
    color: '#92400e',
    borderColor: '#fde68a',
    backgroundColor: '#fef3c7',
  },
  circLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: BLUE_SOFT,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  circLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: BLUE,
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
