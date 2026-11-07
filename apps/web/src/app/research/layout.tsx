import type { Metadata } from 'next'

// Research posts carry their own full headline in the title tag, so they opt out
// of the sitewide '%s | Zeever.ca' template defined in the root layout. The brand
// suffix costs 12 characters, which pushed most of these titles past the ~60
// characters Google will show. Google appends the site name to the result itself,
// so the suffix was buying nothing and losing the end of every headline.
export const metadata: Metadata = {
  title: { template: '%s', default: 'Research | Zeever.ca' },
}

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
