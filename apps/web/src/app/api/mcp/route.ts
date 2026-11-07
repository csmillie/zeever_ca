import { NextRequest, NextResponse } from 'next/server';
import { checkMcpApiKey, handleJsonRpc } from '@/lib/mcp/handlers';
import { checkRateLimit } from '@/lib/a2a/rate-limit';
import { MCP_PROTOCOL_VERSION, MCP_SERVER_INFO, MCP_TOOLS } from '@/lib/mcp/types';

export async function GET() {
  return NextResponse.json({
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: MCP_SERVER_INFO,
    transport: { type: 'http', method: 'POST', contentType: 'application/json' },
    tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
    docs: 'https://www.zeever.ca/.well-known/mcp/server-card.json',
  });
}

export async function POST(request: NextRequest) {
  if (!checkMcpApiKey(request.headers.get('authorization'))) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized.' } },
      { status: 401 },
    );
  }

  const ip = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32002, message: 'Rate limit exceeded.' } },
      {
        status: 429,
        headers: rateCheck.retryAfter
          ? { 'Retry-After': String(rateCheck.retryAfter) }
          : undefined,
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error.' } },
      { status: 400 },
    );
  }

  if (Array.isArray(body)) {
    const responses = await Promise.all(body.map((item) => handleJsonRpc(item)));
    const filtered = responses.filter((r) => r !== null);
    if (filtered.length === 0) return new NextResponse(null, { status: 204 });
    return NextResponse.json(filtered);
  }

  const response = await handleJsonRpc(body);
  if (response === null) return new NextResponse(null, { status: 204 });
  return NextResponse.json(response);
}
