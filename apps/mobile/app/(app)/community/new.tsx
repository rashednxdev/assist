import { useRouter } from 'expo-router';
import { FormScroll } from '@/components/ui/FormScroll';
import { Notice } from '@/components/community/CommunityBits';
import { ThreadForm } from '@/components/community/ThreadForm';
import { createThread, threadHref } from '@/lib/community-api';
import { showToast } from '@/lib/toast';

export default function NewDiscussionScreen() {
  const router = useRouter();
  return (
    <FormScroll>
      <Notice
        tone="warning"
        icon="bulb-outline"
        text="Good discussions have a specific title, the steps you already tried, and a tagged workflow, checklist or circular so others can check the same source."
      />
      <ThreadForm
        submitLabel="Publish discussion"
        onSubmit={async (payload) => {
          const t = await createThread(payload);
          showToast('Discussion published');
          router.replace(threadHref(t.id));
        }}
      />
    </FormScroll>
  );
}
