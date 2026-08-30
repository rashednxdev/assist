import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { LiveClassRecordedVideos } from '@/components/live/LiveClassRecordedVideos';
import {
  fetchLiveStream,
  joinLiveStream,
  sendLiveStreamMessage,
  type LiveStreamListItem,
} from '@/lib/live-stream-api';
import { useAuth } from '@/lib/auth-context';
import {
  canBypassLiveCaptureBlock,
  setLiveGuestCaptureBlocked,
} from '@/lib/live-screen-capture';
import {
  buildZoomGuestAutoNameJoinScript,
  buildZoomGuestUiLockScript,
  ensureGuestListenPermissions,
  ensureGuestSpeakPermissions,
  filterZoomMediaResources,
  withZoomGuestIdentity,
  zoomGuestDisplayName,
} from '@/lib/zoom-guest-webview';
import { startLiveAudioSession, stopLiveAudioSession } from '@/lib/live-audio-session';
import type { LiveStreamJoinPayload } from '@ibas/shared-types';
import { isZoomJoinPayload } from '@ibas/shared-types';
import { colors, spacing } from '@/theme';

function permissionCard(
  status: LiveStreamListItem['permission_status'],
  accessType: LiveStreamListItem['access_type'],
  hasPaid: boolean,
) {
  if (status === 'permitted' || status === 'host') {
    const paidAccess =
      accessType === 'paid' && hasPaid
        ? 'As a paid user, you can join this paid class when it is live (no invite needed).'
        : accessType === 'paid'
          ? 'This is a paid class. Pay or ask an admin to mark your account as paid.'
          : 'Watch and participate when the class is live. You join muted until the host allows speaking.';
    return {
      title: 'You are permitted to join',
      body: paidAccess,
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

export default function LiveStreamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [session, setSession] = useState<LiveStreamListItem | null>(null);
  const [join, setJoin] = useState<LiveStreamJoinPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgBusy, setMsgBusy] = useState(false);
  const [allowMessages, setAllowMessages] = useState(false);
  const [allowSpeech, setAllowSpeech] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [webviewReady, setWebviewReady] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchLiveStream(id);
      if (data.video_platform === 'agora') {
        setError('This class uses legacy video and is not supported in the app. Ask the host for a new live class.');
        setSession(null);
        return;
      }
      setSession(data);
      setAllowMessages(Boolean(data.allow_guest_messages));
      setAllowSpeech(Boolean(data.allow_guest_speech));
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
        setJoin(null);
        stopLiveAudioSession();
        void setLiveGuestCaptureBlocked(false);
      };
    }, [load]),
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!join || canBypassLiveCaptureBlock(user)) return;
    void setLiveGuestCaptureBlocked(true);
    return () => {
      void setLiveGuestCaptureBlocked(false);
    };
  }, [join, user?.user_type, user?.is_super_admin]);

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
        setAllowSpeech(Boolean(data.allow_guest_speech));
        setSession(data);
        if (data.status !== 'live') {
          setJoin(null);
          Alert.alert(
            data.status === 'paused' ? 'Class paused' : 'Class ended',
            data.status === 'paused'
              ? 'The host paused this session. You left the video room.'
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

  useEffect(() => {
    if (!join) return;
    const guestName = isZoomJoinPayload(join) ? zoomGuestDisplayName(join, user) : 'Guest';
    const t = setTimeout(() => {
      webViewRef.current?.injectJavaScript(buildZoomGuestAutoNameJoinScript(guestName));
      webViewRef.current?.injectJavaScript(buildZoomGuestUiLockScript(allowSpeech));
    }, 400);
    // Re-assert audio routing after Zoom WebRTC starts
    const audioKick = setTimeout(() => startLiveAudioSession(), 1500);
    const audioKick2 = setTimeout(() => startLiveAudioSession(), 4000);
    return () => {
      clearTimeout(t);
      clearTimeout(audioKick);
      clearTimeout(audioKick2);
    };
  }, [join, allowSpeech, user]);

  useEffect(() => {
    if (!join || !allowSpeech) return;
    void ensureGuestSpeakPermissions();
  }, [join, allowSpeech]);

  useEffect(() => {
    if (!join) {
      setWebviewReady(false);
      return;
    }
    startLiveAudioSession();
    void ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      stopLiveAudioSession();
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [join]);

  const isPrevious = Boolean(session?.is_previous) || session?.status === 'ended';
  const presentations = session?.presentations ?? [];
  const slides = session?.slides ?? [];
  const hasSlides =
    presentations.length > 0 || slides.length > 0 || (session?.slide_count ?? 0) > 0;
  const recordedContents = session?.recorded_contents ?? [];
  const canViewPresentation = Boolean(session?.can_view_presentation);
  const isPaidOrAdmin =
    user?.has_paid === true ||
    Boolean(user?.is_super_admin) ||
    user?.user_type === 'admin' ||
    user?.user_type === 'system_admin';
  /** Previous classes open recordings/presentations directly — no Join button. */
  const showPresentation = reviewing || (isPrevious && isPaidOrAdmin);
  const startAroundLabel = session
    ? new Date(session.scheduled_at).toLocaleString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const joinBtnLabel = (() => {
    if (!session) return 'Join live class';
    if (session.permission_status === 'not_permitted') return 'Join locked';
    if (session.payment_blocked) return 'Payment required';
    if (session.status === 'paused') return 'Waiting for resume';
    if (session.status === 'ended') return 'Session ended';
    if (session.status === 'live') return 'Join live class';
    return `Class will Start Around ${startAroundLabel}`;
  })();
  const canPressJoin =
    Boolean(session) &&
    !busy &&
    Boolean(session?.can_join) &&
    !session?.payment_blocked &&
    session?.permission_status !== 'not_permitted' &&
    session?.status === 'live';

  useEffect(() => {
    navigation.setOptions({
      title: isPrevious ? 'Previous session' : 'Live session',
    });
  }, [navigation, isPrevious]);

  useEffect(() => {
    if (!showPresentation || canBypassLiveCaptureBlock(user)) return;
    void setLiveGuestCaptureBlocked(true);
    return () => {
      void setLiveGuestCaptureBlocked(false);
    };
  }, [showPresentation, user?.user_type, user?.is_super_admin]);

  const perm = useMemo(
    () =>
      session
        ? permissionCard(session.permission_status, session.access_type, user?.has_paid === true)
        : null,
    [session, user?.has_paid],
  );

  function leaveLiveRoom() {
    setJoin(null);
    setWebviewReady(false);
    stopLiveAudioSession();
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }

  async function handleJoin() {
    if (!id) return;
    setBusy(true);
    try {
      // Mic must be granted before WebView opens or Zoom never joins computer audio.
      const listenOk = await ensureGuestListenPermissions();
      if (!listenOk) {
        Alert.alert(
          'Microphone required',
          'Allow microphone so you can hear the host. You stay muted until the host allows speaking.',
        );
        return;
      }
      const payload = await joinLiveStream(id);
      if (!isZoomJoinPayload(payload)) {
        Alert.alert('Cannot join', 'This live class is not available in the app.');
        return;
      }
      setWebviewReady(false);
      startLiveAudioSession();
      setJoin({ ...payload, role: 'audience' });
      setAllowMessages(Boolean(payload.allow_guest_messages));
      setAllowSpeech(Boolean(payload.allow_guest_speech));
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

  if (join && isZoomJoinPayload(join)) {
    const guestName = zoomGuestDisplayName(join, user);
    const zoomUrl = withZoomGuestIdentity(join.web_client_url, guestName, join.user_email);

    return (
      <KeyboardAvoidingView
        style={styles.liveRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType={allowSpeech ? 'grant' : 'prompt'}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          androidLayerType="hardware"
          source={{ uri: zoomUrl }}
          style={styles.webviewFill}
          onLoadEnd={() => {
            setWebviewReady(true);
            startLiveAudioSession();
            webViewRef.current?.injectJavaScript(buildZoomGuestAutoNameJoinScript(guestName));
            webViewRef.current?.injectJavaScript(buildZoomGuestUiLockScript(allowSpeech));
          }}
          onPermissionRequest={(event) => {
            try {
              const resources = (event.nativeEvent.resources ?? []) as string[];
              const allowed = filterZoomMediaResources(resources, allowSpeech);
              if (allowed.length > 0) {
                event.nativeEvent.grant(allowed);
              } else if (typeof (event.nativeEvent as { deny?: () => void }).deny === 'function') {
                (event.nativeEvent as { deny: () => void }).deny();
              }
            } catch {
              // ignore
            }
          }}
        />
        {!webviewReady ? (
          <View style={styles.connectingOverlay} pointerEvents="none">
            <ActivityIndicator color="#fff" size="large" />
          </View>
        ) : null}
        <View style={styles.guestChrome} pointerEvents="box-none">
          <Pressable
            style={styles.iconBtn}
            onPress={leaveLiveRoom}
            accessibilityLabel="Leave live class"
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          {!allowSpeech ? (
            <View style={styles.iconBadge} accessibilityLabel="Listen only — mic and camera off">
              <Ionicons name="videocam-off-outline" size={16} color="#fde68a" />
              <Ionicons name="mic-off-outline" size={18} color="#fde68a" />
            </View>
          ) : null}
          {allowMessages ? (
            <View style={styles.msgBarTop}>
              <TextInput
                style={styles.msgInput}
                value={msgBody}
                onChangeText={setMsgBody}
                placeholder="…"
                placeholderTextColor="#64748b"
                maxLength={500}
                editable={!msgBusy}
                returnKeyType="send"
                onSubmitEditing={() => void handleSendMessage()}
              />
              <Pressable
                style={[styles.iconBtn, styles.msgSendIcon, (msgBusy || !msgBody.trim()) && styles.msgSendDisabled]}
                disabled={msgBusy || !msgBody.trim()}
                onPress={() => void handleSendMessage()}
                accessibilityLabel="Send message"
              >
                {msgBusy ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
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
      <ScrollView style={styles.root} contentContainerStyle={styles.reviewContent}>
        {reviewing && !isPrevious ? (
          <View style={styles.reviewBar}>
            <Pressable style={styles.reviewClose} onPress={() => setReviewing(false)}>
              <Text style={styles.reviewCloseText}>Close review</Text>
            </Pressable>
            <Text style={styles.reviewHint}>Admin preview</Text>
          </View>
        ) : null}
        {isPrevious ? (
          <View style={styles.previousHeader}>
            <Text style={styles.previousTitle}>{session.topic}</Text>
            <Text style={styles.previousMeta}>
              {new Date(session.scheduled_at).toLocaleString()}
            </Text>
          </View>
        ) : null}
        {!canViewPresentation ? (
          <View style={[styles.permCard, { backgroundColor: '#fff1f2', borderColor: '#fecdd3', margin: spacing.lg }]}>
            <Text style={[styles.permTitle, { color: '#9f1239' }]}>Content locked</Text>
            <Text style={[styles.permBody, { color: '#9f1239' }]}>
              {isPaidOrAdmin
                ? 'Recordings for this class are not available yet, or access could not be verified. Pull to refresh or try again.'
                : 'Previous class recordings are available for paid users.'}
            </Text>
          </View>
        ) : null}
        {canViewPresentation && recordedContents.length === 0 && !hasSlides ? (
          <View style={{ padding: spacing.lg }}>
            <Text style={styles.detailsText}>
              No recordings or presentations published for this class yet.
            </Text>
          </View>
        ) : null}
        {canViewPresentation && recordedContents.length > 0 ? (
          <View style={styles.recordedBlock}>
            <LiveClassRecordedVideos items={recordedContents} />
          </View>
        ) : null}
        {canViewPresentation && hasSlides ? (
          <LiveClassPresentation
            presentations={presentations}
            slides={slides}
            classTopic={recordedContents.length ? undefined : session.topic}
          />
        ) : null}
      </ScrollView>
    );
  }

  if (isPrevious && !isPaidOrAdmin) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.topic}>{session.topic}</Text>
        <View style={[styles.permCard, { backgroundColor: '#fffbeb', borderColor: '#fcd34d' }]}>
          <Text style={[styles.permTitle, { color: '#92400e' }]}>Paid users only</Text>
          <Text style={[styles.permBody, { color: '#92400e' }]}>
            Previous class recordings and presentations are available for paid users.
          </Text>
        </View>
      </ScrollView>
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
            ? 'Previous class recordings are available for paid users without an invite.'
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

      {canViewPresentation &&
      ((session.slide_count ?? slides.length) > 0 ||
        (session.presentation_count ?? presentations.length) > 0 ||
        (session.recorded_content_count ?? recordedContents.length) > 0) ? (
        <View style={styles.detailsCard}>
          <Text style={styles.detailsLabel}>
            {isPrevious ? 'Class recordings & slides' : 'Class content (review)'}
          </Text>
          <Text style={styles.detailsText}>
            {(session.recorded_content_count ?? recordedContents.length) > 0
              ? `${session.recorded_content_count ?? recordedContents.length} recorded video${
                  (session.recorded_content_count ?? recordedContents.length) === 1 ? '' : 's'
                }`
              : null}
            {(session.recorded_content_count ?? recordedContents.length) > 0 &&
            ((session.presentation_count ?? presentations.length) > 0 ||
              (session.slide_count ?? slides.length) > 0)
              ? ' · '
              : ''}
            {(session.presentation_count ?? presentations.length) > 1
              ? `${session.presentation_count ?? presentations.length} presentations`
              : (session.slide_count ?? slides.length) > 0
                ? `${session.slide_count ?? slides.length} slide${
                    (session.slide_count ?? slides.length) === 1 ? '' : 's'
                  }`
                : null}
            {isPrevious
              ? ' for this class.'
              : ' — open anytime to review before or during the session.'}
          </Text>
          {!isPrevious ? (
            <Pressable style={styles.reviewBtn} onPress={() => setReviewing(true)}>
              <Text style={styles.reviewBtnText}>Review class content</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (session.slide_count ?? 0) > 0 ||
        (session.presentation_count ?? 0) > 0 ||
        (session.recorded_content_count ?? 0) > 0 ? (
        <View style={styles.detailsCard}>
          <Text style={styles.detailsLabel}>Content ready</Text>
          <Text style={styles.detailsText}>
            Recordings and slides will open here after the class ends (for permitted users).
          </Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.joinBtn, !canPressJoin && styles.joinBtnDisabled]}
        disabled={!canPressJoin}
        onPress={() => void handleJoin()}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.joinBtnText}>{joinBtnLabel}</Text>
        )}
      </Pressable>
      {session.status === 'scheduled' ? (
        <Text style={styles.joinHint}>
          Join opens when the host starts the class. Your name is filled automatically.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  reviewContent: { paddingBottom: spacing.xl, gap: spacing.md },
  recordedBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  liveRoot: { flex: 1, backgroundColor: '#020617' },
  webviewFill: { ...StyleSheet.absoluteFillObject, backgroundColor: '#020617' },
  connectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  guestChrome: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 88 : 64,
    left: 12,
    right: 12,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.72)',
  },
  iconBadge: {
    minWidth: 52,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(120,53,15,0.75)',
  },
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
  joinBtnText: { color: colors.white, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  joinHint: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -4,
  },
  previousHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: 4,
  },
  previousTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  previousMeta: { fontSize: 13, color: colors.textMuted },
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 22,
    backgroundColor: 'rgba(15,23,42,0.72)',
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
  msgSendIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#be185d',
  },
  msgSendDisabled: { opacity: 0.45 },
});
