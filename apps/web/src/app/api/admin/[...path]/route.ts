import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:3034';

async function proxyRequest(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const subPath = path.join('/');

  try {
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: {
        Authorization: request.headers.get('authorization') || '',
      },
    };

    if (request.method !== 'GET') {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Content-Type': 'application/json',
      };
      fetchOptions.body = await request.text();
    }

    const response = await fetch(`${API_URL}/api/admin/${subPath}`, fetchOptions);

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ detail: 'Backend unavailable' }, { status: 502 });
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
