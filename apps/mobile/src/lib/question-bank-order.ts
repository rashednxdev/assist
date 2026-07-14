/** In-session Question Bank order — used to resolve “next” on the answer screen. */
let sessionOrderIds: string[] = [];

export function setQuestionBankSessionOrder(ids: string[]) {
  sessionOrderIds = ids.filter(Boolean);
}

export function getQuestionBankNextId(currentId: string): string | undefined {
  const index = sessionOrderIds.indexOf(currentId);
  if (index < 0 || index >= sessionOrderIds.length - 1) return undefined;
  return sessionOrderIds[index + 1];
}
