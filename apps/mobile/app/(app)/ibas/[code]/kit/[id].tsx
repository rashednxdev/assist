import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { ToolkitItemDetail } from '@ibas/shared-types';
import { Badge, FileLinks, IbasCard, IbasErrorScreen, IbasLoading, ibasStyles, RefChips } from '@/components/ibas/IbasBits';
import { ChecklistRunner } from '@/components/ibas/ChecklistRunner';
import { TemplateFiller } from '@/components/ibas/TemplateFiller';
import { GuideReader } from '@/components/ibas/GuideReader';
import { fetchToolkitItem } from '@/lib/ibas-api';
import { useIbasAreas } from '@/lib/ibas-areas';
import { colors } from '@/theme';

const KIND_LABEL = { checklist: 'Checklist', template: 'Template', guide: 'Guide' } as const;

export default function AreaKitScreen() {
  const { code, id } = useLocalSearchParams<{ code: string; id: string }>();
  const { areaColor } = useIbasAreas();
  const scrollRef = useRef<ScrollView>(null);
  const [item, setItem] = useState<ToolkitItemDetail | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setItem(await fetchToolkitItem(id));
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

  const accent = code ? areaColor(code) : colors.primary;
  if (!item || !code) return error ? <IbasErrorScreen message={error} /> : <IbasLoading color={accent} />;

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
          <IbasCard accent={accent}>
            <View style={ibasStyles.row}>
              <Badge label={KIND_LABEL[item.kind]} color={accent} filled />
              <Badge label={item.category_label} color={accent} />
              {!item.is_published ? <Badge label="Draft" color={colors.warning} /> : null}
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
            {item.refs.length > 0 ? (
              <>
                <Text style={ibasStyles.label}>Governing rules & circulars</Text>
                <RefChips code={code} refs={item.refs} color={accent} />
              </>
            ) : null}
            {item.attachments.length > 0 ? (
              <>
                <Text style={ibasStyles.label}>Files ({item.attachments.length})</Text>
                <FileLinks files={item.attachments} />
              </>
            ) : null}
          </IbasCard>

          {item.kind === 'checklist' ? <ChecklistRunner item={item} code={code} color={accent} /> : null}
          {item.kind === 'template' ? <TemplateFiller item={item} color={accent} /> : null}
          {item.kind === 'guide' ? (
            <GuideReader item={item} code={code} color={accent} onJump={(y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true })} />
          ) : null}

          <Text style={ibasStyles.disclaimer}>Always verify against the latest official rules and circulars before acting on this content.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
