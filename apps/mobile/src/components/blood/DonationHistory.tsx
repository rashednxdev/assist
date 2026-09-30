import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { BloodDonationRecord, BloodMe } from '@ibas/shared-types';
import { EmptyState } from '@/components/contacts/ContactBits';
import { Button } from '@/components/ui/Button';
import { ErrorNote, RED, RED_BORDER } from '@/components/blood/BloodBits';
import { requestHref } from '@/components/blood/RequestList';
import { deleteDonation, fetchDonations } from '@/lib/blood-api';
import { formatDate } from '@/lib/profile-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

export function DonationHistory({ me, onAdd }: { me: BloodMe; onAdd: () => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<BloodDonationRecord[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    fetchDonations()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load donations'));
  }, []);

  useEffect(load, [load, me.donor.donation_count, me.donor.last_donation_date]);

  function remove(id: string) {
    Alert.alert('Remove donation', 'Remove this donation from your history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deleteDonation(id)
            .then(() => showToast('Donation removed'))
            .catch((e) => setError(e instanceof Error ? e.message : 'Could not remove'));
        },
      },
    ]);
  }

  if (error && !rows) return <ErrorNote text={error} />;
  if (!rows) return <ActivityIndicator color={RED} style={styles.loader} />;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={styles.title}>My donations</Text>
          <Text style={styles.sub}>
            {rows.length} donation{rows.length === 1 ? '' : 's'} recorded · each one can help up to three people
          </Text>
        </View>
      </View>
      <Button title="I donated" onPress={onAdd} style={{ backgroundColor: RED, height: 46 }} />
      <ErrorNote text={error} />
      {rows.length === 0 ? (
        <EmptyState
          icon="water-outline"
          title="No donations recorded"
          text="After you donate, record it here. We work out your next eligible date and pause requests to you until then."
        />
      ) : (
        <View style={styles.timeline}>
          {rows.map((d) => (
            <View key={d.id} style={styles.item}>
              <View style={styles.dot}>
                <Ionicons name="water" size={11} color={colors.white} />
              </View>
              <View style={styles.card}>
                <View style={styles.flex}>
                  <Text style={styles.date}>{formatDate(d.donated_on)}</Text>
                  {d.place ? <Text style={styles.place}>{d.place}</Text> : null}
                  <Text style={styles.sub}>Next eligible {formatDate(d.next_eligible_on)}</Text>
                  {d.note ? <Text style={styles.sub}>{d.note}</Text> : null}
                  {d.request_id ? (
                    <Pressable onPress={() => router.push(requestHref(d.request_id!))} hitSlop={4}>
                      <Text style={styles.link}>For a blood request</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Pressable onPress={() => remove(d.id)} hitSlop={10} accessibilityLabel="Remove donation">
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  wrap: {
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  sub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  timeline: {
    borderLeftWidth: 2,
    borderLeftColor: RED_BORDER,
    marginLeft: 10,
    paddingLeft: spacing.md + 4,
    gap: spacing.sm + 4,
  },
  item: {
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    left: -31,
    top: 14,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  date: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  place: {
    fontSize: 13,
    color: colors.text,
  },
  link: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c',
    marginTop: 2,
  },
});
