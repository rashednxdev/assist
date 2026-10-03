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
  DEMO_BKASH_OTP,
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
  createCart,
  createOrder,
  durationLabel,
  fetchCart,
  fetchOrder,
  payCart,
  payOrder,
} from '@/lib/billing-api';
import { colors, spacing } from '@/theme';

type Step = 'number' | 'otp' | 'pin';

const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

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
      <Row label="Total paid" value={formatBdt(order.total)} />
      <Row label="Method" value={PAYMENT_METHOD_LABELS[order.method]} />
      {order.payer_account ? <Row label="bKash account" value={order.payer_account} /> : null}
      {order.trx_id ? <Row label="Transaction ID" value={order.trx_id} mono /> : null}
      <Row label="Invoice" value={order.invoice_no} mono />
      {order.paid_at ? <Row label="Paid at" value={accessDateTime(order.paid_at)} /> : null}
      <Row label="Access" value={`${accessDate(order.access_starts_at)} → ${accessDate(order.access_ends_at)}`} />
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
        <Row label="Total paid" value={formatBdt(cart.total)} />
        <Row label="Method" value={PAYMENT_METHOD_LABELS[cart.method]} />
        {cart.payer_account ? <Row label="bKash account" value={cart.payer_account} /> : null}
        {cart.trx_id ? <Row label="Transaction ID" value={cart.trx_id} mono /> : null}
        {cart.paid_at ? <Row label="Paid at" value={accessDateTime(cart.paid_at)} /> : null}
      </View>
    </>
  );
}

function Check({ label, value, onChange, tone }: { label: string; value: boolean; onChange: (v: boolean) => void; tone?: 'amber' }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={[styles.check, tone === 'amber' && styles.checkAmber]}>
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={18}
        color={tone === 'amber' ? '#92400e' : value ? BKASH : colors.textMuted}
      />
      <Text style={[styles.checkText, tone === 'amber' && { color: '#78350f' }]}>{label}</Text>
    </Pressable>
  );
}

