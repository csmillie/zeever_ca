'use client'

interface FAQ {
  question: string
  answer: string
}

export default function FAQContent({ faqs }: { faqs: FAQ[] }) {
  // Group FAQs into sections by topic
  const sections = [
    { slug: 'about-zeever', label: 'About Zeever.ca', indices: [0, 3, 8, 9] },
    { slug: 'accuracy-coverage', label: 'Accuracy & Coverage', indices: [1, 2] },
    { slug: 'canadian-ai', label: 'Canadian AI', indices: [4, 5] },
    { slug: 'technology', label: 'Technology', indices: [6] },
    { slug: 'privacy', label: 'Privacy', indices: [7] },
  ]

  return (
    <div className="space-y-8">
      {sections.map(section => (
        <div key={section.slug}>
          {section.indices.map(i => {
            const faq = faqs[i]
            return (
              <details key={i} className="group mb-4">
                <summary className="text-lg font-semibold text-zeever-text mb-2 cursor-pointer list-none flex items-center gap-2 rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zeever-primary">
                  <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-90 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
