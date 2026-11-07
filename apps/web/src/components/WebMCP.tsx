'use client'

import { useEffect } from 'react'

declare global {
  interface ModelContext {
    registerTool(tool: {
      name: string
      description: string
      inputSchema: Record<string, unknown>
      execute: (input: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>
    }, options?: { signal?: AbortSignal }): void
  }
  interface Navigator {
    modelContext?: ModelContext
  }
}

export default function WebMCP() {
  useEffect(() => {
    if (!navigator.modelContext) return

    const controller = new AbortController()

    navigator.modelContext.registerTool(
      {
        name: 'ask_toronto',
        description:
          'Ask a question about any City of Toronto service. Returns a cited answer grounded in official Toronto.ca content.',
        inputSchema: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'Question about Toronto city services (e.g., "How do I get a building permit?")',
            },
          },
          required: ['question'],
        },
        execute: async (input: Record<string, unknown>, signal: AbortSignal) => {
          const res = await fetch('/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: input.question }),
            signal,
          })
          if (!res.ok) throw new Error(`Query failed: ${res.status}`)
          return res.json()
        },
      },
      { signal: controller.signal },
    )

    navigator.modelContext.registerTool(
      {
        name: 'search_toronto_services',
        description:
          'Search for Toronto city services by topic. Returns a list of relevant service categories.',
        inputSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'Service topic to search for (e.g., "recycling", "parking permits")',
            },
          },
          required: ['topic'],
        },
        execute: async (input: Record<string, unknown>, signal: AbortSignal) => {
          const res = await fetch('/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: `What Toronto city services are available for: ${input.topic}`,
            }),
            signal,
          })
          if (!res.ok) throw new Error(`Search failed: ${res.status}`)
          return res.json()
        },
      },
      { signal: controller.signal },
    )

    return () => controller.abort()
  }, [])

  return null
}
