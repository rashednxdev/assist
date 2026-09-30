import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { BloodGroup } from '@ibas/shared-types';
import { BloodDrop, EligibilityBadge, ErrorNote, GroupPicker, RED, RED_BORDER } from '@/components/blood/BloodBits';
import { sinceLabel, useBloodMe } from '@/lib/blood-api';
import { formatDate, updatePersonalProfile } from '@/lib/profile-api';
import { colors, spacing } from '@/theme';

/** Home card: set the blood group in one tap and see donor eligibility. */
export function BloodHomeCard() {
  const router = useRouter();
  const { me, refresh } = useBloodMe();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function saveGroup(g: BloodGroup) {
    setBusy(true);
    setError('');
    try {
      await updatePersonalProfile({ blood_group: g });
      await refresh();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  if (!me) return null;
  const d = me.donor;
  const needsGroup = !me.blood_group;
  const title = needsGroup ? 'Add your blood group' : d.is_donor ? `${me.blood_group} blood donor` : `Blood group ${me.blood_group}`;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <BloodDrop group={me.blood_group} size="lg" />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {!needsGroup && !editing ? (
              <Pressable onPress={() => setEditing(true)} hitSlop={10} accessibilityLabel="Change blood group">
                <Ionicons name="pencil" size={14} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          {needsGroup ? (
            <Text style={styles.sub}>Needed to open the blood bank, find donors and request blood.</Text>
          ) : d.is_donor ? (
            <>
              <EligibilityBadge eligible={d.eligible} days={d.days_until_eligible} available={d.available} />
              <Text style={styles.sub}>
                {sinceLabel(d.last_donation_date)}
                {!d.eligible && d.next_eligible_date ? ` · next ${formatDate(d.next_eligible_date)}` : ''}
              </Text>
            </>
          ) : (
            <Text style={styles.sub}>Become a donor so colleagues can find you when they need {me.blood_group} blood.</Text>
          )}
        </View>
      </View>

      {!needsGroup ? (
        <View style={styles.actions}>
          {d.is_donor ? (
            <Pressable style={({ pressed }) => [styles.btn, styles.btnSolid, pressed && styles.pressed]} onPress={() => router.push('/(app)/blood-bank/donate' as Href)}>
              <Ionicons name="heart" size={15} color={colors.white} />
              <Text style={[styles.btnText, styles.btnTextSolid]}>I donated</Text>
            </Pressable>
          ) : (
            <Pressable style={({ pressed }) => [styles.btn, styles.btnSolid, pressed && styles.pressed]} onPress={() => router.push('/(app)/blood-bank/settings' as Href)}>
              <Ionicons name="water" size={15} color={colors.white} />
              <Text style={[styles.btnText, styles.btnTextSolid]}>Become a donor</Text>
            </Pressable>
          )}
          <Pressable style={({ pressed }) => [styles.btn, pressed && styles.pressed]} onPress={() => router.push('/(app)/blood-bank' as Href)}>
            <Text style={styles.btnText}>Blood bank</Text>
            <Ionicons name="arrow-forward" size={15} color="#b91c1c" />
          </Pressable>
        </View>
      ) : null}

      {needsGroup || editing ? (
        <View style={styles.picker}>
          <GroupPicker value={me.blood_group} onChange={(g) => void saveGroup(g)} disabled={busy} />
          <View style={styles.pickerFoot}>
            {busy ? <ActivityIndicator size="small" color={RED} /> : <Text style={styles.sub}>Tap your blood group to save it.</Text>}
            {editing ? (
              <Pressable onPress={() => setEditing(false)} hitSlop={8}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
          <ErrorNote text={error} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: RED_BORDER,
    backgroundColor: '#fff7f7',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  sub: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: RED_BORDER,
    backgroundColor: colors.surface,
  },
  btnSolid: {
    backgroundColor: RED,
    borderColor: RED,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b91c1c',
  },
  btnTextSolid: {
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
  picker: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: RED_BORDER,
    paddingTop: spacing.md,
  },
  pickerFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
