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
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';
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

/** Guest playback: 100 = original. Soft gain only — high boost clips into rumble/engine noise. */
const GUEST_AUDIO_VOLUME = 110;

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
    boost: GUEST_AUDIO_VOLUME,
  });
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
  <style>
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;width:100%;height:100%;background:#020617;color:#fff;font-family:system-ui,sans-serif;overflow:hidden}
    #stage{position:fixed;inset:0;background:#020617}
    #player{position:absolute;inset:0;width:100%;height:100%}
    #player video{width:100%!important;height:100%!important;object-fit:contain!important;background:#020617}
    #status{
      position:absolute;left:10px;right:10px;top:118px;z-index:2;
      padding:8px 12px;border-radius:10px;background:rgba(15,23,42,.72);
      font-size:12px;line-height:1.35;pointer-events:none
    }
    #soundGate{
      position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;
      background:rgba(2,6,23,.78);padding:24px
    }
    #soundGate button{
      border:0;border-radius:14px;padding:14px 22px;font-size:16px;font-weight:800;
      background:#be185d;color:#fff
    }
    #soundGate.hidden{display:none}
    #audioHost{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  </style>
  <script src="https://download.agora.io/sdk/release/AgoraRTC_N.js"></script>
</head>
<body>
  <div id="stage">
    <div id="player"></div>
    <div id="audioHost"></div>
    <div id="status">Connecting…</div>
    <div id="soundGate"><button type="button" id="soundBtn">Tap to hear host</button></div>
  </div>
  <script>
    (async () => {
      const cfg = ${payload};
      const boost = cfg.boost || 110;
      const status = document.getElementById('status');
      const player = document.getElementById('player');
      const audioHost = document.getElementById('audioHost');
      const soundGate = document.getElementById('soundGate');
      const soundBtn = document.getElementById('soundBtn');
      const remoteAudio = [];
      let client = null;
      let soundReady = false;
      let left = false;

      function setTrackVolume(track) {
        try { track.setVolume(boost); } catch (e) {
          try { track.setVolume(100); } catch (e2) {}
        }
      }

      function playAudio(track) {
        if (!track) return;
        setTrackVolume(track);
        try {
          var el = document.createElement('audio');
          el.autoplay = true;
          el.setAttribute('playsinline', 'true');
          el.controls = false;
          el.volume = 1;
          el.muted = false;
          audioHost.appendChild(el);
          track.play(el);
        } catch (e) {
          try { track.play(); } catch (e2) {}
        }
        if (remoteAudio.indexOf(track) < 0) remoteAudio.push(track);
      }

      async function subscribeUser(user, mediaType) {
        await client.subscribe(user, mediaType);
        if (mediaType === 'video' && user.videoTrack) {
          player.innerHTML = '';
          user.videoTrack.play(player, { fit: 'contain' });
          status.textContent = soundReady ? 'Watching live (full screen)' : 'Video on — tap to hear host';
        }
        if (mediaType === 'audio' && user.audioTrack) {
          playAudio(user.audioTrack);
          if (!soundReady) status.textContent = 'Host audio ready — tap to hear host';
        }
      }

      async function subscribeExisting() {
        if (!client) return;
        for (var i = 0; i < client.remoteUsers.length; i++) {
          var user = client.remoteUsers[i];
          try {
            if (user.hasAudio) await subscribeUser(user, 'audio');
            if (user.hasVideo) await subscribeUser(user, 'video');
          } catch (e) {}
        }
      }

      async function leaveChannel() {
        if (left) return;
        left = true;
        try {
          if (client) {
            await client.leave();
            client.removeAllListeners();
          }
        } catch (e) {}
        client = null;
      }

      async function unlockSound() {
        soundReady = true;
        soundGate.classList.add('hidden');
        try {
          var Ctx = window.AudioContext || window.webkitAudioContext;
          if (Ctx) {
            var ctx = new Ctx();
            if (ctx.state === 'suspended') await ctx.resume();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            gain.gain.value = 0.0001;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.05);
          }
        } catch (e) {}
        await subscribeExisting();
        remoteAudio.forEach(function (t) {
          try { setTrackVolume(t); t.play(); } catch (e) {}
        });
        Array.prototype.forEach.call(audioHost.querySelectorAll('audio'), function (el) {
          try { el.muted = false; el.volume = 1; el.play(); } catch (e) {}
        });
        status.textContent = 'Sound on';
      }

      soundBtn.addEventListener('click', function () { unlockSound(); });
      window.addEventListener('pagehide', function () { leaveChannel(); });
      window.addEventListener('beforeunload', function () { leaveChannel(); });

      try {
        client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        await client.setClientRole('audience');
        client.on('user-published', async function (user, mediaType) {
          try { await subscribeUser(user, mediaType); } catch (e) {}
        });
        client.on('user-unpublished', function (user, mediaType) {
          if (mediaType === 'video') {
            player.innerHTML = '';
            status.textContent = 'Waiting for host…';
          }
        });
        await client.join(cfg.appId, cfg.channel, cfg.token, cfg.uid);
        await subscribeExisting();
        status.textContent = 'Joined — tap to hear host';
      } catch (e) {
        status.textContent = e && e.message ? e.message : 'Join failed';
        soundGate.classList.add('hidden');
      }
    })();
  </script>
