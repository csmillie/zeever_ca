import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'
import { FAQPageJsonLd } from '@/components/JsonLd'

const PAGE_URL = 'https://www.zeever.ca/research/propane-power-ai-data-centres'

const TITLE = 'Can Propane Power Canada’s AI Data Centres?'
const DESCRIPTION =
  'The propane industry puts its best opportunity at about 5 MW or less, and delivery arithmetic explains why. A 100 MW site needs 15 tanker deliveries a day.'


const CPA_REPORT_URL = `https://propane.ca/canadas-ai-ambitions-need-propane/`
const MTL3_URL = `https://www.prnewswire.com/news-releases/bit-digital-inc-secures-site-for-new-tier-3-data-center-to-support-cerebras-colocation-contract-302426047.html`
const NORTHVAULT_URL = `https://www.newswire.ca/news-releases/northvault-ai-unveils-43-75-mw-ai-data-centre-campus-in-ontario-with-4-mw-available-now-863474722.html`
const NODIAC_URL = `https://nodiac.ai/`
const JDA_URL = `https://www.prnewswire.com/news-releases/modular-data-center-joint-development-agreement-signed-between-powerbank-corporation-and-nodiacai-302812717.html`

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
    question: 'How much propane does a 3 MW data centre actually burn?',
    answer:
      'Running at 90% utilization it needs about 23.7 GWh of electricity a year, which works out to roughly 20,000 litres of propane a day through an efficient reciprocating generator. In delivery terms that is about one tanker every couple of days, depending on tanker size and how much storage you put on site. Compare that with a 100 MW facility, which would need close to 15 deliveries a day, and you can see why the Canadian Propane Association drew its line at 5 MW.',
  },
  {
    question: 'What does the CPA report actually recommend?',
    answer:
      'It makes the case for propane as onsite primary or backup power where grid capacity is constrained, interconnection timelines are long or natural gas infrastructure isn’t available. The report, released on 29 September 2026, identifies applications up to 5 MW as propane’s strongest near-term opportunity, along with replacing diesel backup generators. Against diesel the argument is solid: lower emissions, no soil or groundwater contamination risk since propane vaporizes if it escapes, quieter operation and better long-term storage stability.',
  },
  {
    question: 'Where do the Nodiac and PowerBank plans stand?',
    answer:
      'Further along than the April announcement suggested. The two signed a non-binding letter of intent on 8 April 2026, and formalized it as a joint development agreement on 29 June 2026. That agreement sets up a framework for building modular data centres on selected sites and a structure for sharing cash flow. Nodiac deploys units in the 1 to 20 MW range at distribution-level interconnection points, and PowerBank brings a pipeline of more than a gigawatt plus over 100 MW already built across Canada and the US. Still no specific Canadian megawatts committed.',
  },
  {
    question: 'Why does propane fail at 100 MW but work at 3 MW?',
    answer:
      'Fuel logistics scale linearly while the alternatives don’t. At 3 MW a couple of tankers a week and a few days of onsite storage is an ordinary industrial supply arrangement. At 100 MW you are running a fuel terminal, and at that volume a pipeline connection or a grid interconnection becomes worth the wait and the capital. The physics doesn’t change. The operational burden does.',
  },
  {
    question: 'Is propane cleaner than the alternatives?',
    answer:
      'Cleaner than diesel, yes, particularly on particulates and spill risk. Against natural gas it is roughly comparable and usually more expensive to run. Against grid power in Quebec, BC, Manitoba or Ontario it isn’t close, because those grids are already low-carbon. That is the real tension in the report: propane’s best case is where the clean grid can’t reach you yet.',
  },
]

const linkClass = 'text-zeever-text underline hover:text-zeever-primary transition-colors'

