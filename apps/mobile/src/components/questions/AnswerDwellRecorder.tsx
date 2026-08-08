import { useEffect } from 'react';
import { recordAnswerHistory } from '@/lib/answer-history';
import { stripHtml } from '@/lib/book-display';

const DWELL_MS = 6000;

/**
 * Renders nothing — mount it only while a non-MCQ question's answer is visible. Its own
 * mount/unmount lifecycle is the dwell timer: 6s of continuous visibility records a history
 * entry, collapsing/navigating away before that just clears the pending timeout.
 */
export function AnswerDwellRecorder({
  id,
  bodyEn,
  bodyBn,
  subtitle,
}: {
  id: string;
  bodyEn?: string;
  bodyBn?: string;
  subtitle?: string;
}) {
  useEffect(() => {
    const title = stripHtml(bodyEn?.trim() || bodyBn || '').slice(0, 120);
    if (!title) return;
    const timer = setTimeout(() => {
      void recordAnswerHistory({ id, title, subtitle });
    }, DWELL_MS);
    return () => clearTimeout(timer);
  }, [id, bodyEn, bodyBn, subtitle]);

  return null;
}
