import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { clearModuleWelcomeTipsPending } from '@/lib/module-welcome-tips';
import { colors, spacing } from '@/theme';

type TipIcon = keyof typeof Ionicons.glyphMap;

interface TipSlide {
  kicker: string;
  title: string;
  body: string;
  icon: TipIcon;
  colors: [string, string];
  points: string[];
}

const TIPS: TipSlide[] = [
  {
    kicker: 'Welcome',
    title: 'Your study hub is ready',
    body: 'ProAssist brings books, questions, papers, and daily practice together so you can study with a clear path.',
    icon: 'sparkles-outline',
    colors: ['#0a3d5c', '#0f5c8c'],
    points: ['One home for every learning module', 'Access unlocks as it is granted to you'],
  },
  {
    kicker: 'Books & Tools',
    title: 'Read rules the smart way',
    body: 'Open regulatory books chapter by chapter — with notes, processes, comparison tables, and linked questions.',
    icon: 'library-outline',
    colors: ['#0c4a6e', '#0369a1'],
    points: ['Browse books and chapters', 'Jump from a rule to related questions'],
  },
  {
    kicker: 'Question Bank',
    title: 'Practice, then track what you read',
    body: 'Browse questions by subject or book. Stay on an answer for 5 seconds to mark it read and build your reading history.',
    icon: 'list-outline',
    colors: ['#5b21b6', '#7c3aed'],
    points: ['Filter unread vs read', 'History stays on this phone only'],
  },
  {
    kicker: 'Exam Papers',
    title: 'Sit a paper, part by part',
    body: 'Open session-wise model papers, work through each part, and see how you are progressing.',
    icon: 'document-text-outline',
    colors: ['#b45309', '#d97706'],
    points: ['Model papers by session', 'Exam Programs map the full structure'],
  },
  {
    kicker: 'Daily rhythm',
    title: 'A little practice, every day',
    body: 'Questions of the Day keeps a subject-wise streak going. Exams of the Week highlights featured papers.',
    icon: 'calendar-outline',
    colors: ['#047857', '#059669'],
    points: ['QOTD is free for every user', 'Weekly exams keep you exam-ready'],
  },
  {
    kicker: 'More for you',
    title: 'Revision tools & calculators',
    body: 'Marathon Review is rapid Q&A from books. Pension and Joining Period calculators help with service math. Exam Routine shows dates and countdowns.',
    icon: 'flash-outline',
    colors: ['#1e3a8a', '#4338ca'],
    points: ['Tap a locked tile to check access', 'Some modules need a grant or payment'],
  },
];

export function ModuleWelcomeTips({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const slide = TIPS[index];
  const last = index === TIPS.length - 1;
  const progress = useMemo(() => `${index + 1} / ${TIPS.length}`, [index]);

  async function finish() {
    await clearModuleWelcomeTipsPending();
    setIndex(0);
    onDone();
  }

  function next() {
    if (last) {
      void finish();
      return;
    }
    setIndex((i) => Math.min(i + 1, TIPS.length - 1));
  }

  function back() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => void finish()}>
      <LinearGradient colors={slide.colors} style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.topBar}>
            <Text style={styles.progress}>{progress}</Text>
            <Pressable onPress={() => void finish()} hitSlop={10} accessibilityRole="button">
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          </View>

          <View style={styles.center}>
            <View style={styles.iconHalo}>
              <View style={styles.iconCircle}>
                <Ionicons name={slide.icon} size={36} color={slide.colors[1]} />
              </View>
            </View>
            <Text style={styles.kicker}>{slide.kicker}</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>

            <View style={styles.points}>
              {slide.points.map((point) => (
                <View key={point} style={styles.point}>
                  <Ionicons name="checkmark-circle" size={18} color="rgba(255,255,255,0.95)" />
                  <Text style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.dots}>
              {TIPS.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
              ))}
            </View>
            <View style={styles.navRow}>
              {index > 0 ? (
                <Pressable
                  style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
                  onPress={back}
                  accessibilityRole="button"
                  accessibilityLabel="Previous tip"
                >
                  <Ionicons name="chevron-back" size={20} color={colors.white} />
                </Pressable>
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.nextBtn, pressed && styles.pressed]}
                onPress={next}
                accessibilityRole="button"
              >
                <Text style={styles.nextText}>{last ? "Let's go" : 'Next'}</Text>
                {!last ? <Ionicons name="arrow-forward" size={18} color={colors.primaryDark} /> : null}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  progress: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  skip: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xl,
  },
  iconHalo: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    lineHeight: 34,
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: spacing.lg,
  },
  points: {
    gap: 10,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pointText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
    lineHeight: 20,
  },
  footer: {
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.white,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 48,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.88,
  },
});
