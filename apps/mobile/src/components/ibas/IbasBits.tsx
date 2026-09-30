import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ToolkitAttachment, ToolkitResolvedRef } from '@ibas/shared-types';
import { openFileLink, refHref } from '@/lib/ibas-api';
import { colors, spacing } from '@/theme';

export const IBAS = '#0369a1';

export function IbasLoading({ color = IBAS }: { color?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={color} />
    </View>
  );
}

export function IbasError({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={18} color="#991b1b" />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function IbasErrorScreen({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <IbasError message={message} />
    </View>
  );
}

export function IbasCard({ children, accent }: { children: ReactNode; accent?: string }) {
  return <View style={[styles.card, accent ? { borderTopWidth: 4, borderTopColor: accent } : null]}>{children}</View>;
}

export function SectionHead({ icon, title, color = IBAS, right }: { icon: keyof typeof Ionicons.glyphMap; title: string; color?: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.flex} />
      {right}
    </View>
  );
}

export function Badge({ label, color = colors.textMuted, filled }: { label: string; color?: string; filled?: boolean }) {
  return (
    <Text style={[styles.badge, filled ? { backgroundColor: color, color: colors.white } : { color, borderColor: color }]} numberOfLines={1}>
      {label}
    </Text>
  );
}

const REF_ICON: Record<ToolkitResolvedRef['target_type'], keyof typeof Ionicons.glyphMap> = {
  book_topic: 'scale-outline',
  book: 'book-outline',
  circular: 'archive-outline',
};

/** Rule / book / circular references; each opens inside the same area. */
export function RefChips({ code, refs, color = IBAS }: { code: string; refs: ToolkitResolvedRef[]; color?: string }) {
  const router = useRouter();
  const shown = refs.filter((r) => !r.missing);
  if (shown.length === 0) return null;
  return (
    <View style={styles.chips}>
      {shown.map((r) => (
        <Pressable
          key={`${r.target_type}:${r.target_id}`}
          onPress={() => router.push(refHref(code, r))}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          accessibilityRole="link"
        >
          <Ionicons name={REF_ICON[r.target_type]} size={12} color={color} />
          <Text style={[styles.chipText, { color }]} numberOfLines={1}>
            {r.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function fileKind(url: string): string | null {
  const path = url.split(/[?#]/)[0]!.toLowerCase();
  const ext = path.match(/\.(pdf|docx?|xlsx?|pptx?|zip)$/)?.[1];
  if (ext) return ext.toUpperCase();
  if (/drive\.google\.com|docs\.google\.com/.test(path)) return 'Drive';
  return null;
}

export function FileLinks({ files, compact }: { files: ToolkitAttachment[]; compact?: boolean }) {
  if (files.length === 0) return null;
  return (
    <View style={compact ? styles.chips : styles.files}>
      {files.map((f, i) => {
        const kind = fileKind(f.url);
        return (
          <Pressable
            key={`${f.url}-${i}`}
            onPress={() => openFileLink(f.url)}
            style={({ pressed }) => [compact ? styles.chip : styles.file, pressed && styles.pressed]}
            accessibilityRole="link"
          >
            <Ionicons name="document-text-outline" size={compact ? 12 : 16} color="#dc2626" />
            <Text style={compact ? styles.chipFileText : styles.fileText} numberOfLines={1}>
              {f.title}
            </Text>
            {kind && !compact ? <Text style={styles.kind}>{kind}</Text> : null}
            <Ionicons name="open-outline" size={compact ? 11 : 14} color={colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function ItemRow({
  title,
  subtitle,
  meta,
  note,
  icon,
  locked,
  onPress,
}: {
  title: string;
  subtitle?: string;
  meta?: string[];
  note?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  locked?: boolean;
  onPress: () => void;
}) {
  const shown = (meta ?? []).filter(Boolean);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      {icon ? <Ionicons name={icon} size={18} color={colors.textMuted} /> : null}
      <View style={styles.flex}>
        <Text style={styles.itemTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.itemSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {shown.length ? <Text style={styles.itemMeta}>{shown.join('  ·  ')}</Text> : null}
        {note ? <Text style={styles.itemNote}>{note}</Text> : null}
      </View>
      <Ionicons name={locked ? 'lock-closed' : 'chevron-forward'} size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export const ibasStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 27,
    color: colors.text,
  },
  titleBn: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  small: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.textMuted,
  },
});

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
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
  card: {
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  chipFileText: {
    flexShrink: 1,
    fontSize: 12,
    color: colors.text,
  },
  files: {
    gap: 6,
  },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  kind: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm + 6,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  itemSub: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  itemMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textMuted,
  },
  itemNote: {
    marginTop: 6,
    fontSize: 12,
    color: '#78350f',
    backgroundColor: '#fffbeb',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
});
