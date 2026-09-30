import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CommunityThreadDetail } from '@ibas/shared-types';
import { FormScroll } from '@/components/ui/FormScroll';
import { Notice, TEAL } from '@/components/community/CommunityBits';
import { ThreadForm } from '@/components/community/ThreadForm';
import { fetchThread, updateThread } from '@/lib/community-api';
import { showToast } from '@/lib/toast';
import { spacing } from '@/theme';

export default function EditDiscussionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [thread, setThread] = useState<CommunityThreadDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchThread(id, false)
      .then((t) => {
        if (!t.can_edit) setError('You can only edit your own discussions.');
        setThread(t);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the discussion'));
  }, [id]);

  return (
    <FormScroll>
      {error ? (
        <Notice tone="error" icon="alert-circle" text={error} />
      ) : !thread ? (
        <ActivityIndicator color={TEAL} style={styles.loader} />
      ) : (
        <ThreadForm
          initial={{
            title: thread.title,
            body: thread.body,
            category_id: thread.category?.id ?? '',
            tags: thread.tags,
            links: thread.links,
          }}
          submitLabel="Save changes"
          requireIdentity={false}
          onSubmit={async (payload) => {
            await updateThread(id, payload);
            showToast('Discussion updated');
            router.back();
          }}
        />
      )}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginVertical: spacing.xl,
  },
});
