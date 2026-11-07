'use client'

import { useState, useRef, useEffect, useCallback, useMemo, FormEvent } from 'react'
import { getFollowUp } from '@/lib/followups'
import { streamQuery } from '@/lib/streamQuery'

interface Source {
  url: string
  title?: string
}

let messageIdCounter = 0
function nextMessageId(): string {
  messageIdCounter += 1
  return `msg-${Date.now()}-${messageIdCounter}`
}

interface TokenUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

const COST_PER_INPUT_TOKEN = 0.07 / 1_000_000
const COST_PER_OUTPUT_TOKEN = 0.30 / 1_000_000

function estimateCost(usage: TokenUsage): number {
  return usage.input_tokens * COST_PER_INPUT_TOKEN + usage.output_tokens * COST_PER_OUTPUT_TOKEN
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

interface ResponseTime {
  seconds: number
  milliseconds: number
}

function formatTime(rt: ResponseTime): string {
  return rt.milliseconds >= 1000 ? `${rt.seconds.toFixed(2)}s` : `${rt.milliseconds}ms`
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  queryClass?: string
  usage?: TokenUsage
  responseTime?: ResponseTime
  followUp?: string
}

// Full pool of questions covering all Toronto.ca sections
const ALL_QUESTIONS = [
  'Do I need a permit to build a deck?',
  'How much does a building permit cost?',
  'What documents do I need for a permit?',
  'Do I need a sign permit in Toronto?',
  'Can I remove a tree on my property?',
  'How do I get a zoning review?',
  'How do I pay my property tax?',
  'What is the vacant home tax?',
  'What is the land transfer tax?',
  'Do I need a business licence?',
  'How do I renew my business licence?',
  'What goes in the blue bin?',
  'What goes in the green bin?',
  'Where can I drop off hazardous waste?',
  'How do I get a parking permit?',
  'How do I pay a parking ticket?',
  'How do I report a pothole?',
  'How does Toronto handle snow removal?',
  'How do speed cameras work in Toronto?',
  'Is Toronto tap water safe to drink?',
  'What is the basement flooding subsidy?',
  'What home energy grants are available?',
  'How do I find affordable housing?',
  'What are my rights as a tenant?',
  'Where can I get vaccinated in Toronto?',
  'How do I register for rec programs?',
  'Where can I go swimming in Toronto?',
  'How do I get to the Toronto Islands?',
  'Who is my city councillor?',
  'How do I access Toronto open data?',
]

// Pick 6 questions deterministically based on the day so server and client match.
// Use UTC so server (UTC) and client (local TZ) agree across the day boundary.
function pickDaily(arr: string[], count: number): string[] {
  const now = new Date()
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000
  const start = (day * 7) % arr.length
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    result.push(arr[(start + i) % arr.length])
  }
  return result
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const suggestedQuestions = useMemo(() => pickDaily(ALL_QUESTIONS, 6), [])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const totalCost = messages.reduce((sum, msg) => {
    if (msg.usage) return sum + estimateCost(msg.usage)
    return sum
  }, 0)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submitQuestion = useCallback(async (question: string) => {
    if (!question.trim() || loading) return

    setInput('')
    setMessages(prev => [...prev, { id: nextMessageId(), role: 'user', content: question }])
    setLoading(true)

    // The assistant bubble is added empty and fills as tokens arrive. The wait is
    // the same length either way; this puts it inside a visible answer instead of
    // in front of a spinner, which is the whole point of streaming here.
    const assistantId = nextMessageId()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    const patch = (fields: Partial<Message>) =>
      setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, ...fields } : m)))

    const t0 = performance.now()
    let streamed = ''

    try {
      await streamQuery(question, {
        // Sources arrive before the first token: they are the retrieved pages, not
        // something the model produces.
        onSources: urls => patch({ sources: urls.map(url => ({ url })) }),
        onText: delta => {
          streamed += delta
          patch({ content: streamed })
        },
        // Reasoning is dropped. This interface shows plain prose answers and has
        // nowhere sensible to put a model's internal monologue; the server already
        // asks for low effort. It arrives on its own event, so showing it later is
        // a UI change and not a protocol one.
        onFinal: final => {
          const clientMs = Math.round(performance.now() - t0)
          const responseTime: ResponseTime =
            final.response_time ?? { seconds: clientMs / 1000, milliseconds: clientMs }

          const sourceCount = Array.isArray(final.sources) ? final.sources.length : 0
          const followUp = sourceCount > 0 ? getFollowUp(final.query_class, final.answer) : null

          // Authoritative: the cleaned and validated answer, which can differ from
          // the raw deltas rendered above.
          patch({
            content: final.answer,
            sources: (final.sources ?? []).map(url => ({ url })),
            queryClass: final.query_class,
            usage: final.usage,
            responseTime,
            ...(followUp && { followUp }),
          })
        },
        onError: message => {
          console.error('stream error', message)
          patch({
            content: streamed
              ? `${streamed}\n\n(The answer was cut short.)`
              : 'Sorry, something went wrong. Please try again.',
          })
        },
      })
    } catch (err) {
      console.error('submitQuestion failed', err)
      patch({ content: 'Sorry, something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }, [loading])

  const handleSuggestedClick = useCallback((q: string) => {
    submitQuestion(q)
  }, [submitQuestion])

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()
    const question = input.trim()
    if (!question) return

    submitQuestion(question)
  }, [input, submitQuestion])

  return (
    <div className="max-w-3xl mx-auto">
      {/* Messages */}
      <div ref={messagesContainerRef} className="px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="mt-8">
            {/* Trust explainer */}
            <div className="bg-white rounded-xl border border-zeever-accent/20 p-6 mb-8 max-w-xl mx-auto">
              <h2 className="text-lg font-semibold text-zeever-text mb-2">What is Zeever.ca?</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Zeever.ca is a free Canadian AI tool that answers questions about any City of
                Toronto service using official content from Toronto.ca. Building permits,
                property taxes, recycling, parking, housing, recreation, health programs, city
                government, and everything in between. Every answer is cited and grounded in
                public evidence.
              </p>
            </div>

            <div className="text-center mb-6">
              <h3 className="text-lg font-medium text-gray-700 mb-1">
                Try a question
              </h3>
              <p className="text-sm text-gray-500">
                Or type your own below
              </p>
            </div>

            {/* Suggested questions list — ignoreinteraction so individual chips get credit */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto"
            >
              {suggestedQuestions.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSuggestedClick(q)}
                  className="text-left px-4 py-3 rounded-lg border border-zeever-accent/30 bg-white text-sm text-gray-700 hover:border-zeever-primary hover:bg-zeever-primary/5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zeever-primary focus-visible:border-zeever-primary transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div aria-live="polite" aria-busy={loading} aria-relevant="additions text" className="space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' ? (
                /* Answer result */
                <div
                  className="max-w-[85%] min-w-0 rounded-xl px-4 py-3 bg-white border border-zeever-accent/20 shadow-xs"
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>

                  {msg.sources && msg.sources.length > 0 && (
                    /* Citation list */
                    <div className="mt-3 pt-3 border-t border-zeever-accent/20 space-y-1.5">
                      <p className="text-xs font-medium text-zeever-muted">Sources from Toronto.ca:</p>
                      {msg.sources.map(source => {
                        const href = source.url
                        const linkLabel = source.title || source.url
                        return (
                          <a
                            key={source.url}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open source on Toronto.ca: ${linkLabel} (opens in new tab)`}
                            className="flex items-center gap-1.5 text-xs text-zeever-text hover:text-zeever-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zeever-primary rounded-sm transition-colors"
                          >
                            <svg aria-hidden="true" focusable="false" className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            <span className="truncate">{source.url.replace('https://www.toronto.ca/', '')}</span>
                          </a>
                        )
                      })}
                    </div>
                  )}

                  {msg.followUp && (
                    <p className="mt-4 text-sm text-gray-600">{msg.followUp}</p>
                  )}

                  {(msg.usage || msg.responseTime) && (
                    <div className="mt-2 text-xs text-gray-600">
                      {[
                        msg.usage && `${msg.usage.total_tokens.toLocaleString()} tokens`,
                        msg.responseTime && formatTime(msg.responseTime),
                      ].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-[85%] min-w-0 rounded-xl px-4 py-3 bg-zeever-text text-white">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-zeever-accent/20 rounded-xl px-4 py-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1" aria-hidden="true">
                    <span className="w-1.5 h-1.5 bg-zeever-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-zeever-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-zeever-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-gray-600">Searching Toronto.ca…</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 border-t border-zeever-accent/20 bg-white px-6 py-4">
        {totalCost > 0 && (
          <div className="text-right mb-2">
            <span className="text-xs text-gray-600">Session cost: {formatCost(totalCost)}</span>
          </div>
        )}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex gap-3"
        >
          <label htmlFor="ask-input" className="sr-only">
            Ask about any Toronto City service
          </label>
          <input
            id="ask-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about any Toronto City service..."
            enterKeyHint="send"
            autoComplete="off"
            // text-base on mobile prevents iOS Safari from zooming inputs <16px;
            // shrink to text-sm only at sm+ where zoom isn't a concern.
            className="flex-1 min-w-0 rounded-xl border border-zeever-accent/30 px-4 py-2.5 text-base sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-zeever-primary/30 focus:border-zeever-primary transition-colors"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-zeever-primary-text px-6 py-2.5 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zeever-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  )
}
