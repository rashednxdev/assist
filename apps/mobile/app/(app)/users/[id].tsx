import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { useAuth } from '@/lib/auth-context';
import {
  canManageUsers,
  fetchAdminUser,
  fetchSetupModules,
  fetchUserModuleAccess,
  MOBILE_MODULE_CODES,
  revokeUserModuleAccess,
  sendNotificationToUser,
  updateAdminUser,
  upsertUserModuleAccess,
  type AdminUserDetail,
  type ModuleCatalogItem,
  type UserModuleAccessRow,
} from '@/lib/users-api';
import { colors, spacing } from '@/theme';

type Tab = 'profile' | 'access' | 'notify';

const USER_TYPES = ['applicant', 'officer', 'admin', 'system_admin'];
const USER_STATUSES = ['active', 'inactive', 'suspended', 'pending_verify'];

const PERM_FLAGS = [
  'can_read',
  'can_create',
  'can_update',
  'can_delete',
  'can_grade',
  'can_publish',
] as const;

type PermFlag = (typeof PERM_FLAGS)[number];

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const isAdmin = canManageUsers(me);

  const [tab, setTab] = useState<Tab>('profile');
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [modules, setModules] = useState<ModuleCatalogItem[]>([]);
  const [access, setAccess] = useState<UserModuleAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifying, setNotifying] = useState(false);

  const [drafts, setDrafts] = useState<
    Record<string, Partial<UserModuleAccessRow> & { bypass_stop?: boolean }>
  >({});

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const [u, mods] = await Promise.all([fetchAdminUser(id), fetchSetupModules()]);
      setDetail(u);
      setModules(mods);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab !== 'access' || !id) return;
    void fetchUserModuleAccess(id)
      .then(setAccess)
      .catch(() => setAccess([]));
  }, [tab, id]);

  const mobileModules = useMemo(
    () => modules.filter((m) => (MOBILE_MODULE_CODES as readonly string[]).includes(m.code)),
    [modules],
  );

  async function saveProfile() {
    if (!detail || !id) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateAdminUser(id, {
        full_name_en: detail.full_name_en,
        full_name_bn: detail.full_name_bn,
        email: detail.email,
        phone: detail.phone,
        user_type: detail.user_type,
        status: detail.status,
        is_super_admin: detail.is_super_admin,
        allow_multi_device: detail.allow_multi_device ?? false,
      });
      setDetail(updated.data);
      setMessage('Profile saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function clearDevice() {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await updateAdminUser(id, { clear_bound_device: true });
      setDetail(updated.data);
      setMessage('Bound device cleared');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear device');
    } finally {
      setSaving(false);
    }
  }

  async function forceLogout() {
    if (!id) return;
    setSaving(true);
    try {
      await updateAdminUser(id, { force_logout: true });
      setMessage('Sessions invalidated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Force logout failed');
    } finally {
      setSaving(false);
    }
  }

  function draftFor(mod: ModuleCatalogItem) {
    const existing = access.find((a) => a.module_id === mod._id);
    return (
      drafts[mod._id] ??
      existing ?? {
        can_read: true,
        can_create: false,
        can_update: false,
        can_delete: false,
        can_grade: false,
        can_publish: false,
        bypass_stop: false,
      }
    );
  }

  async function saveAccess(mod: ModuleCatalogItem) {
    if (!id) return;
    const draft = draftFor(mod);
    setSaving(true);
    setError('');
    try {
      await upsertUserModuleAccess(id, {
        module_id: mod._id,
        can_read: Boolean(draft.can_read),
        can_create: Boolean(draft.can_create),
        can_update: Boolean(draft.can_update),
        can_delete: Boolean(draft.can_delete),
        can_grade: Boolean(draft.can_grade),
        can_publish: Boolean(draft.can_publish),
        bypass_stop: Boolean(draft.bypass_stop),
      });
      const rows = await fetchUserModuleAccess(id);
      setAccess(rows);
      setMessage(`Access saved for ${mod.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save access');
    } finally {
      setSaving(false);
    }
  }

  async function revokeAccess(mod: ModuleCatalogItem) {
    if (!id) return;
    setSaving(true);
    try {
      await revokeUserModuleAccess(id, mod._id);
      setAccess((prev) => prev.filter((a) => a.module_id !== mod._id));
      setMessage(`Access revoked for ${mod.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed');
    } finally {
      setSaving(false);
    }
  }

  async function sendNotify() {
    if (!id) return;
    if (!notifyTitle.trim() || !notifyMessage.trim()) {
      setError('Notification title and message are required.');
      return;
    }
    setNotifying(true);
    setError('');
    try {
      await sendNotificationToUser(id, notifyTitle.trim(), notifyMessage.trim());
      setNotifyTitle('');
      setNotifyMessage('');
      setMessage('Notification sent');
      Alert.alert('Sent', 'Notification delivered to this user.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setNotifying(false);
    }
  }

  if (!isAdmin) {
    return <BookEmpty title="Admin only" subtitle="User management requires an admin account." />;
  }
  if (loading) return <BookLoading />;
  if (error && !detail) return <BookError message={error} />;
  if (!detail) return <BookEmpty title="User not found" />;

  return (
    <>
      <Stack.Screen options={{ title: detail.full_name_en || 'User' }} />
      <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
        <View style={styles.tabs}>
          {(
            [
              ['profile', 'Profile'],
              ['access', 'Module access'],
              ['notify', 'Notify'],
            ] as const
          ).map(([idTab, label]) => (
            <Pressable
              key={idTab}
              style={[styles.tab, tab === idTab && styles.tabActive]}
              onPress={() => setTab(idTab)}
            >
              <Text style={[styles.tabText, tab === idTab && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === 'profile' ? (
          <View style={styles.section}>
            <TextField
              label="Full name (EN)"
              value={detail.full_name_en}
              onChangeText={(v) => setDetail({ ...detail, full_name_en: v })}
            />
            <TextField
              label="Full name (BN)"
              value={detail.full_name_bn ?? ''}
              onChangeText={(v) => setDetail({ ...detail, full_name_bn: v })}
            />
            <TextField
              label="Email"
              value={detail.email}
              onChangeText={(v) => setDetail({ ...detail, email: v })}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextField
              label="Phone"
              value={detail.phone}
              onChangeText={(v) => setDetail({ ...detail, phone: v })}
              keyboardType="phone-pad"
            />
            <Text style={styles.label}>User type</Text>
            <View style={styles.chips}>
              {USER_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.chip, detail.user_type === t && styles.chipActive]}
                  onPress={() => setDetail({ ...detail, user_type: t })}
                >
                  <Text style={[styles.chipText, detail.user_type === t && styles.chipTextActive]}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Status</Text>
            <View style={styles.chips}>
              {USER_STATUSES.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.chip, detail.status === s && styles.chipActive]}
                  onPress={() => setDetail({ ...detail, status: s })}
                >
                  <Text style={[styles.chipText, detail.status === s && styles.chipTextActive]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Super admin</Text>
              <Switch
                value={Boolean(detail.is_super_admin)}
                onValueChange={(v) => setDetail({ ...detail, is_super_admin: v })}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Allow multi-device</Text>
              <Switch
                value={Boolean(detail.allow_multi_device)}
                onValueChange={(v) => setDetail({ ...detail, allow_multi_device: v })}
              />
            </View>
            <Text style={styles.hint}>
              Bound device:{' '}
              {detail.bound_device_id
                ? `${detail.bound_device_label ?? 'device'} (${detail.bound_device_id.slice(0, 8)}…)`
                : 'None'}
            </Text>
            <Button title="Save profile" onPress={() => void saveProfile()} loading={saving} />
            <Button
              title="Clear bound device"
              variant="secondary"
              onPress={() => void clearDevice()}
              disabled={!detail.bound_device_id || saving}
            />
            <Button
              title="Force logout"
              variant="secondary"
              onPress={() => void forceLogout()}
              disabled={saving}
            />
          </View>
        ) : null}

        {tab === 'access' ? (
          <View style={styles.section}>
            <Text style={styles.hint}>
              Grant mobile modules. Turn on &quot;Allow while stopped&quot; so this user keeps access
              when a module is centrally stopped.
            </Text>
            {mobileModules.map((mod) => {
              const existing = access.find((a) => a.module_id === mod._id);
              const draft = draftFor(mod);
              return (
                <View key={mod._id} style={styles.accessCard}>
                  <Text style={styles.accessTitle}>{mod.name_en}</Text>
                  <Text style={styles.accessCode}>{mod.code}</Text>
                  <View style={styles.permGrid}>
                    {PERM_FLAGS.map((flag) => (
                      <Pressable
                        key={flag}
                        style={styles.permRow}
                        onPress={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [mod._id]: { ...draft, [flag]: !draft[flag as PermFlag] },
                          }))
                        }
                      >
                        <Text style={styles.permLabel}>{flag.replace('can_', '')}</Text>
                        <Switch
                          value={Boolean(draft[flag as PermFlag])}
                          onValueChange={(v) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [mod._id]: { ...draft, [flag]: v },
                            }))
                          }
                        />
                      </Pressable>
                    ))}
                    <Pressable
                      style={styles.permRow}
                      onPress={() =>
                        setDrafts((prev) => ({
                          ...prev,
                          [mod._id]: { ...draft, bypass_stop: !draft.bypass_stop },
                        }))
                      }
                    >
                      <Text style={styles.permLabel}>Allow while stopped</Text>
                      <Switch
                        value={Boolean(draft.bypass_stop)}
                        onValueChange={(v) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [mod._id]: { ...draft, bypass_stop: v },
                          }))
                        }
                      />
                    </Pressable>
                  </View>
                  <View style={styles.accessActions}>
                    <Button
                      title={existing ? 'Update' : 'Grant'}
                      onPress={() => void saveAccess(mod)}
                      loading={saving}
                    />
                    {existing ? (
                      <Button
                        title="Revoke"
                        variant="secondary"
                        onPress={() => void revokeAccess(mod)}
                        disabled={saving}
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {tab === 'notify' ? (
          <View style={styles.section}>
            <Text style={styles.hint}>
              Sends a push/in-app notification to {detail.full_name_en} only (same as Notifications
              admin → specific users).
            </Text>
            <TextField
              label="Title"
              value={notifyTitle}
              onChangeText={setNotifyTitle}
              placeholder="Notification title"
            />
            <TextField
              label="Message"
              value={notifyMessage}
              onChangeText={setNotifyMessage}
              placeholder="Notification body"
              multiline
              numberOfLines={4}
            />
            <Button
              title="Send to this user"
              onPress={() => void sendNotify()}
              loading={notifying}
            />
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: colors.white },
  section: { gap: spacing.sm },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.white },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  message: { fontSize: 13, color: '#059669', fontWeight: '600' },
  error: { fontSize: 13, color: colors.error },
  accessCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    gap: 6,
    backgroundColor: colors.surface,
  },
  accessTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  accessCode: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  permGrid: { gap: 4 },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permLabel: { fontSize: 13, color: colors.text, textTransform: 'capitalize' },
  accessActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
});
