import { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { visibleComparisonTable } from '@ibas/shared-types';
import { ComparisonTableAnswer } from '@/components/questions/ComparisonTableAnswer';
import { BookRichText } from '@/components/books/BookRichText';
import { useDifferencesLandscape } from '@/hooks/useDifferencesLandscape';
import type { ComparisonTable } from '@/types/questions';
import { colors, spacing } from '@/theme';

/** Shows the real table at normal size right in the reading flow — same read-only render as the
 * admin's "Preview" mode (question-update) — with a header line for the row/column count and an
 * explicit button to open the same table fullscreen in landscape for serious reading. */
export function ComparisonTablePreview({
  table,
  title,
}: {
  table?: ComparisonTable | null;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  useDifferencesLandscape(open);

  // Same pruning as ComparisonTableAnswer — unused compare columns (e.g. empty Item B) are hidden.
  const visible = visibleComparisonTable(table);
  const columns = visible?.columns ?? [];
  const rows = visible?.rows ?? [];
  if (!visible || columns.length < 1 || rows.length === 0) return null;

  const featureHeader = visible.feature_header?.trim() || 'Feature';
  const cardLabel = visible.title?.trim() || featureHeader;
  const modalHeading = title?.trim() || visible.title?.trim() || featureHeader;

  return (
    <>
      <View style={styles.previewWrap}>
        <View style={styles.previewHeader}>
          <Ionicons name="grid-outline" size={14} color={colors.primary} />
          <View style={styles.previewTitleWrap}>
            <BookRichText html={cardLabel} style={styles.previewTitle} />
          </View>
          <Text style={styles.previewSub}>
            {rows.length} row{rows.length === 1 ? '' : 's'} · {columns.length} column
            {columns.length === 1 ? '' : 's'}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.previewCta, pressed && styles.pressed]}
            onPress={() => setOpen(true)}
            hitSlop={6}
          >
            <Text style={styles.previewCtaText}>View full table</Text>
            <Ionicons name="expand-outline" size={13} color={colors.primary} />
          </Pressable>
        </View>

        <ComparisonTableAnswer table={visible} />
      </View>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setOpen(false)}
      >
        <StatusBar hidden={open} />
        <SafeAreaView style={styles.modalRoot} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleWrap}>
              <BookRichText html={modalHeading} style={styles.modalTitle} />
            </View>
            <Pressable style={styles.closeBtn} onPress={() => setOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            <ComparisonTableAnswer table={visible} />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  previewWrap: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.92,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  previewTitleWrap: {
    flexShrink: 1,
    maxWidth: '55%',
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  previewSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  previewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    backgroundColor: '#eef4f8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewCtaText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalTitleWrap: {
    flex: 1,
    gap: 2,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  modalBody: {
    flex: 1,
    padding: spacing.md,
  },
});
