import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  computeCartCharge,
  formatBdt,
  roundTaka,
  type AccessPackageRecord,
  type BillingCatalog,
  type ExamPrepPartOption,
} from '@ibas/shared-types';
import { BKASH, accessDate, durationLabel } from '@/lib/billing-api';
import { colors, spacing } from '@/theme';

interface Group {
  id: string;
  label: string;
  isPrimary: boolean;
  subjectOrder: string[];
}

interface SubjectRow {
  id: string;
  name: string;
  packages: AccessPackageRecord[];
}

const LEGACY_GROUP = 'legacy';
const bundleKey = (groupId: string) => `bundle|${groupId}`;
const subjectKey = (subjectId: string) => `subject|${subjectId}`;

function byDuration(a: AccessPackageRecord, b: AccessPackageRecord): number {
  return a.duration_days - b.duration_days || a.price - b.price;
}

function later(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function inGroup(p: AccessPackageRecord, g: Group): boolean {
  return p.exam_part_id ? p.exam_part_id === g.id : g.isPrimary;
}

function buildGroups(parts: ExamPrepPartOption[], packages: AccessPackageRecord[]): Group[] {
  const all: Group[] =
    parts.length > 0
      ? parts.map((p) => ({ id: p.id, label: p.label, isPrimary: p.is_primary, subjectOrder: p.subjects.map((s) => s.id) }))
      : [...new Map(packages.map((p) => [p.exam_part_id ?? LEGACY_GROUP, p])).entries()].map(([id, p]) => ({
          id,
          label: p.exam_part_name ?? 'All subjects',
          isPrimary: !p.exam_part_id,
          subjectOrder: [],
        }));
  return all.filter((g) => packages.some((p) => inGroup(p, g)));
}

export type ExamPrepBasket = ReturnType<typeof useExamPrepBasket>;

export function useExamPrepBasket(catalog: BillingCatalog | null, parts: ExamPrepPartOption[], initialPart?: string) {
  const [active, setActive] = useState(initialPart ?? '');
  const [picked, setPicked] = useState<Record<string, string>>({});

  const packages = useMemo(() => (catalog?.packages ?? []).filter((p) => p.kind === 'exam_prep'), [catalog]);
  const groups = useMemo(() => buildGroups(parts, packages), [parts, packages]);
  const group = groups.find((g) => g.id === active) ?? groups[0];

  const bundles = useMemo(
    () => (group ? packages.filter((p) => !p.exam_subject_id && inGroup(p, group)).sort(byDuration) : []),
    [packages, group],
  );

  const subjects = useMemo<SubjectRow[]>(() => {
    if (!group) return [];
    const rows = new Map<string, SubjectRow>();
    for (const p of packages) {
      if (!p.exam_subject_id || !inGroup(p, group)) continue;
      const row = rows.get(p.exam_subject_id) ?? { id: p.exam_subject_id, name: p.exam_subject_name ?? 'Subject', packages: [] };
      row.packages.push(p);
      rows.set(p.exam_subject_id, row);
    }
    const rank = (id: string) => {
      const i = group.subjectOrder.indexOf(id);
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...rows.values()]
      .map((r) => ({ ...r, packages: r.packages.sort(byDuration) }))
      .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
  }, [packages, group]);

  const access = catalog?.access.exam_prep_access ?? [];
  const partUntil = (groupId: string) =>
    access.filter((a) => a.exam_part_id === groupId && !a.exam_subject_id).reduce<string | undefined>((m, a) => later(m, a.until), undefined);
  const subjectUntil = (groupId: string, subjectId: string) =>
    later(
      partUntil(groupId),
      access.filter((a) => a.exam_subject_id === subjectId).reduce<string | undefined>((m, a) => later(m, a.until), undefined),
    );

  const byId = useMemo(() => new Map(packages.map((p) => [p.id, p])), [packages]);
  const chosen = useMemo(
    () => [...new Set(Object.values(picked))].map((id) => byId.get(id)).filter((p): p is AccessPackageRecord => !!p),
    [picked, byId],
  );
  const subtotal = roundTaka(chosen.reduce((s, p) => s + p.price, 0));
  const charge = catalog
    ? computeCartCharge(
        chosen.map((p) => p.price),
        catalog.settings,
      )
    : 0;

  function countFor(g: Group): number {
    return Object.entries(picked).filter(([k, id]) => {
      if (k === bundleKey(g.id)) return true;
      const p = byId.get(id);
      return k.startsWith('subject|') && !!p && inGroup(p, g);
    }).length;
  }

  function toggleBundle(pkg: AccessPackageRecord) {
    if (!group) return;
    setPicked((cur) => {
      const next = { ...cur };
      const key = bundleKey(group.id);
      if (next[key] === pkg.id) {
        delete next[key];
        return next;
      }
      next[key] = pkg.id;
      for (const s of subjects) delete next[subjectKey(s.id)];
      return next;
    });
  }

  function toggleSubject(subjectId: string, pkg: AccessPackageRecord) {
    setPicked((cur) => {
      const next = { ...cur };
      const key = subjectKey(subjectId);
      if (next[key] === pkg.id) delete next[key];
      else next[key] = pkg.id;
      return next;
    });
  }

  function pickAllSubjects() {
    setPicked((cur) => {
      const next = { ...cur };
      for (const s of subjects) if (!next[subjectKey(s.id)]) next[subjectKey(s.id)] = s.packages[0]!.id;
      return next;
    });
  }

  function bundleSaving(pkg: AccessPackageRecord): number {
    if (subjects.length < 2) return 0;
    let sum = 0;
    for (const s of subjects) {
      const same = s.packages.find((p) => p.duration_days === pkg.duration_days);
      if (!same) return 0;
      sum += same.price;
    }
    return roundTaka(sum - pkg.price);
  }

  return {
    groups,
    group,
    setActive,
    bundles,
    subjects,
    picked,
    bundlePicked: group ? picked[bundleKey(group.id)] : undefined,
    pickedSubject: (subjectId: string) => picked[subjectKey(subjectId)],
    chosen,
    subtotal,
    charge,
    total: roundTaka(subtotal + charge),
    partUntil,
    subjectUntil,
    countFor,
    toggleBundle,
    toggleSubject,
    pickAllSubjects,
    bundleSaving,
    clear: () => setPicked({}),
  };
}

export function ExamPrepShop({ basket }: { basket: ExamPrepBasket }) {
  const { groups, group, bundles, subjects, bundlePicked } = basket;
  if (!group) return null;
  const groupUntil = basket.partUntil(group.id);
  const owned = subjects.filter((s) => basket.subjectUntil(group.id, s.id)).length;
  const pickedInGroup = subjects.filter((s) => basket.pickedSubject(s.id)).length;

  return (
    <View style={styles.wrap}>
      {groups.length > 1 ? (
        <View style={styles.partTabs}>
          {groups.map((g) => {
            const on = g.id === group.id;
            const count = basket.countFor(g);
            return (
              <Pressable key={g.id} onPress={() => basket.setActive(g.id)} style={[styles.partTab, on && styles.partTabOn]}>
                <Ionicons name="layers-outline" size={15} color={on ? colors.white : colors.textMuted} />
                <Text style={[styles.partTabText, on && styles.partTabTextOn]} numberOfLines={1}>
                  {g.label}
                </Text>
                {count > 0 ? (
                  <View style={[styles.countPill, on && styles.countPillOn]}>
                    <Text style={[styles.countText, on && styles.partTabTextOn]}>{count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {groupUntil ? (
        <View style={styles.ownedBox}>
          <Ionicons name="checkmark-circle" size={18} color="#065f46" />
          <Text style={styles.ownedText}>
            You have every subject of {group.label} until {accessDate(groupUntil)}. Buying again extends it.
          </Text>
        </View>
      ) : owned > 0 ? (
        <View style={styles.ownedBox}>
          <Ionicons name="checkmark-circle" size={18} color="#065f46" />
          <Text style={styles.ownedText}>
            You own {owned} of {subjects.length} subject{subjects.length === 1 ? '' : 's'} in {group.label}.
          </Text>
        </View>
      ) : null}

      {bundles.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Whole {group.label}</Text>
          <Text style={styles.small}>One package that opens every subject of {group.label}.</Text>
          {bundles.map((p) => {
            const on = bundlePicked === p.id;
            const save = basket.bundleSaving(p);
            return (
              <Pressable
                key={p.id}
                onPress={() => basket.toggleBundle(p)}
                style={({ pressed }) => [styles.bundle, on && styles.bundleOn, pressed && styles.pressed]}
              >
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? colors.primary : colors.textMuted} />
                <View style={styles.flex}>
                  <View style={styles.badges}>
                    {p.is_featured ? (
                      <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>Popular</Text>
                      </View>
                    ) : null}
                    {save > 0 ? (
                      <View style={[styles.badge, { backgroundColor: colors.success }]}>
                        <Text style={styles.badgeText}>Save {formatBdt(save)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.bundleName}>{p.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{p.price === 0 ? 'Free' : formatBdt(p.price)}</Text>
                    {p.compare_at_price ? <Text style={styles.compare}>{formatBdt(p.compare_at_price)}</Text> : null}
                    <Text style={styles.small}>/ {durationLabel(p.duration_days)}</Text>
                  </View>
                  {p.features.slice(0, 4).map((f) => (
                    <View key={f} style={styles.feature}>
                      <Ionicons name="checkmark" size={14} color={colors.primary} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {subjects.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>{bundles.length > 0 ? 'Or pick subjects' : `Subjects of ${group.label}`}</Text>
              <Text style={styles.small}>You only see questions, papers and reviews of the subjects you own.</Text>
            </View>
            {!bundlePicked && subjects.length > 1 && pickedInGroup < subjects.length ? (
              <Pressable onPress={basket.pickAllSubjects} style={({ pressed }) => [styles.allBtn, pressed && styles.pressed]}>
                <Text style={styles.allBtnText}>Select all</Text>
              </Pressable>
            ) : null}
          </View>
          {bundlePicked ? <Text style={styles.included}>Every subject is included in the whole-part package in your basket.</Text> : null}
          <View style={[styles.subjectList, !!bundlePicked && styles.dim]}>
            {subjects.map((s, i) => {
              const until = basket.subjectUntil(group.id, s.id);
              const sel = basket.pickedSubject(s.id);
              return (
                <View key={s.id} style={[styles.subject, i > 0 && styles.subjectBorder]}>
                  <View style={styles.subjectHead}>
                    <Ionicons
                      name={sel ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={sel ? colors.primary : colors.textMuted}
                    />
                    <Text style={styles.subjectName}>{s.name}</Text>
                  </View>
                  {until ? <Text style={styles.activeText}>Active until {accessDate(until)}</Text> : null}
                  <View style={styles.chips}>
                    {s.packages.map((p) => {
                      const on = sel === p.id;
                      return (
                        <Pressable
                          key={p.id}
                          disabled={!!bundlePicked}
                          onPress={() => basket.toggleSubject(s.id, p)}
                          style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
                        >
                          <Text style={[styles.chipPrice, on && styles.chipTextOn]}>
                            {p.price === 0 ? 'Free' : formatBdt(p.price)}
                          </Text>
                          <Text style={[styles.chipPer, on && styles.chipTextOn]}>/ {durationLabel(p.duration_days)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <Text style={styles.small}>
        Access starts today, or when your current access to the same subject or part ends. Live classes are sold in the Live
        class tab; Question of the Day stays free.
      </Text>
    </View>
  );
}

export function BasketBar({
  basket,
  catalog,
  busy,
  error,
  onPay,
}: {
  basket: ExamPrepBasket;
  catalog: BillingCatalog;
  busy: boolean;
  error: string;
  onPay: () => void;
}) {
  if (basket.chosen.length === 0) return null;
  const paused = !catalog.settings.gateway_enabled && basket.subtotal > 0;
  return (
    <View style={styles.bar}>
      <View style={styles.flex}>
        <Text style={styles.barTitle}>
          {basket.chosen.length} in basket · {formatBdt(basket.total)}
        </Text>
        <Text style={styles.small} numberOfLines={1}>
          {basket.charge > 0 ? `incl. ${catalog.settings.charge_label} ${formatBdt(basket.charge)} · ` : ''}
          {basket.chosen.map((p) => p.exam_subject_name ?? p.exam_part_name ?? p.name).join(', ')}
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {paused ? <Text style={styles.errorText}>Online payments are paused right now.</Text> : null}
      </View>
      <Pressable onPress={basket.clear} disabled={busy} hitSlop={8} style={styles.clearBtn}>
        <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
      </Pressable>
      <Pressable
        onPress={onPay}
        disabled={busy || paused}
        style={({ pressed }) => [styles.payBtn, (pressed || busy || paused) && styles.pressed]}
      >
        {busy ? <ActivityIndicator color={colors.white} size="small" /> : null}
        <Text style={styles.payText}>{basket.total === 0 ? 'Get free' : 'Pay'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: spacing.md },
  pressed: { opacity: 0.7 },
  dim: { opacity: 0.5 },
  small: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  errorText: { fontSize: 12, color: colors.error },

  partTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  partTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  partTabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  partTabText: { fontSize: 14, fontWeight: '700', color: colors.text },
  partTabTextOn: { color: colors.white },
  countPill: { backgroundColor: '#dbeafe', borderRadius: 999, paddingHorizontal: 6, minWidth: 18, alignItems: 'center' },
  countPillOn: { backgroundColor: 'rgba(255,255,255,0.25)' },
  countText: { fontSize: 11, fontWeight: '800', color: colors.primaryDark },

  ownedBox: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: spacing.sm,
    alignItems: 'flex-start',
  },
  ownedText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#065f46' },

  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  allBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  allBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  included: { fontSize: 13, color: colors.primaryDark, backgroundColor: '#eff6ff', borderRadius: 10, padding: spacing.sm },

  bundle: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  bundleOn: { borderColor: colors.primary, borderWidth: 2, backgroundColor: '#f0f7fc' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  bundleName: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  price: { fontSize: 22, fontWeight: '800', color: colors.text },
  compare: { fontSize: 13, color: colors.textMuted, textDecorationLine: 'line-through' },
  feature: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 2 },
  featureText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 },

  subjectList: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  subject: { padding: spacing.md, gap: 6 },
  subjectBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  subjectHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  activeText: { fontSize: 12, fontWeight: '600', color: colors.success, marginLeft: 28 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginLeft: 28 },
  chip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipPrice: { fontSize: 14, fontWeight: '800', color: colors.text },
  chipPer: { fontSize: 12, color: colors.textMuted },
  chipTextOn: { color: colors.white },

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  barTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  clearBtn: { padding: 6 },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BKASH,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  payText: { color: colors.white, fontWeight: '800', fontSize: 15 },
});
