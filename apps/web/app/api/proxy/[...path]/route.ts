import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/api-url';

export const runtime = 'nodejs';

const HOP_BY_HOP_REQUEST_HEADERS = [
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'keep-alive',
  'proxy-authorization',
  'proxy-connection',
] as const;

function buildUpstreamHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_REQUEST_HEADERS.includes(lower as (typeof HOP_BY_HOP_REQUEST_HEADERS)[number])) {
      return;
    }
    // Avoid compressed upstream responses; fetch decompresses but would leave misleading headers.
    if (lower === 'accept-encoding') return;
    headers.set(key, value);
  });
  return headers;
}

function buildClientResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  const passthrough = ['content-type', 'cache-control', 'etag', 'vary'];
  for (const name of passthrough) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

async function proxyRequest(req: NextRequest, path: string): Promise<NextResponse> {
  let apiBase: string;
  try {
    apiBase = getApiBaseUrl();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'API_URL is not configured';
    return jsonError(503, 'API_URL_NOT_CONFIGURED', message);
  }

  const url = `${apiBase}/api/${path}${req.nextUrl.search}`;
  const headers = buildUpstreamHeaders(req);

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await req.text();
    if (body) {
      init.body = body;
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch {
    return jsonError(
      503,
      'API_UNAVAILABLE',
      `Cannot reach API at ${apiBase}. Check API_URL on the web service and that the API is deployed and running.`,
    );
  }

  const text = await upstream.text();
  const setCookie = upstream.headers.getSetCookie?.() ?? [];
  const contentType = upstream.headers.get('content-type') ?? '';

  if (!text && upstream.status >= 400) {
    return jsonError(
      upstream.status,
      'UPSTREAM_ERROR',
      `API returned ${upstream.status} with no response body`,
    );
  }

  if (text && !contentType.includes('application/json') && !looksLikeJson(text)) {
    const isHtml = text.trimStart().startsWith('<');
    return jsonError(
      502,
      'UPSTREAM_NOT_JSON',
      isHtml
        ? `API at ${apiBase} returned HTML (status ${upstream.status}). On Render: set the web service API_URL to your API URL (https://…onrender.com), not the web URL. If the API was sleeping, retry after it wakes up.`
        : `API returned non-JSON (status ${upstream.status}). Verify API_URL points to the API service.`,
    );
  }

  const responseHeaders = buildClientResponseHeaders(upstream);
  const res = new NextResponse(text || null, {
    status: upstream.status,
    headers: responseHeaders,
  });

  for (const cookie of setCookie) {
    res.headers.append('Set-Cookie', cookie);
  }

  return res;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyRequest(req, path.join('/'));
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyRequest(req, path.join('/'));
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyRequest(req, path.join('/'));
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyRequest(req, path.join('/'));
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyRequest(req, path.join('/'));
}
