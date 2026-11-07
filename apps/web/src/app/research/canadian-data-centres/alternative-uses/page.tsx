import type { Metadata } from 'next'
import SeriesChapter from '@/components/SeriesChapter'
import { FAQPageJsonLd } from '@/components/JsonLd'
import { getChapter, chapterUrl, CBRE_UPDATE_DATE } from '@/lib/aiInfrastructureSeries'

const chapter = getChapter('alternative-uses')!
const PAGE_URL = chapterUrl('alternative-uses')
const DESCRIPTION =
  "The same 100 megawatts could run an EV battery plant, a steel furnace, or a hydrogen hub, often with more jobs per megawatt. Power is rarely disclosed."

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
    question: 'If not a data centre, what else could 100 megawatts of power build?',
    answer:
      "The clearest comparators in our dataset are EV battery plants, steel, hydrogen, and petrochemicals. Volkswagen PowerCo took a dedicated 380 MW line in St. Thomas, Ontario for a plant projected to employ 3,000 people. Algoma Steel raised its self-generation to about 110 MW to run an electric arc furnace supporting a workforce of roughly 2,800. Power can also go to things that draw almost no grid load at all, like the roughly 5,000 homes planned on Toronto's Villiers Island.",
  },
  {
    question: 'How many permanent jobs does a data centre create per megawatt?',
    answer:
      "The industry staffing benchmark is about 0.2 to 0.35 permanent jobs per megawatt, so a 100 MW hyperscale campus supports on the order of 20 to 35 permanent roles. Of the two Canadian sites that disclose both figures, Beacon Foothills runs above the benchmark at about 0.75 jobs per MW (300 jobs at 400 MW), while Meta Sturgeon sits within it at about 0.30 (300 jobs at 1,000 MW). Both are announced figures, not realized headcounts, and both remain far below the per-megawatt employment of an EV battery plant or a steel furnace.",
  },
  {
    question: 'Which of these alternative projects actually got built?',
    answer:
      "Several did not. Northvolt's 352 MW Quebec battery plant was cancelled in 2025 after the parent company's bankruptcy, costing Quebec an estimated 270 million dollars. Honda shelved its 15 billion dollar Ontario EV hub in May 2026, and Umicore paused its cathode materials plant in 2024 on weak EV demand. Algoma's first electric arc furnace came online in July 2025, and the Port of Montreal broke ground at Contrecoeur in 2026. The lesson is that announced is not built, for data centres and their alternatives alike.",
  },
  {
    question: 'When is a data centre still the best use of the power?',
    answer:
      "When the goal is compute itself. If a region needs sovereign AI capacity, low-latency inference near its users, or an anchor tenant for new fibre, a data centre delivers what a steel mill cannot. Data centres also throw off a large construction boom and a durable property-tax base. The opportunity-cost argument is not that data centres are worthless. It is that on the single metric of permanent jobs per megawatt, they are among the weakest large-load options, so the power should be allocated with eyes open.",
  },
  {
    question: 'How reliable are these job and power comparisons?',
    answer:
      "They carry real caveats. Power draw is publicly disclosed for only a few comparators, so most per-megawatt comparisons rest on capital and jobs instead. Almost every job number is an announcement projection, not a verified headcount. Dollar figures mix Canadian and US currency, which we flag case by case. And some counts differ in kind: Algoma's 2,800 is a total retained workforce, not net new hires. We tag status and currency throughout rather than smooth the numbers into a false precision.",
  },
]

