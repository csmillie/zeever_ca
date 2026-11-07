import Link from 'next/link'
import { ArticleJsonLd, BreadcrumbJsonLd } from '@/components/JsonLd'

interface BlogPostProps {
  title: string
  description: string
  date: string
  dateModified?: string
  url: string
  /** Set for syndicated posts whose canonical version lives elsewhere. Article
   *  schema then points at the original; breadcrumbs stay on this site. */
  canonicalUrl?: string
  children: React.ReactNode
}

function formatDate(isoDate: string): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const [year, month, day] = isoDate.split('-').map(Number)
  return `${months[month - 1]} ${day}, ${year}`
}

export default function BlogPost({ title, description, date, dateModified, url, canonicalUrl, children }: BlogPostProps) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <ArticleJsonLd
        title={title}
        description={description}
        url={canonicalUrl || url}
        datePublished={date}
        dateModified={dateModified}
      />
      <BreadcrumbJsonLd items={[
        { name: 'Home', url: 'https://www.zeever.ca' },
        { name: 'Research', url: 'https://www.zeever.ca/research' },
        { name: title, url },
      ]} />
      <Link href="/research" className="text-sm text-zeever-text hover:text-zeever-primary transition-colors mb-4 inline-block">
        &larr; All research
      </Link>
      <h1 className="text-3xl font-semibold text-zeever-text mb-2">{title}</h1>
      <p className="text-sm text-gray-600 mb-4">{formatDate(date)}</p>
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
    </div>
  )
}
