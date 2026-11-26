import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BookPdfLink } from '@/types/books';
import { colors, spacing } from '@/theme';

/** Pick an admin-attached PDF link, then open it in the in-app browser. */
export function BookAdminPdfSheet({
  visible,
  bookName,
  links,
  onSelect,
  onClose,
  onExportContent,
}: {
  visible: boolean;
  bookName: string;
  links: BookPdfLink[];
  onSelect: (link: BookPdfLink) => void;
  onClose: () => void;
  /** Optional: fall back to HTML→PDF content export. */
  onExportContent?: () => void;
}) {
  const items = links.filter((l) => l.title?.trim() && l.url?.trim());

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheetSafe}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Download book</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {bookName}
            </Text>
            <Text style={styles.hint}>
              Opens an in-app preview first. Use Download after viewing to save the file.
            </Text>

            {items.map((link, idx) => (
              <Pressable
                key={`${link.url}-${idx}`}
                style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
                onPress={() => onSelect(link)}
                accessibilityRole="button"
                accessibilityLabel={`Download ${link.title}`}
              >
                <View style={styles.linkIcon}>
                  <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.linkTitle} numberOfLines={2}>
                  {link.title.trim()}
                </Text>
                <Ionicons name="download-outline" size={18} color={colors.primary} />
              </Pressable>
            ))}

            {onExportContent ? (
              <Pressable style={styles.exportBtn} onPress={onExportContent}>
                <Ionicons name="print-outline" size={16} color={colors.primary} />
                <Text style={styles.exportBtnText}>Export book content as PDF</Text>
              </Pressable>
            ) : null}

            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheetSafe: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  sheet: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  sub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    marginBottom: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#eaf0f6',
    backgroundColor: '#f8fbfe',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pressed: { opacity: 0.9 },
  linkIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#e8f2fc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0a2f5b',
  },
  exportBtn: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
  },
  exportBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
