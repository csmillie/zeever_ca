const BASE_URL = 'https://www.zeever.ca'

const POSTS = [
  {
    slug: 'provider-comparison',
    title: 'Switching Inference Providers: A 24-Hour Latency Test',
    date: '2026-04-03',
    description: 'We ran a 24-hour latency test across Fireworks, Together, and OVHcloud. Together.ai was 1.7x faster. Here is why we switched.',
  },
  {
    slug: 'canadian-inference',
    title: 'The Missing Layer: AI Inference in Canada',
    date: '2026-04-02',
    description: 'Canada has GPU hosting but no easy way to test and prototype open-source models. That gap is pushing Canadian companies toward US-hosted black boxes.',
  },
  {
    slug: 'benchmark-suite',
    title: '100 Questions Across Toronto.ca: Building a Comprehensive Benchmark',
    date: '2026-03-31',
    description: 'We expanded our evaluation from 12 building permit questions to 100 prompts across 16 categories covering all of Toronto.ca.',
  },
  {
    slug: 'scaling-infrastructure',
    title: 'Scaling a RAG Pipeline from 174 Pages to 35,000 Documents',
    date: '2026-03-30',
    description: 'Our database hit 25GB, the server crashed from OOM, and the web admin went dark during crawls. Here is how we fixed all three.',
  },
  {
    slug: 'llm-as-judge',
    title: 'How We Built an LLM-as-Judge to Replace Keyword Scoring',
    date: '2026-03-28',
    description: 'Keyword matching scored our best answer at 0.00. The LLM judge scored it 1.00. Here is how we built a semantic evaluation system.',
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
    description: 'Three retrieval fixes that improved citation accuracy by 35% and fixed queries that returned zero results.',
  },
  {
    slug: 'vector-vs-graph',
    title: 'Vector RAG vs GraphRAG on Toronto City Data',
    date: '2026-03-27',
    description: 'We compared plain vector retrieval against graph-enhanced retrieval. Graph mode helped on some queries and hurt on others.',
  },
]

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const items = POSTS.map(post => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${BASE_URL}/research/${post.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/research/${post.slug}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <author>colin@zeever.ca (Colin Smillie)</author>
    </item>`).join('')

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Zeever.ca Research</title>
    <link>${BASE_URL}/research</link>
    <description>How we build, evaluate, and improve Zeever.ca. Research on LLM evaluation, model selection, retrieval engineering, and scaling RAG infrastructure.</description>
    <language>en-ca</language>
    <managingEditor>colin@zeever.ca (Colin Smillie)</managingEditor>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
