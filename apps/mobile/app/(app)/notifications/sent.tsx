import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { BookBadge } from '@/components/books/BookBadge';
import { useAuth } from '@/lib/auth-context';
import { canManageUsers } from '@/lib/users-api';
import {
  fetchSentNotifications,
  stopRemainingNotification,
  removeSentNotification,
  type AdminNotificationRecord,
} from '@/lib/notifications-api';
import { colors, spacing } from '@/theme';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusOf(n: AdminNotificationRecord) {
  return n.status ?? 'sent';
}

export default function SentNotificationsScreen() {
  const { user } = useAuth();
  const allowed = canManageUsers(user);
  const [items, setItems] = useState<AdminNotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetchSentNotifications();
      setItems(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sent notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load();
    }, [allowed, load]),
  );

  function confirmStop(n: AdminNotificationRecord) {
    const remaining = n.remaining_unread_count ?? 0;
    Alert.alert(
      'Stop remaining?',
      remaining > 0
        ? `Remove this notice from ${remaining} user${remaining === 1 ? '' : 's'} who have not opened it yet. Already-read copies stay. Push alerts already on phones cannot be recalled.`
        : 'Mark this notice as stopped. There are no unread inboxes left. Push alerts already on phones cannot be recalled.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop remaining', style: 'destructive', onPress: () => void onStop(n) },
      ],
    );
  }

  function confirmRemove(n: AdminNotificationRecord) {
    Alert.alert(
      'Remove from all?',
      'Remove this notice from every inbox, including people who already opened it. Push alerts already on phones cannot be recalled.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void onRemove(n) },
      ],
    );
  }

  async function onStop(n: AdminNotificationRecord) {
    setBusyId(n.id);
    try {
      const res = await stopRemainingNotification(n.id);
      setItems((prev) => prev.map((row) => (row.id === n.id ? res.data : row)));
    } catch (err) {
      Alert.alert('Could not stop', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusyId(null);
    }
  }

  async function onRemove(n: AdminNotificationRecord) {
    setBusyId(n.id);
    try {
      const res = await removeSentNotification(n.id);
      setItems((prev) => prev.map((row) => (row.id === n.id ? res.data : row)));
    } catch (err) {
      Alert.alert('Could not remove', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) {
    return (
      <BookEmpty
        title="Admin only"
        subtitle="Stopping or removing sent notifications is available to admins on this device."
      />
    );
  }

  if (loading && items.length === 0) return <BookLoading />;
  if (error && items.length === 0) return <BookError message={error} />;

  if (items.length === 0) {
    return (
      <BookEmpty
        title="No sent notifications"
        subtitle="Broadcasts and user notifies will appear here so you can stop remaining delivery."
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <Text style={styles.hint}>
        Stop remaining removes the notice from users who have not opened it. Remove from all clears every
        inbox. Phone push alerts cannot be recalled.
      </Text>
      {items.map((n) => {
        const status = statusOf(n);
        const remaining = n.remaining_unread_count ?? 0;
        const busy = busyId === n.id;
        return (
          <View key={n.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.title}>{n.title}</Text>
              <View style={styles.badges}>
                <BookBadge
                  label={n.target_type === 'all' ? 'All users' : `${n.target_user_ids?.length ?? 0} users`}
                  variant="muted"
                />
                {status === 'stopped' ? <BookBadge label="Stopped remaining" variant="warning" /> : null}
                {status === 'removed' ? <BookBadge label="Removed" variant="warning" /> : null}
              </View>
            </View>
            <Text style={styles.message}>{n.message}</Text>
            <Text style={styles.meta}>
              {formatDate(n.sent_at)} · {n.recipient_count} recipients
              {status === 'sent' ? ` · ${remaining} unread remaining` : ''}
              {status !== 'sent' && (n.removed_unread_count ?? 0) > 0
                ? ` · ${n.removed_unread_count} unread removed`
                : ''}
            </Text>
            {status !== 'removed' ? (
              <View style={styles.actions}>
                {status === 'sent' ? (
                  <Pressable
                    style={({ pressed }) => [styles.actionBtn, styles.stopBtn, pressed && styles.pressed]}
                    onPress={() => confirmStop(n)}
                    disabled={busy}
                  >
                    <Ionicons name="stop-circle-outline" size={16} color={colors.warning} />
                    <Text style={styles.stopText}>{busy ? 'Stopping…' : 'Stop remaining'}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, styles.removeBtn, pressed && styles.pressed]}
                  onPress={() => confirmRemove(n)}
                  disabled={busy}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                  <Text style={styles.removeText}>{busy ? 'Removing…' : 'Remove from all'}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  cardHead: {
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  message: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  meta: {
    fontSize: 11,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stopBtn: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  removeBtn: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  stopText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
  },
  removeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.error,
  },
  pressed: {
    opacity: 0.85,
  },
});
