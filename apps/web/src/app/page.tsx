import type { Metadata } from 'next'
import ChatInterface from '@/components/ChatInterface'
import { WebPageJsonLd, SoftwareApplicationJsonLd } from '@/components/JsonLd'

const BASE_URL = 'https://www.zeever.ca'

export const metadata: Metadata = {
  title: 'Zeever.ca - Free Toronto City Services AI Assistant',
  description: 'Ask questions about any Toronto city service and get cited answers from official Toronto.ca content. Permits, taxes, recycling, parking, housing, and more.',
  alternates: { canonical: BASE_URL },
  openGraph: { images: [{ url: "https://www.zeever.ca/og-image.png", width: 1200, height: 630, alt: "Zeever.ca" }],
    title: 'Zeever.ca - Free Toronto City Services AI Assistant',
    description: 'Ask questions about any Toronto city service and get cited answers from official Toronto.ca content.',
    url: BASE_URL,
    type: 'website',
  },
}

export default function Home() {
  return (
    <>
      <WebPageJsonLd
        name="Zeever.ca - Toronto City Services AI Assistant"
        description="Ask questions about any Toronto city service and get cited answers from official Toronto.ca content."
        url={BASE_URL}
      />
      <SoftwareApplicationJsonLd />
      <div className="max-w-3xl mx-auto px-6 pt-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-semibold text-zeever-text">
          Ask about any Toronto city service
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Cited answers from official Toronto.ca content.
        </p>
      </div>
      <ChatInterface />
    </>
  )
}
