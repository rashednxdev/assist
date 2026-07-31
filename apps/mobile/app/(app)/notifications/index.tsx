import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationRecipientRecord,
} from '@/lib/notifications-api';
import { colors, spacing } from '@/theme';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationRecipientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchMyNotifications();
      setItems(res.data);
    } catch {
      // keep whatever was already shown on a transient load failure
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
  }

  async function onPressItem(item: NotificationRecipientRecord) {
    if (item.is_read) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_read: true } : i)));
    try {
      await markNotificationRead(item.id);
    } catch {
      void load();
    }
  }

  async function onMarkAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      void load();
    }
  }

  const unreadCount = items.filter((i) => !i.is_read).length;

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading...</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No notifications yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {unreadCount > 0 && (
        <View style={styles.toolbar}>
          <Text style={styles.unreadLabel}>{unreadCount} unread</Text>
          <Pressable onPress={() => void onMarkAllRead()} hitSlop={8}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        </View>
      )}
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        {items.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.card,
              !item.is_read && styles.cardUnread,
              pressed && styles.cardPressed,
            ]}
            onPress={() => void onPressItem(item)}
          >
            {!item.is_read && <View style={styles.dot} />}
            <View style={styles.cardBody}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.date}>{formatDate(item.created_at)}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  unreadLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardUnread: {
    backgroundColor: '#eef6fc',
    borderColor: colors.primaryLight,
  },
  cardPressed: {
    opacity: 0.92,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  message: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  date: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
