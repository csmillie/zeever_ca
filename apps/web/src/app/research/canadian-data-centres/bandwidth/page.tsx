import type { Metadata } from 'next'
import SeriesChapter from '@/components/SeriesChapter'
import { FAQPageJsonLd } from '@/components/JsonLd'
import { getChapter, chapterUrl, CBRE_UPDATE_DATE } from '@/lib/aiInfrastructureSeries'

const chapter = getChapter('bandwidth')!
const PAGE_URL = chapterUrl('bandwidth')
const DESCRIPTION =
  "Canada's internet interconnection is a two-metro story. Toronto and Montreal are genuine hubs. Everywhere else is thin, and that shapes where AI compute sits."

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
    question: 'Where is Canada’s real internet interconnection?',
    answer:
      'In two metros. Toronto anchors the Toronto Internet Exchange (TorIX), Canada’s largest, which peaked around 2.3 Tbps in August 2024 with roughly 299 participants, all clustered at the 151 Front St W carrier hotel. Montreal anchors QIX, the second largest, with 108 networks and about 320 Gbps peak. No other Canadian city comes close. Ottawa, Calgary, Vancouver, Winnipeg, Edmonton, Halifax, Saskatoon, and Regina all run small regional exchanges.',
  },
  {
    question: 'Which Canadian metros have a hyperscaler cloud region?',
    answer:
      'Only four sites, and they cluster in two provinces. Toronto has Azure Canada Central and Google Cloud (northamerica-northeast2). Montreal has AWS Canada Central (ca-central-1, since 2016) and Google Cloud (northamerica-northeast1). Calgary has AWS Canada West (ca-west-1, launched December 2023). Azure Canada East sits in Quebec City. British Columbia, Manitoba, Saskatchewan, and Atlantic Canada have none.',
  },
  {
    question: 'Why does cross-border latency to Chicago and New York matter?',
    answer:
      'Because the nearest large interconnection and cloud markets for much of Canada are in the United States. Measured round-trip times put Toronto about 13.7 ms from Chicago and 14.3 ms from New York, and Montreal about 10 ms from New York. For Winnipeg, Chicago (16.9 ms) is actually closer than Toronto (21.8 ms). Where a workload can tolerate that path, U.S. hubs pull compute toward the border.',
  },
  {
    question: 'Can I trust the latency numbers in this analysis?',
    answer:
      'Treat them as directional, not canonical. Every latency figure here is a measured WonderNetwork round-trip ping average captured on a single date, so it reflects the route the traffic actually took, not a provider’s engineered one-way fibre path. Calgary to New York reads a notably high 87.8 ms, which reflects routing. Regina could not be measured at all because it has no WonderNetwork node, so Saskatoon values stand in for Saskatchewan.',
  },
  {
    question: 'Why don’t the B.C. and Halifax subsea cables have cloud regions near them?',
    answer:
      'They are gateways, not hubs. Vancouver Island hosts the landing for Google’s Topaz cable to Asia, and Halifax hosts a transatlantic cable to Ireland and the U.K. Both are strategically valuable as cable landings, but neither British Columbia nor Nova Scotia has a hyperscaler cloud region. A cable landing moves traffic across an ocean; it does not by itself create the dense local peering and cloud onramps that anchor compute.',
  },
]

