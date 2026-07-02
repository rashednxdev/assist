import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { BookBadge } from '@/components/books/BookBadge';
import { HtmlContent } from '@/components/books/HtmlContent';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { fetchRegulationDetail } from '@/lib/books-api';
import type { RegulationDetail } from '@/types/books';
import { colors, spacing } from '@/theme';

export default function RegulationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [reg, setReg] = useState<RegulationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchRegulationDetail(id)
      .then((data) => {
        setReg(data);
        navigation.setOptions({ title: data.regulation_no });
      })
      .catch((err) => {
        setReg(null);
        setError(err instanceof Error ? err.message : 'Failed to load regulation');
      })
      .finally(() => setLoading(false));
  }, [id, navigation]);

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (!reg) return <BookEmpty title="Regulation not found" />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{reg.regulation_no}</Text>
      <Text style={styles.subtitle}>{reg.title}</Text>

      <View style={styles.badges}>
        <BookBadge label={reg.regulation_type} variant="muted" />
        {reg.is_amended ? <BookBadge label="Amended" variant="warning" /> : null}
        {reg.payment_related ? <BookBadge label="Payment" variant="muted" /> : null}
        {reg.receipt_related ? <BookBadge label="Receipt" variant="muted" /> : null}
      </View>

      {reg.book_name ? (
        <Text style={styles.bookRef}>
          Book: {reg.book_short_name || reg.book_name}
        </Text>
      ) : null}

      <Text style={styles.meta}>
        Effective: {new Date(reg.effective_date).toLocaleDateString()}
      </Text>

      <View style={styles.panel}>
        <HtmlContent html={reg.full_text} />
      </View>

      {reg.amendments.length > 0 && (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Amendments</Text>
          {reg.amendments.map((a) => (
            <View key={a.id} style={styles.amendmentCard}>
              <Text style={styles.amendmentTitle}>
                {a.amendment_no} — {new Date(a.amendment_date).toLocaleDateString()}
              </Text>
              <Text style={styles.amendmentMeta}>Issued by {a.issued_by}</Text>
              {a.change_summary ? (
                <Text style={styles.amendmentSummary}>{a.change_summary}</Text>
              ) : null}
              {a.old_text?.trim() ? (
                <View style={styles.oldText}>
                  <Text style={styles.oldLabel}>Previous text</Text>
                  <HtmlContent html={a.old_text} />
                </View>
              ) : null}
              <View style={styles.newText}>
                <Text style={styles.newLabel}>Updated text</Text>
                <HtmlContent html={a.new_text} />
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bookRef: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  amendmentCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.sm,
    gap: 6,
    marginTop: spacing.sm,
  },
  amendmentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  amendmentMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  amendmentSummary: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  oldText: {
    opacity: 0.75,
    gap: 4,
  },
  oldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  newText: {
    gap: 4,
  },
  newLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
});
