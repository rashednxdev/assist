import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

async function proxyRequest(req: NextRequest, path: string): Promise<NextResponse> {
  const url = `${API_URL}/api/${path}${req.nextUrl.search}`;
  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('connection');

  const init: RequestInit = {
    method: req.method,
    headers,
    credentials: 'include',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await req.text();
    if (body) init.body = body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'API_UNAVAILABLE',
          message: 'API server is unavailable. Ensure the API is running on port 3001.',
        },
      },
      { status: 503 },
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('transfer-encoding');

  const text = await upstream.text();
  const setCookie = upstream.headers.getSetCookie?.() ?? [];
  const res = new NextResponse(text || null, {
    status: upstream.status,
    headers: responseHeaders,
  });

  if (!text && upstream.status >= 400) {
    return NextResponse.json(
      {
        error: {
          code: 'UPSTREAM_ERROR',
          message: `API returned ${upstream.status} with no response body`,
        },
      },
      { status: upstream.status },
    );
  }

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
