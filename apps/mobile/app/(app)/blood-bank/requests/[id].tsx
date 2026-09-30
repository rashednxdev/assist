import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { donorGroupsFor, type BloodRequestRecord } from '@ibas/shared-types';
import { BloodDrop, EligibilityBadge, ErrorNote, RED, RED_DARK, StatusBadge, UrgencyBadge } from '@/components/blood/BloodBits';
import {
  deleteRequest,
  fetchRequest,
  formatDateTime,
  setRequestStatus,
  toggleRespond,
  useBloodMe,
} from '@/lib/blood-api';
import { formatDate } from '@/lib/profile-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

function ActionButton({
  title,
  icon,
  onPress,
  tone = 'red',
  busy,
  disabled,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: 'red' | 'outline' | 'green' | 'danger';
  busy?: boolean;
  disabled?: boolean;
}) {
  const filled = tone === 'red' || tone === 'green';
  const fg = filled ? colors.white : tone === 'danger' ? colors.error : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.action,
        tone === 'red' && styles.actionRed,
        tone === 'green' && styles.actionGreen,
        !filled && styles.actionOutline,
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : <Ionicons name={icon} size={17} color={fg} />}
      <Text style={[styles.actionText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export default function BloodRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { me } = useBloodMe();
  const [r, setR] = useState<BloodRequestRecord | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'respond' | 'status' | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setR(await fetchRequest(id));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the request');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function respond() {
    if (!r) return;
    setBusy('respond');
    setError('');
    try {
      const next = await toggleRespond(r.id);
      setR(next);
      showToast(next.i_responded ? 'Offer sent — the requester can now see you' : 'Offer withdrawn');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(status: 'open' | 'fulfilled' | 'cancelled') {
    setBusy('status');
    setError('');
    try {
      setR(await setRequestStatus(id, status));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(null);
    }
  }

  function remove() {
    Alert.alert('Delete request', 'Delete this request? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setBusy('status');
          deleteRequest(id)
            .then(() => {
              showToast('Request deleted');
              router.back();
            })
            .catch((e) => {
              setError(e instanceof Error ? e.message : 'Could not delete');
              setBusy(null);
            });
        },
      },
    ]);
  }

  function share() {
    if (!r) return;
    const message = `${r.blood_group} blood needed (${r.units} bag${r.units === 1 ? '' : 's'}) at ${r.hospital}${
      r.district?.name ? `, ${r.district.name}` : ''
    } by ${formatDateTime(r.needed_on)}. Contact ${r.contact_name}: ${r.contact_phone}`;
    void Share.share({ title: `${r.blood_group} blood needed`, message }).catch(() => undefined);
  }

  if (!r) {
    return (
      <View style={styles.center}>
        {error ? <ErrorNote text={error} /> : <ActivityIndicator color={RED} size="large" />}
      </View>
    );
  }

  const canManage = r.is_mine || !!me?.is_admin;
  const place = [r.address, r.thana?.name, r.district?.name].filter(Boolean).join(', ');
  let blockReason: string | undefined;
  if (r.status !== 'open') blockReason = 'This request is closed.';
  else if (r.is_mine) blockReason = undefined;
  else if (!me?.blood_group) blockReason = 'Add your blood group first.';
  else if (!r.compatible) blockReason = `${me.blood_group} can't be given to a ${r.blood_group} patient.`;
  else if (!me.donor.eligible) blockReason = `You can donate again from ${formatDate(me.donor.next_eligible_date)}.`;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <View style={styles.card}>
        <LinearGradient colors={[RED, '#e11d48', RED_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <BloodDrop group={r.blood_group} size="xl" inverted />
          <View style={styles.heroText}>
            <View style={styles.tags}>
              {r.status === 'open' ? <UrgencyBadge urgency={r.urgency} /> : <StatusBadge status={r.status} />}
              <View style={styles.glassPill}>
                <Text style={styles.glassText}>
                  {r.units} bag{r.units === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{r.blood_group} blood needed</Text>
            <Text style={styles.heroSub}>Compatible donors: {donorGroupsFor(r.blood_group).join(', ')}</Text>
          </View>
          <Pressable onPress={share} hitSlop={8} style={styles.shareBtn} accessibilityLabel="Share request">
            <Ionicons name="share-social" size={18} color={colors.white} />
          </Pressable>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.line}>
            <Ionicons name="medkit" size={16} color={RED} />
            <Text style={styles.hospital}>{r.hospital}</Text>
          </View>
          {place ? (
            <View style={styles.line}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text style={styles.muted}>{place}</Text>
            </View>
          ) : null}
          <View style={styles.line}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <Text style={styles.muted}>
              Needed by <Text style={styles.strong}>{formatDateTime(r.needed_on)}</Text>
            </Text>
          </View>
          {r.patient_name ? (
            <View style={styles.line}>
              <Ionicons name="person-outline" size={16} color={colors.textMuted} />
              <Text style={styles.muted}>
                Patient: <Text style={styles.strong}>{r.patient_name}</Text>
              </Text>
            </View>
          ) : null}
          {r.note ? <Text style={styles.note}>{r.note}</Text> : null}
          <Text style={styles.small}>
            Posted by {r.requester.name} · {formatDateTime(r.created_at)}
          </Text>

          <View style={styles.callRow}>
            <Ionicons name="call" size={16} color={RED} />
            <View style={styles.flex}>
              <Text style={styles.callName} numberOfLines={1}>
                {r.contact_name}
              </Text>
              <Text style={styles.small}>{r.contact_phone}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
              onPress={() => void Linking.openURL(`tel:${r.contact_phone}`)}
              accessibilityLabel={`Call ${r.contact_name}`}
            >
              <Ionicons name="call" size={15} color={colors.white} />
              <Text style={styles.callBtnText}>Call</Text>
            </Pressable>
          </View>

          {!r.is_mine ? (
            <View style={styles.gap}>
              <ActionButton
                title={r.i_responded ? 'Withdraw my offer' : 'I can donate'}
                icon="hand-left"
                tone={r.i_responded ? 'outline' : 'red'}
                busy={busy === 'respond'}
                disabled={!r.i_responded && !!blockReason}
                onPress={() => void respond()}
              />
              {!r.i_responded && blockReason ? <Text style={styles.block}>{blockReason}</Text> : null}
              {r.i_responded ? (
                <ActionButton
                  title="I donated for this request"
                  icon="water"
                  tone="outline"
                  onPress={() => router.push(`/(app)/blood-bank/donate?requestId=${r.id}` as Href)}
                />
              ) : null}
            </View>
          ) : null}

          {canManage ? (
            <View style={styles.manage}>
              {r.status === 'open' ? (
                <>
                  <ActionButton title="Got blood" icon="checkmark-circle" tone="green" busy={busy === 'status'} onPress={() => void changeStatus('fulfilled')} />
                  <ActionButton title="Cancel request" icon="close-circle" tone="outline" disabled={!!busy} onPress={() => void changeStatus('cancelled')} />
                </>
              ) : r.status === 'fulfilled' || r.status === 'cancelled' ? (
                <ActionButton title="Reopen" icon="refresh" tone="outline" busy={busy === 'status'} onPress={() => void changeStatus('open')} />
              ) : null}
              <ActionButton title="Delete" icon="trash-outline" tone="danger" disabled={!!busy} onPress={remove} />
            </View>
          ) : null}
          <ErrorNote text={error} />
        </View>
      </View>

      {r.responders ? (
        <View style={styles.gap}>
          <Text style={styles.section}>Donors who offered ({r.responders.length})</Text>
          {r.responders.length === 0 ? (
            <Text style={styles.emptyBox}>No offers yet. Share this request — donors of compatible groups nearby were notified.</Text>
          ) : (
            r.responders.map((d) => (
              <View key={d.id} style={styles.responder}>
                <BloodDrop group={d.blood_group} />
                <View style={styles.flex}>
                  <Text style={styles.callName}>{d.name}</Text>
                  {d.designation || d.office ? (
                    <Text style={styles.small} numberOfLines={1}>
                      {[d.designation, d.office].filter(Boolean).join(', ')}
                    </Text>
                  ) : null}
                  <View style={styles.tags}>
                    <EligibilityBadge eligible={d.eligible} days={0} />
                    <Text style={styles.small}>offered {formatDateTime(d.at)}</Text>
                  </View>
                  {d.note ? <Text style={styles.quote}>“{d.note}”</Text> : null}
                </View>
                {d.phone ? (
                  <Pressable
                    style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
                    onPress={() => void Linking.openURL(`tel:${d.phone}`)}
                    accessibilityLabel={`Call ${d.name}`}
                  >
                    <Ionicons name="call" size={15} color={colors.white} />
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </View>
      ) : null}
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
    paddingBottom: spacing.xl * 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  gap: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  glassPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  glassText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.white,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  shareBtn: {
    alignSelf: 'flex-start',
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm + 4,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  hospital: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  muted: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
  },
  strong: {
    fontWeight: '700',
    color: colors.text,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.sm + 4,
  },
  small: {
    fontSize: 12,
    color: colors.textMuted,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.sm + 4,
  },
  callName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 38,
    minWidth: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: RED,
  },
  callBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
  actionRed: {
    backgroundColor: RED,
  },
  actionGreen: {
    backgroundColor: '#059669',
  },
  actionOutline: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  block: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  manage: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm + 4,
  },
  section: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  emptyBox: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  responder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  quote: {
    fontSize: 12,
    color: colors.text,
  },
});
