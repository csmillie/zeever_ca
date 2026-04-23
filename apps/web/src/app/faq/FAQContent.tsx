'use client'

import { useRef } from 'react'
import { trackedContent, trackContentInteraction, toSlug, debugLog } from '@/lib/matomo'

interface FAQ {
  question: string
  answer: string
}

export default function FAQContent({ faqs }: { faqs: FAQ[] }) {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  // Group FAQs into sections by topic for faq.section tracking
  const sections = [
    { slug: 'about-zeever', label: 'About Zeever.ca', indices: [0, 3, 8, 9] },
    { slug: 'accuracy-coverage', label: 'Accuracy & Coverage', indices: [1, 2] },
    { slug: 'canadian-ai', label: 'Canadian AI', indices: [4, 5] },
    { slug: 'technology', label: 'Technology', indices: [6] },
    { slug: 'privacy', label: 'Privacy', indices: [7] },
  ]

  function handleExpand(faq: FAQ, index: number) {
    const slug = toSlug(faq.question)
    // Manual interaction since accordion expand is not a click on a tracked link
    trackContentInteraction('expand', 'faq.item', slug, 'expand_faq')
    debugLog('interaction', { name: 'faq.item', piece: slug, action: 'expand' })
  }

  return (
    <div className="space-y-8">
      {sections.map(section => (
        <div
          key={section.slug}
          {...trackedContent('faq.section', section.slug, 'none', true)}
        >
          {section.indices.map(i => {
            const faq = faqs[i]
            const slug = toSlug(faq.question)
            return (
              <details
                key={i}
                className="group mb-4"
                onToggle={(e) => {
                  if ((e.target as HTMLDetailsElement).open) {
                    handleExpand(faq, i)
                  }
                }}
              >
                <summary
                  className="text-lg font-semibold text-zeever-text mb-2 cursor-pointer list-none flex items-center gap-2"
                  ref={el => { itemRefs.current[i] = el as unknown as HTMLDivElement }}
                  {...trackedContent('faq.item', slug, 'expand_faq', true)}
                >
                  <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {faq.question}
                </summary>
                <p className="text-gray-700 leading-relaxed pl-6">{faq.answer}</p>
              </details>
            )
          })}
        </div>
      ))}
    </div>
  )
}
