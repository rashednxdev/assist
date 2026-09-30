import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CommunityCategoryRecord, CommunityLinkRecord, CommunityThreadDetail } from '@ibas/shared-types';
import { FormScroll } from '@/components/ui/FormScroll';
import { Button } from '@/components/ui/Button';
import { PickerSheet } from '@/components/ui/PickerSheet';
import { AuthorRow, Badge, LinkChips, Notice, TEAL, TagPill, VoteButton } from '@/components/community/CommunityBits';
import { PostBody } from '@/components/community/PostBody';
import { PostEditor } from '@/components/community/PostEditor';
import { AnswerCard, SmallAction } from '@/components/community/AnswerCard';
import { PostingAs, useCanPost } from '@/components/community/PostingAs';
import { ReportSheet } from '@/components/community/ReportSheet';
import { useAuth } from '@/lib/auth-context';
import {
  acceptAnswer,
  createAnswer,
  deleteThread,
  fetchCategories,
  fetchThread,
  followThread,
  moderateThread,
  timeAgo,
  voteThread,
  webUrl,
} from '@/lib/community-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

export default function CommunityThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const meId = user?.id ?? '';
  const { ready: canPost, refresh: refreshIdentity } = useCanPost();

  const [thread, setThread] = useState<CommunityThreadDetail | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState<{ type: 'thread' | 'answer'; id: string } | null>(null);
  const [categories, setCategories] = useState<CommunityCategoryRecord[]>([]);
  const [moving, setMoving] = useState(false);
  const counted = useRef(false);

  const [answerBody, setAnswerBody] = useState('');
  const [answerLinks, setAnswerLinks] = useState<CommunityLinkRecord[]>([]);
  const [posting, setPosting] = useState(false);
  const [answerError, setAnswerError] = useState('');

  const load = useCallback(
    async (countView: boolean) => {
      try {
        setThread(await fetchThread(id, countView));
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the discussion');
      }
    },
    [id],
  );

  useFocusEffect(
    useCallback(() => {
      void load(!counted.current);
      counted.current = true;
    }, [load]),
  );

  useEffect(() => {
    if (thread?.can_moderate && categories.length === 0) {
      fetchCategories()
        .then(setCategories)
        .catch(() => undefined);
    }
  }, [thread?.can_moderate, categories.length]);

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setActionError('');
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy('');
    }
  }

  const toggleFollow = () =>
    act('follow', async () => {
      const r = await followThread(id);
      setThread((t) => (t ? { ...t, following: r.following, follower_count: r.follower_count } : t));
      showToast(r.following ? 'Following — you’ll be notified of new answers' : 'Unfollowed');
    });

  const remove = () =>
    Alert.alert('Delete discussion', 'Delete this discussion and all its answers?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void act('delete', async () => {
            await deleteThread(id);
            showToast('Discussion deleted');
            router.back();
          }),
      },
    ]);

  const moderate = (key: string, patch: Parameters<typeof moderateThread>[1]) =>
    act(key, async () => {
      setThread(await moderateThread(id, patch));
    });

  async function accept(answerId: string, on: boolean) {
    await acceptAnswer(id, on ? answerId : null);
    await load(false);
  }

  async function postAnswer() {
    setAnswerError('');
    if (!canPost) return setAnswerError('Add your designation and office above before posting.');
    if (answerBody.trim().length < 2) return setAnswerError('Write your answer first.');
    setPosting(true);
    try {
      await createAnswer(id, answerBody.trim(), answerLinks);
      setAnswerBody('');
      setAnswerLinks([]);
      await load(false);
      showToast('Answer posted');
    } catch (e) {
      void refreshIdentity().catch(() => undefined);
      setAnswerError(e instanceof Error ? e.message : 'Could not post your answer');
    } finally {
      setPosting(false);
    }
  }

  function share() {
    if (!thread) return;
    void Share.share({ title: thread.title, message: `${thread.title}\n${webUrl(`/community/${thread.id}`)}` }).catch(() => undefined);
  }

  async function refresh() {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  }

  if (!thread) {
    return (
      <View style={styles.center}>
        {error ? <Notice tone="error" icon="alert-circle" text={error} /> : <ActivityIndicator size="large" color={TEAL} />}
      </View>
    );
  }

  const own = thread.author.id === meId;
  const canAnswer = !thread.is_locked || thread.can_moderate;
  const setVote = (v: { voted: boolean; vote_score: number }) => setThread((t) => (t ? { ...t, voted: v.voted, vote_score: v.vote_score } : t));

  return (
    <FormScroll refreshing={refreshing} onRefresh={() => void refresh()}>
      {thread.is_hidden ? (
        <Notice tone="warning" icon="eye-off" title="This discussion is hidden" text="A moderator hid it from the community. Only the author and admins can see it." />
      ) : null}
      {thread.is_locked ? <Notice tone="info" icon="lock-closed" title="Locked" text="This discussion is closed for new answers." /> : null}
      {actionError ? <Notice tone="error" icon="alert-circle" text={actionError} /> : null}

      <View style={styles.card}>
        <View style={styles.badges}>
          {thread.is_pinned ? <Badge text="Pinned" icon="pin" bg={TEAL} fg={colors.white} /> : null}
          {thread.category ? (
            <Pressable onPress={() => router.navigate(`/(app)/community?category=${thread.category!.id}` as Href)}>
              <Badge text={thread.category.name} dot={thread.category.color} bg={colors.surface} style={styles.outline} />
            </Pressable>
          ) : null}
          {thread.is_solved ? <Badge text="Solved" icon="checkmark-circle" bg="#ecfdf5" fg="#047857" /> : null}
        </View>

        <Text style={styles.title} selectable>
          {thread.title}
        </Text>

        <AuthorRow author={thread.author} meta={`asked ${timeAgo(thread.created_at)}${thread.edited_at ? ` · edited ${timeAgo(thread.edited_at)}` : ''}`} />
        <View style={styles.metaRow}>
          <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta}>{thread.view_count} views</Text>
          <Ionicons name="bookmark-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta}>{thread.follower_count} following</Text>
        </View>

        <PostBody text={thread.body} />
        <LinkChips links={thread.links} />

        {thread.tags.length > 0 ? (
          <View style={styles.badges}>
            {thread.tags.map((t) => (
              <TagPill key={t} tag={t} onPress={() => router.navigate(`/(app)/community?tag=${encodeURIComponent(t)}` as Href)} />
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          <VoteButton score={thread.vote_score} voted={thread.voted} disabled={own} onToggle={() => voteThread(id)} onChange={setVote} />
          <Pressable
            onPress={() => void toggleFollow()}
            disabled={busy === 'follow'}
            style={({ pressed }) => [styles.follow, thread.following && styles.followOn, pressed && styles.pressed]}
          >
            <Ionicons name={thread.following ? 'bookmark' : 'bookmark-outline'} size={14} color={thread.following ? TEAL : colors.text} />
            <Text style={[styles.followText, thread.following && styles.followTextOn]}>{thread.following ? 'Following' : 'Follow'}</Text>
          </Pressable>
          <SmallAction icon="share-social-outline" label="Share" onPress={share} />
          <View style={styles.flex} />
          {thread.can_edit ? (
            <>
              <SmallAction icon="create-outline" label="Edit" onPress={() => router.push(`/(app)/community/edit/${id}` as Href)} />
              <SmallAction icon="trash-outline" label="Delete" color={colors.error} busy={busy === 'delete'} onPress={remove} />
            </>
          ) : null}
          {!own ? <SmallAction icon="flag-outline" label="Report" onPress={() => setReport({ type: 'thread', id: thread.id })} /> : null}
        </View>
      </View>

      {thread.can_moderate ? (
        <View style={styles.modBox}>
          <View style={styles.modHead}>
            <Ionicons name="shield-half" size={16} color="#78350f" />
            <Text style={styles.modTitle}>Moderate</Text>
            {busy ? <ActivityIndicator size="small" color="#92400e" /> : null}
          </View>
          <View style={styles.badges}>
            <SmallAction icon="pin-outline" label={thread.is_pinned ? 'Unpin' : 'Pin'} color="#78350f" disabled={!!busy} onPress={() => void moderate('pin', { is_pinned: !thread.is_pinned })} />
            <SmallAction
              icon={thread.is_locked ? 'lock-open-outline' : 'lock-closed-outline'}
              label={thread.is_locked ? 'Unlock' : 'Lock'}
              color="#78350f"
              disabled={!!busy}
              onPress={() => void moderate('lock', { is_locked: !thread.is_locked })}
            />
            <SmallAction icon="eye-off-outline" label={thread.is_hidden ? 'Unhide' : 'Hide'} color="#78350f" disabled={!!busy} onPress={() => void moderate('hide', { is_hidden: !thread.is_hidden })} />
            {categories.length > 0 ? <SmallAction icon="folder-open-outline" label="Move" color="#78350f" disabled={!!busy} onPress={() => setMoving(true)} /> : null}
          </View>
        </View>
      ) : null}

      <View style={styles.answersHead}>
        <Ionicons name="chatbubbles-outline" size={18} color={TEAL} />
        <Text style={styles.answersTitle}>
          {thread.answers.length} {thread.answers.length === 1 ? 'answer' : 'answers'}
        </Text>
      </View>
      {thread.answers.length === 0 ? <Text style={styles.noAnswers}>No answers yet — share what you know.</Text> : null}
      {thread.answers.map((a) => (
        <AnswerCard
          key={a.id}
          answer={a}
          meId={meId}
          canAccept={thread.can_accept}
          canModerate={thread.can_moderate}
          onChange={(next) => setThread((t) => (t ? { ...t, answers: t.answers.map((x) => (x.id === next.id ? next : x)) } : t))}
          onReload={() => void load(false)}
          onAccept={(on) => accept(a.id, on)}
          onReport={() => setReport({ type: 'answer', id: a.id })}
        />
      ))}

      <View style={[styles.card, !canAnswer && styles.cardMuted]}>
        {canAnswer ? (
          <>
            <Text style={styles.answersTitle}>Your answer</Text>
            <PostingAs />
            <PostEditor
              body={answerBody}
              onBodyChange={setAnswerBody}
              links={answerLinks}
              onLinksChange={setAnswerLinks}
              minHeight={120}
              placeholder="Share the steps, the rule, or your experience. Tag the workflow, checklist or circular that backs it up."
            />
            {answerError ? <Notice tone="error" icon="alert-circle" text={answerError} /> : null}
            <Button title="Post answer" loading={posting} disabled={!canPost} onPress={() => void postAnswer()} style={{ backgroundColor: TEAL }} />
          </>
        ) : (
          <View style={styles.metaRow}>
            <Ionicons name="lock-closed" size={15} color={colors.textMuted} />
            <Text style={styles.meta}>This discussion is locked, so new answers are closed.</Text>
          </View>
        )}
      </View>

      <ReportSheet target={report} onClose={() => setReport(null)} />
      <PickerSheet
        visible={moving}
        title="Move to category"
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        value={thread.category?.id ?? ''}
        onSelect={(o) => void moderate('move', { category_id: o.value })}
        onClose={() => setMoving(false)}
      />
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  card: {
    gap: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardMuted: {
    backgroundColor: '#f8fafc',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 27,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm + 2,
  },
  follow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followOn: {
    borderColor: '#99f6e4',
    backgroundColor: '#f0fdfa',
  },
  followText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  followTextOn: {
    color: TEAL,
  },
  modBox: {
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  modHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#78350f',
  },
  answersHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  answersTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  noAnswers: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
});