function StatusHero({ icon, color, title, text }: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; text: string }) {
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
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState<Step>('number');
  const [msisdn, setMsisdn] = useState('');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [agree, setAgree] = useState(true);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refreshedFor = useRef<string | null>(null);

  const load = useCallback(async (id: string) => {
    try {
      const o = await fetchOrder(id);
      if (o.cart_id) {
        const c = await fetchCart(o.cart_id);
        setCart(c);
        setOrder(c.orders.find((x) => x.id === o.id) ?? o);
      } else {
        setCart(null);
        setOrder(o);
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
      void refreshUser().catch(() => {});
    }
  }, [order, refreshUser]);

  function backToPricing(kind?: PaymentOrderRecord['kind']) {
    router.dismissTo(`/(app)/pricing?tab=${kind ?? 'exam_prep'}` as Href);
  }

  function next() {
    setError('');
    if (step === 'number') {
      if (!/^01[3-9]\d{8}$/.test(msisdn)) return setError('Enter your 11-digit bKash account number');
      if (!agree) return setError('Please accept the terms to continue');
      setStep('otp');
    } else if (step === 'otp') {
      if (otp !== DEMO_BKASH_OTP) return setError('Wrong verification code');
      setStep('pin');
    } else {
      if (!/^\d{5}$/.test(pin)) return setError('Enter your 5-digit PIN');
      void pay();
    }
  }

  async function pay() {
    if (!order) return;
    setBusy(true);
    try {
      const body = { msisdn, otp, pin, simulate_failure: simulateFailure || undefined };
      if (cart) {
        const c = await payCart(cart.cart_id, body);
        setCart(c);
        setOrder(c.orders.find((x) => x.id === order.id) ?? c.orders[0]!);
      } else {
        setOrder(await payOrder(order.id, body));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (!order) return backToPricing();
    if (order.status === 'pending') {
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
      } else {
        fresh = await createOrder(order.package_id);
      }
      setStep('number');
      setOtp('');
      setPin('');
      setSimulateFailure(false);
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
          title={(cart?.total ?? order.total) > 0 ? 'Payment successful' : multi ? 'Packages added' : 'Package added'}
          text={
            multi
              ? `${cart.orders.length} packages are now on your account.`
              : `Your access is active${later ? ` from ${accessDate(order.access_starts_at)}` : ''} until ${accessDate(order.access_ends_at)}.`
          }
        />
        {multi ? <CartReceipt cart={cart} /> : <Receipt order={order} />}
        <Pressable onPress={() => router.dismissTo(open.href)} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
          <Text style={styles.primaryBtnText}>{open.label}</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(app)/pricing/payments' as Href)} style={styles.outlineBtn}>
          <Text style={styles.outlineBtnText}>Payment history</Text>
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
          title="Payment failed"
          text={`${order.failure_reason ?? 'The payment did not go through.'} No money was taken.`}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable onPress={() => void retry()} disabled={busy} style={({ pressed }) => [styles.bkashBtn, (pressed || busy) && styles.pressed]}>
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
        <Pressable onPress={() => backToPricing(order.kind)} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
          <Text style={styles.primaryBtnText}>Back to pricing</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.bkCard}>
          <View style={styles.bkHeader}>
            <View style={styles.bkTop}>
              <Text style={styles.bkBrand}>bKash</Text>
              <View style={styles.demoPill}>
                <Text style={styles.demoPillText}>DEMO</Text>
              </View>
            </View>
            <View style={styles.bkMerchant}>
              <View style={styles.bkLogo}>
                <Text style={styles.bkLogoText}>PA</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.bkName}>ProAssist</Text>
                <Text style={styles.bkSub} numberOfLines={1}>
                  {cart ? `${cart.orders.length} package${cart.orders.length === 1 ? '' : 's'}` : `Invoice: ${order.invoice_no}`}
                </Text>
              </View>
              <View style={styles.bkAmountBox}>
                <Text style={styles.bkAmount}>{formatBdt(cart?.total ?? order.total)}</Text>
                {(cart?.charge ?? order.charge) > 0 ? (
                  <Text style={styles.bkSub}>
                    incl. {order.charge_label} {formatBdt(cart?.charge ?? order.charge)}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.bkBody}>
            {cart ? (
              <CartItems cart={cart} />
            ) : (
              <Text style={styles.bkSummary}>
                {order.package_name} · {durationLabel(order.duration_days)} · access {accessDate(order.access_starts_at)} →{' '}
                {accessDate(order.access_ends_at)}
              </Text>
            )}

            {step === 'number' ? (
              <>
                <Text style={styles.bkLabel}>Your bKash Account number</Text>
                <TextInput
                  style={styles.bkInput}
                  keyboardType="number-pad"
                  placeholder="e.g 01XXXXXXXXX"
                  placeholderTextColor={colors.textMuted}
                  value={msisdn}
                  onChangeText={(v) => setMsisdn(digits(v, 11))}
                  onSubmitEditing={next}
                  autoFocus
                />
                <Check label="By tapping Confirm, you are agreeing to the terms & conditions." value={agree} onChange={setAgree} />
                <Check
                  label={'Demo: simulate "insufficient balance" to see a failed payment.'}
                  value={simulateFailure}
                  onChange={setSimulateFailure}
                  tone="amber"
                />
              </>
            ) : step === 'otp' ? (
              <>
                <Text style={styles.bkLabel}>
                  Enter the verification code sent to {msisdn.slice(0, 3)}•••••{msisdn.slice(-3)}
                </Text>
                <TextInput
                  style={[styles.bkInput, styles.bkInputWide]}
                  keyboardType="number-pad"
                  placeholder="Verification code"
                  placeholderTextColor={colors.textMuted}
                  value={otp}
                  onChangeText={(v) => setOtp(digits(v, 6))}
                  onSubmitEditing={next}
                  autoFocus
                />
                <Text style={styles.bkHint}>
                  Demo code: <Text style={styles.mono}>{DEMO_BKASH_OTP}</Text>
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.bkLabel}>Enter PIN of your bKash Account number</Text>
                <TextInput
                  style={[styles.bkInput, styles.bkInputWide]}
                  keyboardType="number-pad"
                  secureTextEntry
                  placeholder="Enter PIN"
                  placeholderTextColor={colors.textMuted}
                  value={pin}
                  onChangeText={(v) => setPin(digits(v, 5))}
                  onSubmitEditing={next}
                  autoFocus
                />
                <Text style={styles.bkHint}>Demo: any 5 digits work.</Text>
              </>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <View style={styles.bkActions}>
            <Pressable onPress={() => void close()} disabled={busy} style={[styles.bkClose, busy && styles.pressed]}>
              <Text style={styles.bkCloseText}>Close</Text>
            </Pressable>
            <Pressable onPress={next} disabled={busy} style={[styles.bkConfirm, busy && styles.pressed]}>
              {busy ? <ActivityIndicator color={colors.white} size="small" /> : null}
              <Text style={styles.primaryBtnText}>{step === 'pin' ? 'Confirm payment' : 'Confirm'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.demoNote}>
          <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
          <Text style={styles.small}>Demo gateway — no real bKash payment is made.</Text>
        </View>
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
  small: { fontSize: 12, color: colors.textMuted },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '700' },
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center' },

  statusHero: { alignItems: 'center', gap: 6, paddingVertical: spacing.md },
  statusTitle: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  statusText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

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

  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', alignSelf: 'stretch' },
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  bkHeader: { backgroundColor: BKASH, paddingBottom: spacing.md },
  bkTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md },
  bkBrand: { color: colors.white, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  demoPill: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  demoPillText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  bkMerchant: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  bkLogo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  bkLogoText: { color: BKASH, fontWeight: '800', fontSize: 14 },
  bkName: { color: colors.white, fontWeight: '700', fontSize: 15 },
  bkSub: { color: 'rgba(255,255,255,0.82)', fontSize: 11 },
  bkAmountBox: { alignItems: 'flex-end' },
  bkAmount: { color: colors.white, fontWeight: '800', fontSize: 20 },
  bkBody: { padding: spacing.md, gap: spacing.sm },
  bkSummary: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  bkLabel: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'center', marginTop: spacing.xs },
  bkInput: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 2,
    color: colors.text,
  },
  bkInputWide: { letterSpacing: 8 },
  bkHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  checkAmber: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: spacing.sm,
  },
  checkText: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  bkActions: { flexDirection: 'row' },
  bkClose: { flex: 1, backgroundColor: '#e2e8f0', paddingVertical: 15, alignItems: 'center' },
  bkCloseText: { color: '#334155', fontWeight: '700', fontSize: 14 },
  bkConfirm: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: BKASH,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
