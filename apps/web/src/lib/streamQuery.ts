/**
 * Reads the Server-Sent Event stream from /api/query/stream.
 *
 * Split out from the component so the chunk-assembly rules can be tested without
 * rendering anything. The rules that matter: events are separated by a blank
 * line, a chunk from the network can split an event anywhere including
 * mid-character, and a trailing partial event must be held back rather than
 * parsed.
 */

export interface StreamUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export interface StreamFinal {
  answer: string
  sources: string[]
  query_class: string
  model_used: string
  usage?: StreamUsage
  response_time?: { seconds: number; milliseconds: number }
}

export interface StreamHandlers {
  onSources?: (urls: string[]) => void
  onProvider?: (label: string) => void
  onReasoning?: (delta: string) => void
  onText?: (delta: string) => void
  onFinal?: (final: StreamFinal) => void
  onError?: (message: string) => void
}

/** Pull complete `data: ...` events out of a buffer, leaving any partial tail. */
export function parseEvents(buffer: string): { events: unknown[]; rest: string } {
  const events: unknown[] = []
  let rest = buffer

  for (;;) {
    const boundary = rest.indexOf('\n\n')
    if (boundary === -1) break
    const raw = rest.slice(0, boundary)
    rest = rest.slice(boundary + 2)

    // An SSE frame may carry comments or other fields; only data lines matter here.
    const payload = raw
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('')
    if (!payload) continue
    try {
      events.push(JSON.parse(payload))
    } catch {
      // A frame we cannot parse is dropped rather than killing the stream; the
      // final event is what the caller ultimately relies on.
    }
  }

  return { events, rest }
}

function dispatch(event: unknown, handlers: StreamHandlers): void {
  if (typeof event !== 'object' || event === null) return
  const { event: kind, data } = event as { event?: string; data?: unknown }

  switch (kind) {
    case 'sources':
      if (Array.isArray(data)) handlers.onSources?.(data as string[])
      break
    case 'provider':
      if (typeof data === 'string') handlers.onProvider?.(data)
      break
    case 'reasoning':
      if (typeof data === 'string') handlers.onReasoning?.(data)
      break
    case 'text':
      if (typeof data === 'string') handlers.onText?.(data)
      break
    case 'final':
      handlers.onFinal?.(data as StreamFinal)
      break
    case 'error':
      handlers.onError?.(typeof data === 'string' ? data : 'The request failed.')
      break
  }
}

export async function streamQuery(
  question: string,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch('/api/query/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
    signal,
  })

  if (!res.ok && !res.body) {
    throw new Error(`Query API error: ${res.status}`)
  }
  if (!res.body) {
    throw new Error('Query API returned no body')
  }

  const reader = res.body.getReader()
  // stream: true matters — a multi-byte character can straddle two chunks, and
  // decoding each chunk independently would corrupt it.
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const { events, rest } = parseEvents(buffer)
      buffer = rest
      for (const event of events) dispatch(event, handlers)
    }
    // Flush anything the server sent without a trailing blank line.
    buffer += decoder.decode()
    const { events } = parseEvents(buffer.endsWith('\n\n') ? buffer : buffer + '\n\n')
    for (const event of events) dispatch(event, handlers)
  } finally {
    reader.releaseLock()
  }
}
