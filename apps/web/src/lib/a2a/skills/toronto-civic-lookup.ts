import type { A2AResponse, A2ARequestContext, A2ADataItem } from '../types';
import { AGENT_NAME, DEFAULT_LIMIT, MAX_LIMIT } from '../types';

const API_URL = process.env.API_URL || 'http://localhost:3034';

export async function torontoCivicLookup(
  query: string,
  context?: A2ARequestContext,
): Promise<A2AResponse> {
  const limit = Math.min(context?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const includeSources = context?.includeSources ?? true;

  try {
    const response = await fetch(`${API_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Self-hosted only; see source-grounded-answer.ts for why.
      body: JSON.stringify({ question: query, provider: 'local' }),
    });

    if (response.status === 429) {
      return {
        agent: AGENT_NAME,
        skill: 'toronto_civic_lookup',
        query,
        status: 'error',
        answer: 'Rate limit exceeded. Please try again later.',
        data: [],
        sources: [],
        warnings: ['rate_limited'],
      };
    }

    if (!response.ok) {
      return {
        agent: AGENT_NAME,
        skill: 'toronto_civic_lookup',
        query,
        status: 'error',
        answer: 'Backend service unavailable.',
        data: [],
        sources: [],
        warnings: ['backend_unavailable'],
      };
    }

    const data = await response.json();
    const rawSources = (data.sources ?? []) as Array<{ url: string; title?: string }>;
    const sources = includeSources
      ? rawSources.slice(0, limit).map((s) => ({ url: s.url, title: s.title ?? '' }))
      : [];

    const items: A2ADataItem[] = [
      {
        type: 'response_meta',
        model_used: data.model_used,
        query_class: data.query_class,
        source_count: rawSources.length,
      },
      ...sources.map((s, i) => ({
        type: 'source' as const,
        rank: i + 1,
        url: s.url,
        title: s.title,
      })),
    ];

    return {
      agent: AGENT_NAME,
      skill: 'toronto_civic_lookup',
      query,
      status: 'completed',
      answer: data.answer ?? 'No answer available.',
      data: items,
      sources,
      warnings: data.answer ? [] : ['no_relevant_sources'],
    };
  } catch {
    return {
      agent: AGENT_NAME,
      skill: 'toronto_civic_lookup',
      query,
      status: 'error',
      answer: 'Unable to connect to backend service.',
      data: [],
      sources: [],
      warnings: ['connection_error'],
    };
  }
}
