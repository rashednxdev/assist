import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { youtubeEmbedUrl, type LiveStreamRecordedContent } from '@ibas/shared-types';
import { colors, spacing } from '@/theme';

interface Props {
  items: LiveStreamRecordedContent[];
  classTopic?: string;
}

/** Embedded YouTube list for previous live classes (screen capture blocked by parent). */
export function LiveClassRecordedVideos({ items, classTopic }: Props) {
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(0);
  const valid = useMemo(
    () =>
      items
        .map((item) => ({
          title: item.title?.trim() || '',
          youtube_url: item.youtube_url,
          embed: youtubeEmbedUrl(item.youtube_url),
        }))
        .filter((x) => Boolean(x.embed)),
    [items],
  );

  if (valid.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No recorded video yet</Text>
        <Text style={styles.emptyBody}>
          When the admin adds YouTube links for this class, they will play here.
        </Text>
      </View>
    );
  }

  const current = valid[Math.min(active, valid.length - 1)]!;
  const playerH = Math.round((Math.min(width - spacing.lg * 2, width) * 9) / 16);

  return (
    <View style={styles.root}>
      {classTopic ? <Text style={styles.classTopic}>{classTopic}</Text> : null}
      <Text style={styles.label}>
        Recorded class · {valid.length} video{valid.length === 1 ? '' : 's'}
      </Text>
      {valid.length > 1 ? (
        <View style={styles.tabs}>
          {valid.map((item, index) => (
            <Pressable
              key={`${item.youtube_url}-${index}`}
              style={[styles.tab, index === active && styles.tabActive]}
              onPress={() => setActive(index)}
            >
              <Text style={[styles.tabText, index === active && styles.tabTextActive]} numberOfLines={1}>
                {item.title || `Part ${index + 1}`}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {current.title ? <Text style={styles.partTitle}>{current.title}</Text> : null}
      <View style={[styles.player, { height: playerH }]}>
        <WebView
          source={{ uri: current.embed! }}
          style={styles.webview}
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, paddingBottom: spacing.md },
  classTopic: { fontSize: 18, fontWeight: '800', color: colors.text },
  label: { fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase' },
  partTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: '#fce7f3', borderColor: '#f9a8d4' },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted, maxWidth: 140 },
  tabTextActive: { color: '#9d174d' },
  player: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#020617',
  },
  webview: { flex: 1, backgroundColor: '#020617' },
  empty: { padding: spacing.lg, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  emptyBody: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
});
