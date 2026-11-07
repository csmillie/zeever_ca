import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'
import { FAQPageJsonLd } from '@/components/JsonLd'

const PAGE_URL = 'https://www.zeever.ca/research/cbre-data-centre-update'

const TITLE = 'Toronto Is 315 MW: What CBRE’s Data Changed'
const DESCRIPTION =
  'CBRE now reports Toronto and Montreal on the same basis as US markets. We checked our series against it, corrected six things, and learned definitions rule.'

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
    question: 'How much data-centre capacity do Toronto and Montreal actually have?',
    answer:
      'At the end of 2025, CBRE tracked 315.0 MW of commissioned colocation inventory in Toronto, with 29.6 MW of it available to lease, and 229.5 MW in Montreal, with only 6.4 MW available. Those are all-workload figures for multi-tenant colocation space, counted building by building. They leave out owner-occupied hyperscaler campuses, and they are not the same measure as the federal government’s estimate of roughly 337 MW of AI-specific capacity nationally. The two numbers should never be added together.',
  },
  {
    question: 'How many data centres does Canada have?',
    answer:
      'More than 300 facilities, according to CBRE’s February 2026 figure. The overwhelming majority are ordinary enterprise, telecom and colocation sites that predate the AI boom. Our own research dataset tracks a much narrower set of 20 major AI, hyperscale, cloud-region, expansion and contested projects, because those are the builds that move national capacity and provincial power allocations. Within that tracked set, five are fully operating and four are partly operating. That is a statement about the flagship pipeline, not a census of Canadian data centres.',
  },
  {
    question: 'Is Northern Virginia really that much bigger than Canada?',
    answer:
      'Yes. Northern Virginia ended 2025 at 4,039.6 MW of tracked inventory, up 37 percent year over year, and reached 4,182.0 MW by the first quarter of 2026. Toronto and Montreal combined are 544.5 MW, about 13 percent of that single metro. Northern Virginia finished the year with 21.5 MW available and a 0.5 percent vacancy rate, so the gap is not softening.',
  },
  {
    question: 'What did you get wrong, specifically?',
    answer:
      'Six things. We presented Calgary’s roughly 125 MW as operating capacity when 90 MW of it is a building that does not open until the second half of 2026. We quoted Northern Virginia as a 2,930 to 4,040 MW range when those were two dated annual readings. We said Dallas, Atlanta and Chicago had each cleared 1,000 MW; Chicago had not. Our Montreal estimate mistakenly folded in Vantage’s Quebec City campus, which is a separate market. Our prose said we tracked 18 projects while the dataset had grown to 20, including a duplicated entry. And we placed metro inventory figures next to the federal 337 MW estimate without saying they measure different things.',
  },
  {
    question: 'Should CBRE be treated as a neutral source?',
    answer:
      'Partly. CBRE is a commercial real-estate advisory and data-centre services firm, so it has a commercial interest in data-centre growth. Its measured market data, meaning inventory, vacancy, absorption, availability, preleasing and asking rents, is proprietary and has no public substitute, and we use it as evidence. Its forecasts and commentary, including its view that Canada’s grid could reach a breaking point and its published position that the benefits of data-centre growth outweigh the drawbacks, are labelled in our sources as CBRE’s analysis rather than fact. We also do not cite CBRE for numbers it is repeating from someone else.',
  },
]

