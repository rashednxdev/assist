import { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ComparisonTableAnswer } from '@/components/questions/ComparisonTableAnswer';
import { useDifferencesLandscape } from '@/hooks/useDifferencesLandscape';
import type { ComparisonTable } from '@/types/questions';
import { colors, spacing } from '@/theme';

export function TopicComparisonTable({
  table,
  title,
}: {
  table?: ComparisonTable | null;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  useDifferencesLandscape(open);

  const columns = (table?.columns ?? []).map((c) => String(c ?? '').trim()).filter(Boolean);
  const rows = table?.rows ?? [];
  if (!table || columns.length < 2 || rows.length === 0) return null;

  const featureHeader = table.feature_header?.trim() || 'Feature';
  const cardLabel = table.title?.trim() || featureHeader;

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.previewCard, pressed && styles.pressed]}
        onPress={() => setOpen(true)}
      >
        <View style={styles.previewIconWrap}>
          <Ionicons name="grid-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.previewTextWrap}>
          <Text style={styles.previewTitle} numberOfLines={1}>
            {cardLabel}
          </Text>
          <Text style={styles.previewSub}>
            {rows.length} row{rows.length === 1 ? '' : 's'} · {columns.length} column
            {columns.length === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={styles.previewCta}>
          <Text style={styles.previewCtaText}>View table</Text>
          <Ionicons name="expand-outline" size={16} color={colors.white} />
        </View>
      </Pressable>

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
              <Text style={styles.modalTitle} numberOfLines={1}>
                {title?.trim() || featureHeader}
              </Text>
              <Text style={styles.modalSub}>Landscape view</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={() => setOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            <ComparisonTableAnswer table={table} />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  pressed: {
    opacity: 0.9,
  },
  previewIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#eef4f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTextWrap: {
    flex: 1,
    gap: 2,
  },
  previewTitle: {
    fontSize: 13,
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
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  previewCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
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
  modalSub: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
