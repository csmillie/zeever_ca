import type { A2AResponse, A2ARequestContext, A2ASource, A2ADataItem } from '../types';
import { AGENT_NAME, DEFAULT_LIMIT, MAX_LIMIT } from '../types';

interface ResearchArticle {
  slug: string;
  title: string;
  description: string;
  date: string;
  keywords: string[];
}

const RESEARCH_ARTICLES: ResearchArticle[] = [
  {
    slug: 'canadian-inference',
    title: 'The Missing Layer: AI Inference in Canada',
    description:
      'Canada has GPU hosting but no easy way to test and prototype open-source models. That gap is pushing Canadian companies toward US-hosted black boxes.',
    date: '2026-04-02',
    keywords: ['sovereign ai', 'canadian ai', 'inference', 'compute', 'gpu', 'canada', 'hosting'],
  },
  {
    slug: 'agent-first-ai',
    title:
      'The Shift to Agent-First AI: What Together.ai and Fireworks.ai Model Changes Tell Us',
    description:
      'AI inference platforms are deprecating chat-first models and replacing them with agent-first architectures built on Mixture of Experts.',
    date: '2026-04-23',
    keywords: ['agentic ai', 'agent', 'moe', 'model routing', 'together', 'fireworks', 'deprecation'],
  },
  {
    slug: 'provider-comparison',
    title:
      'Switching Inference Providers: A 24-Hour Latency Test Across Fireworks, Together, and OVHcloud',
    description:
      'We ran a 24-hour latency test across three inference providers. Together.ai was 1.7x faster than Fireworks.',
    date: '2026-04-03',
    keywords: ['inference', 'latency', 'provider', 'fireworks', 'together', 'ovhcloud', 'benchmark'],
  },
  {
    slug: 'local-ollama-benchmark',
    title:
      'Running Ollama on an Old Dell XPS With an NVIDIA 3070: A Practical Local LLM Test',
    description:
      'We tested local inference with Ollama on a Dell XPS with an RTX 3070 against cloud providers.',
    date: '2026-04-17',
    keywords: ['ollama', 'local inference', 'gpu', 'benchmark', 'self-hosted', 'sovereign'],
  },
  {
    slug: 'model-comparison',
    title: 'Comparing 7 Open-Source Models for RAG on City Data',
    description:
      'We tested 7 open-source LLMs on 10 Toronto building permit questions. GPT-oss 120B won on relevance and cost.',
    date: '2026-03-28',
    keywords: ['model', 'benchmark', 'open-source', 'rag', 'comparison', 'llm'],
  },
  {
    slug: 'benchmark-suite',
    title: '100 Questions Across Toronto.ca: Building a Comprehensive Benchmark',
    description:
      'We expanded our evaluation from 12 building permit questions to 100 prompts across 16 categories.',
    date: '2026-03-31',
    keywords: ['benchmark', 'evaluation', 'toronto', 'rag', 'testing'],
  },
  {
    slug: 'llm-as-judge',
    title: 'How We Built an LLM-as-Judge to Replace Keyword Scoring',
    description:
      'Keyword matching scored our best answer at 0.00. The LLM judge scored it 1.00.',
    date: '2026-03-28',
    keywords: ['evaluation', 'llm', 'judge', 'scoring', 'semantic'],
  },
  {
    slug: 'vector-vs-graph',
    title: 'Vector RAG vs GraphRAG on Toronto City Data',
    description:
      'We compared plain vector retrieval against graph-enhanced retrieval on Toronto.ca content.',
    date: '2026-03-27',
    keywords: ['graphrag', 'vector', 'retrieval', 'rag', 'knowledge graph'],
  },
  {
    slug: 'retrieval-improvements',
    title:
      'Fixing Vector Search: IVFFlat Probes, Heading-Aware Chunking, and Content Classification',
    description:
      'Three retrieval fixes that improved citation accuracy by 35%.',
    date: '2026-03-27',
    keywords: ['vector search', 'chunking', 'ivfflat', 'retrieval', 'pgvector'],
  },
  {
    slug: 'scaling-infrastructure',
    title: 'Scaling a RAG Pipeline from 174 Pages to 35,000 Documents',
    description:
      'Our database hit 25GB, the server crashed from OOM, and the web admin went dark during crawls.',
    date: '2026-03-30',
    keywords: ['scaling', 'infrastructure', 'rag', 'pipeline', 'database', 'oom'],
  },
];

function scoreArticle(
  article: ResearchArticle,
  queryLower: string,
): { score: number; matched: string[] } {
  const terms = queryLower.split(/\s+/).filter((t) => t.length > 2);
  let score = 0;
  const matched = new Set<string>();
  for (const term of terms) {
    const kw = article.keywords.find((k) => k.includes(term));
    if (kw) {
      score += 2;
      matched.add(kw);
    }
    if (article.title.toLowerCase().includes(term)) score += 1;
    if (article.description.toLowerCase().includes(term)) score += 1;
  }
  return { score, matched: [...matched] };
}

export async function sovereignAiResearch(
  query: string,
  context?: A2ARequestContext,
): Promise<A2AResponse> {
  const limit = Math.min(context?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const queryLower = query.toLowerCase();

  const scored = RESEARCH_ARTICLES.map((article) => {
    const { score, matched } = scoreArticle(article, queryLower);
    return { article, score, matched };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) {
    return {
      agent: AGENT_NAME,
      skill: 'sovereign_ai_research',
      query,
      status: 'completed',
      answer:
        'No Zeever.ca research articles matched this query. Try searching for topics like sovereign AI, Canadian inference, model benchmarks, or agentic AI.',
      data: [],
      sources: [],
      warnings: ['no_matching_research'],
    };
  }

  const sources: A2ASource[] = scored.map((r) => ({
    url: `https://www.zeever.ca/research/${r.article.slug}`,
    title: r.article.title,
  }));

  const summaryParts = scored.map(
    (r) => `- ${r.article.title}: ${r.article.description}`,
  );
  const answer = `Found ${scored.length} relevant research article${scored.length === 1 ? '' : 's'} from Zeever.ca:\n\n${summaryParts.join('\n')}`;

  const items: A2ADataItem[] = scored.map((r, i) => ({
    type: 'research_article',
    rank: i + 1,
    slug: r.article.slug,
    url: `https://www.zeever.ca/research/${r.article.slug}`,
    title: r.article.title,
    description: r.article.description,
    date: r.article.date,
    match_score: r.score,
    matched_keywords: r.matched,
  }));

  return {
    agent: AGENT_NAME,
    skill: 'sovereign_ai_research',
    query,
    status: 'completed',
    answer,
    data: items,
    sources,
    warnings: [],
  };
}
