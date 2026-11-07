import type { A2AResponse, A2ARequestContext, A2ADataItem } from '../types';
import { AGENT_NAME, DEFAULT_LIMIT, MAX_LIMIT } from '../types';

const API_URL = process.env.API_URL || 'http://localhost:3034';

export async function sourceGroundedAnswer(
  query: string,
  context?: A2ARequestContext,
): Promise<A2AResponse> {
  const limit = Math.min(context?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const includeSources = context?.includeSources ?? true;

  try {
    const response = await fetch(`${API_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // provider: 'local' pins this to self-hosted inference and makes the API
      // fail rather than fall back to a paid provider. /a2a is reachable by
      // anything that can make an HTTP request, and checkApiKey() treats a
      // missing A2A_API_KEY as "no auth required", so an unauthenticated agent
      // must not be able to spend money here.
      body: JSON.stringify({ question: query, provider: 'local' }),
    });

    if (response.status === 429) {
      return {
        agent: AGENT_NAME,
        skill: 'source_grounded_answer',
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
        skill: 'source_grounded_answer',
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

    const warnings: string[] = [];
    if (!data.sources || data.sources.length === 0) {
      warnings.push('no_sources_found');
    }
    if (data.answer?.toLowerCase().includes('not enough information')) {
      warnings.push('insufficient_evidence');
    }
    if (data.answer?.toLowerCase().includes('could not find')) {
      warnings.push('weak_retrieval');
    }

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
      skill: 'source_grounded_answer',
      query,
      status: 'completed',
      answer: data.answer ?? 'No answer available.',
      data: items,
      sources,
      warnings,
    };
  } catch {
    return {
      agent: AGENT_NAME,
      skill: 'source_grounded_answer',
      query,
      status: 'error',
      answer: 'Unable to connect to backend service.',
      data: [],
      sources: [],
      warnings: ['connection_error'],
    };
  }
}
