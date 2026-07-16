import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import { fetchAccountSummary, type AccountSummary } from '@/lib/auth-api';
import { colors, spacing } from '@/theme';

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.primary} style={styles.infoIcon} />
      <View style={styles.infoBody}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={[styles.pill, ok ? styles.pillOk : styles.pillWarn]}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'alert-circle'}
        size={14}
        color={ok ? colors.success : colors.warning}
      />
      <Text style={[styles.pillText, ok ? styles.pillTextOk : styles.pillTextWarn]}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [sum] = await Promise.all([
      fetchAccountSummary().catch(() => null),
      refreshUser().catch(() => null),
    ]);
    setSummary(sum);
  }, [refreshUser]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const verified = !!(user?.is_verified && user?.email_verified && user?.phone_verified);
  const modules = user?.module_access ?? [];

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.full_name_en?.trim()?.[0] ?? 'U').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{user?.full_name_en ?? 'User'}</Text>
          {user?.full_name_bn ? <Text style={styles.nameBn}>{user.full_name_bn}</Text> : null}
          <View style={styles.pillRow}>
            <StatusPill ok={verified} label={verified ? 'Verified' : 'Not fully verified'} />
            {summary?.subscription?.plan?.name ? (
              <View style={[styles.pill, styles.pillPlan]}>
                <Ionicons name="ribbon-outline" size={14} color={colors.primary} />
                <Text style={[styles.pillText, styles.pillTextPlan]}>
                  {summary.subscription.plan.name}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <InfoRow icon="mail-outline" label="Email" value={user?.email ?? ''} />
          <InfoRow icon="call-outline" label="Phone" value={user?.phone ?? ''} />
          <InfoRow icon="person-outline" label="Account type" value={user?.user_type ?? ''} />
          <InfoRow icon="shield-checkmark-outline" label="Status" value={user?.status ?? ''} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verification</Text>
          <View style={styles.verifyGrid}>
            <StatusPill ok={!!user?.email_verified} label="Email" />
            <StatusPill ok={!!user?.phone_verified} label="Phone" />
            <StatusPill ok={!!user?.is_verified} label="Account" />
          </View>
          {summary ? (
            <Text style={styles.profileHint}>
              Profile {summary.profile_complete_percent}% complete
              {summary.address_count > 0 ? ` · ${summary.address_count} address(es)` : ''}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Module access</Text>
          {modules.length === 0 ? (
            <Text style={styles.empty}>No learning modules granted yet.</Text>
          ) : (
            modules.map((m) => (
              <View key={m.module_code} style={styles.moduleRow}>
                <Ionicons name="cube-outline" size={18} color={colors.primary} />
                <View style={styles.moduleBody}>
                  <Text style={styles.moduleName}>{m.module_name_en}</Text>
                  <Text style={styles.moduleCode}>{m.module_code}</Text>
                </View>
                <Ionicons
                  name={m.can_read ? 'checkmark-circle' : 'close-circle'}
                  size={18}
                  color={m.can_read ? colors.success : colors.textMuted}
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  nameBn: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillOk: {
    backgroundColor: '#ecfdf3',
  },
  pillWarn: {
    backgroundColor: '#fffbeb',
  },
  pillPlan: {
    backgroundColor: '#e8f2fa',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pillTextOk: {
    color: colors.success,
  },
  pillTextWarn: {
    color: colors.warning,
  },
  pillTextPlan: {
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoBody: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  verifyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileHint: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  empty: {
    fontSize: 13,
    color: colors.textMuted,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  moduleBody: {
    flex: 1,
    gap: 1,
  },
  moduleName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  moduleCode: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
