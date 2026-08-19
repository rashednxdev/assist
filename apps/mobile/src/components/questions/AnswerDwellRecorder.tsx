import { useEffect } from 'react';
import { recordAnswerHistory } from '@/lib/answer-history';
import { stripHtml } from '@/lib/book-display';
import { READ_DWELL_MS, startReadDwell, stopReadDwell } from '@/lib/read-dwell';
import { ReadHistoryLocalTip } from '@/components/questions/ReadHistoryLocalTip';

/**
 * Mount only while a question's answer is visible. Runs a 5s dwell then records a local read.
 * Also shows a one-time tip that read history lives on this device.
 */
export function AnswerDwellRecorder({
  id,
  bodyEn,
  bodyBn,
  subtitle,
  subject,
}: {
  id: string;
  bodyEn?: string;
  bodyBn?: string;
  subtitle?: string;
  subject?: string;
}) {
  useEffect(() => {
    const title = stripHtml(bodyEn?.trim() || bodyBn || '').slice(0, 120);
    if (!title) return;
    startReadDwell(id);
    const timer = setTimeout(() => {
      void recordAnswerHistory({ id, title, subtitle, subject });
      stopReadDwell(id);
    }, READ_DWELL_MS);
    return () => {
      clearTimeout(timer);
      stopReadDwell(id);
    };
  }, [id, bodyEn, bodyBn, subtitle, subject]);

  return <ReadHistoryLocalTip active />;
}
