import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { AnswerPdfPageSize } from '@ibas/shared-types';
import { downloadAndShareAnswerPdf } from '@/lib/answer-pdf-api';
import { colors, spacing } from '@/theme';

interface AnswerPdfDownloadSheetProps {
  visible: boolean;
  questionIds: string[];
  /** Short label shown in the sheet, e.g. "1 question" or "24 questions (current list)". */
  scopeLabel: string;
  onClose: () => void;
}

/** Choose A4 or Digest 5" × 8" (both landscape) then download + share the answer PDF. */
export function AnswerPdfDownloadSheet({
  visible,
  questionIds,
  scopeLabel,
  onClose,
}: AnswerPdfDownloadSheetProps) {
  const [pageSize, setPageSize] = useState<AnswerPdfPageSize>('a4');
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    if (questionIds.length === 0) {
      Alert.alert('Nothing to export', 'No questions in this selection.');
      return;
    }
    setBusy(true);
    try {
      await downloadAndShareAnswerPdf({ questionIds, pageSize });
      onClose();
    } catch (err) {
      Alert.alert('Download failed', err instanceof Error ? err.message : 'Could not create PDF');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={busy ? undefined : onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheetSafe}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Download answers as PDF</Text>
            <Text style={styles.sub}>{scopeLabel}</Text>

            <Text style={styles.label}>Page size (landscape)</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.option, pageSize === 'a4' && styles.optionActive]}
                onPress={() => setPageSize('a4')}
                disabled={busy}
              >
                <Text style={[styles.optionTitle, pageSize === 'a4' && styles.optionTitleActive]}>A4</Text>
                <Text style={[styles.optionSub, pageSize === 'a4' && styles.optionSubActive]}>
                  Horizontal · standard font
                </Text>
              </Pressable>
              <Pressable
                style={[styles.option, pageSize === 'pocket' && styles.optionActive]}
                onPress={() => setPageSize('pocket')}
                disabled={busy}
              >
                <Text style={[styles.optionTitle, pageSize === 'pocket' && styles.optionTitleActive]}>
                  {`Digest 5" × 8"`}
                </Text>
                <Text style={[styles.optionSub, pageSize === 'pocket' && styles.optionSubActive]}>
                  Horizontal · font −35%
                </Text>
              </Pressable>
            </View>

            <Text style={styles.hint}>
              Both sizes are landscape. Layout matches the mobile answer view. Max 40 questions per
              file.
            </Text>

            <Pressable
              style={[styles.downloadBtn, busy && styles.downloadBtnDisabled]}
              onPress={() => void handleDownload()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color={colors.white} />
                  <Text style={styles.downloadBtnText}>Download PDF</Text>
                </>
              )}
            </Pressable>

            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={busy}>
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
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  sheetSafe: {
    width: '100%',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
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
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    backgroundColor: colors.background,
    gap: 2,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: '#eff6ff',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  optionTitleActive: {
    color: colors.primary,
  },
  optionSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  optionSubActive: {
    color: colors.primary,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  downloadBtn: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  downloadBtnDisabled: {
    opacity: 0.7,
  },
  downloadBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
