import type { Metadata } from 'next'
import ChatInterface from '@/components/ChatInterface'
import { WebPageJsonLd, SoftwareApplicationJsonLd } from '@/components/JsonLd'

const BASE_URL = 'https://www.zeever.ca'

export const metadata: Metadata = {
  title: 'Zeever.ca - Free Toronto City Services AI Assistant',
  description: 'Ask questions about any Toronto city service and get cited answers from official Toronto.ca content. Permits, taxes, recycling, parking, housing, recreation, and more.',
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
      <ChatInterface />
    </>
  )
}
