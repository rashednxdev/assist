import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ContactEmployee, ContactOffice, ContactPhone } from '@ibas/shared-types';
import { useContactAccess } from '@/components/contacts/ContactAccess';
import { mapsUrl, officeTitle, toggleFavorite, whatsappUrl } from '@/lib/contacts-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

const AVATAR_COLORS = ['#0d9488', '#2563eb', '#7c3aed', '#e11d48', '#d97706', '#059669', '#0284c7', '#c026d3'];

function colorFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

export function officeHref(id: string, view?: 'sub' | 'employees'): Href {
  return (view ? `/(app)/contacts/office/${id}?view=${view}` : `/(app)/contacts/office/${id}`) as Href;
}

export function Avatar({ id, initials, size = 44 }: { id: string; initials: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(id) }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

function IconAction({
  icon,
  onPress,
  label,
  primary,
  locked,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  primary?: boolean;
  locked?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconBtn,
        primary && !locked && styles.iconBtnPrimary,
        locked && styles.iconBtnLocked,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={locked ? 'lock-closed' : icon} size={16} color={primary && !locked ? colors.white : colors.textMuted} />
    </Pressable>
  );
}

/** Label + number + WhatsApp / call. Actions open only for paid users; others see the package prompt. */
export function PhoneLine({
  label,
  phone,
  mobile,
  icon = 'call-outline',
  hideLabel,
}: {
  label: string;
  phone: ContactPhone;
  mobile?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** List rows: the icon alone tells telephone from mobile. */
  hideLabel?: boolean;
}) {
  const { access, requestUpgrade } = useContactAccess();
  const canDial = !!access?.can_dial && !!phone.dial;
  const wa = mobile && canDial && phone.dial ? whatsappUrl(phone.dial) : null;
  return (
    <View style={styles.phoneRow} accessibilityLabel={hideLabel ? `${label} ${phone.display}` : undefined}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <View style={styles.phoneText}>
        {hideLabel ? null : <Text style={styles.phoneLabel}>{label}</Text>}
        <Text style={[styles.phoneValue, !canDial && styles.muted]} numberOfLines={1}>
          {phone.display}
        </Text>
      </View>
      {wa ? <IconAction icon="logo-whatsapp" label="WhatsApp" onPress={() => void Linking.openURL(wa)} /> : null}
      {canDial && mobile ? (
        <IconAction icon="chatbubble-outline" label="Message" onPress={() => void Linking.openURL(`sms:${phone.dial}`)} />
      ) : null}
      <IconAction
        icon="call"
        label={canDial ? `Call ${phone.display}` : 'Calling needs a package'}
        primary
        locked={!canDial}
        onPress={canDial ? () => void Linking.openURL(`tel:${phone.dial}`) : requestUpgrade}
      />
    </View>
  );
}

export function FavoriteStar({
  type,
  id,
  value,
  onChange,
  light,
}: {
  type: 'office' | 'user';
  id: string;
  value: boolean;
  onChange?: (v: boolean) => void;
  light?: boolean;
}) {
  const [on, setOn] = useState(value);
  const [busy, setBusy] = useState(false);
  useEffect(() => setOn(value), [value]);

  async function toggle() {
    const prev = on;
    setBusy(true);
    setOn(!prev);
    try {
      const next = await toggleFavorite(type, id);
      setOn(next);
      onChange?.(next);
      showToast(next ? 'Added to favourites' : 'Removed from favourites');
    } catch {
      setOn(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable onPress={() => void toggle()} disabled={busy} hitSlop={10} accessibilityLabel={on ? 'Remove from favourites' : 'Add to favourites'}>
      <Ionicons name={on ? 'star' : 'star-outline'} size={22} color={on ? '#f59e0b' : light ? 'rgba(255,255,255,0.85)' : '#cbd5e1'} />
    </Pressable>
  );
}

function Tag({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'primary' | 'code' }) {
  return (
    <View style={[styles.tag, tone === 'primary' && styles.tagPrimary, tone === 'code' && styles.tagCode]}>
      <Text style={[styles.tagText, tone === 'primary' && styles.tagTextPrimary]}>{text}</Text>
    </View>
  );
}

export function OfficeCard({ o, onFavorite }: { o: ContactOffice; onFavorite?: (v: boolean) => void }) {
  const router = useRouter();
  const location = [o.address, o.thana_name, o.district_name, o.division_name].filter(Boolean).join(', ');

  return (
    <View style={[styles.card, o.is_my_office && styles.cardMine]}>
      <Pressable style={styles.officeHead} onPress={() => router.push(officeHref(o.id))}>
        <View style={styles.officeIcon}>
          <Ionicons name="business" size={20} color={colors.white} />
        </View>
        <View style={styles.flex}>
          <View style={styles.tags}>
            {o.office_type ? <Tag text={o.office_type.short_name} /> : null}
            {o.office_code ? <Tag text={o.office_code} tone="code" /> : null}
            {o.is_my_office ? <Tag text="Your office" tone="primary" /> : null}
          </View>
          <Text style={styles.officeName}>{officeTitle(o)}</Text>
          {o.name_bn ? <Text style={styles.sub}>{o.name_bn}</Text> : null}
          {o.parent_path ? (
            <Text style={styles.sub} numberOfLines={1}>
              Under {o.parent_path}
            </Text>
          ) : null}
        </View>
        <FavoriteStar type="office" id={o.id} value={o.is_favorite} onChange={onFavorite} />
      </Pressable>

      {o.telephone || o.mobile || o.email || location ? (
        <View style={styles.officeBody}>
          {o.telephone ? <PhoneLine label="Telephone" phone={o.telephone} icon="call-outline" hideLabel /> : null}
          {o.mobile ? <PhoneLine label="Mobile" phone={o.mobile} mobile icon="phone-portrait-outline" hideLabel /> : null}
          {o.email ? (
            <Pressable style={styles.linkRow} onPress={() => void Linking.openURL(`mailto:${o.email}`)}>
              <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
              <Text style={styles.linkText} numberOfLines={1}>
                {o.email}
              </Text>
            </Pressable>
          ) : null}
          {location ? (
            <Pressable style={styles.linkRow} onPress={() => void Linking.openURL(mapsUrl(o))}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.linkText, styles.muted]} numberOfLines={2}>
                {location}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.officeFoot}>
        <Pressable
          disabled={o.sub_office_count === 0}
          onPress={() => router.push(officeHref(o.id, 'sub'))}
          style={({ pressed }) => [styles.footBtn, o.sub_office_count === 0 && styles.footBtnDisabled, pressed && styles.pressed]}
        >
          <Ionicons name="git-network-outline" size={15} color={colors.text} />
          <Text style={styles.footBtnText}>Sub-offices ({o.sub_office_count})</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(officeHref(o.id, 'employees'))}
          style={({ pressed }) => [styles.footBtn, styles.footBtnPrimary, pressed && styles.pressed]}
        >
          <Ionicons name="people-outline" size={15} color={colors.white} />
          <Text style={[styles.footBtnText, styles.footBtnTextPrimary]}>Employees ({o.employee_total})</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function EmployeeCard({
  e,
  showOffice = true,
  onFavorite,
}: {
  e: ContactEmployee;
  showOffice?: boolean;
  onFavorite?: (v: boolean) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.card, styles.person, e.is_me && styles.cardMine, pressed && styles.pressed]}
      >
        <Avatar id={e.id} initials={e.initials} />
        <View style={styles.personBody}>
          <View style={styles.personHead}>
            <View style={styles.flex}>
              <Text style={styles.personName}>
                {e.name}
                {e.is_me ? <Text style={styles.you}>  You</Text> : null}
              </Text>
              {e.name_bn && e.name_bn !== e.name ? <Text style={styles.sub}>{e.name_bn}</Text> : null}
              {e.listed_as_additional ? (
                <View style={styles.chargeTag}>
                  <Text style={styles.chargeTagText}>Additional charge · {e.listed_as_additional.designation.name}</Text>
                </View>
              ) : null}
              {e.designation ? <Text style={styles.designation}>{e.designation.name}</Text> : null}
              {e.section ? <Text style={styles.sub}>{e.section}</Text> : null}
              {showOffice && e.office ? (
                <Pressable onPress={() => router.push(officeHref(e.office!.id))} hitSlop={4}>
                  <Text style={styles.officeLink} numberOfLines={1}>
                    {e.office.short_name || e.office.name}
                    {e.office.parent_path ? ` · ${e.office.parent_path}` : ''}
                  </Text>
                </Pressable>
              ) : null}
              {e.additional_charges.length > 0 && !e.listed_as_additional ? (
                <Text style={styles.chargeLine} numberOfLines={1}>
                  Also: {e.additional_charges.map((c) => `${c.designation.short_name || c.designation.name}, ${c.office.short_name || c.office.name}`).join(' · ')}
                </Text>
              ) : null}
            </View>
            <FavoriteStar type="user" id={e.id} value={e.is_favorite} onChange={onFavorite} />
          </View>
          {e.telephone ? <PhoneLine label="Telephone" phone={e.telephone} icon="call-outline" hideLabel /> : null}
          {e.mobile ? (
            <PhoneLine label="Mobile" phone={e.mobile} mobile icon="phone-portrait-outline" hideLabel />
          ) : e.phone_hidden ? (
            <View style={styles.linkRow}>
              <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.small, styles.muted]}>Mobile number kept private</Text>
            </View>
          ) : null}
          {e.email ? (
            <Pressable style={styles.linkRow} onPress={() => void Linking.openURL(`mailto:${e.email}`)}>
              <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
              <Text style={styles.linkText} numberOfLines={1}>
                {e.email}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
      <EmployeeSheet e={e} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Full contact details for one employee: posting, numbers and additional charges. */
export function EmployeeSheet({ e, visible, onClose }: { e: ContactEmployee; visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const noNumbers = !e.mobile && !e.telephone && !e.pabx;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.sheetBody}>
          <View style={styles.sheetHead}>
            <Avatar id={e.id} initials={e.initials} size={52} />
            <View style={styles.flex}>
              <Text style={styles.sheetName}>{e.name}</Text>
              {e.name_bn && e.name_bn !== e.name ? <Text style={styles.sub}>{e.name_bn}</Text> : null}
              {e.designation ? <Text style={styles.designation}>{e.designation.name}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.detailBox}>
            {e.office ? (
              <Pressable
                style={styles.linkRow}
                onPress={() => {
                  onClose();
                  router.push(officeHref(e.office!.id));
                }}
              >
                <Ionicons name="business-outline" size={16} color={colors.textMuted} />
                <View style={styles.flex}>
                  <Text style={styles.officeLink}>{e.office.short_name ? `${e.office.name} (${e.office.short_name})` : e.office.name}</Text>
                  {e.office.parent_path ? <Text style={styles.sub}>Under {e.office.parent_path}</Text> : null}
                </View>
              </Pressable>
            ) : null}
            {e.section ? (
              <View style={styles.linkRow}>
                <Ionicons name="grid-outline" size={16} color={colors.textMuted} />
                <Text style={styles.linkText}>{e.section}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.detailBox}>
            {e.mobile ? <PhoneLine label="Mobile" phone={e.mobile} mobile icon="phone-portrait-outline" /> : null}
            {e.telephone ? <PhoneLine label="Telephone" phone={e.telephone} icon="call-outline" /> : null}
            {e.pabx ? <PhoneLine label="PABX" phone={e.pabx} icon="keypad-outline" /> : null}
            {e.phone_hidden ? (
              <View style={styles.linkRow}>
                <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.small, styles.muted]}>Mobile number kept private</Text>
              </View>
            ) : noNumbers ? (
              <Text style={[styles.small, styles.muted]}>No numbers added yet.</Text>
            ) : null}
            {e.email ? (
              <Pressable style={styles.linkRow} onPress={() => void Linking.openURL(`mailto:${e.email}`)}>
                <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                <Text style={styles.linkText} numberOfLines={1}>
                  {e.email}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {e.additional_charges.length > 0 ? (
            <View style={styles.detailBox}>
              <Text style={styles.boxLabel}>ADDITIONAL CHARGE</Text>
              {e.additional_charges.map((c) => (
                <Pressable
                  key={`${c.office.id}:${c.designation.id}`}
                  style={styles.linkRow}
                  onPress={() => {
                    onClose();
                    router.push(officeHref(c.office.id));
                  }}
                >
                  <Ionicons name="briefcase-outline" size={16} color={colors.textMuted} />
                  <View style={styles.flex}>
                    <Text style={styles.linkText}>{c.designation.name}</Text>
                    <Text style={styles.officeLink}>{c.office.short_name ? `${c.office.name} (${c.office.short_name})` : c.office.name}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/** Rounded filter chip with an optional count. */
export function Chip({ label, count, active, onPress }: { label: string; count?: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
      {count !== undefined ? (
        <View style={[styles.chipCount, active && styles.chipCountActive]}>
          <Text style={[styles.chipCountText, active && styles.chipTextActive]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function EmptyState({ icon = 'search-outline', title, text }: { icon?: keyof typeof Ionicons.glyphMap; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={34} color="#cbd5e1" />
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.85,
  },
  muted: {
    color: colors.textMuted,
  },
  small: {
    fontSize: 12,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontWeight: '800',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  iconBtnLocked: {
    borderStyle: 'dashed',
    backgroundColor: colors.background,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  phoneText: {
    flex: 1,
    minWidth: 0,
  },
  phoneLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  phoneValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardMine: {
    borderColor: colors.primaryLight,
    borderWidth: 1.5,
  },
  officeHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 4,
    padding: spacing.md,
    paddingBottom: spacing.sm + 4,
  },
  officeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 2,
  },
  tag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#f1f5f9',
  },
  tagPrimary: {
    backgroundColor: colors.primary,
  },
  tagCode: {
    backgroundColor: colors.background,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  tagTextPrimary: {
    color: colors.white,
  },
  officeName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 20,
  },
  sub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  officeBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm + 4,
    gap: spacing.sm + 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  officeFoot: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 9,
  },
  footBtnDisabled: {
    borderStyle: 'dashed',
    opacity: 0.55,
  },
  footBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  footBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  footBtnTextPrimary: {
    color: colors.white,
  },
  person: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    padding: spacing.md,
  },
  personBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  personHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  personName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  you: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  designation: {
    fontSize: 13,
    color: colors.text,
    marginTop: 2,
  },
  chargeTag: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    backgroundColor: '#fef3c7',
  },
  chargeTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400e',
  },
  chargeLine: {
    fontSize: 11,
    color: '#92400e',
    marginTop: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetBody: {
    padding: spacing.md,
    gap: spacing.md,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  sheetName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  detailBox: {
    gap: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.sm + 4,
  },
  boxLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  officeLink: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    maxWidth: 220,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  chipTextActive: {
    color: colors.white,
  },
  chipCount: {
    minWidth: 20,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  chipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  chipCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
