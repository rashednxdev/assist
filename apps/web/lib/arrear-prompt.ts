/** sessionStorage flag: the Home "calculate arrear bill?" prompt is shown once per browsing session. */
export const ARREAR_PROMPT_SESSION_KEY = 'proassist.arrearPrompt.shown';

export function resetArrearPrompt(): void {
  try {
    window.sessionStorage.removeItem(ARREAR_PROMPT_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
