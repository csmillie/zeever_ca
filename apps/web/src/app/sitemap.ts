import type { MetadataRoute } from 'next'
import { CHAPTERS, SERIES_BASE_URL, chapterUrl, isLive } from '@/lib/aiInfrastructureSeries'
import { RESEARCH_POSTS, postUrl } from '@/lib/researchPosts'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.zeever.ca'

  // The data-centre series: hub is always listed; individual chapters appear
  // only once they are live (evaluated at build time, so a rebuild after each
  // publish date adds that day's chapter to the sitemap).
  const seriesEntries: MetadataRoute.Sitemap = [
    {
      url: SERIES_BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...CHAPTERS.filter(isLive).map((c) => ({
      url: chapterUrl(c.slug),
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/canadas-ai-compute-landscape`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/research`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...seriesEntries,
    // Standalone research posts come from the registry. Posts whose canonical
    // version lives on another site are excluded: listing a page that
    // canonicalizes elsewhere is a mixed signal.
    ...RESEARCH_POSTS.filter((p) => !p.canonicalUrl).map((p) => ({
      url: postUrl(p.slug),
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]
}
