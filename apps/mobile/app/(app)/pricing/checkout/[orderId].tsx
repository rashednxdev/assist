import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCESS_PACKAGE_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  formatBdt,
  type CartRecord,
  type PaymentOrderRecord,
} from '@ibas/shared-types';
import { useAuth } from '@/lib/auth-context';
import {
  BKASH,
  OPEN_AFTER_PURCHASE,
  accessDate,
  accessDateTime,
  cancelCart,
  cancelOrder,
  claimCart,
  claimOrder,
  createCart,
  createOrder,
  durationLabel,
  fetchCart,
  fetchCatalog,
  fetchOrder,
} from '@/lib/billing-api';
import { colors, spacing } from '@/theme';

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

function Receipt({ order }: { order: PaymentOrderRecord }) {
  return (
    <View style={styles.receipt}>
      <Row label="Package" value={order.package_name} />
      <Row label="Type" value={ACCESS_PACKAGE_KIND_LABELS[order.kind]} />
      {order.exam_part_name ? <Row label="Part" value={order.exam_part_name} /> : null}
      {order.exam_subject_name ? <Row label="Subject" value={order.exam_subject_name} /> : null}
      <Row label="Price" value={formatBdt(order.price)} />
      <Row label={order.charge_label} value={formatBdt(order.charge)} />
      <Row label="Total" value={formatBdt(order.total)} />
      <Row label="Method" value={PAYMENT_METHOD_LABELS[order.method]} />
      {order.payer_account ? <Row label="Your bKash" value={order.payer_account} /> : null}
      {order.trx_id ? <Row label="Transaction ID" value={order.trx_id} mono /> : null}
      <Row label="Invoice" value={order.invoice_no} mono />
      {order.paid_at ? <Row label="Confirmed at" value={accessDateTime(order.paid_at)} /> : null}
      <Row
        label="Access"
        value={
          order.status === 'paid'
            ? `${accessDate(order.access_starts_at)} → ${accessDate(order.access_ends_at)}`
            : durationLabel(order.duration_days)
        }
      />
    </View>
  );
}

function CartItems({ cart, showAccess }: { cart: CartRecord; showAccess?: boolean }) {
  return (
    <View style={styles.receipt}>
      {cart.orders.map((o) => (
        <View key={o.id} style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.itemName}>{o.package_name}</Text>
            <Text style={styles.small}>
              {[o.exam_part_name, o.exam_subject_name, durationLabel(o.duration_days)]
                .filter((s) => s && s !== o.package_name)
                .join(' · ')}
              {showAccess ? `\n${accessDate(o.access_starts_at)} → ${accessDate(o.access_ends_at)}` : ''}
            </Text>
          </View>
          <Text style={styles.itemPrice}>{formatBdt(o.price)}</Text>
        </View>
      ))}
    </View>
  );
}

function CartReceipt({ cart }: { cart: CartRecord }) {
  return (
    <>
      <CartItems cart={cart} showAccess />
      <View style={styles.receipt}>
        <Row label="Price" value={formatBdt(cart.price)} />
        <Row label={cart.charge_label} value={formatBdt(cart.charge)} />
        <Row label="Total" value={formatBdt(cart.total)} />
        <Row label="Method" value={PAYMENT_METHOD_LABELS[cart.method]} />
        {cart.payer_account ? <Row label="Your bKash" value={cart.payer_account} /> : null}
        {cart.trx_id ? <Row label="Transaction ID" value={cart.trx_id} mono /> : null}
        {cart.paid_at ? <Row label="Confirmed at" value={accessDateTime(cart.paid_at)} /> : null}
      </View>
    </>
  );
}

