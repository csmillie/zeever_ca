import type { Metadata } from 'next'
import { WebPageJsonLd } from '@/components/JsonLd'
import EmailLink from '@/components/EmailLink'

const PAGE_URL = 'https://www.zeever.ca/privacy'

export const metadata: Metadata = {
  title: 'Privacy Policy - Zeever.ca',
  description: 'Zeever.ca privacy policy: no tracking, no ads, no account required. Your questions are processed in real time and not stored.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: "https://www.zeever.ca/og-image.png", width: 1200, height: 630, alt: "Zeever.ca" }],
    title: 'Privacy Policy - Zeever.ca',
    description: 'Zeever.ca privacy policy: no tracking, no ads, no account required.',
    url: PAGE_URL,
  },
}

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <WebPageJsonLd name="Privacy Policy" description="How Zeever.ca handles your data and protects your privacy." url={PAGE_URL} />
      <h1 className="text-3xl font-semibold text-zeever-text mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: March 2026</p>

      <div className="space-y-6 text-gray-700 leading-relaxed">
        <p>
          Zeever.ca is committed to protecting your privacy. This policy explains what
          data we collect, how we use it, and your rights.
        </p>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">What we collect</h2>

        <h3 className="font-medium text-gray-800">Questions you ask</h3>
        <p>
          When you submit a question, it is sent to our server to generate an answer.
          During our beta period, your questions and the generated answers are logged
          to help us improve the quality of responses. We do not build profiles based
          on your questions or track your query history across sessions. These logs
          do not contain any personal information beyond the text of your question and
          the system&apos;s response.
        </p>

        <h3 className="font-medium text-gray-800">Technical data</h3>
        <p>
          Server logs may record basic technical information such as your IP
          address and the pages you visit. This data is used only for maintaining
          the service and is not shared with third parties.
        </p>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">Third-party services</h2>

        <h3 className="font-medium text-gray-800">AI model providers</h3>
        <p>
          To generate answers, your questions are sent to AI model providers
          (currently <a href="https://fireworks.ai/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-zeever-text hover:text-zeever-primary transition-colors">Fireworks.ai</a>)
          for processing. These providers process your question to generate a response
          and are subject to their own privacy policies. We do not send any personal
          information beyond the text of your question.
        </p>

        <h3 className="font-medium text-gray-800">Embedding services</h3>
        <p>
          Your questions are converted into vector embeddings to search our content
          database. This processing is done via the same AI provider and follows the
          same privacy terms.
        </p>

        <h3 className="font-medium text-gray-800">Observability (beta)</h3>
        <p>
          During the beta period, we
          use <a href="https://langfuse.com/privacy" target="_blank" rel="noopener noreferrer" className="text-zeever-text hover:text-zeever-primary transition-colors">Langfuse</a> to
          log queries and responses for quality improvement. Langfuse is hosted on
          AWS in the United States. The data sent to Langfuse includes the text of
          your question, the generated answer, retrieved source content, token counts,
          and latency. No personal information, IP addresses, or browser data is sent
          to Langfuse. We plan to move to a self-hosted or Canadian-hosted observability
          solution as the platform matures.
        </p>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">What we don&apos;t do</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>We do not sell your data to third parties</li>
          <li>We do not use your questions to train AI models</li>
          <li>We do not use advertising trackers or third-party analytics services (our analytics are self-hosted on Canadian infrastructure)</li>
          <li>We do not require you to create an account</li>
          <li>We do not use cookies for tracking (only essential session cookies if needed)</li>
        </ul>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">Data location</h2>
        <p>
          Our content database (crawled Toronto.ca pages) is hosted on Canadian
          infrastructure. Questions are processed through Fireworks.ai (United States)
          for AI inference, and logged through Langfuse (AWS, United States) during
          the beta for quality improvement. We are working toward fully
          Canadian-hosted processing as part of our long-term platform goals.
        </p>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">Content sources</h2>
        <p>
          All answers are generated from publicly available content on Toronto.ca.
          We do not collect, store, or process any personal information from the
          City of Toronto&apos;s website — only public-facing informational content
          about building permits and related services.
        </p>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">Changes to this policy</h2>
        <p>
          We may update this privacy policy from time to time. Changes will be
          posted on this page with an updated date. Continued use of Zeever.ca
          after changes are posted constitutes acceptance of the updated policy.
        </p>

        <h2 className="text-xl font-semibold text-zeever-text pt-4">Contact</h2>
        <p>
          If you have questions about this privacy policy or how we handle your data,
          please contact us at{' '}
          <EmailLink user="info" domain="zeever.ca" className="text-zeever-text hover:text-zeever-primary transition-colors" />.
        </p>
      </div>
    </div>
  )
}
