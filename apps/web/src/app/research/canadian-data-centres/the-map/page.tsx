import type { Metadata } from 'next'
import SeriesChapter from '@/components/SeriesChapter'
import { FAQPageJsonLd } from '@/components/JsonLd'
import { getChapter, chapterUrl, CBRE_UPDATE_DATE } from '@/lib/aiInfrastructureSeries'

const chapter = getChapter('the-map')!
const PAGE_URL = chapterUrl('the-map')
const DESCRIPTION =
  "Canada has more than 300 data-centre facilities, but among the 20 major projects we track the operating base is thin and the headline gigawatts are proposals."

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
    question: 'How many data centres does Canada actually have, and how many are just announced?',
    answer:
      'Two different counts, and they get confused constantly. Canada has more than 300 data-centre facilities in total, according to CBRE (February 2026), and most are ordinary colocation, enterprise, and telecom sites that long predate the AI boom. Zeever tracks a much narrower set: 20 major AI, hyperscale, cloud-region, expansion, and contested projects, chosen because they are the builds that move national capacity, power allocation, and the sovereignty question. Within that tracked set, 5 are fully operating (AWS Canada Central, AWS Canada West, Google Cloud Toronto, TELUS Rimouski, and Vantage’s Montreal campuses), 4 are partly operating and expanding (QScale L&eacute;vis, Vantage Quebec City, Bell’s Merritt AI Fabric, and the CoreWeave Cambridge site), 5 are under construction, 5 are proposed, and 1 is under review. That is a statement about the flagship pipeline, not a count of every operating data centre in Canada.',
  },
  {
    question: 'Where are Canada data centres concentrated?',
    answer:
      "Four corridors. The Greater Toronto and Golden Horseshoe area holds the Google and Microsoft cloud footprint plus the CoreWeave Cambridge AI site. Greater Montreal and Quebec hold AWS Canada Central, Vantage, and QScale. Alberta is the epicentre of the new build, with 9 of the 20 projects. The Lower Mainland and interior British Columbia hold the TELUS sovereign AI cluster and Bell’s Merritt AI Fabric. New Brunswick sits outside those corridors as a contested single proposal.",
  },
  {
    question: 'What is the gap between announced gigawatts and operating megawatts?',
    answer:
      'Real operating capacity is measured in hundreds of megawatts. CBRE’s tracked colocation inventory put Toronto at 315.0 MW and Montreal at 229.5 MW at the end of 2025; Calgary’s eStruxture footprint is about 35 MW today and reaches roughly 125 MW only once CAL-3 opens in the second half of 2026. Separately, a federal pitch deck put Canada’s AI-specific data-centre capacity at roughly 337 MW. Those two measures are not additive and not comparable: the metro figures count all-workload commissioned colocation megawatts, the federal figure counts AI-designated capacity nationally. The announced pipeline, meanwhile, is measured in tens of gigawatts, more than 20 GW nationally, led by a single proposed Alberta campus of up to 7.5 GW. Those proposal numbers should never be summed as if they were operating.',
  },
  {
    question: 'How much of the boom is real AI versus crypto or cloud?',
    answer:
      'By type, our 20 projects split into 9 AI campuses, 4 hyperscale sites, 4 cloud regions, 2 sovereign AI factories, and 1 crypto facility. But the labels blur-sm at the edges. Some AI campuses are crypto-to-AI pivots, such as the small AVAX One micro-grid, and the Bitdeer Fox Creek site is a crypto build with an AI-ready design. Tagging each project by its real stage and real use is the only way to read the map honestly.',
  },
  {
    question: 'Which Canadian data-centre projects have been rejected or paused?',
    answer:
      "Several. The Alberta Utilities Commission rejected the roughly $10 billion Synapse project near Olds in March 2026 for missing information and inadequate consultation. Manitoba's premier rejected a proposed 500 MW hyperscale campus near Winnipeg. Hamilton's committee of adjustment denied the Steelport land severance tied to a feared waterfront data centre, now under appeal, and the city moved toward a moratorium. The map includes its own rejections.",
  },
]

