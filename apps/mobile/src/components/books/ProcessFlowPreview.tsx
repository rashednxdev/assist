import { View, Text, StyleSheet } from 'react-native';
import type { ProcessStep } from '@/types/books';
import { BookRichText } from '@/components/books/BookRichText';
import { colors, spacing } from '@/theme';

// Matches the web app's `--color-primary` family (app/globals.css), which is what both the
// Workflow FlowPreview and the web Process preview render with — the app's own `colors.primary`
// (a blue, used for buttons/links elsewhere) is a different color on mobile, so it's hardcoded
// here rather than reused, to keep this component's color tune consistent with web.
const PROCESS_ACCENT = '#0d9488';
const PROCESS_ACCENT_DARK = '#0f766e';
const PROCESS_ACCENT_MUTED = '#f0fdfa';

/**
 * Read-only step timeline for a book Process — mirrors the web admin's numbered-circle
 * timeline (`process-flow-preview.tsx`, itself adapted from the Workflow feature's FlowPreview).
 */
export function ProcessFlowPreview({ steps }: { steps: ProcessStep[] }) {
  if (steps.length === 0) return null;

  return (
    <View>
      {steps.map((step, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.badgeCol}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{i + 1}</Text>
            </View>
            {i < steps.length - 1 ? <View style={styles.connector} /> : null}
          </View>
          <View style={styles.body}>
            {step.role?.trim() ? (
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{step.role.trim()}</Text>
              </View>
            ) : null}
            {step.title?.trim() ? (
              <BookRichText html={step.title} style={styles.stepTitle} />
            ) : null}
            {step.description?.trim() ? (
              <BookRichText html={step.description} style={styles.stepDescription} />
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  badgeCol: {
    alignItems: 'center',
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: PROCESS_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: PROCESS_ACCENT,
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginVertical: 4,
    backgroundColor: colors.border,
  },
  body: {
    flex: 1,
    paddingBottom: spacing.md,
    gap: 2,
  },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: PROCESS_ACCENT_MUTED,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 2,
  },
  rolePillText: {
    fontSize: 14,
    fontWeight: '700',
    color: PROCESS_ACCENT_DARK,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'justify',
  },
  stepDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'justify',
  },
});