export default function Page() {
  return (
    <SeriesChapter
      slug="bandwidth"
      description={DESCRIPTION}
      updated={{
        date: CBRE_UPDATE_DATE,
        note: (
          <>
            Adds a section on inference. CBRE&rsquo;s H1 2025 Toronto profile found AI capacity leasing beyond the traditional
            100 km radius of 151 Front Street West, with power availability and site security displacing latency, and its
            H2 2025 report describes inference driving demand for regional and distributed capacity. The two-metro thesis
            stands for serving users; it no longer holds as a constraint on where AI capacity gets built.
            A later pass on 24 August added the evidence behind the training and inference split, and how little of it
            there is: company-wide averages from Google and AWS, an IEA characterisation, and nothing Canadian or
            facility-specific at all.
          </>
        ),
      }}
    >
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm text-gray-700">
          <strong className="text-zeever-text">The short version.</strong>{' '}Power decides whether a Canadian AI campus can be energized. Fibre decides where it makes sense to put one. And Canada&rsquo;s real interconnection is a two-metro story. Toronto (TorIX, roughly 2.3 Tbps, all anchored at 151 Front St W) and Montreal (QIX, plus AWS and Google cloud regions) are genuine hubs. Everywhere else is thin. Cloud regions cluster in Ontario and Quebec, with a single AWS anchor in Calgary, while British Columbia, Manitoba, Saskatchewan, and Atlantic Canada have none, even where subsea cables land. Cross-border latency to Chicago and New York quietly shapes the map.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Fibre is the second infrastructure question</h2>
      <p>
        The last chapter argued that power is the binding constraint on Canadian AI data centres. Fibre is the next one. Once a site can be energized, the question becomes whether it can be reached: how densely it connects to other networks, how many cloud onramps sit nearby, and how far its packets have to travel to the markets that matter.
      </p>
      <p>
        That question splits along the two main AI workloads. Large-scale model training is relatively latency-tolerant. You can put a training cluster somewhere remote and cheap, feed it data in bulk, and wait. Inference, the serving of live answers to users, is the opposite: it is latency-sensitive, and it wants to sit close to interconnection and close to the people asking questions. Canada&rsquo;s fibre geography is generous to the first workload and stingy to the second, because dense interconnection exists in almost exactly two places.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The two real hubs: Toronto and Montreal</h2>
      <p>
        Toronto is the centre of gravity. The Toronto Internet Exchange (TorIX) is Canada&rsquo;s largest internet exchange, with a peak around 2.3 Tbps recorded in August 2024 and roughly 299 peering participants. Almost all of that density lives in one building, the 151 Front St W carrier hotel, which also houses Cologix&rsquo;s TOR1 and, by our dataset&rsquo;s description, more than 300 cloud onramps. Toronto pairs that peering fabric with two hyperscaler cloud regions: Azure Canada Central and Google Cloud&rsquo;s northamerica-northeast2. Its one notable gap is that there is no physically local AWS region; the nearest is Montreal.
      </p>
      <p>
        Montreal is the clear second. QIX, the Montreal internet exchange, is Canada&rsquo;s second largest, with 108 connected networks, 414 peer connections, and a peak above 320 Gbps recorded in October 2024, plus a Cologix meet-me room at 1250 Rene-Levesque and a Cologix footprint of roughly a dozen sites and about a million square feet. Montreal also carries two cloud regions: AWS Canada Central (ca-central-1, live since 2016) and Google Cloud&rsquo;s northamerica-northeast1 at Beauharnois. One labelling wrinkle is worth flagging: the Azure region called Canada East is physically in Quebec City, roughly 250 km northeast, not in Montreal.
      </p>
      <p>
        The distance between these two hubs is trivial. Measured round-trip latency between Toronto and Montreal is about 7.9 ms in either direction (7.90 ms Toronto to Montreal, 7.87 ms Montreal to Toronto). For practical purposes they behave like a single interconnection corridor. Everything in this chapter is really a story about how far the rest of the country sits from that corridor.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The cloud map is an Ontario and Quebec map, plus Calgary</h2>
      <p>
        Line up every hyperscaler cloud region in Canada and the concentration is stark. There are four region sites in total, and they sit in three cities across two provinces, with one outlier in a third:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li><strong>Toronto (Ontario):</strong>{' '}Azure Canada Central and Google Cloud (northamerica-northeast2, opened 2021).</li>
        <li><strong>Montreal (Quebec):</strong>{' '}AWS Canada Central (ca-central-1) and Google Cloud (northamerica-northeast1, since 2018).</li>
        <li><strong>Quebec City (Quebec):</strong>{' '}Azure Canada East, and Azure&rsquo;s expansion adds capacity here and in Toronto from the second half of 2026.</li>
        <li><strong>Calgary (Alberta):</strong>{' '}AWS Canada West (ca-west-1), the lone hyperscaler region outside central Canada, launched December 2023 with three availability zones and a planned CA$4 billion regional investment.</li>
      </ul>
      <p>
        That is the entire national cloud-region footprint. Ontario and Quebec hold every region except one, and Alberta holds that one. British Columbia, Manitoba, Saskatchewan, and all of Atlantic Canada have no in-country hyperscaler region at all. For a company that needs its data to live inside a named Canadian cloud region, the practical choice is Toronto, Montreal, Quebec City, or Calgary. Nothing else qualifies.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Everywhere else is thin</h2>
      <p>
        Outside the two hubs, interconnection thins out quickly, and the exchange sizes tell the story on their own:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Calgary</strong>{' '}has the strongest secondary position: the AWS ca-west-1 anchor plus YYCIX, a Calgary exchange with 71 peers and a peak around 50 Gbps whose members include AWS, Cloudflare, Meta, and Telus. Still, its interconnection density is far below Toronto or Montreal, and it leans on a single hyperscaler.</li>
        <li><strong>Ottawa</strong>{' '}runs OGIX, a small regional exchange with a government and enterprise focus, and has no hyperscaler region. Its saving grace is proximity to Montreal: about 4.4 ms away.</li>
        <li><strong>Winnipeg</strong>{' '}is a genuine east-west fibre crossroads on the Trans-Canada long-haul routes, served by MBIX, but again with no cloud region. It is closer to Chicago (16.9 ms) than to Toronto (21.8 ms).</li>
        <li><strong>Vancouver</strong>{' '}has Cologix at Harbour Centre and the VANIX and BCIX exchanges (with participant figures that vary by source and are best treated as unverified), yet no local hyperscaler region; the nearest is Seattle or Montreal.</li>
        <li><strong>Edmonton</strong>{' '}is the weakest of the Prairie metros, with YEGIX at roughly 10 peers and about 537 Mbps of average traffic, and no cloud region.</li>
        <li><strong>Saskatchewan</strong>{' '}(Saskatoon and Regina) runs small SaskTel-dominant exchanges and has no cloud region. Halifax runs the small HFXIX and likewise has none.</li>
      </ul>
      <p>
        The pattern is consistent: exactly two cities have deep, multi-carrier, multi-cloud interconnection, one city has a credible single-cloud anchor, and everyone else has a small regional exchange and a long-haul dependence on the hubs.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The subsea paradox: gateways without regions</h2>
      <p>
        Canada has two of the more strategically interesting cable landings in North America, and neither has translated into a nearby cloud region. That is the paradox worth sitting with.
      </p>
      <p>
        On the west coast, Google&rsquo;s Topaz cable, the first subsea link between Canada and Asia, lands at Port Alberni on Vancouver Island. It carries 16 fibre pairs and a design capacity around 240 Tbps, and came into service in 2023. On the east coast, Halifax is a transatlantic gateway: the EXA Express cable (formerly Hibernia Express), with a 53 Tbps design, runs from Halifax to Ireland and the U.K. and has been in service since 2015. These are real transoceanic on-ramps.
      </p>
      <p>
        And yet British Columbia and Nova Scotia both have zero hyperscaler cloud regions. Halifax&rsquo;s data-centre value is described in our dataset as limited domestically but strategic as a transatlantic gateway; Vancouver&rsquo;s is moderate to strong on the strength of Cologix and Topaz, but still without a local region. A cable landing is a pipe across an ocean. It is not the same asset as the dense local peering and cloud onramps that actually attract compute, which is why the gateways sit where the regions do not.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Cross-border gravity: Chicago and New York</h2>
      <p>
        For much of Canada, the nearest deep interconnection and cloud markets are in the United States, and the measured latencies show that gravity at work. From Toronto, Chicago is about 13.7 ms away and New York about 14.3 ms; both are comparable to Toronto&rsquo;s own 7.9 ms hop to Montreal, and well inside inference tolerances. From Montreal, New York is about 10 ms and Chicago about 20.8 ms. Winnipeg is the clearest case of cross-border pull: at 16.9 ms it reaches Chicago faster than it reaches Toronto.
      </p>
      <p>
        The Prairies and the coasts pay a distance penalty in every direction. Calgary&rsquo;s measured round-trips run 62.9 ms to Montreal, 66.2 ms to Chicago, 68.0 ms to Toronto, and a notably high 87.8 ms to New York. Vancouver sits around 52 to 66 ms to Toronto, Chicago, and New York alike. For a latency-tolerant training cluster, those numbers are fine. For latency-sensitive serving, they push inference back toward the two hubs or across the border, which is exactly the direction the cloud regions already lean.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">A caveat about these latency numbers</h2>
      <p>
        Every latency figure in this chapter deserves a warning label, and we would rather state it plainly than let the precision imply more than it should. These are measured WonderNetwork round-trip ping averages captured on a single date. That means they reflect the route the traffic actually took on that day, including any suboptimal peering or backhauling, not a carrier&rsquo;s engineered one-way fibre path. Route-dependence is visible in the data itself: Calgary to New York at 87.8 ms is higher than a straight fibre path would predict, and Winnipeg reaching Chicago faster than Toronto is a routing artifact as much as a distance fact.
      </p>
      <p>
        One region could not be measured at all. Regina has no WonderNetwork node, so its latencies could not be captured, and the Saskatchewan values shown are Saskatoon&rsquo;s standing in. Read these as directional evidence of where Canada is close and where it is far, not as canonical fibre-path specifications.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Inference is starting to redraw the map</h2>
      <p>
        This chapter&rsquo;s two-metro argument rests on a split between latency-tolerant training and latency-sensitive inference. That split is no longer theoretical, and the market data now cuts both ways.
      </p>
      <p>
        On the demand side, CBRE&rsquo;s read is that &ldquo;inference AI is redefining data center demand with a need for more regional and distributed data centers,&rdquo; and that inference workloads, because they sit close to end users, are &ldquo;reshaping site strategy and accelerating growth in secondary markets.&rdquo; If that holds, it is the most favourable structural trend in this series for Canadian cities outside Toronto and Montreal &mdash; Calgary, Edmonton, Winnipeg, Vancouver and Halifax do not need a world-class peering fabric to serve Canadian inference traffic; they need power and proximity.
      </p>
      <p>
        On the supply side, the same data undercuts part of the carrier-hotel story. CBRE found that the GTA saw significant AI-driven capacity leased{' '}<strong>beyond the traditional 100-kilometre radius of 151 Front Street West</strong>, describing a shift away from strict latency requirements toward power availability and site security. Nationally the pattern is the same: &ldquo;latency constraints are no longer limiting high-density data centers,&rdquo; with AI factories landing in places like West Des Moines that no interconnection map would have chosen.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">How big is each half? Nobody in Canada knows</h3>
      <p>
        The training-versus-inference split does a great deal of work in this chapter, and in the policy arguments built on it, so it is worth being blunt about how thin the evidence underneath it is. Nobody publishes a measured split for a specific facility. What exists is a handful of company-wide averages, mostly American, mostly old:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Google</strong>{' '}reported roughly{' '}<strong>60 percent inference to 40 percent training</strong>{' '}of its machine-learning energy, in work covering 2019 to 2021 &mdash; a window that closes before the large-language-model boom began.</li>
        <li><strong>AWS</strong>{' '}has said about{' '}<strong>90 percent</strong>{' '}of its AI compute demand is inference. A company statement, cloud-wide, with no published method.</li>
        <li>The{' '}<strong>IEA</strong>{' '}describes AI-workload servers as &ldquo;predominantly inference&rdquo; and expects them to account for almost half the net increase in global data-centre electricity between 2024 and 2030, without putting a number on the split.</li>
      </ul>
      <p>
        For Canada there is nothing at all. The federal 337 MW estimate is not broken down by workload, AESO&rsquo;s connection queue does not record what a load will compute, and neither the Cambridge site nor Sturgeon County has said. Reasoning models and test-time compute are pushing the ratio further toward inference in ways no public dataset captures.
      </p>
      <p>
        Two things follow. Inference is very likely the larger share of AI{' '}<em>energy</em>, and growing. But the gigawatt-scale greenfield campuses that dominate the connection queues are training-oriented, while inference is spread thinly across many small sites and existing cloud regions. Energy share and campus-connection share are different questions with different answers, and the arguments in chapter eleven are careful to claim only the second.
      </p>

      <p>
        The honest reading is that 151 Front Street still matters enormously for what it is &mdash; the place where Canadian networks actually meet &mdash; but it is no longer the gravitational centre for where AI compute physically sits. Two-metro interconnection remains the constraint on serving users well. It is no longer the constraint on building.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The takeaway</h2>
      <p>
        Canada&rsquo;s interconnection map is far more concentrated than its geography suggests. Two cities, Toronto and Montreal, hold the real peering density and, together with Quebec City and Calgary, all four of the country&rsquo;s hyperscaler cloud regions. The subsea gateways on the Pacific and the Atlantic are strategically valuable but have not seeded regions of their own. And a meaningful share of the nearest deep-market interconnection lives across the U.S. border, close enough that Chicago and New York exert real pull.
      </p>
      <p>
        For AI infrastructure the implication is direct. Latency-tolerant training can go almost anywhere the power allows, which is part of why the largest gas-powered proposals sit in remote Alberta. Latency-sensitive inference wants the hubs, and the hubs are few. If Canada wants its AI buildout to be more than a set of stranded training clusters, the fibre and cloud map has to widen beyond two metros. Right now it has not.
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
        Primary and reputable secondary sources: the IEA&rsquo;s{' '}<em>Energy and AI</em>{' '}work (data-centre electricity totals and the inference-weighted composition of AI server demand); published Google research and AWS statements (the only company-level training and inference splits available, both dated and neither facility-specific); CBRE Research and CBRE Data Center Solutions (AI capacity leasing beyond the 151 Front Street radius, and inference-driven regional and distributed demand; the edge-market outlook is CBRE&rsquo;s commentary); TorIX traffic statistics and Cologix (Toronto and Montreal facilities); the Montreal Internet Exchange (QIX); AWS, Microsoft Azure, and Google Cloud global-infrastructure and region pages (ca-central-1, ca-west-1, northamerica-northeast1 and northeast2, Canada Central and Canada East); CIRA and the Internet Society Pulse IXP tracker (OGIX, YYCIX, YEGIX, MBIX, VANIX, HFXIX, and the Saskatchewan exchanges); Google Cloud and Submarine Networks (the Topaz and EXA Express / Hibernia cable landings); and WonderNetwork ping measurements captured 2026-07-06 for all latency figures, which are route-dependent round-trip averages rather than canonical fibre-path values.
      </p>
    </SeriesChapter>
  )
}
