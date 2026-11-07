import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'
import { FAQPageJsonLd } from '@/components/JsonLd'

const PAGE_URL = 'https://www.zeever.ca/research/two-data-centre-rulebooks'

const TITLE = 'Canada Has Two Data Centre Rulebooks. One Can Say No.'
const DESCRIPTION =
  'Ontario proposed a screening playbook and Ottawa launched a national framework. One gates access to the grid. The other has no metric and no consequence.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }],
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
  },
}

const FAQS = [
  {
    question: 'What are Canada’s Responsible Data Centre Development Principles?',
    answer:
      'A voluntary national framework launched by the federal government on 3 September 2026, setting five expectations for data-centre development: create lasting local benefits, do not shift electricity costs onto Canadians, minimise water use and environmental impacts, be transparent about local impacts, and deliver strategic value to Canada. Signatories include AWS, Anthropic, Bell, Cohere, Cologix, Equinix, Google, Meta, Microsoft, OpenAI, OVHcloud and TELUS. No principle carries a metric, a unit, a reporting cadence, an auditor or a consequence for failing to meet it.',
  },
  {
    question: 'What is Ontario’s proposed Data Centre Playbook?',
    answer:
      'A provincial framework proposed in August 2026 that would screen data-centre projects on three pillars: economic development, digital sovereignty and community benefits. It also proposes a new electricity rate class for large new data centres, potentially those above 1 MW, so that the cost of serving them is not recovered from existing ratepayers. It is a consultation, not a rule. The comment period closes 12 September 2026.',
  },
  {
    question: 'Do the federal and Ontario plans conflict?',
    answer:
      'Not on their stated values, which overlap closely on ratepayer protection, sovereignty and community benefit. They conflict in what they are for. Ottawa is trying to create compute capacity and has committed billions to it, estimating Canada needs about 5.5 GW by 2030. Ontario is deciding which projects deserve scarce grid capacity and is preparing to price large loads at their full cost. Ottawa can fund and convene but cannot energise a megawatt, because electricity is provincial. Ontario controls the wire and has no stake in a national capacity target.',
  },
  {
    question: 'Which plan actually has teeth?',
    answer:
      'Ontario’s, if it is adopted. A screening pillar decides who gets a grid connection, and a rate class decides what they pay for it. Both are enforceable because the province controls the asset. The federal Principles are voluntary commitments with no measurement behind them, and Principle 2, which asks signatories not to shift electricity costs onto Canadians, addresses a matter Ottawa has no jurisdiction over.',
  },
  {
    question: 'Where will Canada’s AI data centres actually get built?',
    answer:
      'On current policy, Alberta. Ontario is proposing to price large loads at full cost causation from as low as 1 MW, while Alberta offers queue priority and levy relief for projects that bring their own power: two percent for grid-connected, one percent for self-generating, zero for off-grid. If both regimes hold, the federal capacity target is most likely to be met in the province that charges least for connecting and asks fewest questions, and largely on natural gas. That outcome is what the federal Principles say they want to avoid, and no federal instrument prevents it.',
  },
]

