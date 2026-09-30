import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { ContactOfficeDetail, ContactPhone } from '@ibas/shared-types';
import { ContactsGate, useContactAccess } from '@/components/contacts/ContactAccess';
import { EmptyState, FavoriteStar, PhoneLine, officeHref } from '@/components/contacts/ContactBits';
import { OfficeList } from '@/components/contacts/OfficeList';
import { EmployeeDirectory } from '@/components/contacts/EmployeeDirectory';
import { fetchOffice, mapsUrl } from '@/lib/contacts-api';
import { colors, spacing } from '@/theme';

type View_ = 'about' | 'sub' | 'employees';

export default function OfficeScreen() {
  return (
    <ContactsGate>
      <OfficeDetail />
    </ContactsGate>
  );
}

function OfficeDetail() {
  const { id, view: rawView } = useLocalSearchParams<{ id: string; view?: string }>();
  const [view, setView] = useState<View_>(rawView === 'sub' || rawView === 'employees' ? rawView : 'about');
  const [office, setOffice] = useState<ContactOfficeDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setOffice(null);
    setError('');
    fetchOffice(String(id))
      .then(setOffice)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load office'));
  }, [id]);

  if (error) return <EmptyState icon="alert-circle-outline" title="Could not open office" text={error} />;
  if (!office) return <ActivityIndicator color={colors.primary} style={styles.loader} />;

  const header = <OfficeHeader office={office} view={view} setView={setView} />;
  const title = office.short_name || office.name;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title }} />
      {view === 'about' ? (
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          <About office={office} setView={setView} />
        </ScrollView>
      ) : view === 'sub' ? (
        <OfficeList key={`sub-${office.id}`} parentId={office.id} header={header} emptyTitle="No sub-offices" />
      ) : (
        <EmployeeDirectory key={`emp-${office.id}`} officeId={office.id} header={header} />
      )}
    </View>
  );
}

