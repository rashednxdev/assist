import * as SecureStore from 'expo-secure-store';

const KEY = 'marathon_last_question_v2';

export type MarathonLastQuestion = {
  id: string;
  number: number;
  /** Scroll offset when the question was last tapped. */
  scroll_y: number;
};

export async function loadMarathonLastQuestion(): Promise<MarathonLastQuestion | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MarathonLastQuestion;
    if (!parsed?.id || typeof parsed.number !== 'number') return null;
    return {
      id: parsed.id,
      number: parsed.number,
      scroll_y: typeof parsed.scroll_y === 'number' ? Math.max(0, parsed.scroll_y) : 0,
    };
  } catch {
    return null;
  }
}

export async function saveMarathonLastQuestion(pos: MarathonLastQuestion): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(pos));
  } catch {
    // ignore persistence failures
  }
}
