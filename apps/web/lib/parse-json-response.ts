export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    throw new Error(
      res.status === 503
        ? 'API server is unavailable. Check API_URL on Render (web service) and that the API is running.'
        : `Server returned ${res.status} with an empty response`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.trim().slice(0, 80);
    const hint =
      preview.startsWith('<') || preview.startsWith('<!')
        ? ' — API returned HTML. On Render, set web service API_URL to your API URL (https://your-api.onrender.com).'
        : '';
    throw new Error(`Invalid response from server${hint}`);
  }
}
