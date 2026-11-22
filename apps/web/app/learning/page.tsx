'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LEARNING_HOME } from '@/lib/learning-access';

/** Legacy `/learning` URL — permanently redirected to Home. */
export default function LearningRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(LEARNING_HOME);
  }, [router]);
  return null;
}
