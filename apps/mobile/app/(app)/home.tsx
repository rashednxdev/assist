import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { PerformanceCard } from '@/components/home/PerformanceCard';
import { ModuleTile } from '@/components/home/ModuleTile';
import { useAuth } from '@/lib/auth-context';
import {
  fetchAccountSummary,
  fetchLearningActivity,
  type AccountSummary,
  type LearningActivity,
} from '@/lib/auth-api';
import { colors, spacing } from '@/theme';

const MODULES: Array<{
  code: 'BOOKS' | 'QUESTIONS' | 'EXAM' | 'PAPER' | 'PENSION';
  title: string;
  subtitle: string;
  icon: 'library-outline' | 'help-circle-outline' | 'school-outline' | 'document-text-outline' | 'calculator-outline';
  color: string;
  href: Href;
}> = [
  {
    code: 'BOOKS' as const,
    title: 'Books and Tools',
    subtitle: 'Books & regulatory tools',
    icon: 'library-outline' as const,
    color: '#0f5c8c',
    href: '/(app)/books',
  },
  {
    code: 'QUESTIONS' as const,
    title: 'Question Bank',
    subtitle: 'Browse & practice questions',
    icon: 'help-circle-outline' as const,
    color: '#7c3aed',
    href: '/(app)/questions',
  },
  {
    code: 'EXAM' as const,
    title: 'Exam Programs',
    subtitle: 'SAS, SRAS & exam structure',
    icon: 'school-outline' as const,
    color: '#059669',
    href: '/(app)/exams',
  },
  {
    code: 'PAPER' as const,
    title: 'Practice Papers',
    subtitle: 'Session-wise model papers',
    icon: 'document-text-outline' as const,
    color: '#d97706',
    href: '/(app)/papers',
  },
  {
    code: 'PENSION' as const,
    title: 'Pension Calculator',
    subtitle: 'Leave account & lamp grant',
    icon: 'calculator-outline' as const,
    color: '#0e7490',
    href: '/(app)/pension' as Href,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut, canAccess } = useAuth();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [activity, setActivity] = useState<LearningActivity>({
    books: 0,
    questions: 0,
    exams: 0,
    papers: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [sum, act] = await Promise.all([
      fetchAccountSummary().catch(() => null),
      fetchLearningActivity(),
    ]);
    if (sum) setSummary(sum);
    setActivity(act);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const greeting = user?.full_name_en?.split(' ')[0] ?? 'Learner';
  const verified = !!(user?.is_verified && user?.email_verified && user?.phone_verified);

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.hero}>
        <SafeAreaView edges={['top']}>
          <View style={styles.heroInner}>
            <View>
              <Text style={styles.greet}>{greeting}</Text>
              <Text style={styles.heroSub}>Preparation Dashboard</Text>
            </View>
            <Pressable onPress={() => void signOut()} style={styles.signOutBtn}>
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <PerformanceCard
          profilePercent={summary?.profile_complete_percent ?? 0}
          verified={verified}
          planName={summary?.subscription?.plan?.name}
          activity={activity}
        />

        <Text style={styles.sectionTitle}>Learning modules</Text>
        <View style={styles.grid}>
          {MODULES.map((m) => (
            <ModuleTile
              key={m.code}
              title={m.title}
              subtitle={m.subtitle}
              icon={m.icon}
              color={m.color}
              enabled={m.code === 'BOOKS' ? canAccess('BOOKS') || canAccess('OCR') : canAccess(m.code)}
              onPress={() => router.push(m.href)}
            />
          ))}
        </View>

        <Text style={styles.note}>
          This app includes User account features and Learning modules only. More screens will be
          added in the next phase.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    paddingBottom: spacing.lg,
  },
  heroInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greet: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '800',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 2,
  },
  signOutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  signOutText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
});
