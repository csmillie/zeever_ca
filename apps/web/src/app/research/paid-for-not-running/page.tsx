import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'
import { FAQPageJsonLd } from '@/components/JsonLd'

const PAGE_URL = 'https://www.zeever.ca/research/paid-for-not-running'

export const metadata: Metadata = {
  title: 'A Quarter of a Trillion Dollars, Paid For and Not Running',
  description: 'Five companies disclose $250.2 billion of data centre assets not yet in service. We pulled the figure from the filings to test a claim about the AI buildout.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'A Quarter of a Trillion Dollars, Paid For and Not Running', description: 'We pulled construction-in-progress and server useful lives from six 10-K filings. One number supports the overbuild thesis; one contradicts it.', url: PAGE_URL },
}

const FAQS = [
  {
    question: 'What is construction in progress, and why does it matter here?',
    answer: 'It is capitalised spending on assets that have been paid for but not yet placed in service. Under US accounting rules an asset does not begin depreciating until it is ready for its intended use, so construction in progress is the balance-sheet definition of "bought and not yet running". For a debate about whether announced AI capacity actually exists, it is the most direct audited measure available: at 31 December 2025 Alphabet reported $78.6 billion, Amazon $71.7 billion and Meta $50.5 billion in that state.',
  },
  {
    question: 'Does rising NVIDIA inventory show that GPUs are sitting unused?',
    answer: 'No, and this is the most common error in the argument. Inventory on NVIDIA’s balance sheet is product NVIDIA has not sold. A GPU shipped to a customer leaves NVIDIA’s inventory entirely and appears on the buyer’s balance sheet, in property and equipment or in construction in progress. NVIDIA’s inventory rising from $6.7 billion to $31.6 billion between mid-2024 and mid-2026 tells you NVIDIA is building stock ahead of shipment. It tells you nothing about whether shipped chips were installed.',
  },
  {
    question: 'Have hyperscalers been extending server useful lives to reduce depreciation?',
    answer: 'Some have and at least one has done the opposite, on the same date. Effective 1 January 2025 Meta raised the estimated useful life of most servers and network assets to 5.5 years, reducing depreciation by $2.92 billion and raising net income by $2.59 billion. Effective the same day Amazon shortened the life of a subset of its servers and networking equipment from six years to five, raising depreciation by $1.4 billion and reducing net income by $1.0 billion, citing the pace of technology development in artificial intelligence. Treating life extension as a uniform industry practice does not survive the filings.',
  },
  {
    question: 'Do any of these companies disclose the useful life of a GPU?',
    answer: 'No. Every disclosure we found is written at the level of "servers and network equipment" or "technical infrastructure". Microsoft discloses a range of two to six years for that category without separating accelerators from ordinary servers. So the question of how long an AI accelerator earns cannot be answered from these filings, and any figure quoted for GPU useful life specifically is an estimate rather than a disclosure.',
  },
  {
    question: 'How does this relate to Canadian data centre capacity?',
    answer: 'It is the same gap measured from the other end. Our tracked set of 20 Canadian projects carries 10,359 MW of announced or ultimate capacity against 112 MW operating, which is 1.1 per cent. The American filings show the money arriving before the capacity; the Canadian project data shows the announcements arriving before the concrete. Neither is evidence of fraud, and both are evidence that "capacity" is a word doing several jobs at once.',
  },
]

