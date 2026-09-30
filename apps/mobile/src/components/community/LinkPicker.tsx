import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COMMUNITY_LINK_KIND_LABELS, COMMUNITY_MAX_LINKS, type CommunityLinkKind, type CommunityLinkRecord } from '@ibas/shared-types';
import { LINK_KIND_ORDER, LINK_KIND_STYLE, fetchLinkOptions } from '@/lib/community-api';
import { TEAL } from '@/components/community/CommunityBits';
import { colors, spacing } from '@/theme';

/** Tag a workflow, checklist, template, guide or circular on a discussion or answer. */
export function LinkPicker({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: CommunityLinkRecord[];
  onChange: (links: CommunityLinkRecord[]) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<CommunityLinkKind | ''>('');
  const [options, setOptions] = useState<CommunityLinkRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      fetchLinkOptions(q.trim(), kind)
        .then((r) => alive && setOptions(r))
        .catch(() => alive && setOptions([]))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, kind, visible]);

  const has = (o: CommunityLinkRecord) => value.some((v) => v.type === o.type && v.id === o.id);
  const full = value.length >= COMMUNITY_MAX_LINKS;
  const toggle = (o: CommunityLinkRecord) => {
    if (has(o)) onChange(value.filter((v) => !(v.type === o.type && v.id === o.id)));
    else if (!full) onChange([...value, o]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Tag related items</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search workflows, checklists, circulars…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {loading ? <ActivityIndicator size="small" color={TEAL} /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kinds} style={styles.kindsWrap}>
          {(['', ...LINK_KIND_ORDER] as const).map((k) => (
            <Pressable key={k || 'all'} onPress={() => setKind(k)} style={[styles.kind, kind === k && styles.kindOn]}>
              <Text style={[styles.kindText, kind === k && styles.kindTextOn]}>{k ? COMMUNITY_LINK_KIND_LABELS[k] : 'All'}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <FlatList
          data={options}
          keyExtractor={(o) => `${o.type}:${o.id}`}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Searching…' : 'Nothing found. Try another word.'}</Text>}
          renderItem={({ item }) => {
            const on = has(item);
            const s = LINK_KIND_STYLE[item.kind];
            return (
              <Pressable disabled={!on && full} onPress={() => toggle(item)} style={({ pressed }) => [styles.row, on && styles.rowOn, !on && full && styles.disabled, pressed && styles.pressed]}>
                <View style={[styles.icon, { backgroundColor: s.bg, borderColor: s.border }]}>
                  <Ionicons name={s.icon} size={15} color={s.fg} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {COMMUNITY_LINK_KIND_LABELS[item.kind]}
                    {item.subtitle ? ` · ${item.subtitle}` : ''}
                  </Text>
                </View>
                <Ionicons name={on ? 'checkmark-circle' : 'add-circle-outline'} size={22} color={on ? TEAL : '#cbd5e1'} />
              </Pressable>
            );
          }}
        />
        <Text style={styles.foot}>
          {value.length}/{COMMUNITY_MAX_LINKS} tagged · Readers can open the tagged item straight from the post.
        </Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '82%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  done: {
    fontSize: 16,
    fontWeight: '700',
    color: TEAL,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 8,
  },
  kindsWrap: {
    flexGrow: 0,
    marginTop: spacing.sm,
  },
  kinds: {
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  kind: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  kindOn: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  kindText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  kindTextOn: {
    color: colors.white,
  },
  list: {
    flex: 1,
  },
  empty: {
    padding: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowOn: {
    backgroundColor: '#f0fdfa',
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  rowSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  foot: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
