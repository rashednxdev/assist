import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COMMUNITY_MAX_TAGS, type CommunityCategoryRecord, type CommunityLinkRecord } from '@ibas/shared-types';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { TextField } from '@/components/ui/TextField';
import { Notice, TEAL } from '@/components/community/CommunityBits';
import { PostEditor } from '@/components/community/PostEditor';
import { PostingAs, useCanPost } from '@/components/community/PostingAs';
import { fetchCategories, linkRefs, type ThreadPayload } from '@/lib/community-api';
import { colors, spacing } from '@/theme';

export interface ThreadFormValues {
  title: string;
  body: string;
  category_id: string;
  tags: string[];
  links: CommunityLinkRecord[];
}

function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 30);
}

export function ThreadForm({
  initial,
  submitLabel,
  onSubmit,
  requireIdentity = true,
}: {
  initial?: Partial<ThreadFormValues>;
  submitLabel: string;
  onSubmit: (payload: ThreadPayload) => Promise<void>;
  /** New posts need the author's office + designation; edits keep the ones saved with the post. */
  requireIdentity?: boolean;
}) {
  const { ready: canPost, refresh: refreshIdentity } = useCanPost();
  const [categories, setCategories] = useState<CommunityCategoryRecord[]>([]);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [links, setLinks] = useState<CommunityLinkRecord[]>(initial?.links ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories()
      .then((list) => {
        setCategories(list);
        setCategoryId((cur) => cur || list[0]?.id || '');
      })
      .catch(() => setCategories([]));
  }, []);

  function addTag(raw: string) {
    const t = normalizeTag(raw);
    if (t.length < 2 || tags.includes(t) || tags.length >= COMMUNITY_MAX_TAGS) return;
    setTags((cur) => [...cur, t]);
  }

  function onTagChange(text: string) {
    if (/[,\s]$/.test(text) && text.trim()) {
      addTag(text.replace(/[,\s]+$/, ''));
      setTagDraft('');
    } else {
      setTagDraft(text);
    }
  }

  async function submit() {
    setError('');
    const finalTags = tagDraft.trim()
      ? [...new Set([...tags, normalizeTag(tagDraft)])].filter((t) => t.length >= 2).slice(0, COMMUNITY_MAX_TAGS)
      : tags;
    if (title.trim().length < 8) return setError('Give your discussion a clear title (8+ characters).');
    if (body.trim().length < 10) return setError('Add a few more details (10+ characters).');
    if (!categoryId) return setError('Pick a category.');
    if (requireIdentity && !canPost) return setError('Add your designation and office above before publishing.');
    setBusy(true);
    try {
      await onSubmit({ title: title.trim(), body: body.trim(), category_id: categoryId, tags: finalTags, links: linkRefs(links) });
    } catch (e) {
      if (requireIdentity) void refreshIdentity().catch(() => undefined);
      setError(e instanceof Error ? e.message : 'Could not save');
      setBusy(false);
    }
  }

  const selected = categories.find((c) => c.id === categoryId);

  return (
    <View style={styles.wrap}>
      {requireIdentity ? <PostingAs /> : null}

      <Panel>
        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          maxLength={160}
          autoCapitalize="sentences"
          placeholder="e.g. How do I correct a wrong economic code after a bill is passed?"
          hint="Ask a question or share something new — be specific so others can find it."
        />

        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.cats}>
            {categories.map((c) => {
              const on = categoryId === c.id;
              return (
                <Pressable key={c.id} onPress={() => setCategoryId(c.id)} style={[styles.cat, on && { backgroundColor: c.color, borderColor: c.color }]}>
                  {!on ? <View style={[styles.dot, { backgroundColor: c.color }]} /> : null}
                  <Text style={[styles.catText, on && styles.catTextOn]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {selected?.description ? <Text style={styles.hint}>{selected.description}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Details</Text>
          <PostEditor
            body={body}
            onBodyChange={setBody}
            links={links}
            onLinksChange={setLinks}
            minHeight={180}
            placeholder={'Explain the situation, what you tried, and what you need.\n\nTip: use "Tag" to attach the related workflow, checklist, template or circular.'}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Hashtags</Text>
          <View style={styles.tagBox}>
            {tags.map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>#{t}</Text>
                <Pressable onPress={() => setTags(tags.filter((x) => x !== t))} hitSlop={8} accessibilityLabel={`Remove ${t}`}>
                  <Ionicons name="close" size={13} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
            {tags.length < COMMUNITY_MAX_TAGS ? (
              <TextInput
                value={tagDraft}
                onChangeText={onTagChange}
                onSubmitEditing={() => {
                  addTag(tagDraft);
                  setTagDraft('');
                }}
                onBlur={() => {
                  if (tagDraft.trim()) {
                    addTag(tagDraft);
                    setTagDraft('');
                  }
                }}
                blurOnSubmit={false}
                returnKeyType="done"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={tags.length ? 'Add another' : 'e.g. pension, bill-pass, gpf'}
                placeholderTextColor={colors.textMuted}
                style={styles.tagInput}
              />
            ) : null}
          </View>
          <Text style={styles.hint}>Press space, comma or Done to add · up to {COMMUNITY_MAX_TAGS}.</Text>
        </View>
      </Panel>

      {error ? <Notice tone="error" icon="alert-circle" text={error} /> : null}
      <Button title={submitLabel} loading={busy} disabled={requireIdentity && !canPost} onPress={() => void submit()} style={{ backgroundColor: TEAL }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs + 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  catTextOn: {
    color: colors.white,
  },
  tagBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingLeft: 9,
    paddingRight: 6,
    paddingVertical: 4,
    backgroundColor: '#f1f5f9',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  tagInput: {
    flexGrow: 1,
    minWidth: 120,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 6,
  },
});
