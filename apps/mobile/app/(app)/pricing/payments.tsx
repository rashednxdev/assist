import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCESS_PACKAGE_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  formatBdt,
  type MyAccessSummary,
  type PaymentOrderRecord,
} from '@ibas/shared-types';
import { EmptyState } from '@/components/contacts/ContactBits';
import {
  ENTITLEMENT_STATUS_COLOR,
  ORDER_STATUS_COLOR,
  accessDate,
  accessDateTime,
  daysLeft,
  durationLabel,
  fetchMyAccess,
  fetchMyOrders,
} from '@/lib/billing-api';
import { colors, spacing } from '@/theme';

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}1a`, borderColor: `${color}55` }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function AccessTile({ title, until, onBrowse }: { title: string; until?: string; onBrowse: () => void }) {
  return (
    <View style={[styles.tile, until ? styles.tileOn : null]}>
      <Text style={styles.small}>{title}</Text>
      {until ? (
        <>
          <Text style={styles.tileValue}>Until {accessDate(until)}</Text>
          <Text style={styles.small}>{daysLeft(until)} days left</Text>
        </>
      ) : (
        <>
          <Text style={[styles.tileValue, { color: colors.textMuted }]}>Not active</Text>
          <Pressable onPress={onBrowse} hitSlop={6}>
            <Text style={styles.link}>View packages</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function Line({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

function OrderRow({ order, onContinue }: { order: PaymentOrderRecord; onContinue: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.order}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.orderHead}>
        <View style={styles.flex}>
          <Text style={styles.orderTitle}>{order.package_name}</Text>
          <Text style={styles.small}>
            {ACCESS_PACKAGE_KIND_LABELS[order.kind]}
            {order.exam_subject_name ? ` · ${order.exam_subject_name}` : ''} · {accessDateTime(order.created_at)}
          </Text>
          <Text style={[styles.small, styles.mono]}>{order.invoice_no}</Text>
        </View>
        <View style={styles.orderRight}>
          <Text style={styles.orderAmount}>{formatBdt(order.total)}</Text>
          <StatusPill label={order.status} color={ORDER_STATUS_COLOR[order.status]} />
          {order.access_revoked ? <StatusPill label="Access revoked" color={colors.error} /> : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.orderBody}>
          <Line label="Price" value={formatBdt(order.price)} />
          <Line label={order.charge_label} value={formatBdt(order.charge)} />
          <Line label="Method" value={PAYMENT_METHOD_LABELS[order.method]} />
          <Line label="Duration" value={durationLabel(order.duration_days)} />
          {order.payer_account ? <Line label="bKash account" value={order.payer_account} /> : null}
          {order.trx_id ? <Line label="Transaction ID" value={order.trx_id} mono /> : null}
          {order.paid_at ? <Line label="Paid at" value={accessDateTime(order.paid_at)} /> : null}
          {order.status === 'paid' ? (
            <Line label="Access" value={`${accessDate(order.access_starts_at)} → ${accessDate(order.access_ends_at)}`} />
          ) : null}
          {order.failure_reason ? <Line label="Reason" value={order.failure_reason} /> : null}
          {order.note ? <Line label="Note" value={order.note} /> : null}
          {order.status === 'pending' ? (
            <Pressable onPress={onContinue} style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}>
              <Text style={styles.smallBtnText}>Continue payment</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function PaymentsScreen() {
  const router = useRouter();
  const [access, setAccess] = useState<MyAccessSummary | null>(null);
  const [orders, setOrders] = useState<PaymentOrderRecord[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, o] = await Promise.all([fetchMyAccess(), fetchMyOrders()]);
      setAccess(a);
      setOrders(o);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payments');
    }
  }, []);

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

  const browse = (tab: string) => router.push(`/(app)/pricing?tab=${tab}` as Href);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!access || !orders ? (
        !error ? <ActivityIndicator style={styles.loading} color={colors.primary} /> : null
      ) : (
        <>
          <Section
            title="My access"
            right={
              <Pressable onPress={() => browse('exam_prep')} style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}>
                <Ionicons name="bag-handle-outline" size={14} color={colors.white} />
                <Text style={styles.smallBtnText}>Buy a package</Text>
              </Pressable>
            }
          >
            <View style={styles.tiles}>
              <AccessTile title="Exam Preparation" until={access.exam_prep_until} onBrowse={() => browse('exam_prep')} />
              <AccessTile title="Basic Module" until={access.basic_until} onBrowse={() => browse('basic')} />
            </View>
            <Text style={styles.subTitle}>Live class packages</Text>
            {access.live_packages.length === 0 ? (
              <Text style={styles.small}>
                None yet.{' '}
                <Text style={styles.link} onPress={() => browse('live')}>
                  Browse live packages
                </Text>
              </Text>
            ) : (
              <View style={styles.wrap}>
                {access.live_packages.map((p) => (
                  <StatusPill key={p.package_id} label={`${p.package_name} · until ${accessDate(p.until)}`} color={colors.success} />
                ))}
              </View>
            )}
          </Section>

          <Section title="Access details">
            {access.entitlements.length === 0 ? (
              <Text style={styles.small}>You haven't bought any package yet.</Text>
            ) : (
              access.entitlements.map((e) => (
                <View key={e.id} style={styles.entitlement}>
                  <View style={styles.flex}>
                    <Text style={styles.orderTitle}>{e.package_name}</Text>
                    <Text style={styles.small}>
                      {ACCESS_PACKAGE_KIND_LABELS[e.kind]}
                      {e.exam_subject_name ? ` · ${e.exam_subject_name}` : ''}
                    </Text>
                    <Text style={styles.small}>
                      {accessDate(e.starts_at)} → {accessDate(e.ends_at)}
                      {e.invoice_no ? ` · ${e.invoice_no}` : ''}
                    </Text>
                    {e.opens.length > 0 ? <Text style={styles.small}>Opens: {e.opens.join(', ')}</Text> : null}
                  </View>
                  <StatusPill label={e.status} color={ENTITLEMENT_STATUS_COLOR[e.status]} />
                </View>
              ))
            )}
          </Section>

          <Section title="Payment history">
            {orders.length === 0 ? (
              <EmptyState icon="receipt-outline" title="No payments yet" text="Your package purchases and receipts will appear here." />
            ) : (
              orders.map((o) => (
                <OrderRow key={o.id} order={o} onContinue={() => router.push(`/(app)/pricing/checkout/${o.id}` as Href)} />
              ))
            )}
          </Section>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  loading: { marginTop: spacing.xl },
  pressed: { opacity: 0.75 },
  small: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  mono: { fontFamily: 'monospace' },
  link: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  errorText: { color: colors.error, fontSize: 13 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  subTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 4 },

  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.sm, gap: 2 },
  tileOn: { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' },
  tileValue: { fontSize: 15, fontWeight: '700', color: colors.text },

  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  entitlement: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },

  order: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: spacing.sm, gap: spacing.sm },
  orderHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  orderTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  orderRight: { alignItems: 'flex-end', gap: 4 },
  orderAmount: { fontSize: 14, fontWeight: '800', color: colors.text },
  orderBody: { backgroundColor: colors.background, borderRadius: 10, padding: spacing.sm, gap: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  lineLabel: { fontSize: 12, color: colors.textMuted },
  lineValue: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'right' },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  smallBtnText: { color: colors.white, fontWeight: '700', fontSize: 12 },
});
