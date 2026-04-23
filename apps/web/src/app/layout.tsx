import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { OrganizationJsonLd, WebSiteJsonLd, PersonJsonLd } from '@/components/JsonLd'
import './globals.css'

const BASE_URL = 'https://www.zeever.ca'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Zeever.ca - Toronto City Services AI Assistant',
    template: '%s | Zeever.ca',
  },
  description: 'Get cited, evidence-based answers about any Toronto city service from official Toronto.ca content. Free Canadian AI tool.',
  openGraph: {
    type: 'website',
    siteName: 'Zeever.ca',
    locale: 'en_CA',
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Zeever.ca - Toronto City Services AI Assistant',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [`${BASE_URL}/og-image.png`],
  },
}

function Nav() {
  return (
    <nav className="border-b border-zeever-accent/20 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#EB7F26] flex items-center justify-center">
            <span className="text-white font-bold text-sm">Z</span>
          </div>
          <span className="text-xl font-semibold text-zeever-text">zeever.ca</span>
        </a>
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="text-sm text-gray-600 hover:text-zeever-text transition-colors">
            Ask
          </Link>
          <Link href="/about" className="text-sm text-gray-600 hover:text-zeever-text transition-colors">
            About
          </Link>
          <Link href="/faq" className="text-sm text-gray-600 hover:text-zeever-text transition-colors">
            FAQ
          </Link>
          <Link href="/research" className="text-sm text-gray-600 hover:text-zeever-text transition-colors">
            Research
          </Link>
        </div>
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="border-t border-zeever-accent/20 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex flex-col items-center sm:items-start gap-1">
          <p className="text-xs text-gray-500">
            All content sourced from{' '}
            <a href="https://www.toronto.ca" target="_blank" rel="noopener noreferrer" className="hover:text-zeever-text transition-colors">
              Toronto.ca
            </a>
          </p>
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()}{' '}
            <a href="https://www.ideawarehouse.ca" target="_blank" rel="noopener noreferrer" className="hover:text-zeever-text transition-colors">
              Idea Warehouse
            </a>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://www.ideawarehouse.ca" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-zeever-text transition-colors">
            ideawarehouse.ca
          </a>
          <span className="text-gray-400">|</span>
          <a href="https://colinsmillie.com" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-zeever-text transition-colors">
            colinsmillie.com
          </a>
          <span className="text-gray-400">|</span>
          <Link href="/privacy" className="text-xs text-gray-500 hover:text-zeever-text transition-colors">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="alternate" type="application/rss+xml" title="Zeever.ca Research" href="/feed.xml" />
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <PersonJsonLd />
      </head>
      <body>
        <div className="flex flex-col min-h-dvh">
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
