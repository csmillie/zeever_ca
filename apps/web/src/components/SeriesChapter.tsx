import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArticleJsonLd, BreadcrumbJsonLd } from '@/components/JsonLd'
import { SeriesBanner, SeriesPager } from '@/components/SeriesNav'
import {
  SERIES_TITLE,
  SERIES_BASE_URL,
  getChapter,
  chapterUrl,
  chapterPublishDate,
  isLive,
} from '@/lib/aiInfrastructureSeries'

function formatDate(isoDate: string): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const [year, month, day] = isoDate.split('-').map(Number)
  return `${months[month - 1]} ${day}, ${year}`
}

/**
 * Chapter wrapper for the AI-infrastructure series. Series-aware sibling of
 * BlogPost: 4-level breadcrumb (Home > Research > Series > Chapter), Article
 * schema tied to the series, the "Part N of 11" banner, and a prev/next pager.
 */
interface Revision {
  date: string
  note: React.ReactNode
}

export default function SeriesChapter({ slug, description, updated, children }: {
  slug: string
  description: string
  /** Set when a chapter has been revised after publication. The most recent date
   *  drives the byline and the Article schema's dateModified; each note says what
   *  changed and on what evidence.
   *
   *  Accepts a list because a chapter can be revised more than once for unrelated
   *  reasons, and collapsing two passes under one date hides which change came
   *  from which evidence. A single object still works and is treated as a list of
   *  one. Notes render newest first. */
  updated?: Revision | Revision[]
  children: React.ReactNode
}) {
  const chapter = getChapter(slug)
  if (!chapter) notFound()
  if (!isLive(chapter)) notFound()
  const url = chapterUrl(slug)
  const date = chapterPublishDate(chapter.n)
  // Newest first, so the byline and dateModified take the latest revision and the
  // reader meets the most recent change before the older ones.
  const revisions = (updated ? (Array.isArray(updated) ? updated : [updated]) : [])
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
  const lastUpdated = revisions[0]?.date

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <ArticleJsonLd title={chapter.title} description={description} url={url} datePublished={date} dateModified={lastUpdated} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://www.zeever.ca' },
          { name: 'Research', url: 'https://www.zeever.ca/research' },
          { name: SERIES_TITLE, url: SERIES_BASE_URL },
          { name: chapter.navTitle, url },
        ]}
      />

      <Link href="/research" className="text-sm text-zeever-text hover:text-zeever-primary transition-colors mb-4 inline-block">
        &larr; All research
      </Link>

      <SeriesBanner slug={slug} />

      <h1 className="text-3xl font-semibold text-zeever-text mb-2">{chapter.title}</h1>
      <p className="text-sm text-gray-600 mb-4">
        {formatDate(date)}
        {lastUpdated && <span className="text-gray-500"> &middot; Updated {formatDate(lastUpdated)}</span>}
      </p>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 rounded-full bg-zeever-primary/10 flex items-center justify-center shrink-0">
          <span className="text-zeever-primary font-bold text-xs">CS</span>
        </div>
        <div>
          <Link href="/about" className="text-sm font-medium text-gray-800 hover:text-zeever-primary transition-colors">
            Colin Smillie
          </Link>
          <p className="text-xs text-gray-500">Founder, Developer, AI Researcher</p>
        </div>
      </div>

      <div className="space-y-6 text-gray-700 leading-relaxed">
        {children}
      </div>

      {revisions.map((rev) => (
        <div key={rev.date} className="mt-8 rounded-lg border border-zeever-accent/30 bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Update, {formatDate(rev.date)}
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{rev.note}</p>
        </div>
      ))}

      <SeriesPager slug={slug} />
    </div>
  )
}
