import { NextRequest, NextResponse } from 'next/server';
import { validateA2ARequest, checkApiKey, handleA2ARequest } from '@/lib/a2a/handlers';
import { checkRateLimit } from '@/lib/a2a/rate-limit';
import type { A2ARequest } from '@/lib/a2a/types';

export async function POST(request: NextRequest) {
  if (!checkApiKey(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded.' },
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
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const validationError = validateA2ARequest(body);
  if (validationError) {
    return NextResponse.json({ error: validationError.error }, { status: validationError.status });
  }

  const response = await handleA2ARequest(body as A2ARequest);
  return NextResponse.json(response);
}