export default function Page() {
  return (
    <SeriesChapter
      slug="alternative-uses"
      description={DESCRIPTION}
      updated={{
        date: CBRE_UPDATE_DATE,
        note: (
          <>
            Adds serviced industrial land as a second opportunity cost alongside power, using CBRE&rsquo;s finding that Toronto
            data-centre land commands a premium over ordinary industrial parcels because so few sites have grid capacity, and
            that U.S. site costs have passed $8M per acre.
          </>
        ),
      }}
    >
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm text-gray-700">
          <strong className="text-zeever-text">The short version.</strong>{' '}Power is finite, and a data centre is only one thing you can do with it. The same megawatts could go to EV batteries, steel, hydrogen, semiconductors, housing, or ports, and on the honest metric of permanent jobs per megawatt the alternatives usually win by a wide margin. Volkswagen&rsquo;s battery plant in St. Thomas took a 380 MW line to employ 3,000 people. A 380 MW hyperscale data centre would employ well under 150. That gap is the opportunity cost. The caveat, carried throughout, is that very few of these projects disclose their power draw, and several were later cancelled, shelved, or paused.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The opportunity-cost question</h2>
      <p>
        The previous chapters established the scarce inputs: a firm grid connection, buildable serviced land, and public capital that Ottawa and the provinces are willing to put behind AI infrastructure. This chapter asks the obvious follow-up. If those inputs are genuinely scarce, then every megawatt handed to a data centre is a megawatt not handed to something else. What is that something else worth?
      </p>
      <p>
        To keep it honest, the comparison has to be apples-to-apples. It is easy to build a strawman by comparing a data centre against an idealized factory that was never going to be built. So this chapter uses real, announced Canadian projects, tags each one by status, and where possible compares on the same unit, a megawatt of power. The dataset behind it holds thirteen comparators across EV batteries, steel, hydrogen, clean tech, semiconductors, housing, and ports.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The 100-megawatt thought experiment</h2>
      <p>
        Start with the baseline. What does 100 MW buy in a data centre? On permanent employment, not much. The industry staffing benchmark is roughly 0.2 to 0.35 permanent jobs per megawatt, so a 100 MW hyperscale campus supports on the order of 20 to 35 permanent roles once construction ends. Of the two Canadian data centres in our records that disclose both numbers, Beacon Foothills runs above the benchmark at about 0.75 jobs per MW (300 permanent jobs at 400 MW), while Meta Sturgeon sits within it at about 0.30 (300 permanent jobs at 1,000 MW). Both are promotional announcement figures rather than verified headcounts. Either way, the permanent-jobs-per-megawatt number is the weakest thing about a data centre&rsquo;s economics.
      </p>
      <p>
        Now point the same power somewhere else. Only a handful of the comparators disclose a comparable power figure, which is itself a finding, so the strict per-megawatt comparison rests on three of them. But those three tell a consistent story, and the rest fill in the strategic picture on capital and jobs.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">EV batteries: the clearest per-megawatt gap</h2>
      <p>
        Battery manufacturing is where the disclosure is best and the contrast is sharpest.
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Volkswagen PowerCo, St. Thomas, Ontario</strong>{' '}(power disclosed): a dedicated Hydro One 230kV line rated at about 380 MW, feeding PowerCo&rsquo;s largest cell factory in the world, roughly 90 GWh a year, enough for about a million EVs. Projected 3,000 permanent jobs on a roughly 7 billion dollar Canadian investment (reported as up to 4.8 billion euros by 2030). That is about 7.9 jobs per megawatt, or 25 to 40 times a same-size data centre. One caveat: the 380 MW figure comes from the Hydro One line proposal, not from Volkswagen directly.</li>
        <li><strong>Northvolt Six, Quebec</strong>{' '}(power disclosed, cancelled): 352 MW reserved from the Quebec hydro grid for a plant that promised 3,000 jobs on a 7 billion dollar Canadian budget, with Quebec investing 510 million dollars. It went bankrupt and was cancelled in 2025, costing the province an estimated 270 million dollars. At about 8.5 jobs per megawatt on paper it still dwarfs a data centre, but it is above all a cautionary tale about reserving scarce power for a speculative project.</li>
        <li><strong>NextStar Energy, Windsor, Ontario</strong>{' '}(power not disclosed): Canada&rsquo;s first large-scale battery cell plant, a Stellantis and LG Energy Solution venture, about 45 to 49.5 GWh, 2,500 permanent jobs, more than 5 billion Canadian dollars (roughly 4.1 billion US). Grid load was never made public, so this one compares on capital and jobs, not per megawatt.</li>
        <li><strong>Honda, Alliston, Ontario</strong>{' '}(power not disclosed, shelved): a 15 billion dollar Canadian EV and battery hub of four plants, about 1,000 new jobs on top of 4,200 existing, frozen in May 2026 amid soft EV demand.</li>
        <li><strong>Umicore, Loyalist Township, Ontario</strong>{' '}(power not disclosed, paused): a 2.7 billion dollar Canadian cathode active materials plant, 600 jobs, construction paused in 2024.</li>
      </ul>
      <p>
        The pattern is clear even after the caveats. Where a battery plant discloses its power, it employs one to two orders of magnitude more people per megawatt than a data centre. But three of these five projects are now cancelled, shelved, or paused, which is the honest counterweight: a data centre that actually gets built beats a battery plant that does not.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Steel: decarbonizing an existing base</h2>
      <p>
        Steel is the other sector with a disclosed power figure, and it shows how electricity can anchor an existing industrial community rather than a greenfield one.
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Algoma Steel, Sault Ste. Marie, Ontario</strong>{' '}(power disclosed): the electric arc furnace conversion raised the site&rsquo;s self-generation from 34 MW to about 110 to 115 MW, underpinning a workforce of roughly 2,800 and cutting about 70 percent of the plant&rsquo;s emissions. Capital was about 825 to 875 million Canadian dollars, and the first furnace came online in July 2025. The 2,800 is a total retained workforce, not net new hires, and some role cuts are expected, so read the per-megawatt figure as the employment sustained by that power rather than jobs created.</li>
        <li><strong>ArcelorMittal Dofasco, Hamilton, Ontario</strong>{' '}(power not disclosed): a 1.765 billion dollar Canadian green-steel conversion to hydrogen-ready direct reduced iron plus electric arc furnace, 2.4 million tonnes of green steel a year, cutting roughly 3 million tonnes of CO2 annually, about 60 percent. About 2,500 construction jobs, with the electrical load undisclosed and construction delayed as of 2024.</li>
      </ul>
      <p>
        Steel adds a dimension that jobs per megawatt misses. The power is not just employing people, it is decarbonizing a heavy-emitting industry that already exists. A data centre placed on the same load would employ a fraction of the workers and displace none of those emissions.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Hydrogen and petrochemicals: power that pays for itself</h2>
      <p>
        Some of the largest alternatives barely compete for grid power at all, because they bring or make their own. That is a strategic point in its own right.
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Air Products, Edmonton, Alberta</strong>{' '}(self-powered, grid load not applicable): a 1.6 billion dollar Canadian net-zero blue-hydrogen complex with more than 90 percent CO2 capture, powered by its own hydrogen-fuelled unit rather than the grid. 230 permanent plus about 2,500 construction jobs.</li>
        <li><strong>EverWind, Point Tupper, Nova Scotia</strong>{' '}(builds its own power): a green hydrogen and ammonia hub powered by 800 MW of new renewables it is building itself, 650 MW of wind plus 150 MW of solar, for 240,000 tonnes a year of green ammonia bound for Europe. Phase 1 is roughly 6 billion US dollars (about 8 billion Canadian). Operational-phase headcount is not clearly disclosed, so this is not a clean jobs-per-megawatt comparator, but it adds 800 MW to the system rather than drawing it down.</li>
        <li><strong>Dow Path2Zero, Fort Saskatchewan, Alberta</strong>{' '}(power not disclosed): the world&rsquo;s first net-zero integrated ethylene cracker, 7.5 billion US dollars (about 10.1 billion Canadian), 3.2 million tonnes of polyethylene a year, 400 to 500 permanent plus 7,000 to 8,000 construction jobs, with startup delayed to 2029.</li>
      </ul>
      <p>
        The contrast with a data centre is not only about jobs. Air Products and EverWind either self-power or add generation, so they compete little or not at all for the scarce grid connections that data centres are fighting over. A gas-backed data centre, by comparison, consumes firm capacity for very few permanent jobs.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Semiconductors, housing, and ports: strategic value beyond jobs per megawatt</h2>
      <p>
        The last group of comparators does not disclose power either, but each carries a strategic argument a data centre cannot match.
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>IBM, Bromont, Quebec</strong>{' '}(semiconductors, power not disclosed): a 730 million dollar Canadian expansion of one of North America&rsquo;s largest chip assembly, test, and packaging sites, through which roughly 80 percent of IBM chips pass. 280-plus new highly skilled jobs on top of a maintained 1,000-plus, and a genuine supply-chain sovereignty asset.</li>
        <li><strong>Villiers Island, Toronto Port Lands</strong>{' '}(housing, minimal new power): about 5,000 homes including up to 2,700 affordable, roughly 15,000 residents, and 25 hectares of new parkland on reclaimed industrial land, enabled by 1.25 billion dollars of tri-government flood-protection infrastructure. It draws almost no dedicated power yet delivers thousands of homes and about 2,900 retail and cultural jobs. A data centre on the same land houses no one.</li>
        <li><strong>Port of Montreal, Contrecoeur, Quebec</strong>{' '}(port, power not disclosed): a container terminal expansion adding 60 percent capacity, about 1.15 million TEU, backed by a 1.16 billion dollar Canada Infrastructure Bank loan within a roughly 1.4 billion dollar-plus package. 1,200 operational plus up to 8,000 construction jobs, and about 750 million dollars a year in estimated economic benefit as a national trade gateway. Construction started in 2026.</li>
      </ul>
      <p>
        None of these is a strawman. They are announced, capitalized projects, several already under construction, and each answers a public need, chips, homes, trade capacity, that sits outside what a data centre provides.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The honest caveats</h2>
      <p>
        This comparison is only as good as its disclosures, so four caveats travel with every number above.
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li><strong>Power is rarely disclosed.</strong>{' '}Of the thirteen comparators, only Volkswagen (380 MW), Northvolt (352 MW, cancelled), and Algoma (about 110 MW self-generated) publish a figure that supports a clean jobs-per-megawatt comparison. EverWind and Air Products bring or make their own power. The remaining eight compare on capital and jobs only.</li>
        <li><strong>Announced is not built.</strong>{' '}Northvolt was cancelled, Honda was shelved, and Umicore was paused. The data-centre pipeline has the same problem in reverse, so the fair reading is that both sides of this ledger are heavy with projects that may never operate.</li>
        <li><strong>The data-centre baseline is a benchmark.</strong>{' '}The 0.2 to 0.35 jobs per megawatt figure is an industry staffing benchmark, not a Canadian audited number. Of the two disclosed Canadian sites, Beacon Foothills runs above it at about 0.75 jobs per MW, while Meta Sturgeon sits within it at about 0.30.</li>
        <li><strong>Currency and job types vary.</strong>{' '}Dow and EverWind are quoted in US dollars, NextStar partly so, and we flag those. Algoma&rsquo;s 2,800 is a total retained workforce, and Villiers Island&rsquo;s 2,900 is retail and cultural rather than industrial, so those counts are not identical in kind to a factory&rsquo;s permanent headcount.</li>
      </ul>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Where a data centre still wins</h2>
      <p>
        The opportunity-cost argument is not that data centres are a bad use of power. It is that they are a specific use of power, and the case for them has to rest on what they uniquely provide. When a region actually needs the compute, sovereign AI capacity, low-latency inference near its population, or an anchor tenant to justify new long-haul fibre, then a battery plant or a container terminal is no substitute. Data centres also deliver a large one-time construction boom and a durable property-tax base, which matter to a municipality even when permanent headcount is thin. The point is simply to make the trade visible. A megawatt is a decision, and on jobs per megawatt a data centre is one of the least labour-intensive things a scarce grid connection can be spent on.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Powered land is its own opportunity cost</h2>
      <p>
        This chapter has weighed megawatts against housing, batteries, steel and ports. There is a second scarce input being consumed alongside the power, and it now has a visible price: industrial land with a grid connection.
      </p>
      <p>
        CBRE reports that in Toronto, data-centre development land commands a premium over ordinary industrial projects specifically because so few sites have sufficient grid capacity &mdash; the example being Prologis&rsquo;s 40-acre acquisition in Mississauga. In the most concentrated U.S. markets the same dynamic has pushed site costs past{' '}<strong>$8 million per acre</strong>, with buyers hunting parcels carrying more than 200 MW of power.
      </p>
      <p>
        The implication for the comparison in this chapter is direct. When a data centre outbids a distribution centre, a food processor or a battery plant for a serviced industrial parcel, the province does not just lose the megawatts to a low-employment use. It loses the land that was zoned, serviced and connected for manufacturing &mdash; the scarcest kind of industrial land there is, and the kind an industrial strategy cannot conjure any faster than it can conjure a transmission line.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The takeaway</h2>
      <p>
        Run the thought experiment one more time. A hundred megawatts in a data centre buys roughly 20 to 35 permanent jobs on the industry benchmark. The same power in an EV battery plant buys thousands. In steel it sustains an entire integrated works and cuts a heavy emitter&rsquo;s carbon. In hydrogen it need not touch the grid at all. In housing it puts thousands of families on reclaimed land. None of that makes a data centre worthless, and every alternative here carries its own risk of cancellation, its own undisclosed power draw, its own currency footnote. But when a province is rationing grid connections and putting public capital on the table, the honest question is not whether a data centre creates jobs. It is whether those are the jobs, and the strategic value, that a scarce megawatt should buy.
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
        Primary and reputable secondary sources: CBRE Research and CBRE Data Center Solutions (the Toronto development-land premium and U.S. per-acre site costs); Volkswagen Group and Hydro One (St. Thomas battery plant and its 230kV line); NextStar Energy and Invest WindsorEssex (Windsor); CBC News and the Impact Assessment Agency of Canada (Northvolt cancellation); CBC News and Electrek (Honda Alliston); the Government of Canada and CBC News (Umicore Loyalist Township); Algoma Steel and Northern Ontario Business (electric arc furnace); ArcelorMittal and CBC News (Dofasco green steel); Air Products (Edmonton net-zero hydrogen); EverWind Fuels and Utility Dive (Point Tupper); CBC News and Energy Now (Dow Path2Zero); IBM Newsroom and Supply Chain 24/7 (Bromont); Waterfront Toronto and CreateTO (Villiers Island); and the Canada Infrastructure Bank and the Prime Minister&rsquo;s Office (Contrecoeur). The data-centre staffing baseline is an industry benchmark of roughly 0.2 to 0.35 permanent jobs per megawatt, cross-checked against the disclosed Beacon Foothills and Meta Sturgeon figures in our own Canadian data-centre dataset.
      </p>
    </SeriesChapter>
  )
}