export default function Page() {
  return (
    <BlogPost title={TITLE} description={DESCRIPTION} date="2026-10-03" url={PAGE_URL}>
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm italic text-gray-700">
          Propane can power an AI data centre, but only a small one. The Canadian Propane Association&rsquo;s own report
          puts its best opportunity at about 5 MW or less, plus replacing diesel backup, and the arithmetic explains
          why. A 100 MW site running on propane would need close to 15 tanker deliveries a day. A 3 MW site needs
          roughly one every couple of days, which is a real business. The catch is that the visible Canadian market that
          small is tiny, maybe 16 to 21 MW across recent public projects, and the report compares propane only against
          waiting for the grid. The comparison it leaves out is the one that matters: bringing fuel to the compute
          versus bringing the compute to power that already exists.
        </p>
      </div>

      <p>
        The Canadian Propane Association has a{' '}
        <a href={CPA_REPORT_URL} className={linkClass} rel="noopener">
          new report out
        </a>
        , Energy for the Digital Age: Using Propane to Power Canada&rsquo;s Data Infrastructure, and the pitch is simple
        enough. Electricity demand from AI and data centres is growing faster than utilities can build generation and
        transmission, and propane can help fill the gap. Propane can be stored onsite and doesn&rsquo;t need a pipeline,
        so it can carry a site as primary or backup power while the developer waits for the grid.
      </p>
      <p>
        I think the report makes a fair case, but the most useful line in it is a qualification. The CPA sees its best
        opportunity in facilities of about 5 MW or less, along with replacing diesel backup generators. That&rsquo;s
        where the fuel economics and the logistics work. So before arguing about propane at all, it&rsquo;s worth asking
        how much of Canada&rsquo;s data centre market is actually that small.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The big projects are a different problem</h2>
      <p>
        Most of the attention in Canada&rsquo;s AI infrastructure pipeline is on projects measured in tens or hundreds
        of megawatts, and at that size propane struggles. We modelled a 100 MW facility running on propane full time and
        it came out at hundreds of millions of litres a year, close to 15 tanker deliveries every day. Natural gas is a
        tough competitor at that scale, and where grid power is available Canada&rsquo;s fairly clean electricity beats
        either fuel on emissions by a wide margin.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Who is building under 5 MW?</h2>
      <p>
        There are Canadian examples, and WhiteFiber&rsquo;s Montreal operations are the best of them. MTL-1 has 4 MW of
        gross capacity and about 3 MW of IT load. WhiteFiber also picked up MTL-2 in Pointe-Claire, a 5 MW gross
        development planned for 3 MW of IT load, though that project is now on hold.{' '}
        <a href={MTL3_URL} className={linkClass} rel="noopener">
          MTL-3 in Saint-J&eacute;r&ocirc;me
        </a>{' '}
        is the one I&rsquo;d point people to. It carries a 5 MW Cerebras IT load and was delivered in roughly six months
        by converting an old mattress factory instead of building from scratch.
      </p>
      <p>
        <a href={NORTHVAULT_URL} className={linkClass} rel="noopener">
          NorthVault in Ontario
        </a>{' '}
        announced 4 MW available immediately, but that&rsquo;s the first phase of a campus planned to reach 43.75 MW in
        2027 and possibly 120 MW after that. It&rsquo;s a large data centre starting small, which is a different thing
        from a 4 MW edge site.
      </p>
      <p>
        Add it up and the recent Canadian projects I can find publicly come to roughly 16 to 21 MW, depending on whether
        you count the ones that start under 5 MW and are designed to grow. That&rsquo;s an indication, not a census.
        Enterprise, telecom and industrial sites don&rsquo;t announce their power needs the way hyperscale campuses do.
        Still, next to the gigawatts being proposed across the country, the visible small market is tiny.
      </p>
      <p>So the market exists. It just isn&rsquo;t a big slice of what&rsquo;s been announced.</p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Nodiac is the more interesting signal</h2>
      <p>
        The better evidence for the CPA&rsquo;s thesis may be what companies are getting ready to build.{' '}
        <a href={NODIAC_URL} className={linkClass} rel="noopener">
          Nodiac
        </a>{' '}
        is developing modular, containerized AI data centres placed close to existing power. In April 2026 PowerBank
        announced an agreement with Nodiac to look at putting that kind of compute next to solar and battery storage
        projects in its North American portfolio. Deployments are to be negotiated site by site, and the agreement
        didn&rsquo;t commit any specific Canadian megawatts, so it&rsquo;s early days.
      </p>
      <p>
        The direction is clear enough though. Instead of one campus growing from 100 MW to 300 MW to a gigawatt,
        you&rsquo;d get 2, 3 or 5 MW sites spread across many locations, which is pretty much the market the CPA is
        describing.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What propane looks like at 3 MW</h2>
      <p>
        Take a hypothetical 3 MW AI facility running at 90% utilization. It uses about 23.7 GWh of electricity a year,
        and an efficient modern propane reciprocating generator would burn something on the order of 20,000 litres a day
        to supply it.
      </p>
      <p>
        That&rsquo;s a lot of propane, but it&rsquo;s manageable. Rather than 15 tankers a day you&rsquo;re looking at
        roughly one delivery every couple of days, depending on tanker size and storage, and you can keep several days
        of fuel on site. There&rsquo;s no gas pipeline to build and no waiting years for a new high-capacity
        transmission connection. At this size the CPA&rsquo;s argument starts to hold up.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The comparison the report leaves out</h2>
      <p>
        The report frames the choice as waiting years for the grid or installing propane generation. A developer with a
        3 MW facility has more options than that.
      </p>
      <p>
        Propane can be trucked almost anywhere, it deploys quickly, and its particulate emissions are very low compared
        with diesel. The costs are fuel, carbon and a steady stream of deliveries. Natural gas is probably much cheaper
        to run and somewhat lower-carbon, but only where pipeline capacity already exists or can be built economically.
        Then there are the options that skip onsite fuel altogether: find a site with a few megawatts already available
        on the distribution grid, or put modular compute next to hydro or solar that already has an interconnection,
        often with batteries to handle peaks. Waiting for new transmission is probably the lowest-carbon route long term
        in provinces like Quebec and BC, and probably the slowest.
      </p>
      <p>
        Propane can clearly power an AI data centre. What I want to know is whether bringing fuel to the compute beats
        bringing the compute to power that already exists.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Same bottleneck, two answers</h2>
      <p>
        The CPA and companies like Nodiac are working on the same problem.{' '}
        <a href="/research/canadian-data-centres/power" className={linkClass}>
          Canada has plenty of electricity, but having enough somewhere in a province isn&rsquo;t the same as having
          100 MW at a particular site on a particular date.
        </a>{' '}
        The CPA&rsquo;s answer is to bring the energy to the data centre: build storage, install generators, truck the
        fuel in. The distributed model flips that around and takes the data centre to where generation or distribution
        capacity already sits.
      </p>
      <p>
        Both turn power availability into a site-selection question. The second one avoids most of the fuel cost and
        emissions that come with running fossil generation around the clock, and that&rsquo;s a hard advantage for
        propane to overcome.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">So how big is the opportunity?</h2>
      <p>
        Hyperscale campuses will dominate Canada&rsquo;s data centre capacity measured in megawatts. Distributed
        inference, sovereign AI and edge computing could still produce a much larger number of small facilities. Thirty
        3 MW sites add up to only 90 MW, but they&rsquo;re also 30 separate power decisions, and that&rsquo;s the market
        the CPA is positioning propane for.
      </p>
      <p>
        For each of those sites, a developer will be asking some version of the same questions. Do we truck in propane?
        Build a natural gas microgrid? Find three megawatts already sitting on the distribution grid? Colocate beside
        existing generation and storage? Or just wait for the grid?
      </p>
      <p>
        I think the CPA is reading where part of the market is heading more than where Canadian investment sits today,
        and propane has earned a place on that list. Whether it wins many of those 30 decisions is still open. The
        competitor to watch is the Nodiac model, because it doesn&rsquo;t need a tanker at all.
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

      <p className="text-sm text-gray-500 pt-4 border-t border-zeever-accent/20">
        The Nodiac and PowerBank joint development agreement is{' '}
        <a href={JDA_URL} className={linkClass} rel="noopener">
          announced here
        </a>
        . Broader context on Canada&rsquo;s grid constraint is in{' '}
        <a href="/research/canadian-data-centres" className={linkClass}>
          Canada&rsquo;s Data Centre Race
        </a>
        .
      </p>
    </BlogPost>
  )
}