function OfficeHeader({ office, view, setView }: { office: ContactOfficeDetail; view: View_; setView: (v: View_) => void }) {
  const router = useRouter();
  const views: Array<{ id: View_; label: string; icon: keyof typeof Ionicons.glyphMap; count?: number; disabled?: boolean }> = [
    { id: 'about', label: 'Info', icon: 'information-circle-outline' },
    { id: 'sub', label: 'Sub-offices', icon: 'git-network-outline', count: office.sub_office_count, disabled: office.sub_office_count === 0 },
    { id: 'employees', label: 'Employees', icon: 'people-outline', count: office.employee_total },
  ];
  return (
    <View style={styles.headerWrap}>
      {office.breadcrumb.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.crumbs}>
          {office.breadcrumb.map((b) => (
            <Pressable key={b.id} onPress={() => router.push(officeHref(b.id))} style={styles.crumb}>
              <Text style={styles.crumbText}>{b.short_name || b.name}</Text>
              <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
            </Pressable>
          ))}
          <Text style={styles.crumbCurrent}>{office.short_name || office.name}</Text>
        </ScrollView>
      ) : null}

      <LinearGradient colors={['#0f766e', '#0d9488', '#0369a1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroTags}>
            {office.office_type ? <Text style={styles.heroTag}>{office.office_type.name}</Text> : null}
            {office.office_code ? <Text style={styles.heroTagSoft}>Code {office.office_code}</Text> : null}
            {office.is_my_office ? <Text style={styles.heroTagMine}>Your office</Text> : null}
          </View>
          <FavoriteStar type="office" id={office.id} value={office.is_favorite} light />
        </View>
        <Text style={styles.heroTitle}>
          {office.name}
          {office.short_name && office.short_name !== office.name ? <Text style={styles.heroShort}>{`  (${office.short_name})`}</Text> : null}
        </Text>
        {office.name_bn ? <Text style={styles.heroBn}>{office.name_bn}</Text> : null}
        {office.parent_path ? <Text style={styles.heroParent}>Under {office.parent_path}</Text> : null}
      </LinearGradient>

      <View style={styles.segment}>
        {views.map((v) => {
          const active = view === v.id;
          return (
            <Pressable
              key={v.id}
              disabled={v.disabled}
              onPress={() => setView(v.id)}
              style={[styles.segBtn, active && styles.segBtnActive, v.disabled && styles.segDisabled]}
            >
              <Ionicons name={v.icon} size={16} color={active ? colors.white : colors.text} />
              <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>
                {v.label}
                {v.count !== undefined ? ` ${v.count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function About({ office, setView }: { office: ContactOfficeDetail; setView: (v: View_) => void }) {
  const { access } = useContactAccess();
  const phones = [
    office.telephone && { label: 'Telephone', phone: office.telephone, mobile: false, icon: 'call-outline' as const },
    office.mobile && { label: 'Mobile', phone: office.mobile, mobile: true, icon: 'phone-portrait-outline' as const },
    office.pabx && { label: 'PABX', phone: office.pabx, mobile: false, icon: 'keypad-outline' as const },
    office.fax && { label: 'Fax', phone: office.fax, mobile: false, icon: 'print-outline' as const },
  ].filter(Boolean) as Array<{ label: string; phone: ContactPhone; mobile: boolean; icon: keyof typeof Ionicons.glyphMap }>;
  const location = [office.address, office.thana_name, office.district_name].filter(Boolean).join(', ');
  const subEmployees = office.employee_total - office.employee_count;

  return (
    <View style={styles.about}>
      <View style={styles.card}>
        {phones.length > 0 ? (
          phones.map((p) => <PhoneLine key={p.label} label={p.label} phone={p.phone} mobile={p.mobile} icon={p.icon} />)
        ) : (
          <Text style={styles.muted}>No phone numbers listed.</Text>
        )}
        {office.email ? (
          <Pressable style={styles.linkRow} onPress={() => void Linking.openURL(`mailto:${office.email}`)}>
            <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
            <Text style={styles.linkText}>{office.email}</Text>
          </Pressable>
        ) : null}
        {office.web_address ? (
          <Pressable style={styles.linkRow} onPress={() => void Linking.openURL(office.web_address!)}>
            <Ionicons name="globe-outline" size={16} color={colors.textMuted} />
            <Text style={styles.linkText}>{office.web_address.replace(/^https?:\/\//, '')}</Text>
          </Pressable>
        ) : null}
        {location ? (
          <Pressable style={styles.linkRow} onPress={() => void Linking.openURL(mapsUrl(office))}>
            <Ionicons name="location-outline" size={16} color={colors.textMuted} />
            <Text style={styles.linkText}>{location}</Text>
            <Ionicons name="open-outline" size={14} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.statRow}>
        <Pressable style={styles.stat} onPress={() => setView('employees')}>
          <Ionicons name="people" size={20} color={colors.primary} />
          <Text style={styles.statValue}>{office.employee_count}</Text>
          <Text style={styles.statLabel}>In this office</Text>
        </Pressable>
        <Pressable style={[styles.stat, office.sub_office_count === 0 && styles.segDisabled]} disabled={office.sub_office_count === 0} onPress={() => setView('sub')}>
          <Ionicons name="git-network" size={20} color={colors.primary} />
          <Text style={styles.statValue}>{office.sub_office_count}</Text>
          <Text style={styles.statLabel}>Sub-offices</Text>
        </Pressable>
        <View style={styles.stat}>
          <Ionicons name="business" size={20} color={colors.primary} />
          <Text style={styles.statValue}>{subEmployees}</Text>
          <Text style={styles.statLabel}>In sub-offices</Text>
        </View>
      </View>

      {office.description ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.body}>{office.description}</Text>
        </View>
      ) : null}
      {!access?.can_dial ? <Text style={styles.hint}>Numbers are partly hidden. Tap a locked button to see how to unlock calling.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loader: {
    paddingVertical: spacing.xl,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  headerWrap: {
    gap: spacing.sm + 4,
  },
  crumbs: {
    alignItems: 'center',
    gap: 2,
  },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  crumbText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  crumbCurrent: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  hero: {
    borderRadius: 18,
    padding: spacing.md,
    gap: 4,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  heroTags: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heroTag: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  heroTagSoft: {
    fontSize: 11,
    color: colors.white,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  heroTagMine: {
    fontSize: 11,
    fontWeight: '800',
    color: '#115e59',
    backgroundColor: colors.white,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.white,
    marginTop: 4,
  },
  heroShort: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  heroBn: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  heroParent: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  segment: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 9,
  },
  segBtnActive: {
    backgroundColor: colors.primary,
  },
  segDisabled: {
    opacity: 0.45,
  },
  segText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  segTextActive: {
    color: colors.white,
  },
  about: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm + 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 4,
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
