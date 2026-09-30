import { useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COMMUNITY_LINK_KIND_LABELS, type CommunityLinkRecord } from '@ibas/shared-types';
import { LINK_KIND_STYLE } from '@/lib/community-api';
import { useKeyboardScroll } from '@/lib/keyboard-scroll';
import { PostBody } from '@/components/community/PostBody';
import { LinkPicker } from '@/components/community/LinkPicker';
import { TEAL } from '@/components/community/CommunityBits';
import { colors, spacing } from '@/theme';

function Tool({ label, onPress, active, children }: { label: string; onPress: () => void; active?: boolean; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={4} style={({ pressed }) => [styles.tool, active && styles.toolOn, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

/** Multiline input with light formatting, preview, and workflow / toolkit / circular tagging. */
export function PostEditor({
  body,
  onBodyChange,
  links,
  onLinksChange,
  placeholder,
  minHeight = 140,
}: {
  body: string;
  onBodyChange: (v: string) => void;
  links: CommunityLinkRecord[];
  onLinksChange: (v: CommunityLinkRecord[]) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const wrapRef = useRef<View>(null);
  const keyboardScroll = useKeyboardScroll();
  const [sel, setSel] = useState({ start: body.length, end: body.length });
  const [preview, setPreview] = useState(false);
  const [picking, setPicking] = useState(false);

  function wrap(before: string, after = before, fallback = 'text') {
    const { start: s, end: e } = sel;
    const selected = body.slice(s, e) || fallback;
    onBodyChange(body.slice(0, s) + before + selected + after + body.slice(e));
  }

  function prefixLines(marker: (i: number) => string) {
    const { start: s, end: e } = sel;
    const lineStart = body.lastIndexOf('\n', s - 1) + 1;
    const chunk = body.slice(lineStart, e) || 'item';
    const lines = chunk.split('\n').map((l, i) => `${marker(i)}${l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')}`);
    onBodyChange(body.slice(0, lineStart) + lines.join('\n') + body.slice(e));
  }

  return (
    <View ref={wrapRef} style={styles.wrap} collapsable={false}>
      <View style={styles.box}>
        <View style={styles.toolbar}>
          <Tool label="Write" onPress={() => setPreview(false)} active={!preview}>
            <Ionicons name="create-outline" size={15} color={colors.text} />
            <Text style={styles.toolText}>Write</Text>
          </Tool>
          <Tool label="Preview" onPress={() => setPreview(true)} active={preview}>
            <Ionicons name="eye-outline" size={15} color={colors.text} />
            <Text style={styles.toolText}>Preview</Text>
          </Tool>
          {!preview ? (
            <>
              <View style={styles.sep} />
              <Tool label="Bold" onPress={() => wrap('**')}>
                <Text style={styles.boldIcon}>B</Text>
              </Tool>
              <Tool label="Bulleted list" onPress={() => prefixLines(() => '- ')}>
                <Ionicons name="list" size={16} color={colors.text} />
              </Tool>
              <Tool label="Numbered list" onPress={() => prefixLines((i) => `${i + 1}. `)}>
                <Text style={styles.olIcon}>1.</Text>
              </Tool>
              <Tool label="Code or reference number" onPress={() => wrap('`', '`', 'code')}>
                <Ionicons name="code-slash" size={16} color={colors.text} />
              </Tool>
            </>
          ) : null}
          <View style={styles.flex} />
          <Tool label="Tag workflow, toolkit or circular" onPress={() => setPicking(true)} active={links.length > 0}>
            <Ionicons name="attach" size={16} color={TEAL} />
            <Text style={[styles.toolText, { color: TEAL }]}>Tag</Text>
            {links.length > 0 ? (
              <View style={styles.count}>
                <Text style={styles.countText}>{links.length}</Text>
              </View>
            ) : null}
          </Tool>
        </View>
        {preview ? (
          <View style={[styles.preview, { minHeight }]}>
            {body.trim() ? <PostBody text={body} /> : <Text style={styles.muted}>Nothing to preview yet.</Text>}
          </View>
        ) : (
          <TextInput
            value={body}
            onChangeText={onBodyChange}
            onSelectionChange={(e) => setSel(e.nativeEvent.selection)}
            onFocus={() => requestAnimationFrame(() => keyboardScroll?.ensureVisible(wrapRef.current))}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={10_000}
            textAlignVertical="top"
            style={[styles.input, { minHeight }]}
          />
        )}
      </View>

      {links.length > 0 ? (
        <View style={styles.chips}>
          {links.map((l) => {
            const s = LINK_KIND_STYLE[l.kind];
            return (
              <View key={`${l.type}:${l.id}`} style={[styles.chip, { backgroundColor: s.bg, borderColor: s.border }]}>
                <Ionicons name={s.icon} size={13} color={s.fg} />
                <Text style={[styles.chipText, { color: s.fg }]} numberOfLines={1}>
                  <Text style={styles.chipKind}>{COMMUNITY_LINK_KIND_LABELS[l.kind]}: </Text>
                  {l.title}
                </Text>
                <Pressable
                  hitSlop={8}
                  accessibilityLabel={`Remove ${l.title}`}
                  onPress={() => onLinksChange(links.filter((x) => !(x.type === l.type && x.id === l.id)))}
                >
                  <Ionicons name="close" size={14} color={s.fg} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      <LinkPicker visible={picking} value={links} onChange={onLinksChange} onClose={() => setPicking(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  wrap: {
    gap: spacing.sm,
  },
  box: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#f8fafc',
  },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    minWidth: 32,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  toolOn: {
    backgroundColor: '#e2e8f0',
  },
  toolText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  boldIcon: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  olIcon: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  sep: {
    width: 1,
    height: 18,
    marginHorizontal: 4,
    backgroundColor: colors.border,
  },
  count: {
    minWidth: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: TEAL,
    alignItems: 'center',
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
  },
  input: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
  },
  preview: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  chips: {
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 8,
    paddingRight: 8,
    paddingVertical: 6,
  },
  chipText: {
    flex: 1,
    fontSize: 12,
  },
  chipKind: {
    fontWeight: '800',
  },
});
