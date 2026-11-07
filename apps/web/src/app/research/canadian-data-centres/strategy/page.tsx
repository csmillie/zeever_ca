import type { Metadata } from 'next'
import SeriesChapter from '@/components/SeriesChapter'
import { FAQPageJsonLd } from '@/components/JsonLd'
import { getChapter, chapterUrl, CBRE_UPDATE_DATE, POLICY_UPDATE_DATE } from '@/lib/aiInfrastructureSeries'

const chapter = getChapter('strategy')!
const PAGE_URL = chapterUrl('strategy')
const DESCRIPTION =
  "Canada has the ingredients for AI infrastructure: clean power, cold climate, water, stable capital. What it lacks is coordination, and that is fixable."

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
    question: 'Could Canada connect AI data centres faster without building gas plants?',
    answer:
      "Probably, for part of the load, by selling faster connections to data centres that accept curtailment. Work by Duke University's Nicholas Institute found the U.S. grid could absorb about 76 GW of new load, roughly a tenth of national peak demand, at an average annual curtailment of 0.25 percent, without new generation or transmission. The IEA recommends the same mechanism: non-firm connections offered in return for demand response. The economics are workable but bounded. On our calculation, electricity is only about five percent of an AI facility's revenue per megawatt, so shallow flexibility of a quarter to half a percent is close to free and belongs in the connection agreement, while even free electricity would fund only about five percent curtailment. Deeper or seasonal flexibility has to be bought as a capacity service instead.",
  },
  {
    question: 'Does Canada already have an AI infrastructure strategy?',
    answer:
      "It has pieces of one. Budget 2024 announced a $2.4 billion AI package, including a $2 billion Canadian Sovereign AI Compute Strategy split into up to $700 million for private data centres, up to $1 billion for public supercomputing, and an AI Compute Access Fund, initially $300 million and since expanded. Budget 2025 added roughly $926 million more for sovereign public compute. What is missing is coordination: interconnection speed, a usable sovereign cloud, and national siting, water, and emissions rules.",
  },
  {
    question: 'What is the difference between sovereign compute and a sovereign cloud?',
    answer:
      "Sovereign compute is the hardware: data centres and supercomputers physically located in Canada, which the federal strategy funds directly. A sovereign cloud is the usable service layer on top, hosting, training, and deployment under Canadian legal jurisdiction. CIGI argues Canadian firms still lack a sovereign, enterprise-ready cloud even with the compute money committed. Three US firms hold about 85 percent of Canada's public cloud market, so most workloads still run on foreign-controlled platforms regardless of where the servers sit.",
  },
  {
    question: 'Why does interconnection speed matter more than clean power?',
    answer:
      "Because clean electrons that cannot be connected do not power anything. Alberta is sitting on more than 21,000 MW of data-centre requests against a 1,200 MW cap through 2028, so developers are building private gas plants to skip the queue. Quebec, B.C., and Manitoba all have clean grids but are now rationing access through pricing, capped competitive calls, and outright rejections. The binding constraint is how fast new load can be energized, not whether the electrons are clean.",
  },
  {
    question: 'Is the announced sovereign-compute money actually deployed?',
    answer:
      "Not yet, and that distinction is the whole point. The AI Sovereign Compute Infrastructure Program committing roughly $890 million to a public supercomputer only closed applications on June 1, 2026, and the AI Compute Access Fund is currently closed. Announced funding is a commitment, not built capacity. Until the money moves and the machines run, the strategy exists on paper, against a national demand estimate of about 5.5 GW of commercial AI compute by 2030.",
  },
  {
    question: 'Where does Canadian capital fit into a real strategy?',
    answer:
      "Canadian pension and infrastructure funds are already deep in AI infrastructure: CPP Investments holds a 37.5 percent stake in a US$15 billion data-centre joint venture (roughly US$5.6 billion of its own capital), has committed US$1.75 billion alongside EQT, and put C$225 million into an Ontario project. Brookfield runs a roughly US$100 billion program, and CDPQ has financed Vantage’s Quebec campus. The catch from earlier chapters is that much of this capital builds data centres abroad. A real strategy would give that money reasons to build energized, disclosed, clean-powered capacity at home rather than exporting it.",
  },
]