export default function Page() {
  return (
    <BlogPost title={TITLE} description={DESCRIPTION} date="2026-09-03" url={PAGE_URL}>
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm italic text-gray-700">
          In three weeks Canada acquired two data-centre rulebooks. Ontario proposed one in August that would screen
          projects before granting grid access. Ottawa launched one on 3 September that asks the industry to behave
          well. They agree on almost every value and can do almost nothing to each other, because only one of them is
          attached to an asset anybody needs.
        </p>
      </div>

      <p>
        I have spent eleven chapters arguing that Canada&rsquo;s data-centre problem is not a shortage of land, capital,
        chips or even clean electricity. It is that nobody has assembled those things into a plan. So two plans arriving
        at once ought to be good news, and in some ways it is. But the interesting question about a policy document is
        not what it says. It is what kind of thing it is, and what it can compel.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What Ottawa actually published</h2>

      <p>
        Canada&rsquo;s Responsible Data Centre Development Principles set five expectations. Create lasting local
        benefits. Do not shift electricity costs onto Canadians. Minimise water use and environmental impacts. Be
        transparent about local impacts. Deliver strategic value to Canada.
      </p>

      <p>
        Every one of those is the right thing to want, and I would not argue with a word of it. What none of them
        carries is a number. There is no metric attached to &ldquo;minimise,&rdquo; no unit for &ldquo;transparent,&rdquo;
        no reporting cadence, no auditor, and no consequence for a signatory who does none of it.
      </p>

      <p>
        Compare the instrument, not the sentiment. The European Union did not ask operators to be transparent about
        water. It required reporting under EU 2024/1364 for facilities above 500 kW and pointed at an ISO standard for
        how to measure. That is a rule. Principles 3 and 4 are an aspiration, and they land on an industry where, at one
        Canadian facility I looked at in{' '}
        <a href="/research/canadian-data-centres/water" className="text-zeever-primary hover:underline">chapter six</a>,
        the operator ran for seven years without a water meter. A disclosure expectation presumes the number exists.
        Meter first, then mandate disclosure.
      </p>

      <p>
        The signatory list is worth reading closely too. It includes AWS, Google and Microsoft, the three firms that hold
        roughly 85 percent of Canada&rsquo;s public cloud market, which is the central problem of{' '}
        <a href="/research/canadian-data-centres/sovereignty" className="text-zeever-primary hover:underline">chapter seven</a>.
        It also includes OpenAI and Anthropic, neither of which operates a data centre in Canada at all. What a principle
        about local benefits and water use asks of a company that runs no facility here is not obvious, and a framework
        signed by both operators and their tenants needs to say which obligations attach to which.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What Ontario actually proposed</h2>

      <p>
        Ontario&rsquo;s Data Centre Playbook is a different category of object. It would screen projects on three
        pillars, economic development, digital sovereignty and community benefits, and it proposes moving large new
        loads into their own electricity rate class, potentially those drawing more than 1 MW, so the cost of serving
        them is not recovered from everybody else&rsquo;s bill.
      </p>

      <p>
        A screening pillar decides who gets a grid connection. A rate class decides what they pay for it. Both are
        enforceable, because Ontario owns the wire. This is a document that can say no.
      </p>

      <p>
        It is also not final. The consultation closes on 12 September 2026, and what emerges may be softer, harder or
        differently shaped. But the direction is clear enough to reason about: Ontario is moving from rationing grid
        access by scarcity, which is what a queue does, to rationing it by assessed value, which is what a screen does.
        As I set out in{' '}
        <a href="/research/canadian-data-centres/power" className="text-zeever-primary hover:underline">chapter four</a>,
        that puts it alongside Quebec, British Columbia and Manitoba, all of which now gate large loads in one way or
        another. What is new is the criteria. No Canadian province has previously screened a data centre on digital
        sovereignty.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The comfortable reading, and why it is wrong</h2>

      <p>
        Put the two documents side by side and they look like one policy in two layers.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Concern</th>
              <th className="text-left px-3 py-2 font-medium text-gray-700">Ontario</th>
              <th className="text-left px-3 py-2 font-medium text-gray-700">Federal</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Ratepayer protection', 'Separate rate class for large loads', 'Do not shift costs onto Canadians'],
              ['Sovereignty', 'A screening pillar', 'Deliver strategic value to Canada'],
              ['Community benefit', 'A screening pillar', 'Create lasting local benefits'],
              ['Environment', 'Electricity planning', 'Minimise water and environmental impact'],
              ['Economic value', 'A screening pillar', 'Part of strategic value'],
            ].map(([concern, on, fed]) => (
              <tr key={concern} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{concern}</td>
                <td className="px-3 py-2">{on}</td>
                <td className="px-3 py-2">{fed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-500">
        Five concerns, two documents, near-total agreement on what matters.
      </p>

      <p>
        That agreement is real and it is not the point. The two governments are not measuring the same thing.
      </p>

      <p>
        Ottawa&rsquo;s objective is denominated in gigawatts. Its national AI strategy estimates Canada needs about 5.5
        GW of commercial AI compute by 2030. Its Sovereign AI Compute Strategy put up to $700 million behind commercial
        data centres, up to $1 billion behind a public supercomputer, and an AI Compute Access Fund that started at $300
        million and has since grown. It says it is finalising partnerships proposing 850 MW by 2030, scalable to 2.3 GW.
      </p>

      <p>
        Ontario&rsquo;s objective is denominated in cents per kilowatt-hour and jobs per megawatt.
      </p>

      <p>
        There is no exchange rate between those currencies and no institution empowered to set one. Ottawa can fund,
        sign memoranda and publish principles. It cannot energise a single megawatt, because electricity is provincial.
        Ontario controls the wire, carries the ratepayer, and has no stake whatsoever in a national capacity target.
      </p>

      <p>
        This is why I have stopped calling it a coordination problem. For most of this series I described Canada&rsquo;s
        gaps as coordination failures: the ingredients exist, nobody wrote the recipe. That framing implies a missing
        convener, somebody who could get the parties in a room and find the agreement they both want. Ottawa and Ontario
        do not need a room. They have different objective functions and non-overlapping powers, and no amount of
        convening changes either.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">An uncomfortable thing about my own numbers</h2>

      <p>
        Ontario&rsquo;s economic-development pillar will be argued with a ratio, and the ratio is one I have spent a
        chapter defending. Data centres support roughly 0.2 to 0.35 permanent jobs per megawatt. An EV battery plant on
        the same power supports something closer to eight.{' '}
        <a href="/research/canadian-data-centres/alternative-uses" className="text-zeever-primary hover:underline">Chapter ten</a>{' '}
        makes that comparison at length and I stand behind it.
      </p>

      <p>
        Applied by a provincial regulator running an economic-development screen, that arithmetic is an argument against
        approving data centres. My own research, used honestly, works against the federal government&rsquo;s stated
        target. I would rather say that plainly than pretend the analysis only cuts one way.
      </p>

      <p>
        There is a second problem with the pillar, which is that Canada cannot verify it. Statistics Canada has no NAICS
        code for data centres; the nearest category bundles them with web hosts and one-person consultancies. Every
        Canadian employment figure in this space is a projection made by the proponent at announcement. A screen applied
        to proponent projections rewards the proponent who projects most confidently.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What I think happens next</h2>

      <p>
        Here is a prediction that can be checked, which is the only kind worth making.
      </p>

      <p>
        Ontario is proposing to price large loads at full cost causation, possibly from 1 MW upward. Alberta is doing
        close to the opposite: queue priority for projects that bring their own power, and a levy that falls from two
        percent for grid-connected projects to one percent for self-generating ones to zero for going fully off-grid.
        Two provinces, two signals, pointing in opposite directions.
      </p>

      <p>
        If both regimes hold, the federal 5.5 GW does not fail to get built. It gets built in Alberta, on gas.
      </p>

      <p>
        Which is the outcome Ottawa&rsquo;s own second and third principles say it does not want. Cost-shifting is
        avoided in Ontario by pushing the load somewhere that will absorb it; environmental impact is minimised on paper
        by a document that does not bind the province where the building happens. The two provincial regimes acting
        together produce exactly what the federal framework disclaims, and there is no federal instrument standing in
        the way.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The one mechanism that pays both</h2>

      <p>
        There is a version of this that works, and it is not a new idea, just one aimed at the wrong target until now.
      </p>

      <p>
        Sell faster grid connections in exchange for curtailability. A data centre that agrees to reduce load during
        system peaks costs the grid far less to serve than one that does not, and the utility avoids building capacity
        it must then recover from everybody. Duke has demonstrated something like 76 GW of headroom at a quarter of a
        percent curtailment. Shallow flexibility belongs in the connection agreement; deep flexibility deserves a
        capacity payment.
      </p>

      <p>
        Applied to Ontario&rsquo;s proposal, that means a rate class with a flexible tier rather than a flat penalty on
        size. It is the only instrument I can find that pays both governments at once. Ottawa gets megawatts. Ontario
        avoids building peak capacity for a load that could have moved. And the screen improves, because a rate class
        sorted by megawatts asks how big you are, while one sorted by curtailability asks what you are willing to give
        back. The second is a much better question.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What to watch</h2>

      <p>
        The consultation closes on 12 September 2026, and the shape of what Ontario adopts matters more than the shape
        of what it proposed. Three things I will be looking for.
      </p>

      <p>
        Whether the 1 MW threshold survives. It is aggressive: five times lower than the strawman I used when I argued
        that size is the wrong axis for sorting these projects, and a quarter of Quebec&rsquo;s 5 MW competitive-selection
        threshold. A 1 MW inference site in a city that could absorb it tomorrow is not the thing anybody is worried
        about.
      </p>

      <p>
        Whether digital sovereignty gets a definition. Ontario&rsquo;s pillar and Ottawa&rsquo;s fifth principle both use
        the word and neither says what it means. I count at least five live definitions now, and{' '}
        <a href="/research/canadian-data-centres/sovereignty" className="text-zeever-primary hover:underline">chapter seven</a>{' '}
        argues the differences decide the answer. On a residency reading a foreign hyperscaler with a Canadian region
        qualifies. On a sovereign-cloud reading it does not. A screening pillar that does not pick one will be picked for
        it, by whoever files the first application.
      </p>

      <p>
        And whether either government ever attaches a number to a principle. That is the difference between a rulebook
        and a press release, and after eleven chapters of watching announced capacity outrun built capacity by a factor
        of sixty, I would rather have one measurable obligation than five admirable ones.
      </p>

      <p className="text-sm text-gray-500 pt-2">
        Background and sources for the figures here are in{' '}
        <a href="/research/canadian-data-centres" className="text-zeever-primary hover:underline">Canada&rsquo;s Data Centre Race</a>,
        an eleven-part series on the physical foundations of the AI buildout. The chapters most relevant to this piece
        are four (power), six (water), seven (sovereignty), ten (alternative uses) and eleven (strategy), all of which
        were updated on 3 September 2026 to reflect these two plans.
      </p>
    </BlogPost>
  )
}
