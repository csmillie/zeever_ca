import type { Metadata } from 'next'
import Link from 'next/link'
import { WebPageJsonLd, BreadcrumbJsonLd } from '@/components/JsonLd'
const PAGE_URL = 'https://www.zeever.ca/research'

export const metadata: Metadata = {
  title: 'Research',
  description: 'How we build, evaluate, and improve Zeever.ca. Research posts on LLM evaluation, model selection, retrieval engineering, and scaling RAG infrastructure.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'Research - Zeever.ca', description: 'How we build, evaluate, and improve Zeever.ca.', url: PAGE_URL },
}

const POSTS = [
  {
    slug: 'local-ollama-benchmark',
    title: 'Running Ollama on an Old Dell XPS With an NVIDIA 3070',
    date: 'April 17, 2026',
    description: 'We tested local inference with Ollama on a Dell XPS with an RTX 3070 against Fireworks, Together.ai, and OVHcloud. The old desktop held its own.',
  },
  {
    slug: 'provider-comparison',
    title: 'Switching Inference Providers: A 24-Hour Latency Test',
    date: 'April 3, 2026',
    description: 'We ran a 24-hour latency test across Fireworks, Together, and OVHcloud. Together.ai was 1.7x faster. Here is why we switched.',
  },
  {
    slug: 'canadian-inference',
    title: 'The Missing Layer: AI Inference in Canada',
    date: 'April 2, 2026',
    description: 'Canada has GPU hosting but no easy way to test and prototype open-source models. That gap is pushing Canadian companies toward US-hosted black boxes.',
  },
  {
    slug: 'benchmark-suite',
    title: '100 Questions Across Toronto.ca: Building a Comprehensive Benchmark',
    date: 'March 31, 2026',
    description: 'We expanded our evaluation from 12 building permit questions to 100 prompts across 16 categories covering all of Toronto.ca.',
  },
  {
    slug: 'scaling-infrastructure',
    title: 'Scaling a RAG Pipeline from 174 Pages to 35,000 Documents',
    date: 'March 30, 2026',
    description: 'Our database hit 25GB, the server crashed from OOM, and the web admin went dark during crawls. Here is how we fixed all three.',
  },
  {
    slug: 'llm-as-judge',
    title: 'How We Built an LLM-as-Judge to Replace Keyword Scoring',
    date: 'March 28, 2026',
    description: 'Keyword matching scored our best answer at 0.00. The LLM judge scored it 1.00. Here is how we built a semantic evaluation system.',
  },
  {
    slug: 'model-comparison',
    title: 'Comparing 7 Open-Source Models for RAG on City Data',
    date: 'March 28, 2026',
    description: 'We tested 7 open-source LLMs on Toronto city services questions. The cheapest model won.',
  },
  {
    slug: 'retrieval-improvements',
    title: 'Fixing Vector Search: Probes, Chunking, and Classification',
    date: 'March 27, 2026',
    description: 'Three retrieval fixes that improved citation accuracy by 35% and fixed queries that returned zero results.',
  },
  {
    slug: 'vector-vs-graph',
    title: 'Vector RAG vs GraphRAG on Toronto City Data',
    date: 'March 27, 2026',
    description: 'We compared plain vector retrieval against graph-enhanced retrieval. Graph mode helped on some queries and hurt on others.',
  },
]

export default function ResearchPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <WebPageJsonLd name="Research" description="How we build, evaluate, and improve Zeever.ca." url={PAGE_URL} dateModified="2026-04-17" />
      <BreadcrumbJsonLd items={[
        { name: 'Home', url: 'https://www.zeever.ca' },
        { name: 'Research', url: PAGE_URL },
      ]} />
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-semibold text-zeever-text">Research</h1>
        <a href="/feed.xml" title="RSS Feed" className="text-gray-400 hover:text-zeever-primary transition-colors">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="6.18" cy="17.82" r="2.18"/>
            <path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83c0-8.59-6.97-15.56-15.56-15.56zm0 5.66v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83c0-5.47-4.43-9.9-9.9-9.9z"/>
          </svg>
        </a>
      </div>
      <p className="text-gray-500 mb-8">
        How we build, evaluate, and improve Zeever.ca. We publish our methodology,
        results, and what we learned along the way.
      </p>

      <div className="space-y-6">
        {POSTS.map(post => (
          <Link key={post.slug} href={`/research/${post.slug}`} className="block group">
            <div className="bg-white rounded-xl border border-zeever-accent/20 p-5 hover:border-zeever-primary/30 transition-colors">
              <p className="text-xs text-gray-400 mb-1">{post.date}</p>
              <h2 className="text-lg font-semibold text-zeever-text group-hover:text-zeever-primary transition-colors mb-2">
                {post.title}
              </h2>
              <p className="text-sm text-gray-600">{post.description}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 pt-8 border-t border-zeever-accent/20 space-y-6 text-gray-700 leading-relaxed">
        <h2 className="text-xl font-semibold text-zeever-text">Methodology notes</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>All evaluations use temperature=0 for deterministic output.</li>
          <li>The judge model (GPT-oss 120B via Fireworks.ai) is the same model used for answer generation. We acknowledge the potential for self-evaluation bias.</li>
          <li>The 100-prompt benchmark suite covers 16 categories across all sections of Toronto.ca.</li>
          <li>Groundedness scoring evaluates whether claims are supported by retrieved evidence. It does not verify that the evidence itself is current on Toronto.ca.</li>
        </ul>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">Code and data</h2>
        <p>
          The evaluation framework, benchmark prompts, scoring code, and model comparison
          scripts are available on request. Contact us
          at <a href="mailto:support@zeever.ca" className="text-zeever-text hover:text-zeever-primary transition-colors">support@zeever.ca</a>.
        </p>
      </div>
    </div>
  )
}
