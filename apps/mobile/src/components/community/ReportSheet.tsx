import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COMMUNITY_REPORT_REASONS, COMMUNITY_REPORT_REASON_LABELS, type CommunityReportReason } from '@ibas/shared-types';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/community/CommunityBits';
import { reportContent } from '@/lib/community-api';
import { colors, spacing } from '@/theme';

export function ReportSheet({ target, onClose }: { target: { type: 'thread' | 'answer'; id: string } | null; onClose: () => void }) {
  const [reason, setReason] = useState<CommunityReportReason>('spam');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!target) return;
    setReason('spam');
    setNote('');
    setError('');
    setDone(false);
  }, [target]);

  async function submit() {
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      await reportContent({ target_type: target.type, target_id: target.id, reason, note: note.trim() });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the report');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.header}>
          <Ionicons name="flag" size={16} color={colors.error} />
          <Text style={styles.title}>Report {target?.type === 'thread' ? 'discussion' : 'answer'}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        {done ? (
          <View style={styles.body}>
            <Notice tone="info" icon="checkmark-circle" text="Thanks — a moderator will review it." />
            <Button title="Close" onPress={onClose} />
          </View>
        ) : (
          <View style={styles.body}>
            {COMMUNITY_REPORT_REASONS.map((r) => (
              <Pressable key={r} onPress={() => setReason(r)} style={styles.radioRow} accessibilityRole="radio" accessibilityState={{ checked: reason === r }}>
                <Ionicons name={reason === r ? 'radio-button-on' : 'radio-button-off'} size={20} color={reason === r ? colors.error : colors.textMuted} />
                <Text style={styles.radioText}>{COMMUNITY_REPORT_REASON_LABELS[r]}</Text>
              </Pressable>
            ))}
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Anything the moderator should know? (optional)"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              textAlignVertical="top"
              style={styles.note}
            />
            {error ? <Notice tone="error" icon="alert-circle" text={error} /> : null}
            <Button title="Send report" loading={busy} onPress={() => void submit()} style={{ backgroundColor: colors.error }} />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: 6,
  },
  radioText: {
    fontSize: 15,
    color: colors.text,
  },
  note: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm + 4,
    fontSize: 14,
    color: colors.text,
    marginVertical: spacing.xs,
  },
});
