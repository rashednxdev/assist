import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { PickerSheet } from '@/components/ui/PickerSheet';
import { useAuth } from '@/lib/auth-context';
import { addMyRole, fetchMyRoles, removeMyRole, type MyWorkflowRole } from '@/lib/ibas-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

/** Workflow roles the user holds; self-added roles are for personal runs and never receive handoffs. */
export function MyWorkflowRoles({ highlight, onChanged }: { highlight?: string; onChanged?: () => void }) {
  const { refreshUser } = useAuth();
  const [roles, setRoles] = useState<MyWorkflowRole[] | null>(null);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRoles(await fetchMyRoles());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load roles');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function apply(code: string, run: (c: string) => Promise<MyWorkflowRole[]>, done: string) {
    setBusy(code);
    try {
      setRoles(await run(code));
      await refreshUser().catch(() => null);
      onChanged?.();
      showToast(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update roles');
    } finally {
      setBusy(null);
    }
  }

  function confirmRemove(r: MyWorkflowRole) {
    Alert.alert('Remove role', `Remove ${r.code} · ${r.name_en} from your roles?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void apply(r.code, removeMyRole, 'Role removed') },
    ]);
  }

  const held = roles?.filter((r) => r.held) ?? [];
  const available = roles?.filter((r) => !r.held) ?? [];

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
        <Text style={styles.title}>Your workflow roles</Text>
      </View>
      <Text style={styles.hint}>
        Roles are optional. Add a role to follow processes as that office; self-added roles are for your own runs only, and no one is notified.
      </Text>

      {!roles && !error ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {roles && held.length === 0 ? <Text style={styles.empty}>You have no workflow roles yet.</Text> : null}
      {held.map((r) => (
        <View key={r.code} style={[styles.row, r.code === highlight && styles.rowHighlight]}>
          <View style={[styles.swatch, { backgroundColor: r.color || '#475569' }]} />
          <View style={styles.body}>
            <Text style={styles.name}>
              {r.code} · {r.name_en}
            </Text>
            <Text style={styles.meta}>{r.self_assigned ? 'Added by you · personal runs only' : 'Assigned by administrator · official handoffs'}</Text>
          </View>
          {r.self_assigned ? (
            busy === r.code ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <Pressable onPress={() => confirmRemove(r)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${r.code}`}>
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </Pressable>
            )
          ) : (
            <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
          )}
        </View>
      ))}

      {roles && available.length > 0 ? (
        <Button title="Add a role" variant="secondary" onPress={() => setPicking(true)} loading={available.some((r) => r.code === busy)} disabled={!!busy} />
      ) : null}

      <PickerSheet
        visible={picking}
        title="Add a workflow role"
        options={available.map((r) => ({ value: r.code, label: `${r.code} · ${r.name_en}`, hint: r.name_bn, badge: r.code === highlight ? 'This process' : undefined }))}
        searchable
        onSelect={(o) => void apply(o.value, addMyRole, 'Role added')}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  error: {
    fontSize: 13,
    color: colors.error,
  },
  empty: {
    fontSize: 13,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
  },
  rowHighlight: {
    borderColor: colors.primary,
    backgroundColor: '#f0f9ff',
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
