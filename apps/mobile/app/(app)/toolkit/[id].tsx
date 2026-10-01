import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ToolkitItemDetail } from '@ibas/shared-types';
import { Badge, FileLinks, IbasCard, IbasErrorScreen, IbasLoading, ibasStyles, RefChips } from '@/components/ibas/IbasBits';
import { ChecklistRunner } from '@/components/ibas/ChecklistRunner';
import { TemplateFiller } from '@/components/ibas/TemplateFiller';
import { GuideReader } from '@/components/ibas/GuideReader';
import { fetchIbasAreas, fetchToolkitItem } from '@/lib/ibas-api';
import { useIbasAreas } from '@/lib/ibas-areas';
import { colors } from '@/theme';

const TK = '#0f766e';
const KIND_LABEL = { checklist: 'Checklist', template: 'Template', guide: 'Guide' } as const;

export default function ToolkitItemScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { areaName, areaColor } = useIbasAreas();
  const scrollRef = useRef<ScrollView>(null);
  const [item, setItem] = useState<ToolkitItemDetail | null>(null);
  const [openArea, setOpenArea] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [detail, areas] = await Promise.all([fetchToolkitItem(id), fetchIbasAreas().catch(() => [])]);
      setItem(detail);
      const open = detail.areas.find((a) => areas.some((x) => x.code === a && x.access === 'open'));
      setOpenArea(open ?? detail.areas[0] ?? '');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!item) return error ? <IbasErrorScreen message={error} /> : <IbasLoading color={TK} />;

  return (
    <>
      <Stack.Screen options={{ title: KIND_LABEL[item.kind] }} />
      <KeyboardAvoidingView style={ibasStyles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView
          ref={scrollRef}
          style={ibasStyles.root}
          contentContainerStyle={ibasStyles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
        >
          <IbasCard accent={TK}>
            <View style={ibasStyles.row}>
              <Badge label={KIND_LABEL[item.kind]} color={TK} filled />
              <Badge label={item.category_label} color={TK} />
              {!item.is_published ? <Badge label="Draft — only admins can see this" color={colors.warning} /> : null}
            </View>
            <Text style={ibasStyles.title} selectable>
              {item.title}
            </Text>
            {item.title_bn ? <Text style={ibasStyles.titleBn}>{item.title_bn}</Text> : null}
            {item.summary ? (
              <Text style={ibasStyles.body} selectable>
                {item.summary}
              </Text>
            ) : null}
            {item.areas.length > 0 ? (
              <View style={ibasStyles.row}>
                {item.areas.map((a) => (
                  <Pressable key={a} onPress={() => router.push(`/(app)/ibas/${a}` as Href)} style={({ pressed }) => [styles.area, { borderColor: areaColor(a) }, pressed && styles.pressed]}>
                    <Ionicons name="briefcase-outline" size={12} color={areaColor(a)} />
                    <Text style={[styles.areaText, { color: areaColor(a) }]} numberOfLines={1}>
                      {areaName(a)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {item.refs.length > 0 && openArea ? (
              <>
                <Text style={ibasStyles.label}>Governing rules & circulars</Text>
                <RefChips code={openArea} refs={item.refs} color={TK} />
              </>
            ) : null}
            {item.attachments.length > 0 ? (
              <>
                <Text style={ibasStyles.label}>Files ({item.attachments.length})</Text>
                <FileLinks files={item.attachments} />
              </>
            ) : null}
          </IbasCard>

          {item.kind === 'checklist' ? <ChecklistRunner item={item} code={openArea} color={TK} /> : null}
          {item.kind === 'template' ? <TemplateFiller item={item} color={TK} /> : null}
          {item.kind === 'guide' ? (
            <GuideReader item={item} code={openArea} color={TK} onJump={(y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true })} />
          ) : null}

          <Text style={ibasStyles.disclaimer}>Always verify against the latest official rules and circulars before acting on this content.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  area: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  areaText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
  },
});
