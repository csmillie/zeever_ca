import type { Metadata } from 'next'
import Link from 'next/link'
import { WebPageJsonLd, BreadcrumbJsonLd } from '@/components/JsonLd'

const PAGE_URL = 'https://www.zeever.ca/about'

export const metadata: Metadata = {
  title: 'About Zeever.ca - Canadian AI for Toronto City Services',
  description: 'Zeever.ca answers questions about any Toronto city service using open-source AI and official Toronto.ca content. Founded by Colin Smillie. Built in Canada.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: "https://www.zeever.ca/og-image.png", width: 1200, height: 630, alt: "Zeever.ca" }],
    title: 'About Zeever.ca - Canadian AI for Toronto City Services',
    description: 'Zeever.ca answers questions about any Toronto city service using open-source AI and official Toronto.ca content.',
    url: PAGE_URL,
  },
}

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <WebPageJsonLd name="About Zeever.ca" description="How Zeever.ca uses open-source AI to answer questions about Toronto city services." url={PAGE_URL} dateModified="2026-04-02" />
      <BreadcrumbJsonLd items={[
        { name: 'Home', url: 'https://www.zeever.ca' },
        { name: 'About', url: PAGE_URL },
      ]} />
      <h1 className="text-3xl font-semibold text-zeever-text mb-2">About Zeever.ca</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: April 2026</p>

      <div className="space-y-6 text-gray-700 leading-relaxed">
        <p>
          Zeever.ca is a Canadian AI platform that turns public information into clear,
          trustworthy answers. We cover all of Toronto.ca, from building permits and
          property taxes to recycling schedules, parking, recreation programs, and city
          government.
        </p>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">Founder</h2>
        <div className="bg-white rounded-xl border border-zeever-accent/20 p-6 flex gap-5 items-start">
          <div className="w-16 h-16 rounded-full bg-zeever-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-zeever-primary font-bold text-xl">CS</span>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Colin Smillie</p>
            <p className="text-sm text-gray-500 mb-2">Founder, Developer, AI Researcher</p>
            <p className="text-sm text-gray-600">
              Colin designs and builds AI systems for Canadian public services, with a focus on
              retrieval-augmented generation, open-source model evaluation, and Canadian data
              sovereignty. He publishes <Link href="/research" className="text-zeever-text hover:text-zeever-primary">research</Link> on
              LLM benchmarking, vector search optimization, and scaling RAG infrastructure.
            </p>
            <div className="flex gap-3 mt-3">
              <a href="https://www.linkedin.com/in/colinsmillie/" target="_blank" rel="noopener noreferrer" className="text-xs text-zeever-text hover:text-zeever-primary transition-colors">
                LinkedIn
              </a>
              <a href="https://colinsmillie.com" target="_blank" rel="noopener noreferrer" className="text-xs text-zeever-text hover:text-zeever-primary transition-colors">
                colinsmillie.com
              </a>
              <a href="https://www.ideawarehouse.ca" target="_blank" rel="noopener noreferrer" className="text-xs text-zeever-text hover:text-zeever-primary transition-colors">
                Idea Warehouse
              </a>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">What we do</h2>
        <p>
          Ask a question about any Toronto city service and Zeever.ca will search
          through official content from Toronto.ca to find what&apos;s relevant. It then
          writes an answer based only on what it found, with citations so you can
          check the sources yourself.
        </p>
        <p>
          If the information isn&apos;t there, Zeever.ca will say so. It won&apos;t guess
          and it won&apos;t fill in the blanks with things it doesn&apos;t know.
        </p>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">By the numbers</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-zeever-accent/20 p-4 text-center">
            <p className="text-2xl font-bold text-zeever-primary">23,000+</p>
            <p className="text-xs text-gray-500 mt-1">Pages indexed</p>
          </div>
          <div className="bg-white rounded-xl border border-zeever-accent/20 p-4 text-center">
            <p className="text-2xl font-bold text-zeever-primary">112,000+</p>
            <p className="text-xs text-gray-500 mt-1">Content chunks</p>
          </div>
          <div className="bg-white rounded-xl border border-zeever-accent/20 p-4 text-center">
            <p className="text-2xl font-bold text-zeever-primary">0.94</p>
            <p className="text-xs text-gray-500 mt-1">Relevance score</p>
          </div>
          <div className="bg-white rounded-xl border border-zeever-accent/20 p-4 text-center">
            <p className="text-2xl font-bold text-zeever-primary">9</p>
            <p className="text-xs text-gray-500 mt-1">Models tested</p>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Relevance score from{' '}
          <Link href="/research/benchmark-suite" className="text-zeever-text hover:text-zeever-primary">100-question benchmark</Link>{' '}
          across 16 categories using{' '}
          <Link href="/research/model-comparison" className="text-zeever-text hover:text-zeever-primary">9 open-source models</Link>.
          See our <Link href="/research" className="text-zeever-text hover:text-zeever-primary">research</Link> for full methodology.
        </p>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">Zeever.ca vs. alternatives</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-zeever-accent/10">
                <th className="text-left px-4 py-2 font-medium text-gray-700"></th>
                <th className="text-left px-4 py-2 font-medium text-zeever-primary">Zeever.ca</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Toronto.ca search</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Call 311</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Hire a consultant</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              <tr className="border-t border-zeever-accent/10">
                <td className="px-4 py-2 font-medium text-gray-700">Speed</td>
                <td className="px-4 py-2 text-zeever-primary">Seconds</td>
                <td className="px-4 py-2">10+ minutes</td>
                <td className="px-4 py-2">30+ min wait</td>
                <td className="px-4 py-2">Days</td>
              </tr>
              <tr className="border-t border-zeever-accent/10">
                <td className="px-4 py-2 font-medium text-gray-700">Cost</td>
                <td className="px-4 py-2 text-zeever-primary">Free</td>
                <td className="px-4 py-2">Free</td>
                <td className="px-4 py-2">Free</td>
                <td className="px-4 py-2">$100+/hr</td>
              </tr>
              <tr className="border-t border-zeever-accent/10">
                <td className="px-4 py-2 font-medium text-gray-700">Citations</td>
                <td className="px-4 py-2 text-zeever-primary">Every answer</td>
                <td className="px-4 py-2">You find them</td>
                <td className="px-4 py-2">None</td>
                <td className="px-4 py-2">Varies</td>
              </tr>
              <tr className="border-t border-zeever-accent/10">
                <td className="px-4 py-2 font-medium text-gray-700">Availability</td>
                <td className="px-4 py-2 text-zeever-primary">24/7</td>
                <td className="px-4 py-2">24/7</td>
                <td className="px-4 py-2">Business hours</td>
                <td className="px-4 py-2">By appointment</td>
              </tr>
              <tr className="border-t border-zeever-accent/10">
                <td className="px-4 py-2 font-medium text-gray-700">Source</td>
                <td className="px-4 py-2 text-zeever-primary">Toronto.ca only</td>
                <td className="px-4 py-2">Toronto.ca</td>
                <td className="px-4 py-2">City staff</td>
                <td className="px-4 py-2">Experience</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">How it works</h2>
        <div className="bg-white rounded-xl border border-zeever-accent/20 p-6 space-y-4">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-zeever-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-zeever-primary font-semibold text-sm">1</span>
            </div>
            <div>
              <p className="font-medium text-gray-800">Crawl</p>
              <p className="text-sm text-gray-500">We regularly pull in pages and PDFs from across Toronto.ca to keep our content up to date. Smart re-crawling checks for changes so the index stays current.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-zeever-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-zeever-primary font-semibold text-sm">2</span>
            </div>
            <div>
              <p className="font-medium text-gray-800">Understand</p>
              <p className="text-sm text-gray-500">That content gets parsed, classified, and broken into focused sections. Each one is turned into a vector embedding that captures what it means.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-zeever-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-zeever-primary font-semibold text-sm">3</span>
            </div>
            <div>
              <p className="font-medium text-gray-800">Retrieve</p>
              <p className="text-sm text-gray-500">When you ask a question, we use vector similarity search to find the most relevant sections from across all of Toronto.ca.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-zeever-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-zeever-primary font-semibold text-sm">4</span>
            </div>
            <div>
              <p className="font-medium text-gray-800">Answer</p>
              <p className="text-sm text-gray-500">An AI model reads the retrieved evidence and writes a clear answer with citations. It only works from what it found, never from its own training data.</p>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">What this is not</h2>
        <p>
          Zeever.ca is not a substitute for professional advice. City services can
          get complicated depending on your situation. For anything important,
          check with the relevant City of Toronto department directly or talk to
          a qualified professional.
        </p>
        <p>
          We&apos;re not affiliated with or endorsed by the City of Toronto. We use
          publicly available content from Toronto.ca to help people find the
          information they need.
        </p>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">The bigger picture</h2>
        <p>
          Toronto.ca is where we started, but the plan is bigger. Zeever.ca is
          being built as a Canadian AI platform for navigating public services across
          the country, powered by Canadian infrastructure and open AI models. The goal
          is to make government processes less painful for everyone.
        </p>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">Technology</h2>
        <p>
          Zeever.ca is built using open-source AI models and Canadian-hosted
          infrastructure wherever possible. We chose not to use OpenAI, Google,
          or other proprietary AI services. Every language model we use is open
          source, which means the model weights are publicly available, auditable,
          and not controlled by a single company.
        </p>
        <p>
          Right now, we run open-source models
          through <a href="https://fireworks.ai" target="_blank" rel="noopener noreferrer" className="text-zeever-text hover:text-zeever-primary transition-colors">Fireworks.ai</a>{' '}for
          the AI inference layer. Canadian GPU hosting at the scale we need
          doesn&apos;t exist yet, but as that infrastructure comes online we plan
          to bring inference home too, giving us full data sovereignty from
          question to answer.
        </p>
        <p>
          Everything else is already Canadian-hosted: the content database,
          vector search (PostgreSQL with pgvector), knowledge graph, and the web
          application itself. And every answer comes with its sources, so you
          can always verify what you&apos;re reading.
        </p>
      </div>
    </div>
  )
}
