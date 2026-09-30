import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COMMUNITY_LINK_KIND_LABELS, type CommunityAuthor, type CommunityLinkKind, type CommunityLinkRecord } from '@ibas/shared-types';
import { Avatar } from '@/components/contacts/ContactBits';
import { LINK_KIND_STYLE, authorWork, webUrl } from '@/lib/community-api';
import { colors, spacing } from '@/theme';

export const TEAL = '#0f766e';

export function AuthorRow({ author, meta, size = 36, short }: { author: CommunityAuthor; meta?: string; size?: number; short?: boolean }) {
  const work = authorWork(author, short);
  return (
    <View style={styles.authorRow}>
      <Avatar id={author.id} initials={author.initials} size={size} />
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {author.name}
          </Text>
          {author.is_admin ? (
            <View style={styles.adminPill}>
              <Ionicons name="shield-checkmark" size={10} color={colors.primaryDark} />
              <Text style={styles.adminText}>Admin</Text>
            </View>
          ) : null}
        </View>
        {work ? (
          <Text style={styles.work} numberOfLines={1}>
            {work}
          </Text>
        ) : null}
        {meta ? <Text style={styles.work}>{meta}</Text> : null}
      </View>
    </View>
  );
}

export function Badge({
  text,
  icon,
  bg = '#f1f5f9',
  fg = '#334155',
  dot,
  style,
}: {
  text: string;
  icon?: keyof typeof Ionicons.glyphMap;
  bg?: string;
  fg?: string;
  dot?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      {icon ? <Ionicons name={icon} size={11} color={fg} /> : null}
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function TagPill({ tag, onPress }: { tag: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.tag}>
      <Text style={styles.tagText}>#{tag}</Text>
    </Pressable>
  );
}

/** Upvote toggle with optimistic update. Disabled for your own posts. */
export function VoteButton({
  score,
  voted,
  disabled,
  onToggle,
  onChange,
}: {
  score: number;
  voted: boolean;
  disabled?: boolean;
  onToggle: () => Promise<{ voted: boolean; vote_score: number }>;
  onChange: (v: { voted: boolean; vote_score: number }) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    onChange({ voted: !voted, vote_score: score + (voted ? -1 : 1) });
    try {
      onChange(await onToggle());
    } catch {
      onChange({ voted, vote_score: score });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Pressable
      onPress={() => void toggle()}
      disabled={disabled || busy}
      accessibilityLabel={disabled ? "You can't vote on your own post" : voted ? 'Remove upvote' : 'Upvote'}
      style={({ pressed }) => [styles.vote, voted && styles.voteOn, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-up" size={16} color={voted ? colors.white : colors.text} />
      <Text style={[styles.voteText, voted && styles.voteTextOn]}>{score}</Text>
    </Pressable>
  );
}

/** Tagged workflow / toolkit / circular cards; they open on the website. */
export function LinkChips({ links }: { links: CommunityLinkRecord[] }) {
  if (links.length === 0) return null;
  return (
    <View style={styles.links}>
      {links.map((l) => {
        const s = LINK_KIND_STYLE[l.kind];
        return (
          <Pressable
            key={`${l.type}:${l.id}`}
            onPress={() => void Linking.openURL(webUrl(l.href))}
            style={({ pressed }) => [styles.link, { backgroundColor: s.bg, borderColor: s.border }, pressed && styles.pressed]}
          >
            <Ionicons name={s.icon} size={15} color={s.fg} />
            <View style={styles.flex}>
              <Text style={[styles.linkKind, { color: s.fg }]}>{COMMUNITY_LINK_KIND_LABELS[l.kind]}</Text>
              <Text style={[styles.linkTitle, { color: s.fg }]} numberOfLines={2}>
                {l.title}
              </Text>
              {l.subtitle ? (
                <Text style={[styles.linkSub, { color: s.fg }]} numberOfLines={1}>
                  {l.subtitle}
                </Text>
              ) : null}
            </View>
            <Ionicons name="open-outline" size={14} color={s.fg} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Compact kind badges for list rows. */
export function LinkKindIcons({ kinds }: { kinds: CommunityLinkKind[] }) {
  if (kinds.length === 0) return null;
  return (
    <>
      {kinds.map((k) => {
        const s = LINK_KIND_STYLE[k];
        return <Badge key={k} text={COMMUNITY_LINK_KIND_LABELS[k]} icon={s.icon} bg={s.bg} fg={s.fg} />;
      })}
    </>
  );
}

export function Notice({ tone, icon, title, text }: { tone: 'warning' | 'info' | 'error'; icon: keyof typeof Ionicons.glyphMap; title?: string; text: string }) {
  const t = {
    warning: { bg: '#fffbeb', border: '#fde68a', fg: '#78350f' },
    info: { bg: '#f0f9ff', border: '#bae6fd', fg: '#075985' },
    error: { bg: '#fef2f2', border: '#fecaca', fg: '#991b1b' },
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Ionicons name={icon} size={16} color={t.fg} />
      <View style={styles.flex}>
        {title ? <Text style={[styles.noticeTitle, { color: t.fg }]}>{title}</Text> : null}
        <Text style={[styles.noticeText, { color: t.fg }]}>{text}</Text>
      </View>
    </View>
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
    opacity: 0.5,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  adminPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: '#e0f2fe',
  },
  adminText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  work: {
    fontSize: 12,
    color: colors.textMuted,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tag: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: '#f1f5f9',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  vote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  voteOn: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  voteText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  voteTextOn: {
    color: colors.white,
  },
  links: {
    gap: spacing.sm,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
  },
  linkKind: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  linkTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  linkSub: {
    fontSize: 11,
    opacity: 0.75,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.sm + 4,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
