import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { BloodGroup, BloodMe, BloodStats } from '@ibas/shared-types';
import { FormScroll } from '@/components/ui/FormScroll';
import { BloodDrop, EligibilityBadge, ErrorNote, RED, RED_BORDER, RED_DARK, RED_SOFT } from '@/components/blood/BloodBits';
import { BloodProfileForm } from '@/components/blood/BloodProfileForm';
import { DonorList } from '@/components/blood/DonorList';
import { RequestList } from '@/components/blood/RequestList';
import { DonationHistory } from '@/components/blood/DonationHistory';
import { BloodGuide } from '@/components/blood/BloodGuide';
import { fetchBloodStats, sinceLabel, toggleAvailability, useBloodMe } from '@/lib/blood-api';
import { formatDate } from '@/lib/profile-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

type Tab = 'donors' | 'requests' | 'donations' | 'guide';
const TABS: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'donors', label: 'Donors', icon: 'people' },
  { id: 'requests', label: 'Requests', icon: 'megaphone' },
  { id: 'donations', label: 'My donations', icon: 'time' },
  { id: 'guide', label: 'Guide', icon: 'book' },
];

const go = {
  donate: '/(app)/blood-bank/donate' as Href,
  request: '/(app)/blood-bank/request-new' as Href,
  settings: '/(app)/blood-bank/settings' as Href,
};

function Onboarding({ me }: { me: BloodMe }) {
  return (
    <FormScroll>
      <View style={styles.onboard}>
        <View style={styles.onboardIcon}>
          <Ionicons name="water" size={34} color={RED} />
        </View>
        <Text style={styles.onboardTitle}>Blood bank</Text>
        <Text style={styles.onboardText}>
          Find blood donors among colleagues, request blood in an emergency, and become a donor yourself. Add your blood group to get started.
        </Text>
      </View>
      <BloodProfileForm me={me} submitLabel="Save and open blood bank" />
    </FormScroll>
  );
}

function StatTile({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color="rgba(255,255,255,0.8)" />
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function HeroAction({ icon, label, onPress, solid }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; solid?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.heroBtn, solid && styles.heroBtnSolid, pressed && styles.pressed]}>
      <Ionicons name={icon} size={16} color={solid ? '#b91c1c' : colors.white} />
      <Text style={[styles.heroBtnText, solid && styles.heroBtnTextSolid]}>{label}</Text>
    </Pressable>
  );
}

