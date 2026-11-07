import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL || 'http://localhost:3034'

// The upstream body is forwarded rather than read, so nothing here accumulates the
// answer. Buffering in the proxy would defeat the point of streaming from FastAPI.
export const dynamic = 'force-dynamic'

function errorEvent(message: string): string {
  return `data: ${JSON.stringify({ event: 'error', data: message })}\n\n`
}

function errorStream(message: string, status: number): Response {
  return new Response(errorEvent(message), {
    status,
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Only forward expected fields, same as the non-streaming route.
  const { question } = body
  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'Please provide a question.' }, { status: 400 })
  }

  try {
    const upstream = await fetch(`${API_URL}/api/query/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.slice(0, 2000) }),
      // Abort upstream when the browser disconnects, so the model stops generating
      // for a reader that has gone away.
      signal: request.signal,
    })

    if (upstream.status === 429) {
      return errorStream('Too many requests. Please wait a moment and try again.', 429)
    }
    if (!upstream.ok || !upstream.body) {
      return errorStream('The backend service is not available. Please try again later.', 502)
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return new Response(null, { status: 499 })
    }
    return errorStream('Unable to connect to the backend service.', 502)
  }
}