export default function Page() {
  return (
    <BlogPost title={TITLE} description={DESCRIPTION} date="2026-08-23" url={PAGE_URL}>
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm italic text-gray-700">
          CBRE&rsquo;s H2 2025 research reports Toronto and Montreal in the same inventory table as the U.S. primary
          markets for the first time. That finally lets the Canada versus U.S. comparison run on one definition instead
          of three. So we took our eleven-part data-centre series back through it. Six things were wrong or imprecise,
          including one real error: we had counted an unbuilt Calgary building as operating capacity. The deeper lesson
          is that almost every disagreement about data-centre numbers turns out to be a disagreement about what is being
          measured. Commissioned colocation inventory, critical IT load, AI-designated capacity, secured grid service,
          and an announced campus that does not exist yet are five different things. The public conversation treats them
          as one.
        </p>
      </div>

      <p>
        When we published{' '}
        <a href="/research/canadian-data-centres" className="text-zeever-text underline hover:text-zeever-primary transition-colors">
          Canada&rsquo;s Data Centre Race
        </a>
        , the weakest part was not the argument. It was the Canadian capacity numbers underneath it.
      </p>
      <p>
        The U.S. figures were easy. American metro capacity gets tracked market by market by commercial brokers who
        count buildings for a living. The Canadian figures were assembled the hard way: operator press releases, trade
        press, a chart read off a broker&rsquo;s PDF, and in Montreal&rsquo;s case an aggregate we built ourselves by
        adding up the campuses we knew about. We flagged them as estimates, which is the right thing to do and also not
        much of a defence.
      </p>
      <p>Then CBRE published its H2 2025 numbers, and the problem partly solved itself.</p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The table that changed the comparison</h2>
      <p>
        In March 2026, CBRE published its top ten North American data-centre markets by inventory. Toronto and Montreal
        are in it. Same broker, same methodology, same table as Northern Virginia and Dallas.
      </p>
      <p>At the end of 2025:</p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li><strong>Northern Virginia:</strong>{' '}4,039.6 MW of inventory, 21.5 MW available, 0.5% vacancy</li>
        <li><strong>Atlanta:</strong>{' '}1,459.2 MW, and{' '}<strong>Dallas-Fort Worth</strong>{' '}1,067.3 MW</li>
        <li><strong>Chicago:</strong>{' '}904.6 MW, and{' '}<strong>Phoenix</strong>{' '}807.3 MW</li>
        <li><strong>Toronto:</strong>{' '}315.0 MW, 29.6 MW available</li>
        <li><strong>Montreal:</strong>{' '}229.5 MW, 6.4 MW available</li>
      </ul>
      <p>
        Toronto and Montreal together come to 544.5 MW. That is about 13 percent of one American metro. And Northern
        Virginia grew by more than a gigawatt during 2025 alone, roughly twice everything Canada&rsquo;s two real
        markets have built in total.
      </p>
      <p>
        We had been making that comparison all along. We just could not previously make it without mixing measurement
        systems, which is exactly the sort of thing that lets a wrong number survive.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What we got wrong</h2>
      <p>
        Six corrections came out of the review. One is an actual error and the rest are precision problems, but they are
        all worth listing, because the pattern matters more than any single item.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">Calgary</h3>
      <p>
        We wrote that real operating capacity sits in three metros: Toronto, Montreal, and
        Calgary &ldquo;at roughly 125 MW.&rdquo; But 90 of those megawatts are eStruxture&rsquo;s CAL-3, which does not
        open until the second half of 2026. The operating footprint today is about 35 MW. Our own dataset said so, and a
        different chapter of the same series stated it correctly. This is the error I mind most, because counting an
        unbuilt building as operating capacity is precisely the thing that chapter was written to warn against.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">Northern Virginia</h3>
      <p>
        We quoted &ldquo;roughly 2,930 to 4,040 MW,&rdquo; which reads as an
        uncertainty band. It was never a range. Those are two annual readings, H2 2024 and H2 2025, describing a market
        that grew 37 percent in a year. Presenting growth as uncertainty hid the more interesting fact.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">Chicago</h3>
      <p>
        We said Dallas, Atlanta and Chicago had each cleared roughly 1,000 MW of commissioned
        capacity. Chicago was at 904.6 MW. Only three North American markets had passed a gigawatt.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">Montreal</h3>
      <p>
        Our 200 MW estimate quietly included Vantage&rsquo;s Quebec City campus, which is a
        separate market about 250 km away. The correct tracked figure, Montreal only, is 229.5 MW.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">The project count</h3>
      <p>
        Our prose said we tracked 18 projects. The dataset had grown to 20 rows, one
        of which was the same TELUS B.C. cluster entered twice at two different capacity horizons. The data moved and
        the writing did not follow it.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">The 337 MW problem</h3>
      <p>
        This is the one that matters most, and it gets its own section.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Five different numbers, all called &ldquo;capacity&rdquo;</h2>
      <p>
        Our map chapter had these two sentences next to each other. Operating capacity is concentrated in three metros
        at roughly 312, 200 and 125 MW. A federal pitch deck put Canada&rsquo;s current AI data-centre capacity at about
        337 MW.
      </p>
      <p>
        Both statements were sourced. Both were accurate. And placed side by side with nothing between them, they invite
        a reader to assume the 337 MW is the national roll-up of the metro figures. It is not. On CBRE&rsquo;s
        definition, Toronto and Montreal alone exceed 337 MW, which would be incoherent if the two measured the same
        thing.
      </p>
      <p>They do not. Sorting this out is most of what this update was actually about:</p>
      <div className="rounded-lg border border-zeever-accent/30 bg-gray-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Update, 3 September 2026</p>
        <p className="text-sm text-gray-700 leading-relaxed">
          A sixth measure has been added to the list below. Ottawa&rsquo;s January 2026 call for sovereign facilities
          over 100 MW has produced partnerships proposing 850 MW of compute by 2030, scalable to 2.3 GW, and that figure
          fits none of the original five.
        </p>
      </div>

      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Commissioned colocation inventory.</strong>{' '}Multi-tenant megawatts a broker counts building by building. Owner-occupied hyperscaler campuses are left out. This is CBRE&rsquo;s 315.0 MW for Toronto.</li>
        <li><strong>AI-designated capacity.</strong>{' '}What governments mean when they talk about AI compute. It includes self-built facilities that never appear in a colocation table. This is the federal 337 MW.</li>
        <li><strong>Critical IT load.</strong>{' '}What the servers can actually draw, usually lower than the headline facility number.</li>
        <li><strong>Secured grid service.</strong>{' '}Megawatts a utility has agreed to deliver, which may be years from energizing anything. TELUS&rsquo;s 85 MW from BC Hydro is this.</li>
        <li><strong>Announced campus capacity.</strong>{' '}The press-release number. Wonder Valley&rsquo;s 7.5 GW is this, and Beacon Indus&rsquo;s 1,494 MW is not even that: it is the size of the proposed gas plant, not the computing load.</li>
        <li><strong>Federal partnership pipeline.</strong>{' '}Added September 2026. Ottawa says it is finalising partnerships proposing 850 MW by 2030, scalable to 2.3 GW. These are memoranda of understanding, not campuses: no site is named, no grid service is secured, and no operator has announced a build against them. This measure did not exist when the five above were written, and the 850 MW figure fits none of them.</li>
      </ul>
      <p>
        That sixth row is the point of keeping this list. A number arrived that the taxonomy could not hold, and the
        temptation was to file it under &ldquo;announced&rdquo; because it is large and governmental. It is a stage
        earlier than announced. Adding a row is cheaper than letting a category quietly widen until it means nothing.
      </p>
      <p>
        Every chapter that carries more than one of these now says which is which. The dataset has phased columns for
        operating, preleased, under construction, secured and ultimate capacity, so a project like QScale can record a
        delivered 14 MW phase against a reserved 142 MW campus instead of one flat, misleading number.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What CBRE knows that nobody else publishes</h2>
      <p>
        The corrections are the boring half. The genuinely new material is what a broker sees that a utility filing does
        not: who is leasing, at what price, and how little is left.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">Toronto has almost nothing available</h3>
      <p>
        Immediately available, built-out colocation space in the
        3 to 6 MW range exists at only three locations in the entire market. CBRE describes it as a bottleneck creating
        price pressure. Meanwhile, greenfield projects of 50 to 400 MW are being planned for 2027 and 2028, with
        developers paying for power studies and application fees at both Toronto Hydro and Alectra. It is Ontario&rsquo;s
        quieter version of{' '}
        <a href="/research/canadian-data-centres/power" className="text-zeever-text underline hover:text-zeever-primary transition-colors">
          Alberta&rsquo;s interconnection queue
        </a>
        .
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">The largest AI lease in Canada is in Cambridge, Ontario</h3>
      <p>
        CoreWeave secured roughly 52 MW of
        preleasing in January 2025, with initial infrastructure operational by that June, making it the largest
        wholesale colocation deal in the GTA and the country. The anchor customer is Cohere, and up to C$240 million of
        federal money is attached under the Sovereign AI Compute Strategy. It was missing from our project dataset
        entirely, which is why our map read Ontario as &ldquo;cloud, not campus.&rdquo; It is now in, and it is the
        sharpest illustration of the argument in our{' '}
        <a href="/research/canadian-data-centres/sovereignty" className="text-zeever-text underline hover:text-zeever-primary transition-colors">
          sovereignty chapter
        </a>
        : Canadian soil, Canadian grid, Canadian anchor tenant, Canadian public money, and an American operator within
        reach of the CLOUD Act.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">Quebec is delivering in phases, not campuses</h3>
      <p>
        QScale delivered 14 MW at L&eacute;vis in under
        six months, aimed at AI tenants. Enovum expanded at two sites, including deals with Cerebras. Nordik and
        Accelsius launched a facility built around direct-to-chip liquid cooling. What they have in common is that they
        already held Hydro-Qu&eacute;bec allocations. With new power procurement restricted, essentially no large
        greenfield project broke ground, and blocks larger than 1 MW stayed rare.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">Density is repricing everything</h3>
      <p>
        AI deployments in Toronto are arriving at 60 to 132 kW per
        rack, forcing liquid cooling and pushing build-out costs above C$13 million per project. Continent-wide, the old
        volume discount has inverted. Large deployments used to get a price break, and now AI tenants pay premiums for
        contiguous power. Land with a grid connection is being bid up over ordinary industrial land in Mississauga, and
        past $8 million per acre in the hottest American markets.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">The American market is hitting the same wall</h3>
      <p>
        U.S. primary-market supply grew 36 percent in
        2025 to 9,432 MW, absorption set a record at 2,497.6 MW, and vacancy fell to 1.4 percent. Yet capacity under
        construction{' '}<em>fell</em>{' '}for the first time since 2020, on permitting, zoning and power-procurement delays.
        Grid capacity is largely booked through 2030 in most markets, and interconnection can run 24, 36, or 48 months
        and beyond.
      </p>
      <p>
        That last point forced a change of emphasis rather than a correction. We had framed behind-the-meter gas as
        something Alberta developers invented to route around AESO&rsquo;s cap. It is now routine across North America.
        What remains distinctly Canadian is not the workaround. It is the consequence: spending a genuinely clean
        grid&rsquo;s reputation to make the workaround necessary.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Where we don&rsquo;t follow CBRE</h2>
      <p>
        CBRE sells data-centre services. That does not make its measurements wrong. Leasing and vacancy data is exactly
        the thing a brokerage knows better than anyone, and there is no public substitute for it. But it does mean the
        reading has to be sorted by type, so our source records now tag every CBRE citation as measured research,
        forecast, or commentary.
      </p>
      <p>
        Measured research we use as evidence. Forecasts we date and attribute. Commentary gets named as CBRE&rsquo;s
        analysis, including its view that Canada&rsquo;s grid &ldquo;could reach a breaking point,&rdquo; and its
        published position that the benefits of data-centre growth outweigh the drawbacks. Our{' '}
        <a href="/research/canadian-data-centres/jobs-economics" className="text-zeever-text underline hover:text-zeever-primary transition-colors">
          jobs chapter
        </a>{' '}
        now states that position at its strongest, with CBRE&rsquo;s real finding that data centres will supply nearly
        half of Loudoun County&rsquo;s property tax revenue in 2026, and then answers it on jobs per megawatt.
      </p>
      <p>
        We also do not cite CBRE for numbers CBRE is repeating. Its Canadian article carries a market valuation from a
        third-party research firm and a global electricity figure from the IEA. Those belong to their original
        publishers, and the second one is four years stale. Nothing in the series was built on either.
      </p>
      <p>
        And where a utility, regulator, government filing, or operator disclosure already carries a claim, that source
        stays. AESO still carries the queue. Hydro-Qu&eacute;bec still carries the rate. Pembina still carries the gas
        plant. CBRE corroborates. It does not displace.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What we still don&rsquo;t know</h2>
      <p>
        Six questions came out of this that we deliberately did not answer in prose, because answering them would have
        meant guessing:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Who owns the Cambridge building, and whether CoreWeave&rsquo;s 52 MW of preleasing and CPP Investments&rsquo; separately financed 54 MW expansion describe the same megawatts.</li>
        <li>QScale&rsquo;s cumulative operating capacity at L&eacute;vis. We know one 14 MW phase landed. We do not know the total, and 142 MW is a reservation, not a running campus.</li>
        <li>eStruxture&rsquo;s current load at CAL-1 and CAL-2, which sits behind our 35 MW Calgary figure.</li>
        <li>Which AESO queue snapshot is current: 21,085 MW, or the earlier 29 projects requesting more than 16 GW.</li>
        <li>Whether Microsoft&rsquo;s 48 MW GTA campus sits inside or outside CBRE&rsquo;s 315.0 MW Toronto inventory, which decides whether Toronto&rsquo;s real number is 315 MW or meaningfully higher.</li>
        <li>CBRE&rsquo;s claim that nearly half of Canada&rsquo;s data centres are hyperscalers, which is unsupported in the source and hard to square with a 300-plus facility count. We did not use it.</li>
      </ul>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The part worth keeping</h2>
      <p>
        None of the corrections changed a conclusion. Power interconnection is still the binding constraint. The clean
        grid is still losing to gas on the axis that actually decides these projects, which is how fast power
        arrives. Foreign operators still control most Canadian capacity, including the
        flagship sovereign-AI deployment. The same megawatts would still employ far more people almost anywhere else.
      </p>
      <p>
        What changed is the precision of the evidence, plus one embarrassment about an unbuilt building. Both were worth
        the trip. If a series argues that the whole Canadian data-centre conversation confuses announced capacity with
        operating capacity, then the least it can do is not make that mistake itself, and say so in public when it does.
      </p>
      <p>
        The revised chapters carry a dated update note explaining what changed and why. The underlying dataset,
        including the phased capacity fields and the open questions above, is part of the same public research record.
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

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Sources</h2>
      <p className="text-sm text-gray-600">
        CBRE Research and CBRE Data Center Solutions:{' '}<em>North America Data Center Trends H2 2025</em>{' '}(February 25,
        2026), the accompanying market-inventory release including Toronto and Montreal (March 18, 2026),{' '}
        <em>Global Data Center Trends 2026</em>{' '}(June 17, 2026, reporting Q1 2026), the{' '}
        <em>U.S. Real Estate Market Outlook 2026</em>{' '}data-centre chapter (January 14, 2026, a forecast rather than
        measurement), the Toronto and Montreal market profiles from{' '}<em>North America Data Center Trends H1 2025</em>{' '}
        (September 8, 2025), and{' '}<em>Power Surge: Energizing Canada&rsquo;s Data Centre Expansion</em>{' '}(February 11,
        2026, CBRE commentary). Canadian project detail from operator disclosures, the Alberta Major Projects registry,
        the Impact Assessment Agency of Canada, AESO, Hydro-Qu&eacute;bec, BC Hydro, IESO, ISED, CPP Investments, and
        named reporting by The Globe and Mail, DataCenterDynamics, CBC News, Canada&rsquo;s National Observer, and The
        Narwhal. Figures are dated and labelled by measure. Announced capacity is never presented as operating.
      </p>
    </BlogPost>
  )
}
