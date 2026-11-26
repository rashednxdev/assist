import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  safePdfFilename,
  toDownloadablePdfUrl,
  toViewablePdfUrl,
} from '@/lib/book-pdf-links';
import { colors, spacing } from '@/theme';

/** Full-screen in-app browser: preview PDF first, then download/share on demand. */
export function InAppBrowserModal({
  visible,
  url,
  title,
  onClose,
}: {
  visible: boolean;
  url: string;
  title?: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const href = url.trim();
  const viewUrl = useMemo(() => toViewablePdfUrl(href), [href]);
  const downloadUrl = useMemo(() => toDownloadablePdfUrl(href), [href]);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setError('');
      setDownloading(false);
    }
  }, [visible, viewUrl]);

  async function handleDownload() {
    if (!downloadUrl || downloading) return;
    setDownloading(true);
    try {
      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!dir) throw new Error('Storage is not available on this device');

      const filename = safePdfFilename(title, 'book');
      const dest = `${dir}${filename}`;
      const result = await FileSystem.downloadAsync(downloadUrl, dest);
      const info = await FileSystem.getInfoAsync(result.uri);
      if (!info.exists) throw new Error('Download failed');

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: title?.trim() || 'Download book',
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Linking.openURL(downloadUrl);
      }
    } catch (err) {
      try {
        await Linking.openURL(downloadUrl);
      } catch {
        Alert.alert(
          'Download failed',
          err instanceof Error ? err.message : 'Could not download this PDF.',
        );
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar hidden={visible} />
      <SafeAreaView style={styles.modalRoot} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleWrap}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {title?.trim() || 'Book PDF'}
            </Text>
            <Text style={styles.modalSub} numberOfLines={1}>
              View first · then download
            </Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.text} />
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.webWrap}>
          {loading && !error ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Opening preview…</Text>
            </View>
          ) : null}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorHint} numberOfLines={3}>
                {href}
              </Text>
              <Pressable style={styles.retryBtn} onPress={() => void handleDownload()}>
                <Text style={styles.retryBtnText}>Download instead</Text>
              </Pressable>
            </View>
          ) : viewUrl ? (
            <WebView
              source={{ uri: viewUrl }}
              style={styles.webview}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError('Could not preview this PDF. You can still download it.');
              }}
              onHttpError={() => {
                setLoading(false);
                setError('Could not preview this PDF (server error). You can still download it.');
              }}
              startInLoadingState
              allowsBackForwardNavigationGestures
              setSupportMultipleWindows={false}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
            />
          ) : null}
        </View>

        <View style={styles.footer}>
          <Pressable
            style={[styles.downloadBtn, downloading && styles.downloadBtnDisabled]}
            onPress={() => void handleDownload()}
            disabled={downloading || !downloadUrl}
            accessibilityRole="button"
            accessibilityLabel="Download book PDF"
          >
            {downloading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color={colors.white} />
                <Text style={styles.downloadBtnText}>Download</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={styles.openExternalBtn}
            onPress={() => void Linking.openURL(downloadUrl || href)}
            accessibilityLabel="Open in system browser"
          >
            <Ionicons name="open-outline" size={16} color={colors.primary} />
            <Text style={styles.openExternalText}>Open in browser</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  webWrap: {
    flex: 1,
    backgroundColor: colors.white,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.85)',
    zIndex: 2,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  retryBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  downloadBtn: {
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
  openExternalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  openExternalText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
