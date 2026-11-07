const BASE_URL = 'https://www.zeever.ca'

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${BASE_URL}/#organization`,
  name: 'Zeever.ca',
  url: BASE_URL,
  sameAs: [
    'https://colinsmillie.com',
    'https://www.ideawarehouse.ca',
  ],
  founder: { '@id': `${BASE_URL}/#founder` },
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'info@zeever.ca',
    contactType: 'customer support',
  },
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${BASE_URL}/#website`,
  name: 'Zeever.ca',
  url: BASE_URL,
  publisher: { '@id': `${BASE_URL}/#organization` },
  description: 'Canadian AI platform for trustworthy, cited answers about any City of Toronto service using official Toronto.ca content.',
  dateModified: '2026-04-02',
}

export function OrganizationJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
    />
  )
}

export function WebSiteJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
    />
  )
}

export function WebPageJsonLd({ name, description, url, dateModified }: { name: string; description: string; url: string; dateModified?: string }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}/#webpage`,
    name,
    description,
    url,
    dateModified: dateModified || '2026-04-02',
    isPartOf: { '@id': `${BASE_URL}/#website` },
    publisher: { '@id': `${BASE_URL}/#organization` },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function SoftwareApplicationJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Zeever.ca',
    description: 'Zeever.ca is a Canadian AI assistant that answers questions about any Toronto city service using official Toronto.ca content. Every answer is cited and grounded in public evidence.',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CAD',
      availability: 'https://schema.org/InStock',
      url: BASE_URL,
    },
    url: BASE_URL,
    author: { '@id': `${BASE_URL}/#founder` },
    publisher: { '@id': `${BASE_URL}/#organization` },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function PersonJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${BASE_URL}/#founder`,
    name: 'Colin Smillie',
    url: 'https://colinsmillie.com',
    sameAs: [
      'https://www.linkedin.com/in/csmillie/',
      'https://colinsmillie.com',
      'https://www.ideawarehouse.ca',
    ],
    jobTitle: 'Founder, Developer, AI Researcher',
    worksFor: { '@id': `${BASE_URL}/#organization` },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function ArticleJsonLd({ title, description, url, datePublished, dateModified }: {
  title: string
  description: string
  url: string
  datePublished: string
  dateModified?: string
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    datePublished,
    dateModified: dateModified || datePublished,
    author: { '@id': `${BASE_URL}/#founder` },
    publisher: { '@id': `${BASE_URL}/#organization` },
    isPartOf: { '@id': `${BASE_URL}/#website` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function SeriesJsonLd({ name, description, url, chapters }: {
  name: string
  description: string
  url: string
  chapters: { n: number; title: string; url: string; published: boolean }[]
}) {
  const published = chapters.filter((c) => c.published)
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWorkSeries',
    '@id': `${url}/#series`,
    name,
    description,
    url,
    author: { '@id': `${BASE_URL}/#founder` },
    publisher: { '@id': `${BASE_URL}/#organization` },
    numberOfItems: chapters.length,
    hasPart: published.map((c) => ({
      '@type': 'Article',
      position: c.n,
      headline: c.title,
      url: c.url,
      isPartOf: { '@id': `${url}/#series` },
    })),
    mainEntity: {
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: published.length,
      itemListElement: published.map((c) => ({
        '@type': 'ListItem',
        position: c.n,
        url: c.url,
        name: c.title,
      })),
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function FAQPageJsonLd({ faqs }: { faqs: { question: string; answer: string }[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    dateModified: '2026-04-02',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
