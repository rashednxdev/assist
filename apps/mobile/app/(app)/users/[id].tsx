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
  fetchExamSubjectOptions,
  fetchSetupModules,
  fetchUserModuleAccess,
  MOBILE_MODULE_CODES,
  catalogModuleId,
  revokeUserModuleAccess,
  sendNotificationToUser,
  updateAdminUser,
  upsertUserModuleAccess,
  type AdminUserDetail,
  type ExamSubjectOption,
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
  const [subjectOptions, setSubjectOptions] = useState<ExamSubjectOption[]>([]);
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyModuleId, setBusyModuleId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const [u, mods, subjects] = await Promise.all([
        fetchAdminUser(id),
        fetchSetupModules(),
        fetchExamSubjectOptions().catch(() => [] as ExamSubjectOption[]),
      ]);
      setDetail(u);
      setModules(mods);
      setSubjectOptions(subjects);
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
    if (!id) return;
    void fetchUserModuleAccess(id)
      .then(setAccess)
      .catch(() => setAccess([]));
  }, [id]);

  const mobileModules = useMemo(() => {
    const allowed = modules.filter((m) => (MOBILE_MODULE_CODES as readonly string[]).includes(m.code));
    return [...allowed].sort(
      (a, b) =>
        (MOBILE_MODULE_CODES as readonly string[]).indexOf(a.code) -
        (MOBILE_MODULE_CODES as readonly string[]).indexOf(b.code),
    );
  }, [modules]);

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
        amount_received: Number(detail.amount_received ?? 0),
        all_exam_subjects: detail.all_exam_subjects !== false,
        exam_subject_ids: detail.all_exam_subjects === false ? (detail.exam_subject_ids ?? []) : [],
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

  function accessFor(mod: ModuleCatalogItem) {
    const mid = catalogModuleId(mod);
    return access.find((a) => a.module_id === mid || a.module_code === mod.code);
  }

  function draftFor(mod: ModuleCatalogItem) {
    const mid = catalogModuleId(mod);
    const existing = accessFor(mod);
    return (
      drafts[mid] ??
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

  async function grantAccess(mod: ModuleCatalogItem) {
    if (!id) return;
    const mid = catalogModuleId(mod);
    if (!mid) {
      setError('Module id missing');
      return;
    }
    const draft = draftFor(mod);
    setBusyModuleId(mid);
    setError('');
    setMessage('');
    try {
      await upsertUserModuleAccess(id, {
        module_id: mid,
        can_read: draft.can_read !== false,
        can_create: Boolean(draft.can_create),
        can_update: Boolean(draft.can_update),
        can_delete: Boolean(draft.can_delete),
        can_grade: Boolean(draft.can_grade),
        can_publish: Boolean(draft.can_publish),
        bypass_stop: Boolean(draft.bypass_stop),
      });
      const rows = await fetchUserModuleAccess(id);
      setAccess(rows);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[mid];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant access');
    } finally {
      setBusyModuleId(null);
    }
  }

  async function saveAccessDetails(mod: ModuleCatalogItem) {
    await grantAccess(mod);
  }

  async function revokeAccess(mod: ModuleCatalogItem) {
    if (!id) return;
    const mid = catalogModuleId(mod);
    const existing = accessFor(mod);
    const revokeId = existing?.module_id || mid;
    if (!revokeId) return;
    setBusyModuleId(mid);
    setError('');
    setMessage('');
    try {
      await revokeUserModuleAccess(id, revokeId);
      setAccess((prev) => prev.filter((a) => a.module_id !== revokeId && a.module_code !== mod.code));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[mid];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed');
    } finally {
      setBusyModuleId(null);
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
            <TextField
              label="Amount received"
              value={String(detail.amount_received ?? 0)}
              onChangeText={(v) => {
                const cleaned = v.replace(/[^0-9.]/g, '');
                setDetail({
                  ...detail,
                  amount_received: cleaned === '' ? 0 : Number(cleaned),
                });
              }}
              keyboardType="decimal-pad"
            />
            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.switchLabel}>Paid user</Text>
                <Text style={styles.hint}>
                  Paid users can join paid live classes without a separate invite. Set amount to 0 to
                  mark unpaid.
                </Text>
              </View>
              <Switch
                value={Number(detail.amount_received ?? 0) > 0}
                onValueChange={(v) =>
                  setDetail({
                    ...detail,
                    amount_received: v
                      ? Math.max(Number(detail.amount_received ?? 0), 1)
                      : 0,
                  })
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Allow all exam subjects</Text>
              <Switch
                value={detail.all_exam_subjects !== false}
                onValueChange={(v) =>
                  setDetail({
                    ...detail,
                    all_exam_subjects: v,
                    exam_subject_ids: v ? [] : (detail.exam_subject_ids ?? []),
                  })
                }
              />
            </View>
            {detail.all_exam_subjects === false ? (
              <View style={styles.subjectBox}>
                <Text style={styles.label}>Allowed subjects</Text>
                <Text style={styles.hint}>
                  User only sees Exam Papers, Question Bank, Exam of the Week, and Questions of the Day
                  for these subjects.
                </Text>
                <View style={styles.chips}>
                  {subjectOptions.map((s) => {
                    const selected = (detail.exam_subject_ids ?? []).includes(s.id);
                    return (
                      <Pressable
                        key={s.id}
                        style={[styles.chip, selected && styles.chipActive]}
                        onPress={() => {
                          const current = new Set(detail.exam_subject_ids ?? []);
                          if (selected) current.delete(s.id);
                          else current.add(s.id);
                          setDetail({ ...detail, exam_subject_ids: [...current] });
                        }}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                          {s.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
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
              Grant or revoke one module at a time. Open details only if extra permissions are needed.
            </Text>
            {mobileModules.map((mod) => {
              const mid = catalogModuleId(mod);
              const existing = accessFor(mod);
              const granted = Boolean(existing);
              const expanded = expandedId === mid;
              const draft = draftFor(mod);
              const busy = busyModuleId === mid;
              return (
                <View key={mid || mod.code} style={[styles.accessRow, granted && styles.accessRowGranted]}>
                  <View style={styles.accessMain}>
                    <View style={styles.accessInfo}>
                      <View style={styles.accessTitleRow}>
                        <Text style={[styles.accessTitle, granted && styles.accessTitleGranted]}>
                          {mod.name_en}
                        </Text>
                        {granted ? (
                          <View style={styles.grantedBadge}>
                            <Text style={styles.grantedBadgeText}>Granted</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.accessActions}>
                      {granted ? (
                        <Pressable
                          style={[styles.actionBtn, busy && styles.actionBtnDisabled]}
                          onPress={() => void revokeAccess(mod)}
                          disabled={busy}
                        >
                          <Text style={styles.actionBtnText}>{busy ? '…' : 'Revoke'}</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={[styles.actionBtn, styles.grantBtn, busy && styles.actionBtnDisabled]}
                          onPress={() => void grantAccess(mod)}
                          disabled={busy}
                        >
                          <Text style={styles.grantBtnText}>{busy ? '…' : 'Grant'}</Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={styles.actionBtn}
                        onPress={() => setExpandedId(expanded ? null : mid)}
                      >
                        <Text style={styles.actionBtnText}>{expanded ? 'Hide' : 'Details'}</Text>
                      </Pressable>
                    </View>
                  </View>
                  {expanded ? (
                    <View style={styles.accessDetails}>
                      {PERM_FLAGS.map((flag) => (
                        <View key={flag} style={styles.permRow}>
                          <Text style={styles.permLabel}>{flag.replace('can_', '')}</Text>
                          <Switch
                            value={Boolean(draft[flag as PermFlag])}
                            onValueChange={(v) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [mid]: { ...draft, [flag]: v },
                              }))
                            }
                          />
                        </View>
                      ))}
                      <View style={styles.permRow}>
                        <Text style={styles.permLabel}>Allow while stopped</Text>
                        <Switch
                          value={Boolean(draft.bypass_stop)}
                          onValueChange={(v) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [mid]: { ...draft, bypass_stop: v },
                            }))
                          }
                        />
                      </View>
                      <Pressable
                        style={[
                          styles.actionBtn,
                          styles.saveDetailsBtn,
                          styles.grantBtn,
                          busy && styles.actionBtnDisabled,
                        ]}
                        onPress={() => void saveAccessDetails(mod)}
                        disabled={busy}
                      >
                        <Text style={styles.grantBtnText}>
                          {busy ? 'Saving…' : granted ? 'Save permissions' : 'Grant with these permissions'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {tab === 'notify' ? (
          <View style={styles.section}>
            <Text style={styles.hint}>
              Sends a push/in-app notification to {detail.full_name_en} only. To stop remaining unread
              delivery or remove a notice, open Notifications → Stop or remove sent notifications.
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
  subjectBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    gap: 8,
    backgroundColor: colors.surface,
  },
  message: { fontSize: 13, color: '#059669', fontWeight: '600' },
  error: { fontSize: 13, color: colors.error },
  accessRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: 8,
  },
  accessRowGranted: {
    backgroundColor: '#ecfdf5',
    borderColor: '#34d399',
    borderWidth: 2,
  },
  accessMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accessInfo: {
    flex: 1,
    minWidth: 0,
  },
  accessTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  accessTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  accessTitleGranted: { color: '#064e3b' },
  grantedBadge: {
    backgroundColor: '#059669',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  grantedBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  accessActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grantBtn: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  grantBtnText: { fontSize: 12, fontWeight: '800', color: '#ffffff' },
  actionBtnDisabled: { opacity: 0.55 },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: colors.text },
  accessDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: 4,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permLabel: { fontSize: 13, color: colors.text, textTransform: 'capitalize' },
  saveDetailsBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
});