</body>
</html>`;
}

export default function LiveStreamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
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
      return () => {
        // Leaving this screen closes the Agora WebView → stops guest minutes.
        setJoin(null);
      };
    }, [load]),
  );

  // Hide nav header while watching so video is full-screen.
  useEffect(() => {
    navigation.setOptions({ headerShown: !join });
  }, [navigation, join]);

  useEffect(() => {
    if (!join || !id) return;
    let cancelled = false;
    async function refreshFlag() {
      try {
        const data = await fetchLiveStream(id);
        if (cancelled) return;
        setAllowMessages(Boolean(data.allow_guest_messages));
        setSession(data);
        // Host ended/paused → leave channel (cost + UX).
        if (data.status !== 'live') {
          setJoin(null);
          Alert.alert(
            data.status === 'paused' ? 'Class paused' : 'Class ended',
            data.status === 'paused'
              ? 'The host paused this session. You left the video room to save connection time.'
              : 'The host ended this session. You left the video room.',
          );
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

  // Allow portrait + landscape while watching so the full shared screen fits.
  useEffect(() => {
    if (!join) return;
    let cancelled = false;
    void ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      cancelled = true;
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      void cancelled;
    };
  }, [join]);

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

  function leaveLiveRoom() {
    setJoin(null);
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }

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
        style={styles.liveRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <WebView
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          androidLayerType="hardware"
          source={{ html: agoraHtml(join) }}
          style={styles.webviewFill}
        />
        <View style={styles.topOverlay} pointerEvents="box-none">
          <Pressable style={styles.leaveBtn} onPress={leaveLiveRoom}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
            <Text style={styles.leaveBtnText}>Leave</Text>
          </Pressable>
          {allowMessages ? (
            <View style={styles.msgBarTop}>
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
          ) : null}
        </View>
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

      {session.payment_blocked ? (
        <View style={[styles.permCard, { backgroundColor: '#fffbeb', borderColor: '#fcd34d' }]}>
          <Text style={[styles.permTitle, { color: '#92400e' }]}>Paid class — payment required</Text>
          <Text style={[styles.permBody, { color: '#92400e' }]}>
            {session.payment_required_message ??
              'This Live Class only for Paid User. You are unpaid Mode. Pay to Enjoy Live Class.'}
          </Text>
        </View>
      ) : null}

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
            session.payment_blocked ||
            session.permission_status === 'not_permitted' ||
            session.status === 'paused' ||
            session.status === 'ended') &&
            styles.joinBtnDisabled,
        ]}
        disabled={
          busy ||
          !session.can_join ||
          session.payment_blocked ||
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
              : session.payment_blocked
                ? 'Payment required'
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
  liveRoot: { flex: 1, backgroundColor: '#020617' },
  webviewFill: { ...StyleSheet.absoluteFillObject, backgroundColor: '#020617' },
  topOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 12,
    left: 12,
    right: 12,
    zIndex: 20,
    gap: 8,
  },
  leaveBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.78)',
  },
  leaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
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
  msgBarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.88)',
  },
  msgInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#f8fafc',
    backgroundColor: '#0f172a',
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
});
