import type { Metadata } from 'next'
import Link from 'next/link'
import { WebPageJsonLd, BreadcrumbJsonLd, SeriesJsonLd } from '@/components/JsonLd'
import {
  CHAPTERS,
  SERIES_TITLE,
  SERIES_DESCRIPTION,
  SERIES_BASE_URL,
  chapterPath,
  chapterUrl,
  chapterPublishDate,
  isLive,
  CBRE_UPDATE_DATE,
} from '@/lib/aiInfrastructureSeries'

export const metadata: Metadata = {
  title: SERIES_TITLE,
  description: SERIES_DESCRIPTION,
  alternates: { canonical: SERIES_BASE_URL },
  openGraph: {
    images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }],
    title: SERIES_TITLE,
    description: SERIES_DESCRIPTION,
    url: SERIES_BASE_URL,
  },
}

function shortDate(iso: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [y, m, d] = iso.split('-').map(Number)
  return `${months[m - 1]} ${d}, ${y}`
}

export default function CanadianDataCentresSeriesPage() {
  const publishedCount = CHAPTERS.filter(isLive).length
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <WebPageJsonLd name={SERIES_TITLE} description={SERIES_DESCRIPTION} url={SERIES_BASE_URL} dateModified={CBRE_UPDATE_DATE} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://www.zeever.ca' },
          { name: 'Research', url: 'https://www.zeever.ca/research' },
          { name: SERIES_TITLE, url: SERIES_BASE_URL },
        ]}
      />
      <SeriesJsonLd
        name={SERIES_TITLE}
        description={SERIES_DESCRIPTION}
        url={SERIES_BASE_URL}
        chapters={CHAPTERS.map((c) => ({ n: c.n, title: c.title, url: chapterUrl(c.slug), published: isLive(c) }))}
      />

      <Link href="/research" className="text-sm text-zeever-text hover:text-zeever-primary transition-colors mb-4 inline-block">
        &larr; All research
      </Link>

      <p className="text-xs font-medium text-zeever-primary uppercase tracking-wide mb-2">Research series</p>
      <h1 className="text-3xl font-semibold text-zeever-text mb-3">{SERIES_TITLE}</h1>
      <p className="text-gray-600 mb-8">{SERIES_DESCRIPTION}</p>

      <div className="space-y-5 text-gray-700 leading-relaxed mb-10">
        <p>
          The competitive frontier of artificial intelligence has moved from models and chips to
          physical infrastructure: power, land, fibre, water, and capital. Canada has the raw
          ingredient the rest of the world wants, an abundant and largely clean electricity supply,
          but converting that into a strategic advantage runs into constraints the marketing rarely
          mentions.
        </p>
        <p>
          This series works through those constraints one at a time, grounded in a{' '}
          <Link href="/research/mapping-canadian-ai-compute" className="text-zeever-text underline hover:text-zeever-primary">
            primary-source research dataset
          </Link>{' '}
          rather than press releases. A few threads run through all eleven chapters: power
          interconnection, not land or money, is the real bottleneck; where the clean grid
          is capped, developers are quietly falling back on natural gas; foreign hyperscalers still
          control most of the capacity; and the same megawatts could often do more for the economy
          somewhere else.
        </p>
        <p>
          Every figure is cited. Where the data is partial, estimated, or disputed, we say so rather
          than paper over it.
        </p>
        <p className="text-sm border-l-2 border-zeever-primary/30 pl-4 text-gray-600">
          <strong className="text-zeever-text">Updated August 23, 2026.</strong>{' '}The series has been revised against
          CBRE&rsquo;s H2 2025 data-centre research, which reports Toronto and Montreal on the same basis as the U.S.
          markets for the first time. Toronto (315.0 MW) and Montreal (229.5 MW) now carry tracked colocation inventory
          rather than estimates, Northern Virginia is stated as dated figures rather than a range, the tracked project
          set is 20 rather than 18, and the metro figures are explicitly distinguished from the federal 337 MW
          AI-specific estimate. Revised chapters carry a dated update note at the end.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text mb-4">Chapters</h2>
      <ol className="space-y-4">
        {CHAPTERS.map((c) => {
          const live = isLive(c)
          const inner = (
            <div
              className={`flex gap-4 rounded-xl border p-5 transition-colors ${
                live
                  ? 'bg-white border-zeever-accent/20 group-hover:border-zeever-primary/30'
                  : 'bg-gray-50/60 border-dashed border-zeever-accent/20'
              }`}
            >
              <span
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  live ? 'bg-zeever-primary/10 text-zeever-primary' : 'bg-gray-200 text-gray-400'
                }`}
              >
                {c.n}
              </span>
              <div>
                <h3 className={`text-base font-semibold ${live ? 'text-zeever-text group-hover:text-zeever-primary transition-colors' : 'text-gray-500'}`}>
                  {c.navTitle}
                  {!live && <span className="ml-2 align-middle text-[10px] uppercase tracking-wide text-gray-400 border border-gray-300 rounded-sm px-1.5 py-0.5">{shortDate(chapterPublishDate(c.n))}</span>}
                </h3>
                <p className={`text-sm mt-1 ${live ? 'text-gray-600' : 'text-gray-400'}`}>{c.description}</p>
              </div>
            </div>
          )
          return (
            <li key={c.slug}>
              {live ? (
                <Link href={chapterPath(c.slug)} className="block group">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          )
        })}
      </ol>

      <div className="mt-12 pt-8 border-t border-zeever-accent/20 space-y-4 text-gray-700 leading-relaxed">
        <h2 className="text-xl font-semibold text-zeever-text">How this series is built</h2>
        <p className="text-sm">
          The underlying research is a structured dataset of Canadian data-centre projects, provincial
          power systems, fibre and interconnection, water use, capital and financing, sovereignty
          policy, and public controversies, each row carrying source URLs and a confidence flag.
          Primary sources are prioritized: IESO, AESO, Hydro-Qu&eacute;bec, BC Hydro, the Canada Energy
          Regulator, ISED, Alberta Major Projects, the federal Impact Assessment Agency, and named
          investigative reporting.
        </p>
        <p className="text-sm">
          New chapters publish daily over the run of the series.{' '}
          {publishedCount > 0 &&
            (publishedCount === CHAPTERS.length
              ? 'All chapters are live.'
              : `${publishedCount} of ${CHAPTERS.length} are live so far.`)}{' '}
          Related reading:{' '}
          <Link href="/canadas-ai-compute-landscape" className="text-zeever-text underline hover:text-zeever-primary">Canada&rsquo;s AI Compute Landscape</Link>.
        </p>
      </div>
    </div>
  )
}
