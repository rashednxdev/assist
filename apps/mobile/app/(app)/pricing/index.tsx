import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { AccessPackageKind } from '@ibas/shared-constants';
import { computeCharge, formatBdt, roundTaka, type AccessPackageRecord, type BillingCatalog } from '@ibas/shared-types';
import { EmptyState } from '@/components/contacts/ContactBits';
import { openSupportWhatsApp } from '@/lib/contact';
import {
  BKASH,
  PACKAGE_TABS,
  accessDate,
  accessDateTime,
  createOrder,
  currentUntil,
  durationLabel,
  fetchCatalog,
  isPackageKind,
  purchaseWindow,
} from '@/lib/billing-api';
import { colors, spacing } from '@/theme';

function Notice({ tone, icon, children }: { tone: 'success' | 'error'; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const c = tone === 'success' ? { bg: '#ecfdf5', border: '#a7f3d0', fg: '#065f46' } : { bg: '#fef2f2', border: '#fecaca', fg: '#991b1b' };
  return (
    <View style={[styles.notice, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Ionicons name={icon} size={18} color={c.fg} />
      <Text style={[styles.noticeText, { color: c.fg }]}>{children}</Text>
    </View>
  );
}

function PackageCard({
  pkg,
  owned,
  disabled,
  onBuy,
}: {
  pkg: AccessPackageRecord;
  owned?: string;
  disabled: boolean;
  onBuy: () => void;
}) {
  const upcoming = pkg.upcoming_classes ?? [];
  return (
    <View style={[styles.card, pkg.is_featured && styles.cardFeatured]}>
      {pkg.is_featured || owned ? (
        <View style={styles.badges}>
          {pkg.is_featured ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Ionicons name="sparkles" size={11} color={colors.white} />
              <Text style={styles.badgeText}>Popular</Text>
            </View>
          ) : null}
          {owned ? (
            <View style={[styles.badge, { backgroundColor: colors.success }]}>
              <Text style={styles.badgeText}>Active until {accessDate(owned)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.cardTitle}>{pkg.name}</Text>
      {pkg.name_bn ? <Text style={styles.cardTitleBn}>{pkg.name_bn}</Text> : null}

      <View style={styles.priceRow}>
        <Text style={styles.price}>{pkg.price === 0 ? 'Free' : formatBdt(pkg.price)}</Text>
        {pkg.compare_at_price ? <Text style={styles.comparePrice}>{formatBdt(pkg.compare_at_price)}</Text> : null}
        <Text style={styles.per}>/ {durationLabel(pkg.duration_days)}</Text>
      </View>

      {pkg.description ? <Text style={styles.description}>{pkg.description}</Text> : null}

      {pkg.features.length > 0 ? (
        <View style={styles.features}>
          {pkg.features.map((f) => (
            <View key={f} style={styles.feature}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {pkg.kind === 'live' ? (
        <View style={styles.liveBox}>
          <View style={styles.feature}>
            <Ionicons name="videocam" size={16} color={colors.primary} />
            <Text style={[styles.featureText, styles.bold]}>
              {pkg.class_count ?? 0} class{pkg.class_count === 1 ? '' : 'es'} in this package
            </Text>
          </View>
          {upcoming.length > 0 ? (
            upcoming.map((c) => (
              <View key={c.id} style={styles.feature}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={styles.small}>
                  <Text style={{ color: colors.text }}>{c.topic}</Text> · {accessDateTime(c.scheduled_at)}
                  {c.status === 'live' ? <Text style={styles.liveNow}>  LIVE NOW</Text> : null}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.small}>Upcoming classes will be announced.</Text>
          )}
        </View>
      ) : null}

      <Pressable
        onPress={onBuy}
        disabled={disabled}
        style={({ pressed }) => [styles.buyBtn, disabled && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={styles.buyBtnText}>{owned ? 'Extend' : pkg.price === 0 ? 'Get it free' : 'Buy now'}</Text>
      </Pressable>
    </View>
  );
}

function CheckoutSheet({
  catalog,
  pkg,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  catalog: BillingCatalog;
  pkg: AccessPackageRecord;
  busy: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const charge = computeCharge(pkg.price, catalog.settings);
  const total = roundTaka(pkg.price + charge);
  const span = purchaseWindow(catalog, pkg);
  const tab = PACKAGE_TABS.find((t) => t.id === pkg.kind)!;
  const { charge_label, charge_type, charge_value, checkout_note } = catalog.settings;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.sheetHead}>
          <View style={styles.flex}>
            <Text style={styles.sheetKicker}>{tab.label.toUpperCase()}</Text>
            <Text style={styles.sheetTitle}>{pkg.name}</Text>
            {pkg.exam_subject_name ? <Text style={styles.small}>{pkg.exam_subject_name}</Text> : null}
          </View>
          <Pressable onPress={onClose} hitSlop={10} disabled={busy}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.sheetBody}>
          <View style={styles.line}>
            <Text style={styles.lineLabel}>Package price</Text>
            <Text style={styles.lineValue}>{formatBdt(pkg.price)}</Text>
          </View>
          <View style={styles.line}>
            <Text style={styles.lineLabel}>
              {charge_label}
              {charge_type === 'percent' && charge > 0 ? ` (${charge_value}%)` : ''}
            </Text>
            <Text style={styles.lineValue}>{formatBdt(charge)}</Text>
          </View>
          <View style={[styles.line, styles.totalLine]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalLabel}>{formatBdt(total)}</Text>
          </View>

          <View style={styles.accessBox}>
            <View style={styles.feature}>
              <Ionicons name="shield-checkmark" size={16} color={colors.primaryDark} />
              <Text style={[styles.featureText, styles.bold, { color: colors.primaryDark }]}>
                Access for {durationLabel(pkg.duration_days)}
              </Text>
            </View>
            <Text style={styles.small}>
              {accessDate(span.start.toISOString())} → {accessDate(span.end.toISOString())}
              {span.extends ? ' (starts when your current access ends)' : ''}
            </Text>
            <Text style={styles.small}>{pkg.kind === 'live' ? 'Opens every class in this package.' : `Opens ${tab.blurb}`}</Text>
          </View>

          {checkout_note ? <Text style={styles.small}>{checkout_note}</Text> : null}
          {error ? <Notice tone="error" icon="alert-circle-outline">{error}</Notice> : null}

          <Pressable
            onPress={onConfirm}
            disabled={busy}
            style={({ pressed }) => [styles.payBtn, (pressed || busy) && styles.pressed]}
          >
            {busy ? <ActivityIndicator color={colors.white} /> : null}
            <Text style={styles.buyBtnText}>{total === 0 ? 'Confirm' : `Pay ${formatBdt(total)} with bKash`}</Text>
          </Pressable>
          <Text style={[styles.small, styles.center]}>Demo payment — no real money is charged.</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function PricingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<AccessPackageKind>(isPackageKind(params.tab) ? params.tab : 'exam_prep');
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<AccessPackageRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [buyError, setBuyError] = useState('');

  useEffect(() => {
    if (isPackageKind(params.tab)) setTab(params.tab);
  }, [params.tab]);

  const load = useCallback(async () => {
    try {
      setCatalog(await fetchCatalog());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load packages');
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

  const inTab = useMemo(() => (catalog?.packages ?? []).filter((p) => p.kind === tab), [catalog, tab]);
  const examGroups = useMemo(() => {
    if (tab !== 'exam_prep') return [];
    const groups = new Map<string, AccessPackageRecord[]>();
    for (const p of inTab) {
      const key = p.exam_subject_name ?? 'All subjects';
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    return [...groups.entries()];
  }, [inTab, tab]);

  const tabMeta = PACKAGE_TABS.find((t) => t.id === tab)!;
  const activeUntil =
    catalog && tab === 'exam_prep' ? catalog.access.exam_prep_until : catalog && tab === 'basic' ? catalog.access.basic_until : undefined;

  async function buy() {
    if (!selected) return;
    setBusy(true);
    setBuyError('');
    try {
      const order = await createOrder(selected.id);
      setSelected(null);
      router.push(`/(app)/pricing/checkout/${order.id}` as Href);
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : 'Could not start the payment');
    } finally {
      setBusy(false);
    }
  }

  function cards(list: AccessPackageRecord[]) {
    return list.map((p) => (
      <PackageCard
        key={p.id}
        pkg={p}
        owned={catalog ? currentUntil(catalog, p) : undefined}
        disabled={!catalog?.settings.gateway_enabled && p.price > 0}
        onBuy={() => {
          setBuyError('');
          setSelected(p);
        }}
      />
    ));
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <LinearGradient colors={[colors.primaryDark, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroTitle}>Choose a package</Text>
          <Text style={styles.heroText}>Pay with bKash — access opens as soon as the payment succeeds.</Text>
          <Pressable
            onPress={() => router.push('/(app)/pricing/payments' as Href)}
            style={({ pressed }) => [styles.heroBtn, pressed && styles.pressed]}
          >
            <Ionicons name="receipt-outline" size={16} color={colors.white} />
            <Text style={styles.heroBtnText}>Payments & access</Text>
          </Pressable>
        </LinearGradient>

        <View style={styles.tabs}>
          {PACKAGE_TABS.map((t) => {
            const on = t.id === tab;
            return (
              <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, on && styles.tabOn]}>
                <Ionicons name={t.icon} size={16} color={on ? colors.white : colors.textMuted} />
                <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.blurb}>{tabMeta.blurb}</Text>

        {error ? <Notice tone="error" icon="alert-circle-outline">{error}</Notice> : null}
        {catalog && !catalog.settings.gateway_enabled ? (
          <View style={styles.pausedBox}>
            <Notice tone="error" icon="pause-circle-outline">
              Online payments are paused right now. Please message us on WhatsApp to buy a package.
            </Notice>
            <Pressable
              onPress={() => openSupportWhatsApp(`Hi, I'd like to buy a ${tabMeta.label} package on ProAssist.`)}
              style={({ pressed }) => [styles.waBtn, pressed && styles.pressed]}
            >
              <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
              <Text style={styles.buyBtnText}>Message us on WhatsApp</Text>
            </Pressable>
          </View>
        ) : null}
        {activeUntil ? (
          <Notice tone="success" icon="checkmark-circle-outline">
            Your {tabMeta.label} access is active until {accessDate(activeUntil)}. Buying again extends it.
          </Notice>
        ) : null}
        {catalog && tab === 'live' && catalog.access.live_packages.length > 0 ? (
          <Notice tone="success" icon="checkmark-circle-outline">
            You own: {catalog.access.live_packages.map((p) => `${p.package_name} (until ${accessDate(p.until)})`).join(', ')}
          </Notice>
        ) : null}

        {!catalog && !error ? (
          <ActivityIndicator style={styles.loading} color={colors.primary} />
        ) : catalog && inTab.length === 0 ? (
          <EmptyState icon="pricetags-outline" title="No packages yet" text="Packages for this section will be available soon." />
        ) : tab === 'exam_prep' ? (
          <>
            <Text style={styles.small}>
              Pick your exam subject. Any Exam Preparation package opens every exam-prep module for its period.
            </Text>
            {examGroups.map(([subject, list]) => (
              <View key={subject} style={styles.group}>
                <Text style={styles.groupTitle}>{subject}</Text>
                {cards(list)}
              </View>
            ))}
          </>
        ) : (
          cards(inTab)
        )}
      </ScrollView>

      {catalog && selected ? (
        <CheckoutSheet
          catalog={catalog}
          pkg={selected}
          busy={busy}
          error={buyError}
          onConfirm={() => void buy()}
          onClose={() => !busy && setSelected(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  bold: { fontWeight: '700' },
  center: { textAlign: 'center' },
  loading: { marginTop: spacing.xl },
  small: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },

  hero: { borderRadius: 18, padding: spacing.lg, gap: spacing.sm },
  heroTitle: { color: colors.white, fontSize: 22, fontWeight: '800' },
  heroText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  heroBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 4,
  },
  heroBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  tabOn: { backgroundColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textMuted, flexShrink: 1 },
  tabTextOn: { color: colors.white },
  blurb: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },

  notice: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 12, padding: spacing.sm, alignItems: 'flex-start' },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  pausedBox: { gap: spacing.sm },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 12,
  },

  group: { gap: spacing.sm },
  groupTitle: { fontSize: 16, fontWeight: '800', color: colors.text },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardFeatured: { borderColor: colors.primary, borderWidth: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  cardTitleBn: { fontSize: 14, color: colors.textMuted, marginTop: -4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  price: { fontSize: 28, fontWeight: '800', color: colors.text },
  comparePrice: { fontSize: 14, color: colors.textMuted, textDecorationLine: 'line-through' },
  per: { fontSize: 13, color: colors.textMuted },
  description: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  features: { gap: 6 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },
  liveBox: { backgroundColor: colors.background, borderRadius: 12, padding: spacing.sm, gap: 6 },
  liveNow: { color: colors.error, fontWeight: '800', fontSize: 11 },
  buyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  buyBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textMuted },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2 },
  sheetBody: { padding: spacing.md, gap: spacing.sm },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  lineLabel: { flex: 1, fontSize: 14, color: colors.textMuted },
  lineValue: { fontSize: 14, color: colors.text },
  totalLine: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  totalLabel: { fontSize: 16, fontWeight: '800', color: colors.text },
  accessBox: { backgroundColor: '#eff6ff', borderRadius: 12, padding: spacing.sm, gap: 4 },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BKASH,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
});
