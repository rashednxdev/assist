import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fetchTerms, type TermsRecord } from '@/lib/terms-api';
import { ExplanationSectionsView } from '@/components/shared/ExplanationSectionsView';
import { colors, spacing } from '@/theme';

export function TermsViewerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [terms, setTerms] = useState<TermsRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || terms) return;
    setLoading(true);
    setError('');
    fetchTerms()
      .then((res) => setTerms(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [visible, terms]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {terms?.header ?? 'Terms and Conditions'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loading} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : !terms || terms.sections.length === 0 ? (
            <Text style={styles.empty}>No terms have been published yet.</Text>
          ) : (
            <ExplanationSectionsView sections={terms.sections} />
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  loading: {
    marginTop: spacing.xl,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