export default function BloodBankScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { me, error, refresh } = useBloodMe();
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.id === params.tab) ? (params.tab as Tab) : 'donors'));
  const [stats, setStats] = useState<BloodStats | null>(null);
  const [donorGroup, setDonorGroup] = useState<BloodGroup | ''>('');
  const [reloadKey, setReloadKey] = useState(0);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const firstFocus = useRef(true);

  const ready = !!me?.ready;
  useEffect(() => {
    if (!ready) return;
    fetchBloodStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, [ready, me?.donor.donation_count, me?.donor.is_donor, me?.blood_group, reloadKey]);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setReloadKey((k) => k + 1);
    }, []),
  );

  async function pullRefresh() {
    setRefreshing(true);
    await refresh();
    setReloadKey((k) => k + 1);
    setRefreshing(false);
  }

  async function onToggleAvailable() {
    if (!me?.blood_group) return;
    setToggling(true);
    try {
      await toggleAvailability(me);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not update availability');
    } finally {
      setToggling(false);
    }
  }

  if (!me) {
    return (
      <View style={styles.center}>
        {error ? <ErrorNote text={error} /> : <ActivityIndicator size="large" color={RED} />}
      </View>
    );
  }
  if (!me.ready) return <Onboarding me={me} />;

  const d = me.donor;
  const title = me.blood_group ? (d.is_donor ? `You're a ${me.blood_group} donor` : `Your blood group: ${me.blood_group}`) : 'Blood bank moderation';

  const header = (
    <View style={styles.headerWrap}>
      <LinearGradient colors={[RED, '#e11d48', RED_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Ionicons name="water" size={160} color="rgba(255,255,255,0.08)" style={styles.heroBg} />
        <View style={styles.heroTop}>
          <BloodDrop group={me.blood_group} size="xl" inverted />
          <View style={styles.heroText}>
            <Text style={styles.kicker}>BLOOD BANK</Text>
            <Text style={styles.heroTitle}>{title}</Text>
            {d.is_donor ? (
              <View style={styles.heroMeta}>
                <EligibilityBadge eligible={d.eligible} days={d.days_until_eligible} available={d.available} />
                <Text style={styles.heroSub}>
                  {sinceLabel(d.last_donation_date)}
                  {!d.eligible ? ` · next ${formatDate(d.next_eligible_date)}` : ''}
                </Text>
              </View>
            ) : me.blood_group ? (
              <Text style={styles.heroSub}>Become a donor so people who need {me.blood_group} blood can reach you.</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.heroActions}>
          {me.blood_group ? <HeroAction icon="heart" label="I donated" solid onPress={() => router.push(go.donate)} /> : null}
          <HeroAction icon="megaphone" label="Request blood" onPress={() => router.push(go.request)} />
          <HeroAction
            icon="settings-outline"
            label={d.is_donor ? 'Donor settings' : me.blood_group ? 'Become a donor' : 'Set blood group'}
            onPress={() => router.push(go.settings)}
          />
        </View>
        {d.is_donor ? (
          <View style={styles.availRow}>
            <Text style={styles.availText}>
              Available for requests{d.district?.name ? <Text style={styles.availSub}>{` in ${d.district.name}`}</Text> : null}
            </Text>
            <Switch
              value={d.available}
              disabled={toggling}
              onValueChange={() => void onToggleAvailable()}
              trackColor={{ false: 'rgba(255,255,255,0.3)', true: '#fecdd3' }}
              thumbColor={d.available ? colors.white : '#f1f5f9'}
            />
          </View>
        ) : null}
        {stats ? (
          <View style={styles.stats}>
            <StatTile icon="people" label="Donors" value={stats.donors} />
            <StatTile icon="heart-circle" label="Eligible now" value={stats.eligible} />
            <StatTile icon="megaphone" label="Open requests" value={stats.open_requests} />
            <StatTile icon="water" label="Donations this year" value={stats.donations_this_year} />
          </View>
        ) : null}
      </LinearGradient>

      {stats ? (
        <View style={styles.groupGrid}>
          {stats.groups.map((g) => (
            <Pressable
              key={g.group}
              onPress={() => {
                setDonorGroup(g.group);
                setTab('donors');
              }}
              style={({ pressed }) => [styles.groupCell, g.group === me.blood_group && styles.groupCellMine, pressed && styles.pressed]}
            >
              <Text style={styles.groupName}>{g.group}</Text>
              <Text style={styles.groupReady}>{g.eligible} ready</Text>
              <Text style={styles.groupDonors}>{g.donors} donors</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, on && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Ionicons name={on ? t.icon : (`${t.icon}-outline` as keyof typeof Ionicons.glyphMap)} size={16} color={on ? colors.white : colors.textMuted} />
              <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (tab === 'donors') return <DonorList myGroup={me.blood_group} initialGroup={donorGroup} header={header} />;
  if (tab === 'requests') return <RequestList me={me} header={header} reloadKey={reloadKey} onNew={() => router.push(go.request)} />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void pullRefresh()} />}
    >
      {header}
      {tab === 'donations' ? (
        me.blood_group ? (
          <DonationHistory me={me} onAdd={() => router.push(go.donate)} />
        ) : (
          <Text style={styles.notice}>Set your blood group to record donations.</Text>
        )
      ) : (
        <BloodGuide myGroup={me.blood_group} />
      )}
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
  pressed: {
    opacity: 0.85,
  },
  onboard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  onboardIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: RED_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  onboardText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
  headerWrap: {
    gap: spacing.md,
  },
  hero: {
    borderRadius: 22,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute',
    right: -30,
    top: -30,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.75)',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
    lineHeight: 25,
  },
  heroMeta: {
    gap: 4,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroBtnSolid: {
    backgroundColor: colors.white,
  },
  heroBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  heroBtnTextSolid: {
    color: '#b91c1c',
  },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    paddingLeft: spacing.sm + 4,
    paddingRight: spacing.sm,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  availText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  availSub: {
    fontWeight: '400',
    color: 'rgba(255,255,255,0.75)',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '48%',
    flexGrow: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  groupCell: {
    width: '22.5%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  groupCellMine: {
    borderColor: RED_BORDER,
    borderWidth: 1.5,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#b91c1c',
  },
  groupReady: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  groupDonors: {
    fontSize: 10,
    color: colors.textMuted,
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabOn: {
    backgroundColor: RED,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tabTextOn: {
    color: colors.white,
  },
  notice: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.lg,
  },
});
