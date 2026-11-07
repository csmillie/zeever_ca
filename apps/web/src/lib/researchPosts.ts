// Single source of truth for the standalone research posts (everything under
// /research/* that is not part of the Canada's Data Centre Race series). The
// research index and the RSS feed both read from here, so a new post only needs
// to be added once. The series itself lives in aiInfrastructureSeries.ts.

export interface ResearchPost {
  slug: string
  title: string
  /** ISO publish date (YYYY-MM-DD). */
  date: string
  description: string
  /** Set when the post was first published elsewhere and that copy is canonical. */
  canonicalUrl?: string
}

/** Newest first. */
export const RESEARCH_POSTS: ResearchPost[] = [
  {
    slug: 'ai-data-centres-in-containers',
    title: 'AI Data Centres Now Ship in Containers. Municipalities Should Change How They Evaluate Them.',
    date: '2026-10-21',
    description:
      'NVIDIA’s DSX POD cuts deployment to as little as 14 days. More of the skilled work happens in the factory, and councils still score these projects like factories.',
  },
  {
    slug: 'propane-power-ai-data-centres',
    title: 'Can Propane Power Canada’s AI Data Centres?',
    date: '2026-10-03',
    description:
      'The propane industry puts its best opportunity at about 5 MW or less, and delivery arithmetic explains why. A 100 MW site needs 15 tanker deliveries a day.',
  },
  {
    slug: 'paid-for-not-running',
    title: 'A Quarter of a Trillion Dollars, Paid For and Not Running',
    date: '2026-09-23',
    description:
      'Five companies disclose $250.2 billion of data centre assets not yet in service. We pulled construction in progress, NVIDIA inventory and server useful lives from the filings to test a claim about the AI buildout, and found one number that supports it, one that measures the wrong balance sheet, and one that is false as usually stated.',
  },
  {
    slug: 'embeddings-on-our-own-hardware',
    title: 'The Smaller Card Won Again',
    date: '2026-09-19',
    description:
      'We moved our embeddings off a US provider onto our own GPUs. The 8GB NVIDIA card beat the 20GB AMD one again, and the move surfaced a months-old bug.',
  },
  {
    slug: 'the-index-that-was-never-used',
    title: 'Our Vector Index Had Never Been Used Once',
    date: '2026-09-08',
    description:
      'For months every search read all 58,000 rows. The answers stayed correct, which is why nobody noticed, and it wrecked a vector database comparison.',
  },
  {
    slug: 'what-my-gpu-benchmark-was-hiding',
    title: 'My GPU Benchmark Was Measuring a Cold Model',
    date: '2026-09-08',
    description:
      'We published a GPU comparison for local language models. One finding was wrong: the first request after a model loads under-reports prompt processing.',
  },
  {
    slug: 'two-data-centre-rulebooks',
    title: 'Canada Now Has Two Data Centre Rulebooks. Only One Can Say No.',
    date: '2026-09-03',
    description:
      'Ontario proposed a screening playbook and Ottawa launched a national framework. One gates access to the grid. The other has no metric and no consequence.',
  },
  {
    slug: 'other-peoples-websites',
    title: 'My Toronto.ca Corpus Contained Other People’s Websites',
    date: '2026-08-31',
    description:
      'Toronto.ca redirects some of its own pages to other organisations, and my crawler stored them anyway. Cleaning that up moved retrieval accuracy eight points.',
  },
  {
    slug: 'benchmarking-our-benchmark',
    title: 'I Benchmarked 17 Models. The Problem Was My Benchmark.',
    date: '2026-08-30',
    description:
      'Seventeen models scored within nine points of each other. Then I checked the benchmark itself and watched retrieval accuracy fall from 89 percent to 56.',
  },
  {
    slug: 'cbre-data-centre-update',
    title: 'Toronto Is 315 MW: What CBRE’s Data Changed in Our Data-Centre Research',
    date: '2026-08-23',
    description:
      'CBRE now reports Toronto and Montreal on the same basis as US markets. We checked our series against it, corrected six things, and learned definitions rule.',
  },
  {
    slug: 'ai-isnt-the-next-2008',
    title: 'AI Isn’t the Next 2008. But Its Financial System Is Starting to Rhyme.',
    date: '2026-08-12',
    description:
      'Data-centre securitization went from $4 billion in 2020 to roughly $61 billion today, and SEC staff have now said qualifying versions are not legally asset-backed securities. This is not subprime. The risk is opacity.',
    canonicalUrl:
      'https://colinsmillie.com/2026/08/12/ai-isnt-the-next-2008-but-its-financial-system-is-starting-to-rhyme/',
  },
  {
    slug: 'turbopuffer-vs-pgvector',
    title: 'Turbopuffer vs pgvector: Equal Quality, and a Speed Claim We Got Wrong',
    date: '2026-07-31',
    description:
      'We benchmarked Turbopuffer against our pgvector setup on 100 Toronto questions. Answer quality was a tie, and still is. The 20x speed advantage was not: our pgvector index had never been used, so the comparison measured an unindexed table.',
  },
  {
    slug: 'cohere-comparison',
    title: 'Does Proprietary Beat Open? Testing Cohere Command on City RAG',
    date: '2026-07-28',
    description:
      "We put Cohere's three Command models against our open Qwen2.5-7B baseline on 100 Toronto questions, scored by a neutral judge. The open model held its ground.",
  },
  {
    slug: 'mapping-canadian-ai-compute',
    title: 'Mapping Canadian AI Compute: Why We Built the Zeever Compute Index',
    date: '2026-05-02',
    description:
      'A verified inventory of 39 Canadian GPU providers, normalized on H100 USD/GPU·hr against a $7.50 ceiling, with a sovereignty taxonomy that makes the procurement trade-off legible.',
  },
  {
    slug: 'agent-first-ai',
    title: 'The Shift to Agent-First AI: What Model Deprecations Tell Us',
    date: '2026-04-23',
    description:
      'AI inference platforms are deprecating chat-first models and replacing them with agent-first MoE architectures. What this shift means for production AI.',
  },
  {
    slug: 'local-ollama-benchmark',
    title: 'Running Ollama on an Old Dell XPS With an NVIDIA 3070',
    date: '2026-04-17',
    description:
      'We tested local inference with Ollama on a Dell XPS with an RTX 3070 against Fireworks, Together.ai, and OVHcloud. The old desktop held its own.',
  },
  {
    slug: 'provider-comparison',
    title: 'Switching Inference Providers: A 24-Hour Latency Test',
    date: '2026-04-03',
    description:
      'We ran a 24-hour latency test across Fireworks, Together, and OVHcloud. Together.ai was 1.7x faster. Here is why we switched.',
  },
  {
    slug: 'canadian-inference',
    title: 'The Missing Layer: AI Inference in Canada',
    date: '2026-04-02',
    description:
      'Canada has GPU hosting but no easy way to test and prototype open-source models. That gap is pushing Canadian companies toward US-hosted black boxes.',
  },
  {
    slug: 'benchmark-suite',
    title: '100 Questions Across Toronto.ca: Building a Comprehensive Benchmark',
    date: '2026-03-31',
    description:
      'We expanded our evaluation from 12 building permit questions to 100 prompts across 16 categories covering all of Toronto.ca.',
  },
  {
    slug: 'scaling-infrastructure',
    title: 'Scaling a RAG Pipeline from 174 Pages to 35,000 Documents',
    date: '2026-03-30',
    description:
      'Our database hit 25GB, the server crashed from OOM, and the web admin went dark during crawls. Here is how we fixed all three.',
  },
  {
    slug: 'llm-as-judge',
    title: 'How We Built an LLM-as-Judge to Replace Keyword Scoring',
    date: '2026-03-28',
    description:
      'Keyword matching scored our best answer at 0.00. The LLM judge scored it 1.00. Here is how we built a semantic evaluation system.',
  },
  {
    slug: 'model-comparison',
    title: 'Comparing 7 Open-Source Models for RAG on City Data',
    date: '2026-03-28',
    description: 'We tested 7 open-source LLMs on Toronto city services questions. The cheapest model won.',
  },
  {
    slug: 'retrieval-improvements',
    title: 'Fixing Vector Search: Probes, Chunking, and Classification',
    date: '2026-03-27',
    description:
      'Three retrieval fixes that improved citation accuracy by 35% and fixed queries that returned zero results.',
  },
  {
    slug: 'vector-vs-graph',
    title: 'Vector RAG vs GraphRAG on Toronto City Data',
    date: '2026-03-27',
    description:
      'We compared plain vector retrieval against graph-enhanced retrieval. Graph mode helped on some queries and hurt on others.',
  },
]

export function postPath(slug: string): string {
  return `/research/${slug}`
}

export function postUrl(slug: string): string {
  return `https://www.zeever.ca/research/${slug}`
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "2026-08-12" -> "August 12, 2026". Parsed by hand so no timezone shifts the day. */
export function formatPostDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return `${MONTHS[month - 1]} ${day}, ${year}`
}
