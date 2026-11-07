import { RESEARCH_POSTS, postUrl } from '@/lib/researchPosts'
import { CHAPTERS, SERIES_TITLE, chapterPublishDate, chapterUrl, isLive } from '@/lib/aiInfrastructureSeries'

const BASE_URL = 'https://www.zeever.ca'

interface FeedItem {
  title: string
  url: string
  date: string // ISO YYYY-MM-DD
  description: string
}

/**
 * Standalone research posts plus the live chapters of the data-centre series,
 * merged into one date-ordered feed. Both lists come from the same modules the
 * research index reads, so the feed cannot drift out of date behind the site.
 */
function feedItems(): FeedItem[] {
  const posts: FeedItem[] = RESEARCH_POSTS.map(post => ({
    title: post.title,
    url: postUrl(post.slug),
    date: post.date,
    description: post.description,
  }))

  const chapters: FeedItem[] = CHAPTERS.filter(isLive).map(chapter => ({
    title: `${SERIES_TITLE}, Part ${chapter.n} — ${chapter.title}`,
    url: chapterUrl(chapter.slug),
    date: chapterPublishDate(chapter.n),
    description: chapter.description,
  }))

  return [...posts, ...chapters].sort((a, b) => b.date.localeCompare(a.date))
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const items = feedItems().map(item => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${new Date(`${item.date}T12:00:00Z`).toUTCString()}</pubDate>
      <author>noreply@zeever.ca (Colin Smillie)</author>
    </item>`).join('')

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Zeever.ca Research</title>
    <link>${BASE_URL}/research</link>
    <description>How we build, evaluate, and improve Zeever.ca. Research on LLM evaluation, model selection, retrieval engineering, and scaling RAG infrastructure.</description>
    <language>en-ca</language>
    <managingEditor>noreply@zeever.ca (Colin Smillie)</managingEditor>
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
