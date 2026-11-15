'use client';

import { useEffect } from 'react';
import { apiFetch } from '@/lib/api-client';

const READ_DWELL_MS = 5000;

/** Count one read after the answer stays open for 5 seconds. Same rule as the mobile app. */
export function useAnswerRead(questionId: string | undefined, active: boolean) {
  useEffect(() => {
    if (!questionId || !active) return;
    const timer = window.setTimeout(() => {
      void apiFetch(`/evaluation/questions/${questionId}/read`, { method: 'POST' }).catch(() => undefined);
    }, READ_DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [questionId, active]);
}