export default function Page() {
  return (
    <SeriesChapter
      slug="strategy"
      description={DESCRIPTION}
      updated={[
        {
          date: POLICY_UPDATE_DATE,
          note: (
            <>
            The largest revision in this pass, and it changes an argument rather than a figure. This chapter said all
            four gaps are coordination failures rather than shortages of a physical input. The September 2026
            announcements produced a case that is not one. Ottawa&rsquo;s Responsible Data Centre Development Principles
            and Ontario&rsquo;s proposed Playbook are not two parties failing to convene; they are two governments with
            different objective functions and non-overlapping powers, and a new section says so, along with the
            uncomfortable corollary that this series&rsquo; own jobs-per-megawatt figure works against the federal
            target. Also adds the 850 MW federal pipeline, Ontario&rsquo;s proposed rate class, and corrects the AI
            Compute Access Fund figure.
            </>
          ),
        },
        {
          date: CBRE_UPDATE_DATE,
        note: (
          <>
            Adds what the competitive target now looks like: CBRE&rsquo;s shift toward 500 MW-plus AI campuses, interconnection
            running 24 to 48-plus months, and at least 36 U.S. states offering targeted incentives, set against Alberta&rsquo;s
            1,200 MW door, B.C.&rsquo;s 400 MW call and Quebec&rsquo;s 5 MW threshold. CBRE&rsquo;s view that Canada&rsquo;s
            grid could reach a breaking point is included as industry commentary, attributed as such.
            A later pass on 24 August added a fifth strategic front: paying for flexibility rather than buying firmness.
            It covers sorting data centres by workload rather than size, selling faster connections in exchange for
            curtailment, the ceiling on what an energy-rate discount can fund, and putting a non-emitting condition on
            the dedicated generation Alberta&rsquo;s regulation already contemplates.
            Updated 25 August: the disclosure recommendation now asks for metering first and disclosure second, citing
            the ISO/IEC 30134-9:2022 water metric NRCan has already adopted and the EU reporting regime in force since
            September 2024.
          </>
        ),
        },
      ]}
    >
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm text-gray-700">
          <strong className="text-zeever-text">The short version.</strong>{' '}Canada has the raw ingredients almost every other country wants: clean power, a cold climate, abundant water, political stability, and deep pools of patient capital. What it does not have is a strategy that turns those ingredients into advantage. The compute money is announced but barely deployed, the sovereign cloud does not exist, the grid cannot connect new load fast enough, and there are no national rules on siting, water, or emissions. This closing chapter pulls the ten before it into one question: what would a real Canadian AI infrastructure strategy actually have to do?
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The ingredients are real</h2>
      <p>
        Start with the good news, because it is genuinely good. On the raw inputs, Canada is one of the best-positioned countries in the world to host AI compute, and the earlier chapters documented why.
      </p>
      <p>
        The power is clean where it flows. Quebec&rsquo;s grid runs around 1.2 gCO2/kWh, against roughly 470 in Alberta and far higher across most of the United States. The climate cuts cooling loads for much of the year. Water is abundant in most of the country. The country is politically stable, has a strong rule-of-law tradition, and hosts serious AI research talent. And the capital is already committed: CPP Investments holds a 37.5 percent stake in a US$15 billion data-centre joint venture (roughly US$5.6 billion of its own capital), has committed US$1.75 billion alongside EQT, and put C$225 million into an Ontario project. Brookfield runs a program near US$100 billion, and CDPQ has financed Vantage&rsquo;s Quebec campus. The ingredients list is not the problem.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The missing pieces are all about coordination</h2>
      <p>
        The problem is that Canada has never assembled the ingredients into a coherent whole. Four gaps recur across every chapter of this series, and three of them are coordination failures rather than shortages of any physical input. The fourth, added after the September 2026 policy announcements, is not a coordination failure at all, and calling it one was a mistake this chapter made until now.
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Interconnection speed.</strong>{' '}Chapter 4 was blunt: the scarce input is a grid connection, not clean electrons. Alberta is sitting on more than 21,000 MW of data-centre requests against a 1,200 MW cap through 2028, so developers build private gas plants to skip the queue. Even the clean-power provinces are rationing: Quebec through a roughly 13 cent per kWh data-centre rate (proposed and pending approval by the R&eacute;gie de l&rsquo;&eacute;nergie, effective in the second half of 2026 pending that approval) and competitive selection above 5 MW, B.C. through a capped 400 MW call plus a crypto ban, Manitoba by rejecting a 500 MW campus outright. Ontario has no hard cap but expects only about 16 new data centres to connect over ten years, and in August 2026 proposed a Playbook that would screen projects on three pillars and move large loads into their own rate class, potentially above 1 MW.</li>
        <li><strong>Sovereign cloud, not just sovereign compute.</strong>{' '}Chapter 7 drew the line: funding hardware inside Canada does not make the workloads on it Canadian-controlled. Three US firms hold about 85 percent of Canada&rsquo;s public cloud market, and Ottawa itself has spent roughly C$1.3 billion on US cloud since 2021, most of it to Microsoft. Under the US CLOUD Act, data sovereignty is about legal jurisdiction and corporate control, not storage location.</li>
        <li><strong>Deployment, not announcement.</strong>{' '}The $2 billion Sovereign AI Compute Strategy is real, but as of mid-2026 the flagship public-supercomputer program had only just closed applications and the SME compute fund was closed. Announced is not built.</li>
        <li><strong>Disclosure standards.</strong>{' '}Chapter 6 found a black hole: no Canadian project publishes measured water use, and three-quarters of planned Alberta sites sit in high water-stress basins. Chapter 4 showed emissions estimates for gas-supported capacity diverging by three to four times because there is no common reporting standard.</li>
      </ul>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Sovereign cloud, sovereign compute, or both?</h2>
      <p>
        The sharpest strategic question in the whole series is what &ldquo;sovereignty&rdquo; even means here, because the two things the word gets attached to are not the same.
      </p>
      <p>
        Sovereign compute is the physical layer: data centres and supercomputers on Canadian soil. That is what the federal strategy actually funds, up to $700 million for private data-centre investment, up to $1 billion for public supercomputing, and the roughly $890 million AI Sovereign Compute Infrastructure Program that grew out of it. A sovereign cloud is the service layer on top: the platform enterprises and government departments actually deploy on, operating under Canadian legal jurisdiction. CIGI&rsquo;s April 2026 assessment called the $2 billion strategy a meaningful start but warned that Canadian firms still lack a sovereign, enterprise-ready cloud to host, train, and deploy models under Canadian control.
      </p>
      <p>
        That is the gap in a sentence. You can build all the sovereign compute you want, but if the workloads run on a foreign hyperscaler&rsquo;s platform, the data on them stays exposed to foreign legal access. The Privacy Commissioner&rsquo;s own cross-border guidance says an organization stays accountable for data sent abroad but cannot override a foreign court or national-security order. Residency is not sovereignty.
      </p>
      <p>
        The honest answer is both, in sequence. Compute without a usable cloud layer is a warehouse of machines that Canadian firms cannot easily deploy on. A cloud mandate without domestic compute is a promise with nowhere to run. But of the two, the cloud layer is the harder and more neglected half, and it is the one the current strategy barely touches. The Dais put the risk plainly: spend the compute money without an intermediary evaluating long-term impact, and Canada could subsidize capacity that crowds out the very domestic firms it is meant to help.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What a real strategy would do</h2>
      <p>
        Pulling the threads together, a strategy worthy of the name would move on five fronts at once. None of these requires inventing a new advantage. Each is about converting an ingredient Canada already has into capacity that actually exists.
      </p>
      <ol className="list-decimal pl-6 space-y-2 text-sm">
        <li><strong>Reform the interconnection queue.</strong>{' '}The binding constraint is connection speed, so fix that first. Faster, transparent large-load processes, clear rules on behind-the-meter gas, and coordinated transmission planning would do more than any subsidy. As long as the fastest path to power is a private gas plant, the clean-grid pitch keeps getting written in natural gas, and on a baseload assumption that could add tens of megatonnes to national emissions.</li>
        <li><strong>Actually deploy the sovereign-compute money, and add a cloud mandate.</strong>{' '}The $2 billion is announced; the job is to move it, then close the cloud gap on top. That means a usable, enterprise-ready sovereign cloud layer and procurement rules that stop Ottawa&rsquo;s own C$1.3 billion cloud spend from flowing almost entirely to US hyperscalers. The AI Compute Access Fund already tilts SMEs toward Canadian compute, with non-Canadian compute becoming ineligible for support in April 2027. That logic should extend to the cloud layer.</li>
        <li><strong>Set clean-power siting rules.</strong>{' '}Match load to clean supply deliberately instead of letting gas fill the gap by default. Direct new compute toward provinces and sites with genuine clean headroom, price access to reflect scarcity as Quebec is already doing, and treat interconnection as a national planning question rather than eleven separate provincial ones.</li>
        <li><strong>Pay for flexibility instead of buying firmness.</strong>{' '}Sell faster connections to loads that accept curtailment, sort data centres by workload rather than size, and put a non-emitting condition on the dedicated generation Alberta already requires. The section below works this through, including what flexibility costs and where the energy rate stops being able to fund it.</li>
        <li><strong>Meter first, then mandate disclosure.</strong>{' '}You cannot manage what no one measures, and in at least one case nobody is measuring: AWS&rsquo;s Varennes facility has run since 2018 without a water meter, so the municipality has no figure to release. A disclosure rule assumes the number exists. Require instrumentation to a defined standard &mdash; water usage effectiveness under ISO/IEC 30134-9:2022, which Natural Resources Canada has already adopted &mdash; and then require reporting of measured withdrawal and consumption plus standardized emissions for gas-supported capacity. The European Union has required exactly this of operators above 500 kW since September 2024; Canada has the metric and the precedent and uses neither. Done properly it also collapses the three-to-four-times spread in today&rsquo;s emissions estimates into a single audited number. The same gap runs through employment. Statistics Canada has no NAICS code for data centres: the closest subsector lumps gigawatt campuses in with web hosts and one-person consultancies, so no Canadian government can say what these facilities actually employ. A reporting category, plus a condition that publicly supported projects report payroll after opening rather than projections at announcement, would cost almost nothing and would settle an argument currently conducted entirely on press releases.</li>
      </ol>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Pay for flexibility instead of buying firmness</h2>
      <p>
        The four fronts above are the conventional list. There is a fifth that almost no Canadian instrument currently uses, and it is the one that would do the most to stop the gas build described in chapter four.
      </p>
      <p>
        Start from what a behind-the-meter gas plant is actually for. It is a hedge. It is bought to guarantee absolute firmness against interconnection delay and curtailment risk. If a load does not need absolute firmness, the hedge has nothing left to protect, and the reason to build the plant weakens considerably. The question is therefore not how to generate more electrons quickly, but how much firmness these loads genuinely require and what the alternative is worth to them.
      </p>

      <h3 className="text-base font-semibold text-zeever-text pt-2">Define two classes of data centre, not one</h3>
      <p>
        Alberta&rsquo;s Data Centre Regulation sorts projects by size: &ldquo;large&rdquo; means a maximum demand at or above 75 MW. Size is the wrong axis. A training campus and an inference node want opposite things from a grid. Training is batch work that checkpoints, so it can be paused and resumed, it can sit anywhere, and what it needs from a system is{' '}<em>energy</em>. Inference serves users in milliseconds, has to sit near them, follows the human daily cycle, and needs{' '}<em>firmness</em>{' '}&mdash; but in blocks of one to twenty megawatts rather than hundreds.
      </p>
      <p>
        Sorting by workload rather than size would let a system operator give the flexible class a different connection product, and stop applying a framework designed for gigawatt campuses to a 5 MW inference site in a city that could be absorbed tomorrow.
      </p>

      <h3 className="text-base font-semibold text-zeever-text pt-2">Sell speed in exchange for flexibility</h3>
      <p>
        Work at Duke University&rsquo;s Nicholas Institute found that the United States grid could absorb about{' '}<strong>76 GW of new load</strong>, roughly a tenth of national peak demand, at an average annual curtailment of{' '}<strong>0.25 percent</strong>{' '}&mdash; without new plants or new lines. The IEA reaches the same policy conclusion from the other direction, recommending that system operators explore non-firm grid connections and &ldquo;incentivise data centre developers to provide demand response in return for faster connection processes.&rdquo;
      </p>
      <p>
        Canada has the raw material for this and uses none of it. Alberta already requires bridged data centres to be curtailed ahead of all other load, but treats that as a reliability backstop rather than as something a developer can buy faster access with. Nobody in this country currently offers the trade: accept curtailment, connect sooner, skip the gas plant.
      </p>

      <h3 className="text-base font-semibold text-zeever-text pt-2">Know what flexibility costs, because it is not free</h3>
      <p>
        The trade only works if it is priced honestly, and the arithmetic sets a hard ceiling that is rarely stated. On our own calculation, using roughly $13 million of annual compute revenue per megawatt and power at C$80 per megawatt-hour, an hour of uptime is worth about $1,500 per MW while the entire annual power bill is about $700,000 per MW. Electricity is around five percent of revenue.
      </p>
      <p>
        That cuts both ways. Duke-scale flexibility of a quarter to half a percent costs $32,000 to $65,000 per MW a year, a small fraction of the power bill, so it is close to free and should be a standard condition of connection rather than a negotiated concession. But even giving the electricity away entirely would only fund about{' '}<strong>5 percent</strong>{' '}curtailment. Anything deeper &mdash; a seasonal winter throttle, for instance &mdash; cannot be paid for through the energy rate and has to be purchased as a capacity service, the way a peaking plant is. The IEA makes the same point in blunter form: an AI data centre is roughly ten times more capital-intensive than an aluminium smelter, which makes curtailing it correspondingly more expensive.
      </p>
      <p>
        The design rule that falls out is simple. Shallow, frequent flexibility belongs in the connection agreement. Deep or seasonal flexibility needs a capacity payment. Confusing the two produces schemes that developers will not sign.
      </p>

      <h3 className="text-base font-semibold text-zeever-text pt-2">Put a fuel condition on the tether</h3>
      <p>
        Alberta&rsquo;s regulation already contemplates &ldquo;tethered&rdquo; data centres paired with dedicated generation. The mechanism exists; what is missing is any condition on what the tether is made of. A tethered gas plant and a tethered wind farm with storage are treated identically, and the levy structure actively favours the former, charging two percent for grid-connected sites, one percent for those that generate their own power, and nothing at all off-grid.
      </p>
      <p>
        Requiring the tether to be non-emitting and available at peak, technology-neutral as between hydro, nuclear, geothermal and firmed renewables, would use machinery that is already in force. Two design cautions apply. Specifying a technology rather than an outcome produces the wrong build: matching a gigawatt of flat load with solar alone would take five to six gigawatts of nameplate and tens of thousands of acres, and would still leave the site on gas in January. And matching should be hourly and additional, since annual matching is what allows a campus to claim it runs on renewables while burning gas overnight, and buying existing hydro allocations simply reshuffles clean power that was already serving somebody.
      </p>

      <h3 className="text-base font-semibold text-zeever-text pt-2">What this claims, and what it does not</h3>
      <p>
        One honest limit. Inference is probably the larger and faster-growing share of AI{' '}<em>energy</em>, on the thin evidence surveyed in chapter five, so a strategy built on interruptible training does not address the majority of AI electricity demand. What it does address is the problem actually in front of Canadian system operators: the gigawatt-scale greenfield campuses filling the connection queues and driving the gas build. That is a narrower claim, and it is the one the evidence supports.
      </p>
      <p>
        The prize for getting it right is a different competitive position. Canada cannot win a race for 500 MW of firm capacity delivered in 24 months; chapter two showed why, and the answer does not change. But the cheapest clean training compute in North America, available to anyone willing to accept interruption, is a different product rather than a worse version of the American one. It runs on exactly what this country has in surplus, which is clean energy without firm winter capacity, and it is the one version of this trade where the environmental outcome and the developer&rsquo;s own incentive point in the same direction.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Ottawa and Ontario are not failing to coordinate</h2>

      <p>
        Everything above this section treats Canada&rsquo;s problem as a missing convener: the ingredients exist, nobody
        has written the recipe. September 2026 produced a case that does not fit, and it is worth separating from the
        others rather than folding it in.
      </p>

      <p>
        On 3 September Ottawa launched Canada&rsquo;s Responsible Data Centre Development Principles, a national
        framework with five expectations: create lasting local benefits, do not shift electricity costs onto Canadians,
        minimise water use and environmental impact, be transparent about local impacts, and deliver strategic value to
        Canada. The signatories run from AWS, Google, Meta, Microsoft, OpenAI and Anthropic through to Bell, TELUS,
        Cohere, Cologix, Equinix and OVHcloud. Three weeks earlier Ontario had proposed its Data Centre Playbook, which
        would screen projects on economic development, digital sovereignty and community benefits, and move large new
        loads into their own electricity rate class.
      </p>

      <p>
        Read side by side, the two look aligned. Ratepayer protection appears in both. Sovereignty appears in both.
        Community benefit appears in both. That reading is too comfortable.
      </p>

      <p>
        Ottawa&rsquo;s objective is denominated in gigawatts: 5.5 GW of commercial AI compute by 2030, and partnerships
        proposing 850 MW with 2.3 GW behind it. Ontario&rsquo;s objective is denominated in cost per ratepayer and jobs
        per megawatt. There is no exchange rate between those two currencies, and no institution empowered to set one.
        Ottawa can fund, sign memoranda and publish principles. It cannot energise a single megawatt, because
        electricity is provincial. Ontario controls the wire, carries the ratepayer, and has no stake in a national
        capacity target.
      </p>

      <p>
        That is not a coordination failure. A convener does not fix two governments with different objective functions
        and non-overlapping powers. Only a change in one side&rsquo;s incentives does.
      </p>

      <p>
        There is an uncomfortable corollary for this series. If Ontario screens projects on economic development, the
        number that loses data centres the screen is the one in chapter ten: roughly 0.2 to 0.35 permanent jobs per
        megawatt, against something like eight for a battery plant. Our own arithmetic, applied by a provincial
        regulator, works directly against the federal target. We would rather state that plainly than leave it implied.
      </p>

      <p>
        Which produces a prediction that can be checked. Ontario is proposing to price large loads at full cost
        causation, potentially from 1 MW upward. Alberta offers queue priority and levy relief for bring-your-own-power:
        two percent for grid-connected, one percent for self-generating, zero for off-grid. If both regimes hold, the
        federal 5.5 GW gets built in Alberta, on gas. Ottawa&rsquo;s own second and third principles say it wants
        neither cost-shifting nor avoidable environmental impact, and the two provincial regimes acting together produce
        exactly the outcome those principles disclaim, with no federal instrument standing in the way.
      </p>

      <p>
        The mechanism that would resolve it is already in this chapter, aimed at the wrong target. The flexibility
        argument above is written as a response to Alberta&rsquo;s gas build, but it is the only instrument that pays
        both governments at once: Ottawa gets megawatts, Ontario avoids building peak capacity it must then recover from
        ratepayers, and the proposed rate class gains a flexible tier instead of a flat penalty on size. A rate class
        that sorts by megawatts asks how big you are. One that sorts by curtailability asks what you are willing to give
        back, which is the question worth pricing.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Announced is not the same as funded and built</h2>
      <p>
        The single most important distinction in this chapter, and the one the headlines routinely blur, is between a strategy that has been announced and a strategy that has been funded, deployed, and built.
      </p>
      <p>
        On paper Canada looks busy. Budget 2024&rsquo;s $2.4 billion AI package, the $2 billion compute strategy, Budget 2025&rsquo;s roughly $926 million top-up, an SME compute fund, a call for data centres over 100 MW that has since produced partnerships proposing 850 MW by 2030 and as much as 2.3 GW beyond it. On the ground the picture is thinner. The flagship public-supercomputer program only closed applications on June 1, 2026. The AI Compute Access Fund is closed. Current national AI data-centre capacity sits around 337 MW against more than 20 GW &ldquo;under planning or development,&rdquo; a roughly 60-fold gap the government itself says will mostly never be built. The national demand estimate is about 5.5 GW of commercial AI compute by 2030. Announced capacity is cheap; energized, disclosed, sovereign capacity is the hard part, and that is what remains largely unbuilt.
      </p>
      <p>
        The same gap runs through the capital story. Canadian pension and infrastructure money is deep in AI infrastructure, but chapter 9 showed much of it building American data centres, not Canadian ones. A real strategy gives that patient capital reasons to build at home: fast connections, clear rules, and a cloud layer worth deploying on.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What competing would actually require</h2>
      <p>
        It is worth being concrete about the scale a serious Canadian bid would have to accommodate, because the target moved. CBRE&rsquo;s 2026 outlook describes a shift toward{' '}<strong>500-MW-plus AI campuses</strong>, developments large enough to need multiple on-site substations and multi-year construction schedules, with interconnection stretching to{' '}<strong>24, 36 or even 48-plus months</strong>{' '}wherever new transmission or generation is required. The competitive question is no longer whether a province can connect 50 MW. It is whether it can deliver 300 MW or more inside three years.
      </p>
      <p>
        Set that against what Canada currently offers. Alberta&rsquo;s interim door is 1,200 MW through 2028, already allocated to two projects. British Columbia&rsquo;s competitive call is capped at as much as 400 MW over its first two years. Quebec rations above 5 MW. On the American side,{' '}<strong>at least 36 states</strong>{' '}now offer targeted data-centre incentives, while CBRE&rsquo;s read of Canada&rsquo;s largest market names limited provincial incentives as a factor shaping where infrastructure lands. A single U.S. campus announcement can exceed a Canadian province&rsquo;s entire multi-year allocation.
      </p>
      <p>
        CBRE&rsquo;s own view &mdash; and it is a view, from a firm that sells data-centre services &mdash; is that Canada&rsquo;s affordable power, abundant energy and cool climate make it genuinely attractive, but that &ldquo;the country&rsquo;s power grid could reach a breaking point if demand continues to surge.&rdquo; That is the industry saying, in its own commercial interest, the same thing this series has argued from utility filings: the ingredient is real and the delivery system is not ready. A Canadian strategy that does not resolve interconnection speed is not a strategy. It is a brochure.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The takeaway</h2>
      <p>
        Across eleven chapters the through-line has held. The AI race is now an infrastructure race, and infrastructure is physical, slow, and local. Canada arrived at that race with an unusually good hand: clean power, cold air, water, stability, and capital. It has not yet learned to play it.
      </p>
      <p>
        The failures are not failures of raw endowment. They are failures of coordination: a grid that cannot connect load fast enough, so gas fills the gap; compute money announced but not deployed; a sovereign cloud that does not exist while foreign hyperscalers hold 85 percent of the market; and no common standard for what these facilities take from the water table or add to the air. Every one of those is fixable, and none of the fixes requires a new advantage Canada lacks.
      </p>
      <p>
        That is the hopeful reading of a hard story. The ingredients are in the pantry. What is missing is the recipe, the timing, and the will to actually cook. Until interconnection reform, deployed sovereign compute, a real cloud layer, clean-power siting, and disclosure standards move from slide decks to signed contracts, Canada will keep having the raw materials of an AI infrastructure advantage without ever quite having the advantage.
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
        Primary and reputable secondary sources: Duke University&rsquo;s Nicholas Institute (curtailment-enabled headroom); the IEA&rsquo;s{' '}<em>Energy and AI</em>{' '}work (non-firm connections in exchange for demand response, and the capital-intensity comparison with aluminium); Alberta&rsquo;s Data Centre Regulation and the associated levy structure; CBRE Research and CBRE Data Center Solutions (the shift toward 500 MW-plus campuses, interconnection timelines, and U.S. state incentives; the Canadian grid-strain assessment is CBRE&rsquo;s commentary, not a measurement); Innovation, Science and Economic Development Canada (the Canadian Sovereign AI Compute Strategy, the AI Compute Access Fund program guide, and the AI Sovereign Compute Infrastructure Program); the Prime Minister of Canada (Budget 2024 &ldquo;Securing Canada&rsquo;s AI advantage&rdquo;); the Centre for International Governance Innovation (the sovereign-cloud gap and the Budget 2025 top-up); The Dais at Toronto Metropolitan University (allocation critique); Borden Ladner Gervais and Osler (the CLOUD Act and data sovereignty); the Office of the Privacy Commissioner of Canada (cross-border transfer guidance); AESO, Hydro-Qu&eacute;bec, BC Hydro, and IESO (provincial queues and rationing); the Canada Energy Regulator (grid carbon intensity); CPP Investments, CDPQ, and Brookfield (the capital trail); and the ISED access-to-information deck reported by the Canadian Press (national capacity figures). This chapter synthesizes the ten that precede it.
      </p>
    </SeriesChapter>
  )
}
