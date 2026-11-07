import Link from 'next/link'
import {
  CHAPTERS,
  SERIES_BASE_PATH,
  SERIES_TITLE,
  chapterPath,
  chapterNeighbours,
  getChapter,
} from '@/lib/aiInfrastructureSeries'

/**
 * "Part N of 11" banner. Place at the top of a chapter, above the article body.
 */
export function SeriesBanner({ slug }: { slug: string }) {
  const chapter = getChapter(slug)
  if (!chapter) return null
  return (
    <Link
      href={SERIES_BASE_PATH}
      className="block mb-8 rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3 hover:border-zeever-primary/40 transition-colors"
    >
      <p className="text-xs font-medium text-zeever-primary uppercase tracking-wide">
        Part {chapter.n} of {CHAPTERS.length}
      </p>
      <p className="text-sm text-gray-700">
        {SERIES_TITLE} <span className="text-gray-400">&rarr; see all chapters</span>
      </p>
    </Link>
  )
}

/**
 * Prev/next chapter pager. Place at the bottom of a chapter, after the body.
 * Only links to published chapters.
 */
export function SeriesPager({ slug }: { slug: string }) {
  const { prev, next } = chapterNeighbours(slug)
  return (
    <nav
      className="mt-12 pt-8 border-t border-zeever-accent/20"
      aria-label="Series navigation"
    >
      <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">
        More from {SERIES_TITLE}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {prev ? (
          <Link
            href={chapterPath(prev.slug)}
            className="block rounded-xl border border-zeever-accent/20 p-4 hover:border-zeever-primary/30 transition-colors"
          >
            <p className="text-xs text-gray-400">&larr; Chapter {prev.n}</p>
            <p className="text-sm font-medium text-zeever-text">{prev.navTitle}</p>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={chapterPath(next.slug)}
            className="block rounded-xl border border-zeever-accent/20 p-4 text-right hover:border-zeever-primary/30 transition-colors"
          >
            <p className="text-xs text-gray-400">Chapter {next.n} &rarr;</p>
            <p className="text-sm font-medium text-zeever-text">{next.navTitle}</p>
          </Link>
        ) : (
          <span />
        )}
      </div>
      <p className="mt-4 text-sm">
        <Link
          href={SERIES_BASE_PATH}
          className="text-zeever-text underline hover:text-zeever-primary"
        >
          All {CHAPTERS.length} chapters
        </Link>
      </p>
    </nav>
  )
}
