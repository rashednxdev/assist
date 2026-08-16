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
import {
  downloadAndShareBookPdf,
  type BookPdfOrientation,
} from '@/lib/book-pdf-api';
import type { ReaderChapterFull } from '@/types/books';
import { colors, spacing } from '@/theme';

interface BookPdfDownloadSheetProps {
  visible: boolean;
  bookId: string;
  bookName: string;
  shortName?: string;
  edition?: string;
  language?: string;
  chapters: ReaderChapterFull[];
  onClose: () => void;
}

/** Book PDF only — choose portrait or landscape A4, then download + share. */
export function BookPdfDownloadSheet({
  visible,
  bookId,
  bookName,
  shortName,
  edition,
  language,
  chapters,
  onClose,
}: BookPdfDownloadSheetProps) {
  const [orientation, setOrientation] = useState<BookPdfOrientation>('portrait');
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    if (chapters.length === 0) {
      Alert.alert('Nothing to export', 'This book has no chapters to download yet.');
      return;
    }
    setBusy(true);
    try {
      await downloadAndShareBookPdf({
        bookId,
        bookName,
        shortName,
        edition,
        language,
        chapters,
        orientation,
      });
      onClose();
    } catch (err) {
      Alert.alert('Download failed', err instanceof Error ? err.message : 'Could not create book PDF');
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
            <Text style={styles.title}>Download book as PDF</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {bookName}
            </Text>

            <Text style={styles.label}>Orientation</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.option, orientation === 'portrait' && styles.optionActive]}
                onPress={() => setOrientation('portrait')}
                disabled={busy}
              >
                <Text
                  style={[styles.optionTitle, orientation === 'portrait' && styles.optionTitleActive]}
                >
                  Portrait
                </Text>
                <Text
                  style={[styles.optionSub, orientation === 'portrait' && styles.optionSubActive]}
                >
                  A4 · tall page
                </Text>
              </Pressable>
              <Pressable
                style={[styles.option, orientation === 'landscape' && styles.optionActive]}
                onPress={() => setOrientation('landscape')}
                disabled={busy}
              >
                <Text
                  style={[
                    styles.optionTitle,
                    orientation === 'landscape' && styles.optionTitleActive,
                  ]}
                >
                  Landscape
                </Text>
                <Text
                  style={[styles.optionSub, orientation === 'landscape' && styles.optionSubActive]}
                >
                  A4 · wide page
                </Text>
              </Pressable>
            </View>

            <Text style={styles.hint}>
              Book content only. Choose portrait or landscape before downloading.
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
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.background,
    gap: 4,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: '#eff6ff',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  optionTitleActive: {
    color: colors.primary,
  },
  optionSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  optionSubActive: {
    color: colors.primaryDark,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 2,
  },
  downloadBtn: {
    marginTop: spacing.sm,
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
    fontWeight: '700',
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
