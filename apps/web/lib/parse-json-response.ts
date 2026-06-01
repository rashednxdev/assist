export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    throw new Error(
      res.status === 503
        ? 'API server is unavailable. Run pnpm dev and ensure port 3001 is up.'
        : `Server returned ${res.status} with an empty response`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Invalid response from server');
  }
}