export default function Page() {
  return (
    <SeriesChapter
      slug="the-map"
      description={DESCRIPTION}
      updated={{
        date: CBRE_UPDATE_DATE,
        note: (
          <>
            Revised against CBRE&rsquo;s H2 2025 market data. The tracked project set is now 20, not 18 (a duplicate
            TELUS B.C. entry was merged, and Bell&rsquo;s Merritt AI Fabric and the CoreWeave Cambridge site were added),
            and the status split is restated as 5 fully operating, 4 partly operating, 5 under construction, 5 proposed,
            1 under review. Toronto and Montreal now carry CBRE&rsquo;s tracked colocation inventory (315.0 MW and
            229.5 MW at year-end 2025) in place of earlier estimates. Two corrections: Calgary&rsquo;s roughly 125 MW
            was previously presented as operating, when 90 MW of it is CAL-3, which does not open until the second half
            of 2026; and the metro inventory figures are now explicitly distinguished from the federal 337 MW
            AI-specific estimate, which is a different measure and must not be summed with them.
            The Meta entry is also corrected to show the grid-first sequence: roughly 970 MW of firm Phase-1 grid
            capacity now, its own gas plant only from the second half of 2030.
          </>
        ),
      }}
    >
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm text-gray-700">
          <strong className="text-zeever-text">The short version.</strong>{' '}Canada has more than 300 data-centre facilities. It does not have 300 AI campuses. This chapter tracks the 20 projects that actually move the national numbers, and on that map the boom looks enormous in press releases and thin on the ground: 5 are fully operating, 4 are partly operating and expanding, and real operating capacity sits in the low hundreds of megawatts across three metros &mdash; Toronto at 315 MW and Montreal at 229.5 MW of tracked colocation inventory, Calgary at about 35 MW until CAL-3 opens. The headline gigawatts, led by a single proposed Alberta campus of up to 7.5 GW, are proposals, many of them gas-powered, several exempt from or pending review, and a few already rejected. The gap between announced and operating is the whole story.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">A boom you can count</h2>
      <p>
        It is easy to feel that Canada is being paved over with data centres. The way to check that feeling is to count &mdash; but you have to be clear about what you are counting. Canada has{' '}<strong>more than 300 data-centre facilities</strong>, according to CBRE, and the overwhelming majority of them are unremarkable: enterprise rooms, telecom sites, and colocation halls that were serving ordinary cloud and hosting demand long before anyone said &ldquo;AI campus.&rdquo; That number is not what this chapter is about.
      </p>
      <p>
        What this chapter tracks is the flagship layer:{' '}<strong>20 major AI, hyperscale, cloud-region, expansion, and contested projects</strong>, each tagged with a status, chosen because they are the builds that move national capacity, consume provincial power allocations, and carry the sovereignty question. The shape of that count is the first finding, and it should never be read as a count of every data centre in the country.
      </p>
      <p>
        Of the 20, only 5 are fully operating and another 4 are partly operating and expanding. Five are under construction, 5 are proposed, and 1 is under review. Put plainly, more than half of the flagship map is a promise rather than a building. The operating tier is also the least glamorous part: it is mostly the American hyperscalers&rsquo; cloud regions (AWS Canada Central in Montreal, AWS Canada West in Calgary, Google Cloud Toronto), plus TELUS&rsquo;s Rimouski AI factory and Vantage&rsquo;s Montreal campuses. The partly-operating tier is where the genuine AI capacity sits: QScale&rsquo;s L&eacute;vis campus, Vantage&rsquo;s Quebec City campus, Bell&rsquo;s small Merritt AI Fabric, and the CoreWeave site at Cambridge, Ontario. The gigawatt-scale names that dominate the headlines are all in the proposed or under-construction tiers.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The corridors</h2>
      <p>
        Sorted by geography, the activity clusters into four corridors and one outlier. Each corridor is anchored by a different mix of power, fibre, and cloud demand.
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Greater Toronto and the Golden Horseshoe.</strong>{' '}Mostly cloud, but no longer only cloud. Google Cloud&rsquo;s Toronto region is operating, Microsoft&rsquo;s CA$19 billion Azure expansion (2023 to 2027) is putting new capacity into Toronto and Quebec City, and CoreWeave runs an AI site at Cambridge with the Canadian model developer Cohere as anchor customer &mdash; roughly 52 MW preleased in January 2025, with initial infrastructure operational by that June. At 315.0 MW of tracked colocation inventory and only 29.6 MW of it available at the end of 2025, this is Canada&rsquo;s largest and tightest market. The corridor&rsquo;s headline conflict is the denied Steelport severance on Hamilton&rsquo;s harbourfront.</li>
        <li><strong>Greater Montreal and Quebec.</strong>{' '}The deepest operating base in the country, at 229.5 MW of tracked inventory with just 6.4 MW available. AWS Canada Central and three Vantage Montreal campuses (about 91 MW) already run, QScale has delivered a 14 MW phase at L&eacute;vis on the way to a reserved 142 MW campus, Vantage is adding a final 32 MW building to reach an 86 MW campus in Quebec City, and TELUS runs its Rimouski sovereign AI factory. All of it draws on Hydro-Qu&eacute;bec&rsquo;s near-100-percent renewable grid.</li>
        <li><strong>Alberta.</strong>{' '}The epicentre of the new build and of the controversy, with 9 of the 20 projects. It holds both the largest single proposal on the map (Wonder Valley) and the largest project under construction (Meta&rsquo;s Sturgeon County site). Almost everything here leans on on-site natural gas. Calgary&rsquo;s operating colocation footprint, by contrast, is small: about 35 MW today.</li>
        <li><strong>The Lower Mainland and interior B.C.</strong>{' '}Anchored by the TELUS and Westbank sovereign AI cluster, an 85 MW initial BC Hydro allocation split across Kamloops and Vancouver and scaling toward 150 MW by 2032, plus Bell&rsquo;s live 6.5 MW AI Fabric at Merritt.</li>
      </ul>
      <p>
        The outlier is New Brunswick, where the Beacon and VoltaGrid proposal at Lorneville near Saint John sits under review, a 390 MW site split between an on-site gas plant and the NB Power grid. It has no corridor around it, which is part of why it is so contested locally.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The flagship projects, tagged by status</h2>
      <p>
        Here is the map at its largest scale, grouped by province and always carrying a status tag. The single rule is that a proposed gigawatt is not an operating megawatt.
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Alberta, proposed:</strong>{' '}Wonder Valley (O&rsquo;Leary Ventures, near Grande Prairie), up to 7.5 GW and about CA$70 billion at full buildout, off-grid gas; the Beacon AI Foothills, Chestermere, and Indus campuses, two of them rated 400 MW and Indus proposing 1,494 MW of on-site gas generation; and the small 10 MW AVAX One micro-grid.</li>
        <li><strong>Alberta, under construction:</strong>{' '}Meta&rsquo;s Sturgeon County site, 1 GW and more than CA$13 billion, running first on roughly 970 MW of firm grid capacity (one of Alberta&rsquo;s two Phase-1 allocations) and later on its own gas plant, the Greenlight Electricity Centre, which enters service in the second half of 2030; eStruxture CAL-3, 90 MW with CoreWeave as anchor tenant, due live in the second half of 2026; and the Bitdeer Fox Creek crypto facility, about 100 MW on a 101 MW on-site gas plant.</li>
        <li><strong>Alberta, existing:</strong>{' '}AWS Canada West, the Calgary cloud region, launched in December 2023, and eStruxture&rsquo;s CAL-1 and CAL-2 at about 35 MW combined.</li>
        <li><strong>Quebec, partly operating and expanding:</strong>{' '}QScale&rsquo;s L&eacute;vis campus, which delivered a 14 MW phase in the first half of 2025 against a reserved 142 MW ultimate buildout, and Vantage&rsquo;s Quebec City campus, where the final 32 MW building (QC24) takes the site to 86 MW in early 2027. Both run on Hydro-Qu&eacute;bec power.</li>
        <li><strong>Quebec, existing:</strong>{' '}Vantage&rsquo;s Montreal campuses (about 91 MW), AWS Canada Central, and the TELUS Rimouski sovereign AI factory.</li>
        <li><strong>Ontario:</strong>{' '}Google Cloud&rsquo;s Toronto region (existing), the CoreWeave Cambridge AI site with Cohere as anchor customer (partly operating since mid-2025, about 52 MW preleased), and the Microsoft Azure expansion (under construction, spanning Toronto and Quebec City).</li>
        <li><strong>British Columbia:</strong>{' '}the TELUS and Westbank sovereign AI cluster in Kamloops and Vancouver (under construction, 85 MW secured from BC Hydro, 150 MW by 2032), and Bell&rsquo;s AI Fabric at Merritt (6.5 MW live, expanding to a 2,304-GPU cluster).</li>
        <li><strong>New Brunswick, under review:</strong>{' '}the 390 MW Beacon and VoltaGrid site at Lorneville.</li>
      </ul>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Announced gigawatts, operating megawatts</h2>
      <p>
        Now the credibility gap, stated in numbers. What is actually energized and serving load in Canada is measured in hundreds of megawatts, concentrated in three metros. CBRE&rsquo;s tracked colocation inventory put{' '}<strong>Toronto at 315.0 MW</strong>{' '}and{' '}<strong>Montreal at 229.5 MW</strong>{' '}at the end of 2025, with only 29.6 MW and 6.4 MW respectively available to lease. Calgary is not a tracked market; eStruxture&rsquo;s footprint there is about{' '}<strong>35 MW</strong>{' '}today (CAL-1 and CAL-2) and reaches roughly 125 MW only when CAL-3 opens in the second half of 2026. Separately, a federal pitch deck put the country&rsquo;s current{' '}<strong>AI-specific</strong>{' '}data-centre capacity at about{' '}<strong>337 MW</strong>.
      </p>
      <p>
        Those two kinds of number are not additive, and it is worth being explicit about why, because the temptation to stack them is strong. The metro figures count commissioned, multi-tenant colocation megawatts across all workloads &mdash; cloud, enterprise, retail colocation, AI &mdash; in a market a broker tracks building by building. The federal figure counts AI-designated capacity nationally, including capacity inside self-built facilities that never appears in a colocation market table at all. Toronto and Montreal alone exceed 337 MW on the first definition, which would be nonsense if the two measured the same thing. They do not.
      </p>
      <p>
        The announced numbers live in a different unit. That same federal deck counted more than 20 GW of projects under planning or development nationally, and Canada&rsquo;s AI strategy estimates commercial demand around 5.5 GW by 2030. A single proposed campus, Wonder Valley, carries a headline figure of up to 7.5 GW on its own, more than twenty times the entire operating base. The temptation is to add these up into a Canadian total. That would be a mistake, and it is the mistake this whole chapter is written against.
      </p>
      <p>
        Proposal megawatts are not fungible with operating megawatts. Many of the largest numbers on the map are exempt from or pending regulatory review, dependent on gas plants that are not yet built, and stacked into an interconnection queue that cannot clear. The honest way to read the map is two-layered: a thin, real, mostly clean operating base in Quebec, Ontario, and B.C., and a vast, speculative, mostly Albertan proposal layer sitting on top of it.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Alberta is the epicentre, and it runs on gas</h2>
      <p>
        Nearly half the flagship map is in one province. Alberta holds 9 of the 20 projects, and it holds them for a specific reason: developers there have stopped waiting for a grid connection and started building their own power. Wonder Valley, the Beacon Indus campus, Bitdeer Fox Creek, AVAX One, and Meta&rsquo;s Sturgeon County site are all designed around on-site natural gas rather than the clean grid.
      </p>
      <p>
        The bottleneck behind that choice is stark. By early 2026 data centres had requested 21,085 MW of grid connection from the Alberta Electric System Operator, more than 90 percent of the province&rsquo;s entire existing generating capacity, against an interim cap that allows only about 1,200 MW of new large load to connect through 2028. The door is 1,200 MW wide and already fully allocated. So the Alberta cluster on this map is really a map of gas plants with data centres attached, which is exactly the inversion the power chapter examines in detail.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The project-type mix</h2>
      <p>
        Sorted by type rather than geography, the 20 projects break into 9 AI campuses, 4 hyperscale sites, 4 cloud regions, 2 sovereign AI factories, and 1 crypto facility. That looks like an AI-dominated map, and in ambition it is. But the type labels deserve suspicion at the edges.
      </p>
      <p>
        Some of the &ldquo;AI campus&rdquo; entries are crypto-to-AI pivots. AVAX One is a 10 MW micro-grid that pivoted from crypto, still at the front-end engineering stage. Bitdeer Fox Creek is classed as crypto in our data but built with an AI-ready design, the kind of dual-purpose framing that lets a bitcoin build present as an AI investment. The four cloud regions, meanwhile, are the most solid entries on the map precisely because they are the least new: AWS, Google, and Microsoft footprints that were expanding for enterprise cloud long before the AI boom. Reading the type mix honestly means separating genuine hyperscale AI (Meta, eStruxture with CoreWeave) from cloud infrastructure that has been relabelled AI, and from crypto that has been repositioned as AI.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The rejections are part of the map</h2>
      <p>
        A map of announcements would miss the projects that did not survive contact with a regulator or a community. Those rejections are as much a feature of the Canadian boom as the flagship builds.
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Synapse, Olds, Alberta (rejected).</strong>{' '}A roughly $10 billion project, which would have been Canada&rsquo;s largest, tied to a 1.4 GW gas plant. The Alberta Utilities Commission denied the application in March 2026, citing missing information and inadequate public consultation. The proponent can reapply.</li>
        <li><strong>Hyperscale campus near Winnipeg, Manitoba (rejected).</strong>{' '}A proposed 500 MW site that the premier turned down, saying hyperscale data centres did not appear to be in the best interests of Manitobans given energy demand and environmental cost against limited benefit.</li>
        <li><strong>Steelport, Hamilton, Ontario (denied, under appeal).</strong>{' '}The committee of adjustment denied the land severance for a feared waterfront data centre after roughly 1,688 public comments, and the city moved toward a moratorium. The developer is appealing.</li>
        <li><strong>Wonder Valley, Alberta (advancing, but review waived).</strong>{' '}Not a rejection but its inverse: the province deemed the up-to-7.5-GW campus exempt from a provincial environmental impact assessment, a decision that is itself the controversy.</li>
      </ul>
      <p>
        The pattern is that Canadian communities and regulators are winning some fights and losing others, and the outcomes cluster by province. Alberta approves and exempts; Manitoba and Nova Scotia defer or refuse outright; Ontario and New Brunswick fight it out parcel by parcel.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The takeaway</h2>
      <p>
        Draw the map honestly and it splits into two layers that should never be added together. The bottom layer is small, real, and mostly clean: 315.0 MW of tracked colocation inventory in Toronto, 229.5 MW in Montreal, and about 35 MW in Calgary at the end of 2025, anchored by cloud regions and a handful of Quebec campuses on hydro power. The top layer is enormous, speculative, and mostly Albertan: more than 20 GW of proposals, led by a single 7.5 GW campus, much of it gas-powered, several projects exempt from or pending review, and a real count of rejections underneath.
      </p>
      <p>
        The corridors tell you where the two layers meet. Quebec and Ontario carry the operating base on clean grids. Alberta carries the proposal layer on private gas. British Columbia is trying to build a sovereign cluster inside a capped allocation. And everywhere the same discipline applies: tag every project by status, deduplicate the phases and rebrands, and never let a press-release gigawatt masquerade as an operating one. Do that, and the boom is real but far smaller, far more concentrated, and far less clean than the headline numbers suggest.
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
        Primary and reputable secondary sources: company and operator announcements (Meta Data Centers, eStruxture, Vantage Data Centers, QScale, TELUS, AWS, Google Cloud, Microsoft, Bitdeer, O&rsquo;Leary Ventures); the Alberta Major Projects registry and the Impact Assessment Agency of Canada (project scope and status); AESO (large-load framework and connection requests); ISED and the Canadian Press (the January 2026 pitch deck and current-capacity figure); ISED&rsquo;s National AI Strategy (2030 demand); Hydro-Qu&eacute;bec, BC Hydro, and IESO (grid and provincial context); Canada&rsquo;s National Observer, The Narwhal, CBC News, Global News, and DataCenterDynamics (the Synapse, Manitoba, Hamilton, Lorneville, and Wonder Valley controversies); and CBRE Research with CBRE Data Center Solutions for the commercial-market layer &mdash; the 300-plus national facility count (<em>Power Surge</em>, February 2026), the Toronto and Montreal H2 2025 inventory and availability figures (published March 2026), and the QScale L&eacute;vis and CoreWeave GTA findings (Toronto and Montreal market profiles, H1 2025). CBRE tracks commissioned colocation inventory, which is a narrower measure than &ldquo;all data-centre capacity&rdquo; and a different one from the federal AI-specific estimate.
      </p>
    </SeriesChapter>
  )
}
