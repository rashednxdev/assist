import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CommunityAnswerRecord, CommunityLinkRecord } from '@ibas/shared-types';
import { AuthorRow, Badge, LinkChips, Notice, TEAL, VoteButton } from '@/components/community/CommunityBits';
import { PostBody } from '@/components/community/PostBody';
import { PostEditor } from '@/components/community/PostEditor';
import { deleteAnswer, moderateAnswer, timeAgo, updateAnswer, voteAnswer } from '@/lib/community-api';
import { colors, spacing } from '@/theme';

export function SmallAction({
  icon,
  label,
  onPress,
  color = colors.textMuted,
  busy,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} hitSlop={4} style={({ pressed }) => [styles.small, (disabled || busy) && styles.disabled, pressed && styles.pressed]}>
      {busy ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={15} color={color} />}
      <Text style={[styles.smallText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function AnswerCard({
  answer,
  meId,
  canAccept,
  canModerate,
  onChange,
  onReload,
  onAccept,
  onReport,
}: {
  answer: CommunityAnswerRecord;
  meId: string;
  canAccept: boolean;
  canModerate: boolean;
  onChange: (a: CommunityAnswerRecord) => void;
  onReload: () => void;
  onAccept: (accept: boolean) => Promise<void>;
  onReport: () => void;
}) {
  const own = answer.author.id === meId;
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(answer.body);
  const [links, setLinks] = useState<CommunityLinkRecord[]>(answer.links);
  const [busy, setBusy] = useState<'' | 'save' | 'delete' | 'accept' | 'hide'>('');
  const [error, setError] = useState('');

  async function run(kind: typeof busy, fn: () => Promise<void>) {
    setBusy(kind);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy('');
    }
  }

  const save = () =>
    run('save', async () => {
      onChange(await updateAnswer(answer.id, body.trim(), links));
      setEditing(false);
    });

  const remove = () =>
    Alert.alert('Delete answer', 'Delete this answer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void run('delete', async () => {
            await deleteAnswer(answer.id);
            onReload();
          }),
      },
    ]);

  const toggleHidden = () =>
    run('hide', async () => {
      await moderateAnswer(answer.id, !answer.is_hidden);
      onReload();
    });

  let actions: ReactNode = null;
  if (!editing) {
    actions = (
      <View style={styles.actions}>
        <VoteButton
          score={answer.vote_score}
          voted={answer.voted}
          disabled={own}
          onToggle={() => voteAnswer(answer.id)}
          onChange={(v) => onChange({ ...answer, voted: v.voted, vote_score: v.vote_score })}
        />
        {canAccept && !answer.is_hidden ? (
          <SmallAction
            icon="checkmark-circle-outline"
            label={answer.is_accepted ? 'Unmark solution' : 'Mark as solution'}
            color={answer.is_accepted ? colors.textMuted : colors.success}
            busy={busy === 'accept'}
            onPress={() => void run('accept', () => onAccept(!answer.is_accepted))}
          />
        ) : null}
        <View style={styles.flex} />
        {answer.can_edit ? (
          <>
            <SmallAction icon="create-outline" label="Edit" onPress={() => setEditing(true)} />
            <SmallAction icon="trash-outline" label="Delete" color={colors.error} busy={busy === 'delete'} onPress={remove} />
          </>
        ) : null}
        {canModerate ? (
          <SmallAction icon="eye-off-outline" label={answer.is_hidden ? 'Unhide' : 'Hide'} busy={busy === 'hide'} onPress={() => void toggleHidden()} />
        ) : null}
        {!own ? <SmallAction icon="flag-outline" label="Report" onPress={onReport} /> : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, answer.is_accepted && styles.accepted, answer.is_hidden && styles.hidden]}>
      {answer.is_accepted ? <Badge text="Accepted answer" icon="checkmark-circle" bg="#ecfdf5" fg="#047857" /> : null}
      {answer.is_hidden ? <Badge text="Hidden by a moderator — only the author and admins can see it" icon="eye-off" bg="#fef2f2" fg="#b91c1c" /> : null}

      <AuthorRow author={answer.author} meta={`answered ${timeAgo(answer.created_at)}${answer.edited_at ? ` · edited ${timeAgo(answer.edited_at)}` : ''}`} />

      {editing ? (
        <View style={styles.gap}>
          <PostEditor body={body} onBodyChange={setBody} links={links} onLinksChange={setLinks} minHeight={120} />
          <View style={styles.editActions}>
            <SmallAction
              icon="close"
              label="Cancel"
              onPress={() => {
                setEditing(false);
                setBody(answer.body);
                setLinks(answer.links);
              }}
            />
            <Pressable
              onPress={() => void save()}
              disabled={busy === 'save' || body.trim().length < 2}
              style={({ pressed }) => [styles.saveBtn, (busy === 'save' || body.trim().length < 2) && styles.disabled, pressed && styles.pressed]}
            >
              {busy === 'save' ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <PostBody text={answer.body} />
          <LinkChips links={answer.links} />
        </>
      )}

      {error ? <Notice tone="error" icon="alert-circle" text={error} /> : null}
      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  gap: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  card: {
    gap: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  accepted: {
    borderColor: '#6ee7b7',
    borderWidth: 1.5,
  },
  hidden: {
    borderStyle: 'dashed',
    backgroundColor: '#f8fafc',
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
  small: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
  },
  smallText: {
    fontSize: 12,
    fontWeight: '700',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
  },
  saveBtn: {
    height: 38,
    minWidth: 80,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
