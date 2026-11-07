import { describe, it, expect, vi } from 'vitest'
import { parseEvents, streamQuery } from '../streamQuery'

describe('parseEvents', () => {
  it('extracts a complete event and leaves nothing behind', () => {
    const { events, rest } = parseEvents('data: {"event":"text","data":"hi"}\n\n')
    expect(events).toEqual([{ event: 'text', data: 'hi' }])
    expect(rest).toBe('')
  })

  it('holds back a partial event rather than parsing it', () => {
    // The network splits wherever it likes; a half-received frame must wait.
    const { events, rest } = parseEvents('data: {"event":"text","data":"hi"}\n\ndata: {"eve')
    expect(events).toHaveLength(1)
    expect(rest).toBe('data: {"eve')
  })

  it('reads several events out of one buffer in order', () => {
    const buf =
      'data: {"event":"sources","data":["a"]}\n\n' +
      'data: {"event":"text","data":"one"}\n\n' +
      'data: {"event":"text","data":"two"}\n\n'
    const { events } = parseEvents(buf)
    expect(events.map((e) => (e as { data: unknown }).data)).toEqual([['a'], 'one', 'two'])
  })

  it('drops an unparseable frame without losing the ones around it', () => {
    const buf =
      'data: {"event":"text","data":"one"}\n\n' +
      'data: not json\n\n' +
      'data: {"event":"text","data":"two"}\n\n'
    const { events } = parseEvents(buf)
    expect(events).toHaveLength(2)
  })
})

function streamOf(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
  return new Response(body, { status: 200 })
}

describe('streamQuery', () => {
  it('assembles deltas split across network chunks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        streamOf([
          'data: {"event":"sources","data":["https://toronto.ca/x"]}\n\n',
          'data: {"event":"text","data":"Hel',   // event split mid-JSON
          'lo "}\n\ndata: {"event":"text","data":"world"}\n\n',
          'data: {"event":"final","data":{"answer":"Hello world","sources":[],"query_class":"x","model_used":"m"}}\n\n',
        ])
      )
    )

    const text: string[] = []
    let final: unknown = null
    let sources: string[] = []
    await streamQuery('q', {
      onSources: (u) => { sources = u },
      onText: (d) => text.push(d),
      onFinal: (f) => { final = f },
    })

    expect(sources).toEqual(['https://toronto.ca/x'])
    expect(text.join('')).toBe('Hello world')
    expect(final).toMatchObject({ answer: 'Hello world' })
    vi.unstubAllGlobals()
  })

  it('surfaces a server-sent error event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(streamOf(['data: {"event":"error","data":"all providers failed"}\n\n']))
    )
    const errors: string[] = []
    await streamQuery('q', { onError: (m) => errors.push(m) })
    expect(errors).toEqual(['all providers failed'])
    vi.unstubAllGlobals()
  })

  it('passes the abort signal through to fetch', async () => {
    const spy = vi.fn().mockResolvedValue(streamOf(['data: {"event":"text","data":"x"}\n\n']))
    vi.stubGlobal('fetch', spy)
    const controller = new AbortController()
    await streamQuery('q', {}, controller.signal)
    expect(spy.mock.calls[0][1]).toMatchObject({ signal: controller.signal })
    vi.unstubAllGlobals()
  })

  it('handles a final event that arrives without a trailing blank line', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        streamOf(['data: {"event":"final","data":{"answer":"done","sources":[],"query_class":"x","model_used":"m"}}'])
      )
    )
    let final: unknown = null
    await streamQuery('q', { onFinal: (f) => { final = f } })
    expect(final).toMatchObject({ answer: 'done' })
    vi.unstubAllGlobals()
  })
})