function StatusHero({
  icon,
  color,
  title,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.statusHero}>
      <Ionicons name={icon} size={60} color={color} />
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<PaymentOrderRecord | null>(null);
  const [cart, setCart] = useState<CartRecord | null>(null);
  const [bkashNumber, setBkashNumber] = useState('');
  const [loadError, setLoadError] = useState('');
  const [trxId, setTrxId] = useState('');
  const [amount, setAmount] = useState('');
  const [sender, setSender] = useState('');
  const [agree, setAgree] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refreshedFor = useRef<string | null>(null);

  const load = useCallback(async (id: string) => {
    try {
      const [o, catalog] = await Promise.all([fetchOrder(id), fetchCatalog().catch(() => null)]);
      if (catalog?.settings?.bkash_number) setBkashNumber(catalog.settings.bkash_number);
      if (o.cart_id) {
        const c = await fetchCart(o.cart_id);
        setCart(c);
        setOrder(c.orders.find((x) => x.id === o.id) ?? o);
        setAmount(String(c.total));
      } else {
        setCart(null);
        setOrder(o);
        setAmount(String(o.total));
      }
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Order not found');
    }
  }, []);

  useEffect(() => {
    if (orderId) void load(String(orderId));
  }, [orderId, load]);

  useEffect(() => {
    if (order?.status === 'paid' && refreshedFor.current !== order.id) {
      refreshedFor.current = order.id;
      void refreshUser().catch(() => undefined);
    }
  }, [order, refreshUser]);

  // Poll while waiting for admin confirmation.
  useEffect(() => {
    if (!order || order.status !== 'pending' || !order.trx_id || !orderId) return;
    const t = setInterval(() => {
      void load(String(orderId));
    }, 12_000);
    return () => clearInterval(t);
  }, [order?.status, order?.trx_id, orderId, load]);

  function backToPricing(kind?: PaymentOrderRecord['kind']) {
    router.dismissTo(`/(app)/pricing?tab=${kind ?? 'exam_prep'}` as Href);
  }

  async function submitClaim() {
    if (!order) return;
    setError('');
    if (!agree) return setError('Please confirm the order details to continue.');
    if (trxId.trim().length < 4) return setError('Enter a valid bKash Transaction ID (TrxID).');
    const sent = Number(amount);
    if (!Number.isFinite(sent) || sent <= 0) return setError('Enter the amount you sent.');
    if (sender.trim() && !/^01[3-9]\d{8}$/.test(sender.trim())) {
      return setError('Your bKash number must be 11 digits (01XXXXXXXXX).');
    }
    setBusy(true);
    try {
      const body = {
        trx_id: trxId.trim().toUpperCase(),
        amount: sent,
        payer_account: sender.trim() || undefined,
      };
      if (cart) {
        const c = await claimCart(cart.cart_id, body);
        setCart(c);
        setOrder(c.orders.find((x) => x.id === order.id) ?? c.orders[0]!);
      } else {
        setOrder(await claimOrder(order.id, body));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit payment details.');
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (!order) return backToPricing();
    if (order.status === 'pending' && !order.trx_id) {
      setBusy(true);
      await (cart ? cancelCart(cart.cart_id) : cancelOrder(order.id)).catch(() => undefined);
      setBusy(false);
    }
    backToPricing(order.kind);
  }

  async function retry() {
    if (!order) return;
    setBusy(true);
    try {
      let fresh: PaymentOrderRecord;
      if (cart) {
        const c = await createCart(cart.orders.map((o) => o.package_id));
        setCart(c);
        fresh = c.orders[0]!;
        setAmount(String(c.total));
      } else {
        fresh = await createOrder(order.package_id);
        setAmount(String(fresh.total));
      }
      setTrxId('');
      setSender('');
      setError('');
      setOrder(fresh);
      router.setParams({ orderId: fresh.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start again');
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <View style={[styles.root, styles.centerBox]}>
        <StatusHero icon="alert-circle-outline" color={colors.error} title="Checkout unavailable" text={loadError} />
        <Pressable onPress={() => backToPricing()} style={styles.outlineBtn}>
          <Text style={styles.outlineBtnText}>Back to pricing</Text>
        </Pressable>
      </View>
    );
  }
  if (!order) {
    return (
      <View style={[styles.root, styles.centerBox]}>
        <ActivityIndicator color={BKASH} />
      </View>
    );
  }

  if (order.status === 'paid') {
    const open = OPEN_AFTER_PURCHASE[order.kind];
    const later = new Date(order.access_starts_at).getTime() > Date.now() + 60_000;
    const multi = !!cart && cart.orders.length > 1;
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <StatusHero
          icon="checkmark-circle"
          color={colors.success}
          title="Payment confirmed"
          text={
            multi
              ? `${cart.orders.length} packages are now on your account.`
              : `Your access is active${later ? ` from ${accessDate(order.access_starts_at)}` : ''} until ${accessDate(order.access_ends_at)}.`
          }
        />
        {multi ? <CartReceipt cart={cart} /> : <Receipt order={order} />}
        <Pressable
          onPress={() => router.dismissTo(open.href)}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.primaryBtnText}>{open.label}</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(app)/pricing/payments' as Href)} style={styles.outlineBtn}>
          <Text style={styles.outlineBtnText}>My courses & payments</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (order.status === 'failed') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <StatusHero
          icon="close-circle"
          color={colors.error}
          title="Payment not confirmed"
          text={`${order.failure_reason ?? 'Transaction details did not match.'} Access is not open yet.`}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable
          onPress={() => void retry()}
          disabled={busy}
          style={({ pressed }) => [styles.bkashBtn, (pressed || busy) && styles.pressed]}
        >
          {busy ? <ActivityIndicator color={colors.white} /> : null}
          <Text style={styles.primaryBtnText}>Try again</Text>
        </Pressable>
        <Pressable onPress={() => backToPricing(order.kind)} style={styles.outlineBtn}>
          <Text style={styles.outlineBtnText}>Back to pricing</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (order.status !== 'pending') {
    return (
      <View style={[styles.root, styles.centerBox]}>
        <StatusHero
          icon="time-outline"
          color={colors.textMuted}
          title={order.status === 'expired' ? 'This checkout expired' : 'This checkout was cancelled'}
          text="No money was taken. Start again from Pricing."
        />
        <Pressable
          onPress={() => backToPricing(order.kind)}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.primaryBtnText}>Back to pricing</Text>
        </Pressable>
      </View>
    );
  }

  // Pending + TrxID submitted → waiting for admin confirmation (SMS on accept).
  if (order.trx_id) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <StatusHero
          icon="time-outline"
          color="#d97706"
          title="We are confirming your payment"
          text="Your transaction is under review. Access opens after admin confirmation. You can close this page."
        />
        {cart && cart.orders.length > 1 ? <CartReceipt cart={cart} /> : <Receipt order={order} />}
        <Pressable
          onPress={() => router.replace('/(app)/pricing/payments' as Href)}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.primaryBtnText}>My courses & payments</Text>
        </Pressable>
        <Pressable onPress={() => backToPricing(order.kind)} style={styles.outlineBtn}>
          <Text style={styles.outlineBtnText}>Back to pricing</Text>
        </Pressable>
        <Text style={styles.pollHint}>Status refreshes automatically while you wait.</Text>
      </ScrollView>
    );
  }

  const total = cart?.total ?? order.total;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageTitle}>Checkout</Text>
        <Text style={styles.pageSub}>
          Send money with bKash, then submit your Transaction ID. Never enter PIN or OTP here.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order summary</Text>
          {cart ? (
            <CartItems cart={cart} />
          ) : (
            <View style={styles.pkgRow}>
              <View style={styles.pkgIcon}>
                <Ionicons name="school-outline" size={22} color={colors.white} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.pkgKind}>{ACCESS_PACKAGE_KIND_LABELS[order.kind]}</Text>
                <Text style={styles.pkgName}>{order.package_name}</Text>
                <Text style={styles.small}>
                  {[order.exam_part_name, order.exam_subject_name, `${durationLabel(order.duration_days)} access`]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Text style={styles.itemPrice}>{formatBdt(order.price)}</Text>
            </View>
          )}
          <View style={styles.totals}>
            <Row label="Package price" value={formatBdt(cart?.price ?? order.price)} />
            {(cart?.charge ?? order.charge) > 0 ? (
              <Row label={order.charge_label} value={formatBdt(cart?.charge ?? order.charge)} />
            ) : null}
            <Row label="Total" value={formatBdt(total)} />
          </View>
        </View>

        <View style={styles.bkCard}>
          <View style={styles.bkHeader}>
            <Text style={styles.bkBrand}>bKash Send Money</Text>
            <Text style={styles.bkSelected}>Selected</Text>
          </View>
          <View style={styles.bkBody}>
            <Text style={styles.bkInstruction}>
              Send the amount below to this bKash number, then fill in your TrxID.
            </Text>
            <View style={styles.bkInfoGrid}>
              <View style={styles.bkInfoBox}>
                <Text style={styles.bkInfoLabel}>bKash number</Text>
                <Text style={styles.bkInfoValue}>{bkashNumber || '—'}</Text>
              </View>
              <View style={styles.bkInfoBox}>
                <Text style={styles.bkInfoLabel}>Amount to send</Text>
                <Text style={styles.bkInfoValue}>{formatBdt(total)}</Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>Transaction ID (TrxID) *</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="e.g. BK7X92QA41"
              placeholderTextColor={colors.textMuted}
              value={trxId}
              onChangeText={setTrxId}
            />

            <Text style={styles.fieldLabel}>Amount sent (৳) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder={String(total)}
              placeholderTextColor={colors.textMuted}
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
            />

            <Text style={styles.fieldLabel}>Your bKash number (optional)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              maxLength={11}
              placeholder="01XXXXXXXXX"
              placeholderTextColor={colors.textMuted}
              value={sender}
              onChangeText={(v) => setSender(v.replace(/\D/g, '').slice(0, 11))}
            />

            <View style={styles.lockRow}>
              <Ionicons name="lock-closed-outline" size={14} color={BKASH} />
              <Text style={styles.lockText}>
                Never enter PIN or OTP here. Only submit the TrxID you received after payment.
              </Text>
            </View>
          </View>
        </View>

        <Pressable onPress={() => setAgree((v) => !v)} style={styles.check}>
          <Ionicons
            name={agree ? 'checkbox' : 'square-outline'}
            size={18}
            color={agree ? BKASH : colors.textMuted}
          />
          <Text style={styles.checkText}>
            I verified the order details and am submitting payment information.
          </Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={() => void submitClaim()}
          disabled={busy}
          style={({ pressed }) => [styles.bkashBtn, (pressed || busy) && styles.pressed]}
        >
          {busy ? <ActivityIndicator color={colors.white} /> : null}
          <Text style={styles.primaryBtnText}>Submit bKash payment</Text>
        </Pressable>
        <Pressable onPress={() => void close()} disabled={busy} style={styles.outlineBtn}>
          <Text style={styles.outlineBtnText}>Cancel and go back</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  centerBox: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  pressed: { opacity: 0.7 },
  small: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '700' },
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center' },
  pollHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  pageTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  pageSub: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: -6 },

  statusHero: { alignItems: 'center', gap: 6, paddingVertical: spacing.md },
  statusTitle: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  statusText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  pkgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pkgIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0a2f5b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pkgKind: { fontSize: 11, fontWeight: '700', color: '#1566b8' },
  pkgName: { fontSize: 15, fontWeight: '800', color: colors.text },
  totals: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 6 },

  receipt: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text, textAlign: 'right' },
  itemName: { fontSize: 14, fontWeight: '700', color: colors.text },
  itemPrice: { fontSize: 14, fontWeight: '700', color: colors.text },
  flex: { flex: 1, minWidth: 0 },

  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  bkashBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: BKASH,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  outlineBtnText: { color: colors.text, fontWeight: '700', fontSize: 14 },

  bkCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f5a3c0',
    overflow: 'hidden',
  },
  bkHeader: {
    backgroundColor: BKASH,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bkBrand: { color: colors.white, fontSize: 15, fontWeight: '800' },
  bkSelected: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bkBody: { padding: spacing.md, gap: spacing.sm },
  bkInstruction: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  bkInfoGrid: { flexDirection: 'row', gap: 8 },
  bkInfoBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#f5a3c0',
    backgroundColor: '#fff7fa',
    borderRadius: 12,
    padding: 10,
  },
  bkInfoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: BKASH,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bkInfoValue: { marginTop: 4, fontSize: 18, fontWeight: '900', color: '#9f1239' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#9f1239', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#f5a3c0',
    backgroundColor: '#fff7fa',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  lockRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
  lockText: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  checkText: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
});
