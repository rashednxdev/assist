import * as SecureStore from 'expo-secure-store';

const KEY = 'question_bank_last_question_v2';

export type QuestionBankLastQuestion = {
  id: string;
  /** Index in the full loaded bank list when opened (best-effort). */
  index?: number;
  /** Immediate next question in the loaded bank order (for answer screen). */
  nextId?: string;
};

export async function loadQuestionBankLastQuestion(): Promise<QuestionBankLastQuestion | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuestionBankLastQuestion;
    if (!parsed?.id) return null;
    return {
      id: parsed.id,
      index: typeof parsed.index === 'number' && parsed.index >= 0 ? parsed.index : undefined,
      nextId: typeof parsed.nextId === 'string' && parsed.nextId ? parsed.nextId : undefined,
    };
  } catch {
    return null;
  }
}

export async function saveQuestionBankLastQuestion(pos: QuestionBankLastQuestion): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(pos));
  } catch {
    // ignore persistence failures
  }
}