export default function Page() {
  return (
    <BlogPost title="A Quarter of a Trillion Dollars, Paid For and Not Running" description="Five companies disclose $250.2 billion of data centre assets not yet in service. We pulled it from the filings to test a claim, and found one number that supports it and one that contradicts it." date="2026-09-23" url={PAGE_URL}>
      <FAQPageJsonLd faqs={FAQS} />

      <div className="bg-zeever-primary/5 border border-zeever-primary/20 rounded-xl p-5 mb-2">
        <p className="text-sm font-semibold text-zeever-text mb-2">Key finding</p>
        <p className="text-sm text-gray-700">
          Alphabet, Amazon, Meta, Oracle and CoreWeave disclose <strong>$250.2 billion</strong> of
          construction in progress &mdash; assets paid for and not yet placed in service. Microsoft,
          the largest builder and the subject of most of the argument, does not disclose the figure
          at all.
        </p>
      </div>

      <p>
        Ed Zitron published{' '}
        <a className="text-zeever-primary hover:underline" href="https://www.wheresyoured.at/wherere-all-the-ai-chips/" rel="nofollow noopener" target="_blank">
          Where&rsquo;re All The AI Chips?
        </a>{' '}
        on 22 September 2026, arguing that the AI buildout has produced far less running capacity
        than the spending implies, and that a great deal of hardware is sitting in warehouses and
        half-built facilities. It is a strong piece with a strong thesis, and parts of it rest on
        reporting from sources we cannot check.
      </p>
      <p>
        The parts that rest on public filings we can check, so we did. This is what four of his
        load-bearing numbers look like when pulled from the primary documents rather than quoted.
      </p>
      <p>
        One of them is stronger than he makes it. One of them is measuring the wrong balance sheet.
        And one of them turns out to be false in a way that is more interesting than if it had been
        true.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The number that does the work</h2>
      <p>
        Under US accounting rules an asset does not start depreciating until it is ready for its
        intended use. Until then its cost accumulates in a line called construction in progress.
        That makes it the closest thing in audited financial statements to a direct measure of
        &ldquo;bought, not yet running&rdquo;.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Company</th>
              <th className="text-left px-3 py-2 font-medium text-gray-700">As of</th>
              <th className="text-right px-3 py-2 font-medium text-gray-700">Not in service</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Alphabet', '31 Dec 2025', '$78.6B'],
              ['Amazon', '31 Dec 2025', '$71.7B'],
              ['Meta', '31 Dec 2025', '$50.5B'],
              ['Oracle', '31 May 2026', '$40.0B'],
              ['CoreWeave', '31 Dec 2025', '$9.4B'],
              ['Microsoft', '30 Jun 2026', 'not disclosed'],
            ].map(([co, asOf, v]) => (
              <tr key={co} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{co}</td>
                <td className="px-3 py-2">{asOf}</td>
                <td className="px-3 py-2 text-right tabular-nums">{v}</td>
              </tr>
            ))}
            <tr className="border-t border-zeever-accent/20 bg-zeever-accent/5">
              <td className="px-3 py-2 font-semibold" colSpan={2}>Total of those disclosing it</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">$250.2B</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500">
        Extracted from each company&rsquo;s most recent Form 10-K. Fiscal years differ; Oracle&rsquo;s
        ends 31 May.
      </p>

      <p>
        A quarter of a trillion dollars, capitalised, audited, and by the companies&rsquo; own
        accounting not yet earning anything. That is a stronger statement of the case than the
        chip-counting that surrounds it, and it does not depend on anybody&rsquo;s source.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Three things that made it awkward to collect</h2>
      <p>
        <strong>Alphabet does not use the words.</strong> Its line reads &ldquo;Add: assets not yet
        in service&rdquo;. A search for &ldquo;construction in progress&rdquo; misses it entirely,
        which is how our first pass returned $104 billion instead of $250 billion &mdash; we had
        found only the two companies that tag the concept in machine-readable form.
      </p>
      <p>
        <strong>Microsoft does not disclose it.</strong> There is no construction-in-progress
        component in its property and equipment table. It discloses contractual construction
        commitments of $34.6 billion, of which $29.8 billion falls due within a year, but that is an
        obligation to spend rather than an asset already paid for. We have left it out of the total
        rather than quietly making the two comparable.
      </p>
      <p>
        That absence matters more than the other five entries combined, because Microsoft is the
        largest builder and the subject of most of the argument. The single best public measure of
        the thing being debated is not published by the company being debated.
      </p>
      <p>
        <strong>Column order is not consistent.</strong> Amazon and Alphabet print the earlier year
        first; Meta, Oracle and CoreWeave print the later year first. Reading position rather than
        the header would have halved two of the five figures, and the result would have looked
        entirely plausible.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The number that is measuring the wrong company</h2>
      <p>
        NVIDIA&rsquo;s inventory has grown sharply, and it is regularly offered as evidence that
        GPUs are piling up unused.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Quarter end</th>
              <th className="text-right px-3 py-2 font-medium text-gray-700">Inventory</th>
              <th className="text-right px-3 py-2 font-medium text-gray-700">Revenue</th>
              <th className="text-right px-3 py-2 font-medium text-gray-700">Days of inventory</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Jul 2024', '$6.7B', '$30.0B', '80'],
              ['Oct 2024', '$7.7B', '$35.1B', '77'],
              ['Apr 2025', '$11.3B', '$44.1B', '59'],
              ['Oct 2025', '$19.8B', '$57.0B', '117'],
              ['Apr 2026', '$25.8B', '$81.6B', '113'],
              ['Jul 2026', '$31.6B', '$96.2B', '118'],
            ].map(([q, inv, rev, d]) => (
              <tr key={q} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{q}</td>
                <td className="px-3 py-2 text-right tabular-nums">{inv}</td>
                <td className="px-3 py-2 text-right tabular-nums">{rev}</td>
                <td className="px-3 py-2 text-right tabular-nums">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500">
        Days of inventory computed as inventory divided by quarterly cost of revenue, times ninety.
        Source: NVIDIA quarterly filings via the SEC&rsquo;s XBRL company-concept API.
      </p>

      <p>
        Inventory is up 5.4 times in two years and days of inventory has roughly doubled from the
        early-2025 low. Relative to sales the move is milder &mdash; from about 0.22 to 0.33 &mdash;
        because revenue more than tripled underneath it.
      </p>
      <p>
        But this number cannot answer the question it is being asked. <strong>Inventory on
        NVIDIA&rsquo;s balance sheet is product NVIDIA has not sold.</strong> A GPU shipped to a
        customer leaves NVIDIA&rsquo;s books completely and reappears on the buyer&rsquo;s, in
        property and equipment or in the construction-in-progress line above. Rising NVIDIA
        inventory says NVIDIA is building stock ahead of shipment, which is a fact about NVIDIA.
      </p>
      <p>
        The chips allegedly sitting in warehouses are, by definition, chips that were sold. They are
        in the $250.2 billion, not in the $31.6 billion. Presenting the two together as though they
        were the same argument double-counts nothing but does confuse two different claims, and the
        weaker of them is the one that gets quoted.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The claim that turned out to be false</h2>
      <p>
        The standard version is that hyperscalers keep extending the assumed useful life of servers,
        which lowers reported depreciation and flatters earnings without anything changing in the
        data hall. It is a good argument and it has the advantage of being checkable.
      </p>
      <p>
        Both of the companies that changed an estimate did so effective 1 January 2025. They moved
        in opposite directions.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Company</th>
              <th className="text-left px-3 py-2 font-medium text-gray-700">Change</th>
              <th className="text-right px-3 py-2 font-medium text-gray-700">Depreciation</th>
              <th className="text-right px-3 py-2 font-medium text-gray-700">Net income</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            <tr className="border-t border-zeever-accent/10">
              <td className="px-3 py-2 font-medium">Meta</td>
              <td className="px-3 py-2">most servers and network assets &rarr; 5.5 years</td>
              <td className="px-3 py-2 text-right tabular-nums">&minus;$2.92B</td>
              <td className="px-3 py-2 text-right tabular-nums">+$2.59B</td>
            </tr>
            <tr className="border-t border-zeever-accent/10">
              <td className="px-3 py-2 font-medium">Amazon</td>
              <td className="px-3 py-2">a subset of servers and networking, 6 &rarr; 5 years</td>
              <td className="px-3 py-2 text-right tabular-nums">+$1.4B</td>
              <td className="px-3 py-2 text-right tabular-nums">&minus;$1.0B</td>
            </tr>
            <tr className="border-t border-zeever-accent/10">
              <td className="px-3 py-2 font-medium">Microsoft</td>
              <td className="px-3 py-2">servers and network equipment: 2 to 6 years, unchanged</td>
              <td className="px-3 py-2 text-right text-gray-400">&mdash;</td>
              <td className="px-3 py-2 text-right text-gray-400">&mdash;</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        Meta did what the argument predicts, and the effect is large: a dollar a share.
      </p>
      <p>
        Amazon did the reverse, and said why:
      </p>
      <blockquote className="border-l-2 border-zeever-primary/40 pl-4 text-gray-700 italic">
        The shorter useful lives are due to the increased pace of technology development,
        particularly in the area of artificial intelligence and machine learning.
      </blockquote>
      <p>
        That is a company telling its auditors that AI hardware wears out faster than it used to,
        and accepting $1.4 billion of additional depreciation to say so. It is the opposite of
        flattering the numbers, and it is more damaging to the overbuild case than the version where
        everybody extends: if accelerators obsolete faster than the six years previously assumed,
        then hardware waiting in a half-built facility is losing value while it waits.
      </p>
      <p>
        So the useful-life claim, as usually stated, is not supported. One extended, one shortened,
        one unchanged. What replaces it is a narrower and sharper observation, which is that the two
        companies closest to the workload disagree by a year about how long the equipment lasts.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Nobody discloses the life of a GPU</h2>
      <p>
        We went looking for the useful life of an AI accelerator specifically and it is not in any of
        the six filings. Every disclosure is written at the level of &ldquo;servers and network
        equipment&rdquo; or &ldquo;technical infrastructure&rdquo;. Microsoft&rsquo;s two-to-six-year
        range covers that whole category without separating an accelerator from an ordinary server,
        and a range that wide cannot be pinned to any particular asset.
      </p>
      <p>
        This is worth stating plainly because the GPU depreciation schedule is central to almost
        every argument about the economics of AI infrastructure, including ours. It is not a
        disclosed number. Every figure in circulation for it, including any we have used, is an
        estimate.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The same gap, measured from Canada</h2>
      <p>
        We came to this from the other direction. Our own{' '}
        <a className="text-zeever-primary hover:underline" href="/research/canadian-data-centres/the-map">
          tracked set of Canadian data centre projects
        </a>{' '}
        carries twenty sites with source URLs and confidence flags on every row, and it separates
        capacity into five columns because one column could not hold the question honestly.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Canadian tracked set, 20 projects</th>
              <th className="text-right px-3 py-2 font-medium text-gray-700">MW</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Announced / ultimate', '10,359'],
              ['Under construction', '1,361'],
              ['Operating', '112'],
            ].map(([k, v]) => (
              <tr key={k} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{k}</td>
                <td className="px-3 py-2 text-right tabular-nums">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        Operating capacity is <strong>1.1 per cent</strong> of what has been announced. The 112 MW is
        three projects: Vantage&rsquo;s Montreal campuses at 91 MW, QScale Q01 at 14, and Bell&rsquo;s
        Merritt site at 6. The headline gigawatts &mdash; Wonder Valley at 7.5 GW, Beacon at 4.5 GW
        across six sites &mdash; are proposals.
      </p>
      <p>
        The American filings and the Canadian project data are measuring the same gap from opposite
        ends. There the money arrives before the capacity; here the announcement arrives before the
        concrete.
      </p>
      <p>
        And the Canadian data suggests why the money cannot convert as fast as it is raised. Alberta
        capped new large-load grid connections at 1,200 MW to 2028 against 29 projects requesting
        more than 21 GW, against a provincial peak demand of about 12,000 MW. That 1,200 MW is
        already fully allocated to two projects. This is not a procurement delay that money can
        solve. It is a queue with a ceiling, described in our{' '}
        <a className="text-zeever-primary hover:underline" href="/research/canadian-data-centres/power">
          chapter on power
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Where we disagree with the piece</h2>
      <p>
        We have argued{' '}
        <a className="text-zeever-primary hover:underline" href="/research/ai-isnt-the-next-2008">
          elsewhere
        </a>{' '}
        that the dot-com fibre boom is a better analogy for this than 2008, and Zitron rejects that
        directly: GPUs, he writes, are nothing like dark fibre.
      </p>
      <p>
        He is right about the asset and we were not careful enough. Dark fibre was the ideal
        overbuild &mdash; almost no carrying cost, no obsolescence, and it was eventually lit. A
        server depreciates on a schedule the filings put between two and six years, and Amazon has
        just shortened its own estimate. The half of this buildout that has been built has a clock
        on it that fibre never had.
      </p>
      <p>
        What survives from that piece is the narrower claim it was actually making, which was about
        financial contagion rather than asset quality: there is no subprime-style transmission
        mechanism here, and none of this requires Microsoft to default on anything. That still looks
        right. &ldquo;The fibre comparison is more interesting&rdquo; was doing work our own data
        does not support.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What we would not claim</h2>
      <p>
        Construction in progress rising is what a buildout looks like. A company spending $115.9
        billion a year in capital expenditure, as Microsoft did in fiscal 2026, will have a great
        deal in flight at any moment, and none of the five figures above is evidence of anything
        improper. They are evidence that a large amount of capital has been committed and has not yet
        become capacity.
      </p>
      <p>
        We also looked at depreciation as a share of capital expenditure, which has fallen sharply
        across all four large filers &mdash; Microsoft from 70 per cent in 2019 to 30 in 2026,
        Oracle from 74 to 14. It reads like strong evidence and we are not leaning on it, because the
        ratio falls during any rapid buildout by construction: depreciation reflects the accumulated
        in-service base while capital expenditure is the current year&rsquo;s flow. It would fall
        even if every dollar were installed the day it was spent. The magnitude is striking. The
        inference is not available.
      </p>
      <p>
        The honest summary is that one of these measures is decisive, one is misdirected, one is
        false as usually stated, and one is suggestive and unusable. That is a less satisfying
        conclusion than the article&rsquo;s, and it is what the filings support.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Frequently asked questions</h2>
      <div className="space-y-4 mt-2">
        {FAQS.map((faq) => (
          <details key={faq.question} className="group" open>
            <summary className="text-sm font-semibold text-zeever-text cursor-pointer list-none flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {faq.question}
            </summary>
            <p className="text-sm text-gray-700 leading-relaxed pl-6 pt-1">{faq.answer}</p>
          </details>
        ))}
      </div>

      <p className="text-sm text-gray-500 pt-4">
        Figures extracted from SEC Forms 10-K and from the SEC&rsquo;s XBRL company-concept API, with
        accession numbers recorded per row in{' '}
        <code className="text-sm bg-gray-50 px-1 rounded-sm">hyperscaler_cip_and_useful_life.csv</code>{' '}
        and{' '}
        <code className="text-sm bg-gray-50 px-1 rounded-sm">hyperscaler_capex_depreciation.csv</code>.
        The Canadian project figures come from the tracked set behind{' '}
        <a className="text-zeever-primary hover:underline" href="/research/canadian-data-centres">
          Canada&rsquo;s Data Centre Race
        </a>
        . The piece that prompted this is{' '}
        <a className="text-zeever-primary hover:underline" href="https://www.wheresyoured.at/wherere-all-the-ai-chips/" rel="nofollow noopener" target="_blank">
          Where&rsquo;re All The AI Chips?
        </a>{' '}
        by Ed Zitron.
      </p>
    </BlogPost>
  )
}
