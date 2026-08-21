import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/api-url';

export const runtime = 'nodejs';

/** Headers that must not be forwarded to the upstream API (hop-by-hop or undici-unsupported). */
const BLOCKED_REQUEST_HEADERS = new Set([
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
  // Undici fetch throws UND_ERR_NOT_SUPPORTED if Expect is forwarded (common from PowerShell / some clients).
  'expect',
  // Avoid compressed upstream responses; fetch decompresses but would leave misleading headers.
  'accept-encoding',
]);

function buildUpstreamHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (BLOCKED_REQUEST_HEADERS.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  return headers;
}

function buildClientResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  const passthrough = [
    'content-type',
    'cache-control',
    'etag',
    'vary',
    'content-disposition',
    'x-conversion-pages',
    'x-conversion-method',
    'x-ocr-languages',
  ];
  for (const name of passthrough) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function isBinaryResponse(contentType: string): boolean {
  return (
    contentType.includes('wordprocessingml') ||
    contentType.includes('octet-stream') ||
    contentType.includes('application/pdf')
  );
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
    const reqContentType = req.headers.get('content-type') ?? '';
    if (reqContentType.includes('multipart/form-data')) {
      init.body = await req.arrayBuffer();
    } else {
      const body = await req.text();
      if (body) {
        init.body = body;
        if (!headers.has('content-type')) {
          headers.set('content-type', 'application/json');
        }
      }
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (err) {
    const cause =
      err instanceof Error
        ? err.cause instanceof Error
          ? err.cause.message
          : err.message
        : '';
    const detail = cause && !/fetch failed/i.test(cause) ? ` (${cause})` : '';
    return jsonError(
      503,
      'API_UNAVAILABLE',
      `Cannot reach API at ${apiBase}. Check API_URL on the web service and that the API is deployed and running.${detail}`,
    );
  }

  const setCookie = upstream.headers.getSetCookie?.() ?? [];
  const contentType = upstream.headers.get('content-type') ?? '';

  if (isBinaryResponse(contentType)) {
    const buffer = await upstream.arrayBuffer();
    const responseHeaders = buildClientResponseHeaders(upstream);
    const res = new NextResponse(buffer.byteLength ? buffer : null, {
      status: upstream.status,
      headers: responseHeaders,
    });
    for (const cookie of setCookie) {
      res.headers.append('Set-Cookie', cookie);
    }
    return res;
  }

  const text = await upstream.text();

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
