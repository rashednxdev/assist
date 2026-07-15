import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSavedShortcuts } from '@/hooks/useSavedShortcuts';
import { groupSavedShortcuts, type SavedShortcutKind } from '@/lib/saved-shortcuts';
import { colors, spacing } from '@/theme';

const MODULES: Array<{
  kind: SavedShortcutKind;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  href: Href;
}> = [
  {
    kind: 'book',
    title: 'Books and Tools',
    subtitle: 'Saved books from the library',
    icon: 'library-outline',
    color: '#0f5c8c',
    href: '/(app)/saved/books' as Href,
  },
  {
    kind: 'question',
    title: 'Question Bank',
    subtitle: 'Saved practice questions',
    icon: 'help-circle-outline',
    color: '#7c3aed',
    href: '/(app)/saved/questions' as Href,
  },
  {
    kind: 'marathon',
    title: 'Marathon Review',
    subtitle: 'Saved marathon MCQs',
    icon: 'fitness-outline',
    color: '#0f5c8c',
    href: '/(app)/saved/marathon' as Href,
  },
];

export default function SavedModulesScreen() {
  const router = useRouter();
  const { items } = useSavedShortcuts();
  const groups = groupSavedShortcuts(items);

  function countFor(kind: SavedShortcutKind) {
    if (kind === 'book') return groups.books.length;
    if (kind === 'question') return groups.questions.length;
    return groups.marathon.length;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.hint}>Items saved with the bookmark stay on this device only.</Text>
      <View style={styles.grid}>
        {MODULES.map((m) => {
          const count = countFor(m.kind);
          return (
            <Pressable
              key={m.kind}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              onPress={() => router.push(m.href)}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${m.color}22` }]}>
                <Ionicons name={m.icon} size={26} color={m.color} />
              </View>
              <Text style={styles.tileTitle}>{m.title}</Text>
              <Text style={styles.tileSubtitle}>{m.subtitle}</Text>
              <Text style={styles.tileCount}>{count === 0 ? 'None saved yet' : `${count} saved`}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  tilePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  tileSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  tileCount: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },
});
