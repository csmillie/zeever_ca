import type { Metadata } from 'next'
import SeriesChapter from '@/components/SeriesChapter'
import { FAQPageJsonLd } from '@/components/JsonLd'
import { getChapter, chapterUrl, CBRE_UPDATE_DATE } from '@/lib/aiInfrastructureSeries'

const chapter = getChapter('canada-vs-us')!
const PAGE_URL = chapterUrl('canada-vs-us')
const DESCRIPTION =
  'Canada wins on clean grids, cool climate, and water. It loses on speed and scale. Northern Virginia alone is seven times Toronto and Montreal combined.'

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
    question: 'Does Northern Virginia really have more data-centre capacity than all of Canada?',
    answer:
      "Yes, by a wide margin, and as of the H2 2025 reporting cycle the comparison can be made on a single definition. CBRE's tracked colocation inventory put Northern Virginia at 4,039.6 MW at the end of 2025, up 37 percent year over year, against Toronto at 315.0 MW and Montreal at 229.5 MW in the same table. Toronto and Montreal combined come to 544.5 MW, about 13 percent of that one U.S. metro. Calgary, which CBRE does not track, adds roughly 35 MW today and about 125 MW once eStruxture's CAL-3 opens in the second half of 2026.",
  },
  {
    question: 'Where does Canada clearly beat the United States?',
    answer:
      'On grid carbon, climate, water, and stability. Quebec runs near 1.2 gCO2/kWh and Ontario near 74, against a U.S. grid average around 384. Every Canadian metro sits in a cold-winter zone with strong free-cooling potential, while Phoenix and Silicon Valley carry high water stress. Most Canadian markets sit in low water-stress basins, which is a durable structural edge that speed and scale cannot erase.',
  },
  {
    question: 'Why does Canada barely have hyperscale cloud regions of its own?',
    answer:
      "It is not zero, but it is thin and foreign. Three U.S. firms, Amazon, Microsoft and Google, hold about 85 percent of Canada's public cloud market. The cloud regions that exist cluster in Ontario and Quebec, plus AWS in Calgary. British Columbia, Manitoba, Saskatchewan and Atlantic Canada have no hyperscaler region at all, even where subsea cables land. That absence is why a data centre on Canadian soil does not automatically mean Canadian-controlled compute.",
  },
  {
    question: 'Is Canadian power actually cheaper than in the United States?',
    answer:
      "In some provinces, not all, and the comparison is muddy because of currency and volatile markets. Quebec is among the lowest at roughly CAD 0.05 per kWh, about USD 0.04. But the U.S. Pacific Northwest is cheaper still, with Quincy, Washington under 3 cents per kWh in USD. Alberta's deregulated market is volatile, with one 2023 estimate near 24 cents CAD for large industrial load. Treat all of these as approximate and mind the currency.",
  },
  {
    question: 'How reliable are these Canadian capacity numbers?',
    answer:
      'Better than they used to be, in two cities. Since the H2 2025 cycle, CBRE tracks Toronto and Montreal on the same basis as the U.S. primary markets and publishes them in the same table, so those two figures are now as solid as the American ones. Everything else is softer: Calgary is a single-operator company footprint rather than a tracked market, Vancouver, Winnipeg and Atlantic Canada have no meaningful figure at all, and headline gigawatts like Wonder Valley are proposals, not operating plants. We flag every estimate as such.',
  },
]

