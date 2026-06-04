/** Base URL of the Express API (no trailing slash, no `/api` suffix). */
export function getApiBaseUrl(): string {
  const raw = process.env.API_URL?.trim();
  const base = raw || (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:3001');

  if (!base) {
    throw new Error(
      'API_URL is not set on the web service. In Render, set API_URL to your API service URL, e.g. https://your-api.onrender.com',
    );
  }

  if (process.env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/i.test(base)) {
    throw new Error(
      'API_URL must not point to localhost in production. Use your Render API URL, e.g. https://your-api.onrender.com',
    );
  }

  return base.replace(/\/+$/, '');
}
