// Single source of truth for the "Canada's Data Centre Race" research
// series (published under the /research/canadian-data-centres path). The hub page,
// per-chapter SeriesNav, chapter gating, and sitemap all read from here so
// ordering, titles, publish dates, and liveness stay consistent in one place.

export const SERIES_BASE_PATH = '/research/canadian-data-centres'
export const SERIES_BASE_URL = 'https://www.zeever.ca/research/canadian-data-centres'
export const SERIES_TITLE = "Canada's Data Centre Race"
export const SERIES_DESCRIPTION =
  'An 11-part series on the physical foundations of Canada\'s AI buildout: data centres, power, fibre, water, sovereignty, jobs, and capital. Every figure cited.'

// Date of the CBRE revision pass: chapters whose figures were re-based on
// CBRE's H2 2025 market data carry this as their "Updated" date and as the
// dateModified in their Article schema. One constant so the visible note, the
// structured data, and the hub page can never drift apart.
export const CBRE_UPDATE_DATE = '2026-08-23'

// Date of the September 2026 policy pass: chapters revised after Ottawa launched
// Canada's Responsible Data Centre Development Principles (3 September 2026) and
// Ontario proposed its Data Centre Playbook (August 2026, consultation closing
// 12 September). A separate constant from CBRE_UPDATE_DATE on purpose. That pass
// re-based figures on market data; this one adds policy and corrects errors, and
// a reader deserves to know which change came from which evidence.
export const POLICY_UPDATE_DATE = '2026-09-03'

// Chapter 1 publishes on this date; one chapter goes live each day thereafter.
// Change this single line to reschedule the whole series. See scheduling notes
// in research/data-centre-research/drafts/SCHEDULING.md.
export const SERIES_START_DATE = '2026-07-13'

export interface Chapter {
  n: number
  slug: string
  title: string // full article title
  navTitle: string // short label for nav/cards
  description: string
}

export const CHAPTERS: Chapter[] = [
  {
    n: 1,
    slug: 'infrastructure-race',
    title: 'The AI Race Is Now an Infrastructure Race',
    navTitle: 'The infrastructure race',
    description: 'The competitive frontier of AI has shifted from models and chips to power, land, fibre, and capital. Where that leaves Canada.',
  },
  {
    n: 2,
    slug: 'canada-vs-us',
    title: 'Canada vs. the U.S.: The Data-Centre Competitiveness Gap',
    navTitle: 'Canada vs. the U.S.',
    description: 'Clean grids, cool climate, and water on one side; speed, scale, and cloud regions on the other. A head-to-head scorecard.',
  },
  {
    n: 3,
    slug: 'the-map',
    title: "Mapping Canada's Data-Centre Boom",
    navTitle: 'The map of the boom',
    description: 'Where the projects are, what stage they are really at, and the gap between announced gigawatts and operating megawatts.',
  },
  {
    n: 4,
    slug: 'power',
    title: "Power Is the Bottleneck in Canada's Data-Centre Boom",
    navTitle: 'Data centres and power',
    description: "The scarce input isn't land, capital, or chips. It's a grid connection: Alberta's 21 GW queue, a 1,200 MW door, and the gas workaround.",
  },
  {
    n: 5,
    slug: 'bandwidth',
    title: "Fibre and Bandwidth: Canada's Two-Metro Problem",
    navTitle: 'Fibre and bandwidth',
    description: 'Real interconnection lives in Toronto and Montreal; everywhere else is thin. What that means for where AI compute can sit.',
  },
  {
    n: 6,
    slug: 'water',
    title: 'Data Centres and Water: The Disclosure Black Hole',
    navTitle: 'Data centres and water',
    description: 'No Canadian project publishes measured water use, and three-quarters of planned Alberta sites sit in high water-stress basins.',
  },
  {
    n: 7,
    slug: 'sovereignty',
    title: 'Sovereign in Name: Data Centres and Digital Sovereignty',
    navTitle: 'Data centres and sovereignty',
    description: 'Funded compute, missing cloud. Why a Canadian-located data centre does not make the data it holds Canadian-controlled.',
  },
  {
    n: 8,
    slug: 'jobs-economics',
    title: 'Jobs and Economics: The Per-Megawatt Reckoning',
    navTitle: 'Jobs and economics',
    description: 'Data centres deliver construction booms and tax base but few permanent jobs. The honest metric is jobs per megawatt.',
  },
  {
    n: 9,
    slug: 'capital',
    title: 'The Capital Behind AI Infrastructure',
    navTitle: 'The capital',
    description: 'Canadian pension and infrastructure money (CPPIB, CDPQ, Brookfield) is deep in AI infrastructure, much of it abroad.',
  },
  {
    n: 10,
    slug: 'alternative-uses',
    title: 'If Not Data Centres, Then What?',
    navTitle: 'Alternative uses',
    description: 'The same 100 MW could go to housing, batteries, steel, or ports, often with far more jobs per megawatt. The opportunity cost.',
  },
  {
    n: 11,
    slug: 'strategy',
    title: "Canada's AI Infrastructure Strategy",
    navTitle: 'The strategy',
    description: 'The ingredients without the coordination. What a real Canadian AI infrastructure strategy would need to look like.',
  },
]

export function chapterPath(slug: string): string {
  return `${SERIES_BASE_PATH}/${slug}`
}

export function chapterUrl(slug: string): string {
  return `${SERIES_BASE_URL}/${slug}`
}

export function getChapter(slug: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.slug === slug)
}

/** ISO publish date (YYYY-MM-DD) for chapter n: start date + (n - 1) days. */
export function chapterPublishDate(n: number): string {
  const d = new Date(`${SERIES_START_DATE}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + (n - 1))
  return d.toISOString().slice(0, 10)
}

/**
 * In production, chapters are hidden until their publish date. The comparison
 * happens once, at build time, so releasing a chapter takes a new build.
 *
 * The series finished on 2026-07-23 and the daily rebuild that released each
 * chapter has been retired, so nothing rebuilds on a schedule any more. A
 * future dated series needs a new artifact per release day — `gh workflow run
 * web-build.yml --ref main` — or this function moved off build time. See
 * research/data-centre-research/drafts/SCHEDULING.md.
 *
 * In development, or when PREVIEW_ALL_CHAPTERS=1, all chapters are visible so
 * the full series can be reviewed before it goes live.
 */
export function previewAll(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.PREVIEW_ALL_CHAPTERS === '1'
}

export function isLive(chapter: Chapter): boolean {
  if (previewAll()) return true
  const today = new Date().toISOString().slice(0, 10)
  return today >= chapterPublishDate(chapter.n)
}

/** The most recently published (live) chapter, or chapter 1 if none are live yet. */
export function latestLiveChapter(): Chapter {
  const live = CHAPTERS.filter(isLive)
  return live.length ? live[live.length - 1] : CHAPTERS[0]
}

/** Formatted publish date (e.g. "July 23, 2026") of the most recent live chapter. */
export function latestLiveChapterDate(): string {
  const iso = chapterPublishDate(latestLiveChapter().n)
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** Previous/next live chapters for in-article navigation. */
export function chapterNeighbours(slug: string): { prev?: Chapter; next?: Chapter } {
  const i = CHAPTERS.findIndex((c) => c.slug === slug)
  if (i === -1) return {}
  const prev = [...CHAPTERS.slice(0, i)].reverse().find(isLive)
  const next = CHAPTERS.slice(i + 1).find(isLive)
  return { prev, next }
}
