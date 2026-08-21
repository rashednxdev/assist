import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { BookError, BookLoading } from '@/components/books/BookStates';
import {
  fetchLiveStream,
  joinLiveStream,
  type LiveStreamListItem,
} from '@/lib/live-stream-api';
import type { LiveStreamJoinPayload } from '@ibas/shared-types';
import { colors, spacing } from '@/theme';

function permissionCard(status: LiveStreamListItem['permission_status']) {
  if (status === 'host') {
    return {
      title: 'You can join as host',
      body: 'You are the host or an admin for this session.',
      bg: '#fffbeb',
      border: '#fde68a',
      color: '#92400e',
    };
  }
  if (status === 'permitted') {
    return {
      title: 'You are permitted to join',
      body: 'An admin invited you. Open the video room when the class is live.',
      bg: '#ecfdf5',
      border: '#a7f3d0',
      color: '#065f46',
    };
  }
  return {
    title: 'You are not permitted',
    body: 'You can see this session, but only invited users can enter the video room.',
    bg: '#fff1f2',
    border: '#fecdd3',
    color: '#9f1239',
  };
}

function agoraHtml(join: LiveStreamJoinPayload) {
  const payload = JSON.stringify({
    appId: join.app_id,
    channel: join.channel,
    token: join.token,
    uid: join.uid,
    role: join.role,
  });
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    html,body{margin:0;padding:0;background:#0f172a;color:#fff;font-family:system-ui,sans-serif;height:100%;}
    #status{padding:12px 14px;font-size:13px;opacity:.9}
    #player{width:100%;height:calc(100% - 44px);background:#020617}
    video{width:100%!important;height:100%!important;object-fit:contain}
  </style>
  <script src="https://download.agora.io/sdk/release/AgoraRTC_N.js"></script>
</head>
<body>
  <div id="status">Connecting…</div>
  <div id="player"></div>
  <script>
    (async () => {
      const cfg = ${payload};
      const status = document.getElementById('status');
      const player = document.getElementById('player');
      try {
        const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        await client.setClientRole(cfg.role === 'host' ? 'host' : 'audience');
        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === 'video') {
            player.innerHTML = '';
            user.videoTrack.play(player);
            status.textContent = 'Watching live';
          }
          if (mediaType === 'audio') user.audioTrack.play();
        });
        await client.join(cfg.appId, cfg.channel, cfg.token, cfg.uid);
        if (cfg.role === 'host') {
          const [mic, cam] = await AgoraRTC.createMicrophoneAndCameraTracks();
          cam.play(player);
          await client.publish([mic, cam]);
          status.textContent = 'You are live';
        } else {
          status.textContent = 'Joined — waiting for host…';
        }
      } catch (e) {
        status.textContent = e && e.message ? e.message : 'Join failed';
      }
    })();
  </script>
</body>
</html>`;
}

export default function LiveStreamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<(LiveStreamListItem & { invite_count?: number }) | null>(
    null,
  );
  const [join, setJoin] = useState<LiveStreamJoinPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setSession(await fetchLiveStream(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const perm = useMemo(
    () => (session ? permissionCard(session.permission_status) : null),
    [session],
  );

  async function handleJoin() {
    if (!id) return;
    setBusy(true);
    try {
      const payload = await joinLiveStream(id);
      setJoin(payload);
    } catch (err) {
      Alert.alert('Cannot join', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !session) return <BookLoading />;
  if (error && !session) return <BookError message={error} />;
  if (!session || !perm) return null;

  if (join) {
    return (
      <View style={styles.root}>
        <WebView
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          source={{ html: agoraHtml(join) }}
          style={styles.webview}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.topic}>{session.topic}</Text>
      <Text style={styles.meta}>
        {new Date(session.scheduled_at).toLocaleString()} · {session.status}
      </Text>

      <View style={[styles.permCard, { backgroundColor: perm.bg, borderColor: perm.border }]}>
        <Text style={[styles.permTitle, { color: perm.color }]}>{perm.title}</Text>
        <Text style={[styles.permBody, { color: perm.color }]}>{perm.body}</Text>
      </View>

      {session.status === 'paused' ? (
        <View style={[styles.permCard, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
          <Text style={[styles.permTitle, { color: '#9a3412' }]}>Class paused</Text>
          <Text style={[styles.permBody, { color: '#9a3412' }]}>
            The host paused this session. You can join again when it is live.
          </Text>
        </View>
      ) : null}

      {session.details ? (
        <View style={styles.detailsCard}>
          <Text style={styles.detailsLabel}>Details</Text>
          <Text style={styles.detailsText}>{session.details}</Text>
        </View>
      ) : null}

      <Pressable
        style={[
          styles.joinBtn,
          (busy ||
            !session.can_join ||
            session.permission_status === 'not_permitted' ||
            session.status === 'paused' ||
            session.status === 'ended') &&
            styles.joinBtnDisabled,
        ]}
        disabled={
          busy ||
          !session.can_join ||
          session.permission_status === 'not_permitted' ||
          session.status === 'paused' ||
          session.status === 'ended'
        }
        onPress={() => void handleJoin()}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.joinBtnText}>
            {session.permission_status === 'not_permitted'
              ? 'Join locked'
              : session.status === 'paused'
                ? 'Waiting for resume'
                : session.status === 'ended'
                  ? 'Session ended'
                  : 'Join live class'}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  webview: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  topic: { fontSize: 22, fontWeight: '800', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: -4 },
  permCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.md,
    gap: 6,
  },
  permTitle: { fontSize: 16, fontWeight: '800' },
  permBody: { fontSize: 13, lineHeight: 19, opacity: 0.95 },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  detailsLabel: { fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase' },
  detailsText: { fontSize: 14, lineHeight: 21, color: colors.text },
  joinBtn: {
    marginTop: spacing.sm,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#be185d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnDisabled: { opacity: 0.5 },
  joinBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
