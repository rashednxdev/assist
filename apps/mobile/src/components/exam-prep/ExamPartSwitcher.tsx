import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ExamPrepPartsResponse } from '@ibas/shared-types';
import { fetchExamPrepParts, selectExamPrepPart } from '@/lib/billing-api';
import { colors, spacing } from '@/theme';

/** Part 1 / Part 2 switch; the choice is saved on the account and scopes every exam-prep module. */
export function ExamPartSwitcher({ reloadKey }: { reloadKey?: number }) {
  const router = useRouter();
  const [state, setState] = useState<ExamPrepPartsResponse | null>(null);
  const [switching, setSwitching] = useState('');
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchExamPrepParts()
        .then((r) => {
          if (!cancelled) setState(r);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [reloadKey]),
  );

  async function choose(partId: string) {
    if (!state || partId === state.selected_part_id || switching) return;
    setSwitching(partId);
    setError('');
    try {
      setState(await selectExamPrepPart(partId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not switch part');
    } finally {
      setSwitching('');
    }
  }

  if (!state || state.is_admin || state.parts.length < 2) return null;
  const current = state.parts.find((p) => p.id === state.selected_part_id);

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>STUDYING</Text>
      <View style={styles.segment}>
        {state.parts.map((p) => {
          const on = p.id === state.selected_part_id;
          return (
            <Pressable key={p.id} onPress={() => void choose(p.id)} disabled={!!switching} style={[styles.seg, on && styles.segOn]}>
              {switching === p.id ? <ActivityIndicator size="small" color={on ? colors.white : colors.primary} /> : null}
              <Text style={[styles.segText, on && styles.segTextOn]} numberOfLines={1}>
                {p.label}
              </Text>
              <Text style={[styles.segSub, on && styles.segSubOn]}>
                {p.whole_part ? 'All subjects' : `${p.owned_count}/${p.subjects.length} subjects`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {current && !current.whole_part ? (
        <Pressable
          onPress={() => router.push(`/(app)/pricing?tab=exam_prep&part=${current.id}` as Href)}
          style={({ pressed }) => [styles.buy, pressed && styles.pressed]}
        >
          <Ionicons name="cart-outline" size={16} color={colors.primary} />
          <Text style={styles.buyText}>
            {current.owned_count === 0 ? `Buy subjects of ${current.label}` : `Add more subjects of ${current.label}`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.textMuted, marginLeft: 4 },
  segment: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 12, padding: 4, gap: 4 },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10, gap: 1 },
  segOn: { backgroundColor: colors.primary },
  segText: { fontSize: 14, fontWeight: '800', color: colors.text },
  segTextOn: { color: colors.white },
  segSub: { fontSize: 11, color: colors.textMuted },
  segSubOn: { color: 'rgba(255,255,255,0.85)' },
  buy: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 4 },
  buyText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.primary },
  pressed: { opacity: 0.7 },
  error: { fontSize: 12, color: colors.error, marginLeft: 4 },
});
