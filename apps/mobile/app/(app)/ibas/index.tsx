import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { IbasAreaSummary } from '@ibas/shared-types';
import { AccessRequiredScreen, type AccessRequiredVariant } from '@/components/home/AccessRequiredScreen';
import { EmptyState } from '@/components/contacts/ContactBits';
import { useAuth } from '@/lib/auth-context';
import { fetchIbasAreas } from '@/lib/ibas-api';
import { colors, spacing } from '@/theme';

const SKY = '#0369a1';
const SKY_DARK = '#0c4a6e';

function CountPill({ n, label }: { n: number; label: string }) {
  if (n <= 0) return null;
  return (
    <View style={styles.count}>
      <Text style={styles.countText}>
        {n} {label}
      </Text>
    </View>
  );
}

function AreaCard({ a, onPress }: { a: IbasAreaSummary; onPress: () => void }) {
  const locked = a.access !== 'open';
  const kits = a.counts.checklists + a.counts.templates + a.counts.guides;
  const total = a.counts.procedures + a.counts.rules + a.counts.circulars + a.counts.tools + kits;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, locked && styles.cardLocked, pressed && styles.pressed]}>
      <View style={[styles.cardBar, { backgroundColor: a.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <View style={[styles.cardIcon, { backgroundColor: a.color }]}>
            <Ionicons name="briefcase" size={20} color={colors.white} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{a.name_en}</Text>
            {a.name_bn ? <Text style={styles.cardTitleBn}>{a.name_bn}</Text> : null}
          </View>
          {a.access === 'stopped' ? (
            <Ionicons name="pause-circle" size={20} color="#d97706" />
          ) : locked ? (
            <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          )}
        </View>
        {a.description_en ? (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {a.description_en}
          </Text>
        ) : null}
        <View style={styles.counts}>
          {total === 0 ? (
            <View style={[styles.count, styles.countSoon]}>
              <Text style={styles.countText}>Content coming soon</Text>
            </View>
          ) : (
            <>
              <CountPill n={a.counts.procedures} label="processes" />
              <CountPill n={kits} label="checklists & templates" />
              <CountPill n={a.counts.rules} label="rules" />
              <CountPill n={a.counts.circulars} label="circulars" />
              <CountPill n={a.counts.tools} label="tools" />
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function IbasWorkspaceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [areas, setAreas] = useState<IbasAreaSummary[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [dialog, setDialog] = useState<{ variant: AccessRequiredVariant; title: string; reason?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setAreas(await fetchIbasAreas());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the workspace');
      setAreas((cur) => cur ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openArea(a: IbasAreaSummary) {
    if (a.access !== 'open') {
      setDialog({ variant: a.access, title: `iBAS++: ${a.name_en}`, reason: a.stopped_reason });
      return;
    }
    router.push(`/(app)/ibas/${a.code}` as Href);
  }

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        <LinearGradient colors={[SKY, '#0284c7', SKY_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Ionicons name="briefcase" size={140} color="rgba(255,255,255,0.08)" style={styles.heroBg} />
          <Text style={styles.kicker}>iBAS++ WORKSPACE</Text>
          <Text style={styles.heroTitle}>Processes, checklists, rules and circulars for each area</Text>
          <Text style={styles.heroSub}>Pick an area — everything about it opens right here in the workspace.</Text>
        </LinearGradient>

        <View style={styles.info}>
          <Ionicons name="information-circle" size={18} color={SKY} />
          <Text style={styles.infoText}>This workspace is a guide to iBAS++ work, not a connection to the live iBAS++ system — no transactions are made here.</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#991b1b" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {areas === null ? (
          <ActivityIndicator size="large" color={SKY} style={styles.loader} />
        ) : areas.length === 0 && !error ? (
          <EmptyState icon="briefcase-outline" title="No areas yet" text="iBAS++ areas will appear here once the admin sets them up." />
        ) : (
          areas.map((a) => <AreaCard key={a.code} a={a} onPress={() => openArea(a)} />)
        )}
      </ScrollView>

      {dialog ? (
        <AccessRequiredScreen
          visible
          variant={dialog.variant}
          moduleTitle={dialog.title}
          stoppedReason={dialog.reason}
          unpaidMessage={user?.unpaid_message}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
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
  pressed: {
    opacity: 0.85,
  },
  flex: {
    flex: 1,
  },
  loader: {
    marginTop: spacing.lg,
  },
  hero: {
    borderRadius: 22,
    padding: spacing.lg,
    gap: 6,
    overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute',
    right: -20,
    top: -20,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.75)',
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 25,
    color: colors.white,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
    padding: spacing.sm + 4,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#075985',
  },
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardLocked: {
    opacity: 0.8,
  },
  cardBar: {
    width: 5,
  },
  cardBody: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  cardTitleBn: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  counts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  count: {
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  countSoon: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: spacing.sm + 4,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#991b1b',
  },
});
