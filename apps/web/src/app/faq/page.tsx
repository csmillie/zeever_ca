import type { Metadata } from 'next'
import { WebPageJsonLd, FAQPageJsonLd, BreadcrumbJsonLd } from '@/components/JsonLd'
import FAQContent from './FAQContent'

const PAGE_URL = 'https://www.zeever.ca/faq'

export const metadata: Metadata = {
  title: 'FAQ - Toronto City Services AI Assistant',
  description: 'Frequently asked questions about Zeever.ca: how it works, what Toronto city services it covers, Canadian AI infrastructure, and privacy.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: "https://www.zeever.ca/og-image.png", width: 1200, height: 630, alt: "Zeever.ca" }],
    title: 'FAQ - Zeever.ca Toronto City Services AI Assistant',
    description: 'Frequently asked questions about Zeever.ca: how it works, what it covers, and Canadian AI.',
    url: PAGE_URL,
  },
}

const FAQS = [
  {
    question: 'What is Zeever.ca?',
    answer: 'Zeever.ca is a free Canadian AI tool that answers questions about any City of Toronto service. It searches official Toronto.ca content, finds the most relevant information, and generates a cited answer. It covers building permits, property taxes, recycling, parking, housing, health programs, recreation, city government, and everything in between. It only uses what it finds and never makes things up.',
  },
  {
    question: 'How accurate are the answers?',
    answer: 'Every answer comes from official Toronto.ca content and includes source links so you can verify the information yourself. In our internal evaluations using a 100-question benchmark across 16 categories, the system achieves high groundedness, meaning claims are supported by retrieved evidence. That said, the information may not cover every edge case, so always confirm important decisions with the relevant City of Toronto department.',
  },
  {
    question: 'What kind of questions can I ask?',
    answer: 'Zeever.ca covers all City of Toronto services available on Toronto.ca. You can ask about building permits, sign permits, tree permits, zoning, property taxes, utility bills, business licences, recycling and garbage, streets and parking, tickets and fines, water and environment, grants and incentives, housing and shelter, health programs, parks and recreation, arts and culture, city government, and more. If the information is on Toronto.ca, Zeever.ca can help you find it.',
  },
  {
    question: 'Is Zeever.ca affiliated with the City of Toronto?',
    answer: 'No. Zeever.ca is an independent project. It uses publicly available information from Toronto.ca to help people understand city services, but it is not endorsed by or connected to the City of Toronto in any way.',
  },
  {
    question: 'Why build a Canadian AI platform?',
    answer: 'Most AI tools today run on American infrastructure using proprietary models from companies like OpenAI and Google. Zeever.ca is built with open-source models and aims to run entirely on Canadian infrastructure. The goal is data sovereignty: keeping Canadian questions and Canadian data in Canada, processed by systems we can inspect and trust.',
  },
  {
    question: 'Why can\'t you host everything in Canada right now?',
    answer: 'The AI models that generate answers require powerful GPUs to run. Pay-per-token inference services like Fireworks.ai do not operate in Canada yet. Canadian GPU hosting exists for dedicated servers, but there is no easy way to test and prototype different open-source models without committing to expensive hardware. We use Fireworks.ai for inference while we work toward self-hosting on Canadian infrastructure.',
  },
  {
    question: 'What AI models does Zeever.ca use?',
    answer: 'Zeever.ca uses only open-source AI models. We do not use OpenAI, Google, or any proprietary AI service. Our current default model is Qwen3-8B, selected after benchmarking 9 open-source models on 100 questions across all Toronto.ca categories. It scored highest on relevance while being one of the smallest and cheapest models tested.',
  },
  {
    question: 'Is my data private?',
    answer: 'Yes. Zeever.ca does not store your questions, does not require an account, does not use tracking cookies, and does not show ads. Your questions are processed in real time to generate an answer and are not saved afterward. See our privacy policy for full details.',
  },
  {
    question: 'Will Zeever.ca expand beyond Toronto?',
    answer: 'Yes, that is the plan. Toronto is the starting point. The platform is designed to expand to other Canadian municipalities and eventually provincial and federal government information. The goal is to make navigating Canadian public services easier for everyone.',
  },
  {
    question: 'Is Zeever.ca free?',
    answer: 'Yes. Zeever.ca is free to use. There are no accounts, no subscriptions, and no limits on questions. The project is funded independently and aims to remain free for public use.',
  },
]

export default function FAQPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <WebPageJsonLd name="FAQ" description="Frequently asked questions about Zeever.ca." url={PAGE_URL} dateModified="2026-04-02" />
      <FAQPageJsonLd faqs={FAQS} />
      <BreadcrumbJsonLd items={[
        { name: 'Home', url: 'https://www.zeever.ca' },
        { name: 'FAQ', url: PAGE_URL },
      ]} />

      <h1 className="text-3xl font-semibold text-zeever-text mb-2">Frequently Asked Questions</h1>
      <p className="text-sm text-gray-500 mb-1">Last updated: April 2026</p>
      <p className="text-gray-500 mb-8">Common questions about Zeever.ca and how it works.</p>

      <FAQContent faqs={FAQS} />
    </div>
  )
}
