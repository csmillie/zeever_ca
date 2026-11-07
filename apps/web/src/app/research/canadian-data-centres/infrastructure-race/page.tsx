import type { Metadata } from 'next'
import SeriesChapter from '@/components/SeriesChapter'
import { FAQPageJsonLd } from '@/components/JsonLd'
import { getChapter, chapterUrl, CBRE_UPDATE_DATE, POLICY_UPDATE_DATE } from '@/lib/aiInfrastructureSeries'

const chapter = getChapter('infrastructure-race')!
const PAGE_URL = chapterUrl('infrastructure-race')
const DESCRIPTION =
  "The frontier of AI has moved from models and chips to power, land, fibre, and capital. Canada has about 337 MW built against more than 20 GW announced."

export const metadata: Metadata = {
  title: chapter.title,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }],
    title: chapter.title,
    description: DESCRIPTION,
    url: PAGE_URL,
  },
}

const FAQS = [
  {
    question: 'How did the AI race become an infrastructure race?',
    answer:
      'For two years the constraint on AI was chips and models. That has shifted. What now decides whether a large AI campus gets built, and how fast, is physical: a firm high-capacity grid connection, cheap land, fibre, water for cooling, and billions in patient capital. Chips can be shipped and land can be rezoned, but a fast grid connection cannot be conjured on demand. In Canada that single scarcity is shaping the entire buildout.',
  },
  {
    question: 'How much AI data-centre capacity does Canada have versus plan to build?',
    answer:
      'A federal deck from January 2026 put current AI data-centre capacity at about 337 MW, against more than 20 GW under planning or development. That is roughly a 60-fold gap between built and announced, and the government itself says most of the 20 GW will not be built. The national AI strategy estimates Canada will need about 5.5 GW of AI compute for commercial players by 2030.',
  },
  {
    question: 'What is Meta building in Alberta and why does it matter?',
    answer:
      "In July 2026 Meta announced its first Canadian data centre, and its largest anywhere outside the United States, in Sturgeon County, Alberta: more than CA$13 billion for a 1 GW facility. It matters because of how it gets its power. Alberta can connect only about 1,200 MW of new large load through 2028, and Meta holds roughly 970 MW of that, one of the two Phase-1 allocations. The data centre is due online within two to three years; its dedicated 932 MW gas plant, the Greenlight Electricity Centre, does not run until the second half of 2030, with a Capital Power contract bridging from 2028. One hyperscaler took the last firm grid position and is building gas for the decade after. Everyone behind it in the queue gets the gas without the grid slot.",
  },
  {
    question: 'Does Canada have an advantage in the global data-centre race?',
    answer:
      'Yes, on paper. Canada has abundant clean electricity (Quebec, B.C. and Manitoba run over 90 percent hydro), a cold climate that lowers cooling costs, water, land, and deep pools of pension and infrastructure capital. What it lacks is speed. New load cannot be connected to that clean power quickly, so the fastest path to a Canadian AI data centre often runs through a natural-gas plant in a higher-carbon province.',
  },
  {
    question: 'Who actually owns and operates AI infrastructure in Canada?',
    answer:
      'The largest commitments come from foreign hyperscalers such as Meta, and three U.S. firms (Amazon, Microsoft, Google) hold roughly 85 percent of Canada\'s public cloud market. Much of the capital is Canadian even when the operators are not: pension and infrastructure funds including CPP Investments, CDPQ and Brookfield are deep in AI infrastructure, though a large share of the concrete they finance sits abroad.',
  },
]

