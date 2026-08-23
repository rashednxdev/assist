import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { BookError, BookLoading } from '@/components/books/BookStates';
import { BookRichText } from '@/components/books/BookRichText';
import { LiveClassPresentation } from '@/components/live/LiveClassPresentation';
import {
  fetchLiveStream,
  joinLiveStream,
  sendLiveStreamMessage,
  type LiveStreamListItem,
} from '@/lib/live-stream-api';
import type { LiveStreamJoinPayload } from '@ibas/shared-types';
import { colors, spacing } from '@/theme';

function permissionCard(status: LiveStreamListItem['permission_status']) {
  if (status === 'permitted' || status === 'host') {
    return {
      title: 'You are permitted to join',
      body: 'Watch as a viewer when the class is live. Host broadcasting is only from the web admin page.',
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
        await client.setClientRole('audience');
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
        status.textContent = 'Joined — waiting for host…';
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
  const [session, setSession] = useState<LiveStreamListItem | null>(null);
  const [join, setJoin] = useState<LiveStreamJoinPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgBusy, setMsgBusy] = useState(false);
  const [allowMessages, setAllowMessages] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchLiveStream(id);
      setSession(data);
      setAllowMessages(Boolean(data.allow_guest_messages));
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

  useEffect(() => {
    if (!join || !id) return;
    let cancelled = false;
    async function refreshFlag() {
      try {
        const data = await fetchLiveStream(id);
        if (!cancelled) {
          setAllowMessages(Boolean(data.allow_guest_messages));
          setSession(data);
        }
      } catch {
        // ignore
      }
    }
    const timer = setInterval(() => void refreshFlag(), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [join, id]);

  const isPrevious = Boolean(session?.is_previous) || session?.status === 'ended';
  const slides = session?.slides ?? [];
  const canViewPresentation = Boolean(session?.can_view_presentation);
  /** Previous classes open the deck automatically; upcoming admin review uses a button. */
  const showPresentation =
    reviewing || (isPrevious && canViewPresentation);

  const perm = useMemo(
    () => (session ? permissionCard(session.permission_status) : null),
    [session],
  );

  async function handleJoin() {
    if (!id) return;
    setBusy(true);
    try {
      const payload = await joinLiveStream(id);
      setJoin({ ...payload, role: 'audience' });
      setAllowMessages(Boolean(payload.allow_guest_messages));
    } catch (err) {
      Alert.alert('Cannot join', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage() {
    if (!id || !msgBody.trim()) return;
    setMsgBusy(true);
    try {
      await sendLiveStreamMessage(id, msgBody.trim());
      setMsgBody('');
      Alert.alert('Sent', 'Your message was delivered to the host.');
    } catch (err) {
      Alert.alert('Could not send', err instanceof Error ? err.message : 'Try again');
    } finally {
      setMsgBusy(false);
    }
  }

  if (loading && !session) return <BookLoading />;
  if (error && !session) return <BookError message={error} />;
  if (!session || !perm) return null;

  if (join) {
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <WebView
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          source={{ html: agoraHtml(join) }}
          style={styles.webview}
        />
        {allowMessages ? (
          <View style={styles.msgBar}>
            <TextInput
              style={styles.msgInput}
              value={msgBody}
              onChangeText={setMsgBody}
              placeholder="Message the host…"
              placeholderTextColor="#94a3b8"
              maxLength={500}
              editable={!msgBusy}
              returnKeyType="send"
              onSubmitEditing={() => void handleSendMessage()}
            />
            <Pressable
              style={[styles.msgSend, (msgBusy || !msgBody.trim()) && styles.msgSendDisabled]}
              disabled={msgBusy || !msgBody.trim()}
              onPress={() => void handleSendMessage()}
            >
              {msgBusy ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.msgSendText}>Send</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.msgOff}>
            <Text style={styles.msgOffText}>Host has disallowed guest messages</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  if (showPresentation) {
    return (
      <View style={styles.root}>
        {!isPrevious || reviewing ? (
          <View style={styles.reviewBar}>
            <Pressable style={styles.reviewClose} onPress={() => setReviewing(false)}>
              <Text style={styles.reviewCloseText}>Close review</Text>
            </Pressable>
            <Text style={styles.reviewHint}>Admin preview</Text>
          </View>
        ) : null}
        <LiveClassPresentation slides={slides} classTopic={session.topic} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.topic}>{session.topic}</Text>
      <Text style={styles.meta}>
        {new Date(session.scheduled_at).toLocaleString()} ·{' '}
        {isPrevious ? 'Previous class' : session.status}
      </Text>

      <View style={[styles.permCard, { backgroundColor: perm.bg, borderColor: perm.border }]}>
        <Text style={[styles.permTitle, { color: perm.color }]}>
          {isPrevious && !canViewPresentation ? 'Presentation locked' : perm.title}
        </Text>
        <Text style={[styles.permBody, { color: perm.color }]}>
          {isPrevious && !canViewPresentation
            ? 'You can see this previous class in the list, but an admin must invite you to open the presentation.'
            : perm.body}
        </Text>
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
          <BookRichText html={session.details} style={styles.detailsText} />
        </View>
      ) : null}

      {canViewPresentation && (session.slide_count ?? slides.length) > 0 ? (
        <View style={styles.detailsCard}>
          <Text style={styles.detailsLabel}>
            {isPrevious ? 'Presentation' : 'Class content (review)'}
          </Text>
          <Text style={styles.detailsText}>
            {session.slide_count ?? slides.length} slide
            {(session.slide_count ?? slides.length) === 1 ? '' : 's'}
            {isPrevious
              ? ' published for this class.'
              : ' — open anytime to review before or during the session.'}
          </Text>
          {!isPrevious ? (
            <Pressable style={styles.reviewBtn} onPress={() => setReviewing(true)}>
              <Text style={styles.reviewBtnText}>Review presentation</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (session.slide_count ?? 0) > 0 && !canViewPresentation ? (
        <View style={styles.detailsCard}>
          <Text style={styles.detailsLabel}>Presentation ready</Text>
          <Text style={styles.detailsText}>
            {session.slide_count} slide
            {session.slide_count === 1 ? '' : 's'} will open here after the class ends (for invited
            users).
          </Text>
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
  reviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  reviewClose: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#fce7f3',
  },
  reviewCloseText: { fontSize: 13, fontWeight: '800', color: '#9d174d' },
  reviewHint: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  reviewBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBtnText: { color: '#9d174d', fontSize: 15, fontWeight: '800' },
  msgBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: colors.surface,
  },
  msgInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#fff',
  },
  msgSend: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#be185d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgSendDisabled: { opacity: 0.45 },
  msgSendText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  msgOff: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  msgOffText: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
