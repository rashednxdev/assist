import { useEffect, useState } from 'react';
import { getReadDwellSecondsLeft, subscribeReadDwell } from '@/lib/read-dwell';

/** Live seconds left on the 5s answer-read countdown for this question, or null. */
export function useReadDwellSeconds(questionId?: string) {
  const [secondsLeft, setSecondsLeft] = useState(() => getReadDwellSecondsLeft(questionId));

  useEffect(() => {
    function sync() {
      setSecondsLeft(getReadDwellSecondsLeft(questionId));
    }
    sync();
    return subscribeReadDwell(sync);
  }, [questionId]);

  return secondsLeft;
}
