import { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { contentLinkLabel, resolveContentAbsoluteUrl } from '@/lib/static-ref-pages';
import { colors, spacing } from '@/theme';

export function RuleContentLinkButton({
  contentLink,
  title,
}: {
  contentLink?: string | null;
  title?: string;
}) {
  const link = contentLink?.trim();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const absoluteUrl = useMemo(() => (link ? resolveContentAbsoluteUrl(link) : ''), [link]);
  const label = link ? contentLinkLabel(link) : '';

  if (!link || !absoluteUrl) return null;

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.openBtn, pressed && styles.pressed]}
        onPress={() => {
          setError('');
          setLoading(true);
          setOpen(true);
        }}
      >
        <Ionicons name="document-text-outline" size={18} color={colors.white} />
        <View style={styles.openBtnTextWrap}>
          <Text style={styles.openBtnTitle}>Open</Text>
          <Text style={styles.openBtnSub} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Ionicons name="expand-outline" size={18} color={colors.white} />
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
                {title?.trim() || label}
              </Text>
              <Text style={styles.modalSub} numberOfLines={1}>
                Full screen
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={() => setOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.webWrap}>
            {loading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : null}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.errorHint}>{absoluteUrl}</Text>
              </View>
            ) : (
              <WebView
                source={{ uri: absoluteUrl }}
                style={styles.webview}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError('Could not load this page. Check your network and web URL.');
                }}
                onHttpError={() => {
                  setLoading(false);
                  setError('Could not load this page (server error).');
                }}
                startInLoadingState
                allowsBackForwardNavigationGestures
                setSupportMultipleWindows={false}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  openBtnTextWrap: {
    flex: 1,
    gap: 2,
  },
  openBtnTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  openBtnSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.9,
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
    backgroundColor: 'rgba(255,255,255,0.7)',
    zIndex: 2,
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
});