export default function Page() {
  return (
    <SeriesChapter
      slug="infrastructure-race"
      description={DESCRIPTION}
      updated={[
        {
          date: POLICY_UPDATE_DATE,
          note: (
            <>
            Corrects an arithmetic error in the opportunity-cost section. At 0.2 to 0.35 permanent jobs per
            megawatt, a 100 MW campus supports 20 to 35 permanent positions, not the 100 to 200 this chapter previously
            stated. Chapters 9 and 10 always had it right, so the series was contradicting itself on its own benchmark.
            The correction matters more now than when the error was made: Ontario&rsquo;s proposed Data Centre Playbook
            would screen projects on economic development, and this is the ratio that screen runs on.
            </>
          ),
        },
        {
          date: CBRE_UPDATE_DATE,
        note: (
          <>
            The metro capacity figures were rebased on CBRE&rsquo;s H2 2025 tracked colocation inventory (Toronto
            315.0 MW, Montreal 229.5 MW, Northern Virginia 4,039.6 MW), and the paragraph now states explicitly that
            those all-workload colocation megawatts are a different measure from the federal 337 MW AI-specific
            estimate. The 337 MW against 20-plus GW framing is unchanged.
            The Meta section is also corrected. Meta did not route around the grid: it holds roughly 970 MW of the
            1,200 MW Phase-1 allocation and its gas plant does not run until 2030. The point stands but sharpens, since
            the developers without a grid slot are the ones left building gas.
          </>
        ),
        },
      ]}
    >
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm text-gray-700">
          <strong className="text-zeever-text">The short version.</strong>{' '}The competitive edge in AI has moved off the chip and onto the ground: power, land, fibre, water, and capital. Canada holds the raw ingredient the world wants, abundant clean electricity, but it cannot connect new load to that power fast enough. So it has built about 337 megawatts of AI data-centre capacity against more than 20 gigawatts announced, and the projects that do move fastest, like Meta&rsquo;s CA$13 billion campus in Alberta, run on private natural gas rather than the clean grid. This is the opening chapter of an eleven-part series. It sets the four through-lines: power is the bottleneck, gas is undercutting the clean-grid advantage, foreign hyperscalers dominate, and the same megawatts could often do more elsewhere.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The frontier moved off the chip</h2>
      <p>
        For two years the story of artificial intelligence was told in chips and models. Which lab had the biggest cluster of GPUs, which model topped the benchmarks, who could hire the scarce talent. That framing is now out of date. The frontier of competition has moved to something older and more stubborn: physical infrastructure. Power to run the machines, land to put them on, fibre to move the data, water to keep them cool, and capital measured in the tens of billions to pay for all of it.
      </p>
      <p>
        The reason is simple. A GPU can be shipped anywhere in a week. A model&rsquo;s weights can be copied in minutes. But energizing a gigawatt of compute requires a grid that can actually deliver a gigawatt, and grids move on the timescale of transmission lines and turbines, not software releases. When the scarce input is a physical connection rather than a chip, whoever controls the connection controls the race.
      </p>
      <p>
        This series is about where that leaves Canada. The short answer, developed across the ten chapters that follow, is that Canada has the raw ingredients the world wants and lacks the speed to assemble them.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">337 megawatts against twenty-plus gigawatts</h2>
      <p>
        The gap between ambition and reality in Canada is easiest to see in one pair of numbers. A federal pitch deck prepared for the AI Minister in January 2026 put Canada&rsquo;s current AI data-centre capacity at roughly 337 megawatts, against more than 20 gigawatts of projects &ldquo;under planning or development.&rdquo; That is close to a 60-fold gap between what exists and what has been announced.
      </p>
      <p>
        The government itself cautions that most of that 20 GW will never be built, and that caution is the point. Announced capacity is cheap: a press release and a land option will get a project onto the map. Energized capacity is the hard part, because it has to pass through a grid connection, a permit, a fibre route, and a financing close before a single rack powers on. For scale, the national AI strategy estimates Canada will need about 5.5 GW of AI compute for commercial players by 2030. The pipeline is enormous, the real base is thin, and the infrastructure is the filter that decides what survives.
      </p>
      <p>
        Underneath the national figure, the operating base is genuinely small. CBRE&rsquo;s tracked colocation inventory put Toronto at 315.0 MW and Montreal at 229.5 MW at the end of 2025; Calgary&rsquo;s eStruxture footprint is about 35 MW and reaches roughly 125 MW only when CAL-3 opens in the second half of 2026. Note that these are all-workload colocation megawatts, a different measure from the federal AI-specific 337 MW, and the two should not be added together. Set them against Northern Virginia, the world&rsquo;s largest data-centre market, which ended 2025 at 4,039.6 MW &mdash; more than seven times Toronto and Montreal combined. The next chapter takes that comparison head-on.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Power is the bottleneck</h2>
      <p>
        The first through-line of this series is that power, specifically a firm and fast grid connection, is the binding constraint. The clearest single illustration sits in Alberta. By early 2026, data centres had requested more than 21,000 MW of grid connection from the Alberta Electric System Operator (AESO). Against that queue, AESO&rsquo;s interim large-load framework allows only about 1,200 MW of new large load to connect through 2028, and that entire allocation is already spoken for by just two projects. Everyone else waits for a Phase 2 that has not been sized.
      </p>
      <p>
        A queue that large against a door that small explains almost everything else about how the boom is unfolding. It is not land that is scarce in Alberta, and it is not money. It is the wire. Chapter four takes the power story apart in detail; for now it is enough to hold the shape of it. When interconnection is the bottleneck, developers do one of two things: they wait, or they find another source of power.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The clean-grid advantage, hollowed out by gas</h2>
      <p>
        The second through-line is that Canada&rsquo;s headline advantage is quietly being hollowed out. Not on price, and not because gas is cheaper than hydro, but because the clean electrons cannot be connected in time and the dirty ones can. The pitch to the world was a clean grid: Quebec, B.C. and Manitoba hydro, Ontario&rsquo;s low-carbon nuclear-and-hydro mix, some of the lowest-carbon electricity on the continent. Quebec&rsquo;s grid runs near 1.2 grams of CO2 per kilowatt-hour. That is the ingredient hyperscalers with net-zero pledges say they want.
      </p>
      <p>
        But the fastest path to power in the province with the most demand does not touch that clean grid at all. Faced with AESO&rsquo;s cap, Alberta developers are building their own on-site natural-gas plants behind the meter, sidestepping the interconnection queue entirely. The largest proposals in our dataset are built this way: Wonder Valley (up to 7.5 GW, off-grid gas), Beacon AI Indus (a proposed 1,494 MW gas plant), and Bitdeer&rsquo;s Fox Creek site (a 101 MW on-site plant). Alberta&rsquo;s grid still runs around 424 to 470 grams of CO2 per kilowatt-hour (the 470 figure is from 2023; roughly 424 after the 2024 coal phase-out), hundreds of times Quebec&rsquo;s intensity. When the quickest route to a gigawatt is a private gas plant in a high-carbon province, the &ldquo;clean Canada&rdquo; story starts being written in natural gas. That inversion is the subject of chapters four and six.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Meta is the emblem</h2>
      <p>
        If you want the whole pattern in one project, look at Meta. In July 2026 the company announced its first Canadian data centre, and its largest anywhere outside the United States, in Sturgeon County, Alberta. The figure is more than CA$13 billion for a 1 GW facility, the single biggest Canadian AI data-centre commitment to date.
      </p>
      <p>
        How do you power a 1 GW load in a province that will connect only about 1,200 MW of new load before 2029? The instinctive answer is that you build your own plant, and it is the wrong answer here. Meta holds roughly 970 MW of that 1,200 MW cap, one of the two Phase-1 allocations, awarded under a qualification process that has since closed. Its data centre is expected online within two to three years; the 932 MW Greenlight Electricity Centre that will eventually feed it does not enter service until the second half of 2030, with a 250 MW Capital Power contract covering part of the gap from 2028.
      </p>
      <p>
        Read in that order the project is more revealing, not less. The largest and best-capitalized entrant secured the scarcest thing in the province, a firm grid position, and is building private gas for the decade after. Every through-line of this series runs through that one site: power as the constraint, gas as what you resort to without a slot, and foreign capital and control as the shape of ownership. Chapter four follows what happens to the developers who were not first in line.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Foreign hyperscalers dominate, even where the money is Canadian</h2>
      <p>
        The third through-line is control. The largest commitments in Canada come from foreign hyperscalers, and the cloud layer above the concrete is already heavily foreign. Three U.S. firms, Amazon, Microsoft and Google, hold roughly 85 percent of Canada&rsquo;s public cloud market, and Ottawa itself has spent about CA$1.3 billion on U.S. cloud services since 2021, most of it with Microsoft.
      </p>
      <p>
        The twist is that much of the capital is Canadian even when the operators are not. Canadian pension and infrastructure funds are deep in AI infrastructure: CPP Investments has committed to a US$15 billion Equinix and GIC joint venture, another US$1.75 billion with EQT, and C$225 million into an Ontario site; CDPQ has financed Vantage&rsquo;s Quebec City campus; Brookfield has launched a US$100 billion AI-infrastructure program. The money is Canadian and a great deal of the concrete it builds is American. That flow, and the question of whether a Canadian-located data centre makes the data inside it Canadian-controlled (it does not, under the U.S. CLOUD Act), are the subjects of chapters seven and nine.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The same megawatts could do more elsewhere</h2>
      <p>
        The fourth through-line is opportunity cost. Power is finite, and every gigawatt routed to a data centre is a gigawatt not routed to something else. Data centres are unusually poor job creators for the electricity they consume: industry staffing runs around 0.2 to 0.35 permanent jobs per megawatt, so a 100 MW campus supports on the order of 20 to 35 permanent positions. The same power in an EV battery plant, a steel mill, or petrochemicals employs many times more people per megawatt. That comparison, and what else 100 MW could buy, is the subject of chapter ten.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What the next ten chapters cover</h2>
      <p>
        This chapter frames the race. The ten that follow work through it, each grounded in primary sources with every figure cited:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li><strong>Chapter 2, Canada vs. the U.S.</strong>{' '}A head-to-head scorecard: clean grids, cool climate and water on one side, speed, scale and cloud regions on the other.</li>
        <li><strong>Chapter 3, Mapping the boom.</strong>{' '}Where the projects actually are, what stage they are really at, and the gap between announced gigawatts and operating megawatts.</li>
        <li><strong>Chapter 4, Power.</strong>{' '}The 21 GW queue, the 1,200 MW door, and the gas workaround that follows.</li>
        <li><strong>Chapter 5, Fibre and bandwidth.</strong>{' '}Real interconnection lives in Toronto and Montreal; everywhere else is thin.</li>
        <li><strong>Chapter 6, Water.</strong>{' '}No Canadian project publishes measured water use, and about three-quarters of planned Alberta sites sit in high water-stress basins.</li>
        <li><strong>Chapter 7, Sovereignty.</strong>{' '}Funded compute, missing cloud: why a Canadian address does not make the data Canadian-controlled.</li>
        <li><strong>Chapter 8, Jobs and economics.</strong>{' '}The honest metric is jobs per megawatt, and it is a weak number.</li>
        <li><strong>Chapter 9, Capital.</strong>{' '}Canadian pension money building, in large part, American data centres.</li>
        <li><strong>Chapter 10, Alternative uses.</strong>{' '}The same megawatts weighed against housing, batteries, steel, and ports.</li>
        <li><strong>Chapter 11, Strategy.</strong>{' '}The ingredients without the coordination, and what a real Canadian plan would need.</li>
      </ul>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The takeaway</h2>
      <p>
        The AI race in Canada is, first and most concretely, an infrastructure race. The country has what the world is short of: abundant clean electricity, cold air, water, land, and deep capital. What it does not yet have is the ability to connect new load to that power quickly. Until that changes, the 337 megawatts that exist will keep growing far more slowly than the 20-plus gigawatts on the map, the fastest new campuses will keep running on gas, and much of what does get built will be foreign-operated on Canadian-financed concrete. Those four tensions, power, gas, foreign control, and opportunity cost, are the spine of everything that follows.
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
        Primary and reputable secondary sources: CBC News (Meta&rsquo;s interim grid rights, the Capital Power agreement, and Greenlight&rsquo;s 2030 in-service date); ISED and the Canadian Press (the January 2026 pitch deck and the national 337 MW figure); ISED&rsquo;s National AI Strategy (the 5.5 GW by 2030 demand estimate); AESO (the interim large-load framework and connection queue); Meta Data Centers and Pembina Pipeline (the Meta Sturgeon build and the Greenlight Electricity Centre); the Canadian Association of Marketing Professionals and the Canadian Press (U.S. cloud market share and federal cloud spend); CPP Investments, CDPQ and Brookfield press releases (the capital trail); the Canada Energy Regulator and Alberta.ca (grid carbon intensity); Canada&rsquo;s National Observer and The Narwhal (Alberta gas builds and project status); and CBRE Research with CBRE Data Center Solutions (Toronto, Montreal and Northern Virginia inventory at H2 2025). Figures are as-reported and dated; announced projects are not treated as built, and CAD and USD are labelled where they differ.
      </p>
    </SeriesChapter>
  )
}
