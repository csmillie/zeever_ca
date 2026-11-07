import type { Metadata } from 'next'
import Link from 'next/link'
import { WebPageJsonLd, BreadcrumbJsonLd } from '@/components/JsonLd'
import EmailLink from '@/components/EmailLink'
import { SERIES_BASE_PATH, SERIES_TITLE, SERIES_DESCRIPTION, CHAPTERS, chapterPublishDate, latestLiveChapter, latestLiveChapterDate } from '@/lib/aiInfrastructureSeries'
import { RESEARCH_POSTS, formatPostDate, postPath, type ResearchPost } from '@/lib/researchPosts'

const PAGE_URL = 'https://www.zeever.ca/research'

export const metadata: Metadata = {
  title: { absolute: 'Research | Zeever.ca' },
  description: 'How we build, evaluate, and improve Zeever.ca. Research posts on LLM evaluation, model selection, retrieval engineering, and scaling RAG infrastructure.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'Research - Zeever.ca', description: 'How we build, evaluate, and improve Zeever.ca.', url: PAGE_URL },
}

function PostCard({ post }: { post: ResearchPost }) {
  return (
    <Link href={postPath(post.slug)} className="block group">
      <div className="bg-white rounded-xl border border-zeever-accent/20 p-5 hover:border-zeever-primary/30 transition-colors">
        <p className="text-xs text-gray-400 mb-1">{formatPostDate(post.date)}</p>
        <h2 className="text-lg font-semibold text-zeever-text group-hover:text-zeever-primary transition-colors mb-2">
          {post.title}
        </h2>
        <p className="text-sm text-gray-600">{post.description}</p>
      </div>
    </Link>
  )
}

export default function ResearchPage() {
  // Merge standalone posts and the data-centre series into one date-ordered list.
  // The series sorts by its most recent live chapter's date. Dates are ISO
  // (YYYY-MM-DD), so a plain string comparison sorts them correctly.
  const seriesDate = chapterPublishDate(latestLiveChapter().n)
  const items = [
    ...RESEARCH_POSTS.map((post) => ({ kind: 'post' as const, key: post.slug, sort: post.date, post })),
    { kind: 'series' as const, key: 'ai-infrastructure-series', sort: seriesDate },
  ].sort((a, b) => b.sort.localeCompare(a.sort))

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <WebPageJsonLd name="Research" description="How we build, evaluate, and improve Zeever.ca." url={PAGE_URL} dateModified="2026-05-02" />
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
        {items.map(item =>
          item.kind === 'series' ? (
            <Link key={item.key} href={SERIES_BASE_PATH} className="block group">
              <div className="rounded-xl border border-zeever-primary/30 bg-zeever-primary/5 p-5 hover:border-zeever-primary/50 transition-colors">
                <p className="text-xs font-medium text-zeever-primary uppercase tracking-wide mb-1">Series &middot; {CHAPTERS.length} chapters &middot; {latestLiveChapterDate()}</p>
                <h2 className="text-lg font-semibold text-zeever-text group-hover:text-zeever-primary transition-colors mb-2">{SERIES_TITLE}</h2>
                <p className="text-sm text-gray-600">{SERIES_DESCRIPTION}</p>
              </div>
            </Link>
          ) : (
            <PostCard key={item.key} post={item.post} />
          )
        )}
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
          at <EmailLink user="info" domain="zeever.ca" className="text-zeever-text hover:text-zeever-primary transition-colors" />.
        </p>
      </div>
    </div>
  )
}