export default function Page() {
  return (
    <SeriesChapter
      slug="canada-vs-us"
      description={DESCRIPTION}
      updated={{
        date: CBRE_UPDATE_DATE,
        note: (
          <>
            Rebased on CBRE&rsquo;s H2 2025 market data, which for the first time reports Toronto and Montreal in the
            same inventory table as the U.S. markets. Northern Virginia&rsquo;s previous &ldquo;roughly 2,930 to
            4,040 MW&rdquo; is replaced by dated figures &mdash; 4,039.6 MW at year-end 2025 and 4,182.0 MW at Q1 2026
            &mdash; because those two numbers were never a range, but two annual readings. Montreal&rsquo;s
            ~200 MW estimate is replaced by CBRE&rsquo;s 229.5 MW, and one claim is corrected: Chicago had not cleared
            1,000 MW of commissioned capacity, so only three North American markets had. Two sections are new: the U.S.
            market scoreboard for 2025, and incentives as a competitiveness axis.
          </>
        ),
      }}
    >
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm text-gray-700">
          <strong className="text-zeever-text">The short version.</strong>{' '}Put Canada and the United States on the same scorecard and the split is clean. Canada wins on the things that are physically hard to move: clean grids, cold-climate cooling, abundant water, and political stability. It loses on the things capital rewards: speed, scale, permitting clarity, and a domestic hyperscale cloud presence. The single number that frames the whole chapter is this. Northern Virginia alone ran 4,039.6 megawatts of tracked data-centre inventory at the end of 2025, against 315.0 MW in Toronto and 229.5 MW in Montreal &mdash; same broker, same table, same definition. One American metro is more than seven times Canada&rsquo;s two real markets combined. Canada has the better ingredients and the smaller kitchen.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What actually makes a region competitive</h2>
      <p>
        A data centre is a bet on six inputs at once: cheap and clean power, a climate that lets you cool the machines without paying for it, water for that cooling, dense fibre to move the bits, a permitting process that says yes quickly, and a community that does not fight you. Chapter 4 argued that power is the binding constraint inside Canada. This chapter widens the frame to ask a different question. On each of those six axes, how does Canada compare to the U.S. hubs it is competing against for the same hyperscaler dollars?
      </p>
      <p>
        The honest answer is a split decision, and it is worth being precise about which side wins which axis. One caveat first, and it has improved. The capacity figures here come from market trackers like CBRE and Site Selection Group that measure metro by metro, and since the H2 2025 cycle CBRE reports Toronto and Montreal in the same inventory table as the U.S. markets &mdash; so for those two cities the comparison is finally like-for-like. What that table measures is{' '}<em>commissioned colocation inventory</em>: multi-tenant megawatts a broker can count building by building. It is not every megawatt in a metro, and it is not the same thing as the federal government&rsquo;s AI-specific national estimate. Everywhere else in Canada the figures are still thinner, assembled from operator disclosures and trade press, and several are explicit estimates. Where a number is soft, we say so.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Where Canada wins: the grid is clean</h2>
      <p>
        Start with the axis Canada wins most decisively. Grid carbon intensity is where the country&rsquo;s hydro and nuclear fleet pays off. Quebec&rsquo;s grid runs at roughly 1.2 grams of CO2 per kilowatt-hour, Ontario at about 74, and British Columbia and Manitoba both sit under 30, all of them hydro or nuclear dominated. The U.S. grid average is around 384 gCO2/kWh, more than 300 times Quebec&rsquo;s figure.
      </p>
      <p>
        The comparison sharpens region by region. Northern Virginia, the largest market on earth, draws on Dominion and the wider PJM pool, a moderate gas-and-nuclear mix. Phoenix, Dallas and Atlanta all run gas-heavy grids. Only two U.S. hubs come close to Canadian cleanliness: the Pacific Northwest, where Bonneville hydro dominates, and Chicago, where Illinois runs roughly half nuclear. So a hyperscaler that genuinely wants low-carbon electrons has a short list, and three of the cleanest options on it are Canadian provinces.
      </p>
      <p>
        The glaring exception is Alberta, the epicentre of the Canadian boom, whose grid runs around 424 to 470 gCO2/kWh (the 470 figure is from 2023; roughly 424 after the 2024 coal phase-out). That is dirtier than the U.S. average. So the clean-grid advantage is real but not uniform. It belongs to Quebec, Ontario, B.C. and Manitoba, and it is precisely the provinces with the cleanest grids that are now rationing access, a tension Chapter 4 traced in detail.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Where Canada wins: cold air and water</h2>
      <p>
        The second Canadian advantage is free cooling. Every Canadian market in our comparison sits in a cold-winter climate that lets operators cool servers with outside air for large stretches of the year, cutting the energy overhead that shows up as PUE. Winnipeg and Montreal are as good as it gets on this axis. The U.S. picture is mixed: the Pacific Northwest and Chicago share the cold-climate edge, but Northern Virginia, Atlanta and Dallas are humid and lean on mechanical cooling, and Phoenix is hot desert. We flag that a clean cooling comparison really wants free-cooling hours or measured PUE, and no Canadian project publishes those, so this axis is directional rather than quantified.
      </p>
      <p>
        Water tracks closely with climate. Cooling a large data centre can consume enormous volumes of water, which is why the U.S. water-stress map matters. Phoenix and Silicon Valley both sit in high water-stress zones, and Northern Virginia, Dallas and Atlanta are rated medium. Canada is mostly low: Toronto, Montreal, Vancouver and Winnipeg all sit in low water-stress basins. The exception, again, is Alberta at medium, and it is a real one, because roughly three quarters of planned Alberta sites sit in higher-stress basins, the subject of Chapter 6. On the whole, though, Canada has water where the hottest U.S. markets do not.
      </p>
      <p>
        Add political and hydrological stability and the structural case is complete. These are the advantages that are physically hard for a competitor to replicate. You cannot relocate a cold climate or conjure a hydro river.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Where Canada loses: scale, and it is not close</h2>
      <p>
        Now the other side of the scorecard. The first and largest gap is raw scale, and it is finally measurable on one definition. When CBRE published its H2 2025 numbers it put Toronto and Montreal in the same inventory table as the U.S. markets for the first time. Northern Virginia ended 2025 at{' '}<strong>4,039.6 MW</strong>{' '}of tracked inventory, up 37 percent year over year after delivering more than a gigawatt of new capacity in a single year, with{' '}<strong>21.5 MW</strong>{' '}left available and a vacancy rate of 0.5 percent. By the first quarter of 2026 it had grown again to 4,182.0 MW with vacancy at 0.3 percent. Against that:{' '}<strong>Toronto at 315.0 MW</strong>{' '}(29.6 MW available) and{' '}<strong>Montreal at 229.5 MW</strong>{' '}(6.4 MW available). Canada&rsquo;s two real markets together are 544.5 MW, roughly{' '}<strong>13 percent</strong>{' '}of one American metro. Calgary, which CBRE does not track as a market, adds about 35 MW of eStruxture footprint today and roughly 125 MW once CAL-3 opens in the second half of 2026.
      </p>
      <p>
        And Northern Virginia is not even the only U.S. market that beats all of Canada. By the end of 2025 three North American markets had cleared a gigawatt of commissioned capacity &mdash; Northern Virginia, Atlanta (1,459.2 MW) and Dallas-Fort Worth (1,067.3 MW) &mdash; with Chicago (904.6 MW) and Phoenix (807.3 MW) just below, and Silicon Valley (489.2 MW), Hillsboro (475.4 MW) and Central Washington (402.0 MW) behind them. Every one of those eight exceeds Toronto. The Pacific Northwest&rsquo;s regional demand could reach 4,000 average megawatts before 2030. Canada is not competing against one giant. It is competing against a country with half a dozen of them.
      </p>
      <p>
        This is where the announced-versus-operating distinction, the theme of Chapter 3, has to stay in view. Canada&rsquo;s headline numbers are enormous, more than 20 GW of proposals, but the operating base is small and the pipeline is mostly unbuilt. Comparing Canada&rsquo;s announced gigawatts to America&rsquo;s installed megawatts would flatter Canada dishonestly. On what actually runs today, the gap is roughly an order of magnitude.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The American market is tightening, not loosening</h2>
      <p>
        The scale gap is the obvious finding. The more useful one is what the U.S. market did in 2025, because it tells you what Canada would actually be competing for. Across the eight primary American markets, supply grew 36 percent in a single year to{' '}<strong>9,432 MW</strong>, tenants absorbed a record{' '}<strong>2,497.6 MW</strong>, and the vacancy rate fell to{' '}<strong>1.4 percent</strong>{' '}&mdash; an all-time low reached{' '}<em>while</em>{' '}supply was growing at that pace. There is essentially nothing available to lease in the largest market on earth.
      </p>
      <p>
        And then the number that cuts the other way: capacity under construction{' '}<strong>fell</strong>{' '}for the first time since 2020, to 5,994.4 MW from 6,350.1 MW a year earlier, which CBRE attributes to permitting, zoning and power-procurement delays. The United States is not running out of demand or capital. It is running into the same physical wall Canada hit, roughly one cycle later. That is the sharpest available support for this chapter&rsquo;s claim that the American speed advantage is narrowing rather than widening.
      </p>
      <p>
        Scarcity shows up in price. The average asking rate for a 250-to-500-kW requirement rose 6.5 percent year over year to{' '}<strong>$195.94 per kW per month</strong>, a fourth consecutive annual increase, and pricing for 3-to-10-MW requirements jumped{' '}<strong>12.5 percent</strong>{' '}as tenants competed for large contiguous blocks with scalable power. Preleasing of space under construction is running in the{' '}<strong>mid-70-percent range</strong>{' '}against a historical norm of 40 to 50 percent. Buildings are being spoken for well before they are energized.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Where Canada loses: nobody is paying you to come</h2>
      <p>
        There is a seventh axis this scorecard has been missing, and it is the one a site selector reads first.{' '}<strong>At least 36 U.S. states</strong>{' '}now offer targeted data-centre incentives &mdash; sales-tax exemptions on equipment, property-tax abatements, enterprise-zone treatment &mdash; and CBRE describes them as a key factor in site selection as states position for AI-driven growth. Michigan is the worked example: a market developers previously skipped for want of a sales-tax exemption on data-centre equipment passed new incentives in 2024 and landed a 1.4 GW announcement south of Ann Arbor by late 2025.
      </p>
      <p>
        Canada&rsquo;s posture is close to the opposite. CBRE&rsquo;s read of the country&rsquo;s largest market names &ldquo;federal government AI funding and{' '}<strong>limited provincial incentives</strong>&rdquo; as a factor shaping development pace and where infrastructure ends up. That matches what Chapter 9 found from the other direction: across the Canadian projects in our dataset, there are almost no disclosed cash subsidies at all. What Canada offers instead is regulatory and infrastructural &mdash; power access, permitting, land, and in Quebec and B.C. a place in a rationed queue. That is a real form of support, but it is slower, harder to price, and invisible on the spreadsheet a hyperscaler uses to compare Ohio with Ontario.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Where Canada loses: the missing cloud regions</h2>
      <p>
        Scale has a second face that matters even more for sovereignty: hyperscale cloud regions. This is where a data centre becomes usable public cloud rather than just a warehouse of servers, and Canada is thin. The regions that do exist cluster in two provinces. Montreal has AWS Canada Central and a Google region. Toronto has Azure Canada Central and Google, though notably no local AWS region, with the nearest in Montreal. Quebec City hosts Azure Canada East, and Calgary got AWS Canada West in 2023 and 2024.
      </p>
      <p>
        Everywhere else is a blank. British Columbia, Manitoba, Saskatchewan and Atlantic Canada have no hyperscaler cloud region at all, even though Vancouver anchors Google&rsquo;s Topaz subsea cable to Asia and Halifax lands a transatlantic cable. And the regions that exist are foreign-operated. Three U.S. firms, Amazon, Microsoft and Google, hold roughly 85 percent of Canada&rsquo;s public cloud market. That is the fact that makes &ldquo;sovereign&rdquo; a slippery word, and Chapter 7 pulls that thread. For this chapter the point is narrower: on cloud region density, the U.S. is not ahead by a margin, it is playing a different sport.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Where Canada loses: speed and permitting clarity</h2>
      <p>
        The third gap is speed. Capital rewards a jurisdiction that can say yes fast, and parts of the U.S. are built for it. Dallas is business-friendly with fast permitting. The Pacific Northwest layers tax incentives on top of cheap power. Alberta is genuinely favourable too, with its bring-your-own-generation approach, but that welcome runs straight into the 1,200 MW interim connection cap that Chapter 4 dissected. So even Canada&rsquo;s fastest province has a hard ceiling that its U.S. rivals do not.
      </p>
      <p>
        The honest complication is that U.S. permitting is tightening as fast as Canada&rsquo;s. Northern Virginia&rsquo;s Prince William Digital Gateway is snarled in three or more lawsuits, and Culpeper denied a project at Brandy Station in June 2024. Georgia&rsquo;s DeKalb County extended a moratorium. Silicon Valley is so power-constrained that roughly 100 MW of finished capacity sits idle waiting for a grid connection, with Santa Clara upgrades not due until 2028. So the U.S. advantage on speed is real but narrowing. The fair verdict is that America still has clearly-favourable venues like Dallas and the Pacific Northwest, whereas Canada&rsquo;s fastest venue comes with a cap.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">A wash: community opposition</h2>
      <p>
        On public opposition the two countries look more alike than different, and both are trending the wrong way for developers. In the U.S., Northern Virginia&rsquo;s opposition is rated high and rising, and demands for municipal moratoriums surged through 2025. In Canada, Hamilton is the emblem: hundreds protested the Steelport proposal on the former Stelco lands, and a city committee denied the application. Manitoba&rsquo;s premier rejected a hyperscale campus outright at the provincial level. Opposition is not a Canadian problem or an American one. It is a data-centre problem, and it is intensifying on both sides of the border.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Fibre: a two-metro country against a fibre superpower</h2>
      <p>
        Interconnection is a mixed result. Where Canada has fibre depth, it is genuinely strong. Toronto&rsquo;s TorIX is the country&rsquo;s largest exchange at roughly 2.3 Tbps peak with nearly 300 participants, anchored at the 151 Front Street carrier hotel, and it sits 13.7 milliseconds from Chicago and 14.3 from New York. Montreal&rsquo;s QIX, paired with AWS and Google regions, is 10 milliseconds from New York. Those two metros are real hubs.
      </p>
      <p>
        The problem is that the depth stops there. Chapter 5 calls this the two-metro problem. Calgary, Edmonton, Winnipeg, Vancouver and Halifax all run smaller exchanges and mostly lack cloud regions, and Calgary sits 63 to 88 milliseconds from the major eastern and U.S. hubs. Against that, Northern Virginia&rsquo;s Ashburn corridor is described in the market data as the strongest fibre interconnection hub in the world. Canada has two credible interconnection metros. The U.S. has Ashburn plus strong fabrics in Dallas, Chicago, Atlanta and the Bay Area. On fibre, Canada is competitive in two cities and thin everywhere else.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Price: cheaper in places, but mind the currency</h2>
      <p>
        Electricity price is the axis where the data is weakest and the caveats heaviest. Quebec is among the lowest anywhere in northeastern North America at roughly CAD 0.05 per kWh, about USD 0.04, and Manitoba is cheap too. But cheap Canadian power does not automatically beat the U.S., because the Pacific Northwest is cheaper still: Quincy, Washington comes in under 3 cents per kWh and Hillsboro, Oregon around 5 to 6 cents, both in USD. Alberta&rsquo;s deregulated market is competitive but volatile, with one 2023 secondary estimate near 24 cents CAD for large industrial load in Edmonton. Silicon Valley, at the other extreme, has some of the highest industrial power prices in the U.S.
      </p>
      <p>
        Two warnings apply to every figure in this paragraph. First, several are Canadian dollars and several are U.S. dollars, and at current exchange rates that gap alone is worth roughly a fifth. Second, most of these are secondary or approximate, because hyperscalers negotiate confidential rates that no public table captures. Canada has genuinely cheap clean power in Quebec and Manitoba. It does not have a monopoly on cheap power, and the price comparison is too soft to carry much weight on its own.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The net scorecard</h2>
      <p>
        Line the six axes up and the pattern is consistent. Canada wins the physical, slow-to-change advantages and loses the market, fast-moving ones:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Grid carbon:</strong>{' '}Canada wins, decisively, in Quebec, Ontario, B.C. and Manitoba (roughly 1.2 to about 74 gCO2/kWh versus a U.S. average near 384). Alberta is the exception at roughly 424 to 470.</li>
        <li><strong>Climate and water:</strong>{' '}Canada wins, with cold-climate free cooling and mostly low water stress against high stress in Phoenix and Silicon Valley.</li>
        <li><strong>Scale:</strong>{' '}The U.S. wins overwhelmingly. Northern Virginia alone, at 4,039.6 MW at year-end 2025, is more than seven times Toronto and Montreal combined.</li>
        <li><strong>Cloud regions:</strong>{' '}The U.S. wins. Canada has a thin, two-province, foreign-operated cluster; three U.S. firms hold about 85 percent of the Canadian cloud market.</li>
        <li><strong>Speed and permitting:</strong>{' '}The U.S. wins on clear venues like Dallas, but the gap is narrowing as U.S. opposition and grid limits bite.</li>
        <li><strong>Incentives:</strong>{' '}The U.S. wins. At least 36 states offer targeted data-centre incentives; Canada&rsquo;s support is regulatory rather than fiscal, and CBRE reads provincial incentives in the largest Canadian market as limited.</li>
        <li><strong>Fibre and opposition:</strong>{' '}A wash. Canada is strong in Toronto and Montreal and thin elsewhere; opposition is rising on both sides.</li>
      </ul>
      <p>
        So does cheap, clean hydro offset slower permitting and smaller markets? For a hyperscaler chasing raw scale and speed, no: Northern Virginia and Dallas will win those deals. For a project that specifically values low-carbon electrons, cold-climate cooling and water security, and can live with a slower build, Canada is one of the best options on the continent. The country is not losing the data-centre race because its fundamentals are weak. It is losing on the parts of the race that reward moving fast, and it has barely started building the domestic cloud layer that would turn its clean megawatts into sovereign compute. The ingredients are real. What Canada has not yet done is cook at scale.
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
        Primary and reputable secondary sources: CBRE Research and CBRE Data Center Solutions (H2 2025 market inventory, availability, vacancy, absorption and pricing for Northern Virginia, Toronto, Montreal and the U.S. primary markets, published February and March 2026; the H1 2025 Toronto and Montreal market profiles; and the 2026 U.S. Real Estate Market Outlook for preleasing and incentives, which is CBRE forecast rather than measurement); Site Selection Group (U.S. metro power-capacity rankings); the Canada Energy Regulator (provincial generation mix and grid carbon intensity); AESO (Alberta&rsquo;s interim large-load framework and 1,200 MW cap); Hydro-Qu&eacute;bec, BC Hydro and Manitoba Hydro (provincial rates and allocation policy); TorIX and QIX, with Cologix (interconnection and carrier-hotel data); WonderNetwork (measured latency figures); Google Cloud and AWS (Canadian cloud and Topaz subsea cable); WRI Aqueduct and Ceres (water stress); The American Prospect and CBC News (opposition and moratoriums in the U.S. and Hamilton); and the CAMP cloud-market analysis for the roughly 85 percent U.S. cloud share.
      </p>
    </SeriesChapter>
  )
}
