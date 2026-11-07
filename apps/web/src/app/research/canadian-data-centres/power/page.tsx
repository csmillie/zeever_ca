import type { Metadata } from 'next'
import SeriesChapter from '@/components/SeriesChapter'
import { FAQPageJsonLd } from '@/components/JsonLd'
import { getChapter, chapterUrl, CBRE_UPDATE_DATE, POLICY_UPDATE_DATE } from '@/lib/aiInfrastructureSeries'

const chapter = getChapter('power')!
const PAGE_URL = chapterUrl('power')
const DESCRIPTION =
  "The scarce input is a grid connection, not land, capital, or chips. Alberta is sitting on 21 GW of requests against a 1,200 MW cap, and gas is the workaround."

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
    question: 'Why is power the bottleneck and not chips, land, or money?',
    answer:
      "Chips can be shipped, land can be rezoned, and capital is plentiful. Canadian pension and infrastructure funds are actively deploying into AI infrastructure. What can't be conjured on demand is a firm, high-capacity grid connection. Alberta alone has about 21,000 MW of data-centre connection requests against a 1,200 MW interim cap through 2028, which makes interconnection the binding constraint.",
  },
  {
    question: 'How much data-centre capacity does Canada actually have versus plan to build?',
    answer:
      'A federal pitch deck from January 2026 put current AI data-centre capacity at about 337 MW, against more than 20 GW under planning or development. The government stresses that most of that pipeline will not be built. National commercial AI-compute demand is estimated at about 5.5 GW by 2030.',
  },
  {
    question: 'Why are Alberta data centres using natural gas if Canada has a clean grid?',
    answer:
      "Because the clean grid can't connect them fast enough, and because Alberta policy rewards them for it. With AESO's interim cap fully allocated, developers without a slot are building their own on-site generation to bypass the queue, including Wonder Valley (7.5 GW) and Beacon Indus (1,494 MW of reciprocating engines). Alberta’s Data Centre Regulation, in force since June 2026, also directs the AESO to prioritize projects that bring their own power, and levies large grid-connected ones. Meta is the exception that proves the rule: it holds one of the two Phase-1 grid allocations, and its 932 MW Greenlight plant does not run until 2030. Alberta's grid also runs far higher-carbon, around 424 to 470 gCO2/kWh (470 in 2023, roughly 424 after the 2024 coal phase-out), than Quebec's roughly 1.2.",
  },
  {
    question: 'How much would all this gas-fired capacity emit?',
    answer:
      "Estimates diverge by roughly three times. The federal government's own note put 18 GW of gas-supported capacity at about 20 Mt CO2e a year, roughly 3 percent of Canada's 2023 emissions, or about 1.1 Mt per gigawatt. The Pembina Institute's Wonder Valley analysis implies 3.4 to 4.1 Mt per gigawatt, which applied to 18 GW would be 60 to 70 Mt. Baseload gas physics favours the higher rate.",
  },
  {
    question: 'What environmental review applies when a data centre builds its own gas plant?',
    answer:
      "Less than most people assume. Alberta requires a mandatory environmental assessment for power plants using non-gaseous fuel at 100 MW or more, which means gas plants are not on the mandatory list at any size; assessment is discretionary. The federal Clean Electricity Regulations apply to fossil units of 25 MW or more that are connected to an electricity system, so a genuinely off-grid plant falls outside them, and section 14(1) exempts a unit from the emission limit in any year its facility's net supply is zero or less, which describes self-supplied generation exactly. Data centres are not in Alberta's Schedule of Activities at all, so the facility itself needs no environmental approval and TIER captures the co-located power plant instead, above 100,000 tonnes of CO2e a year. What does still apply: AUC approval of the plant, EPEA approvals and its section 109 release prohibition, Water Act licences, and federal impact assessment where a project is designated.",
  },
  {
    question: 'Which provinces have power headroom for AI?',
    answer:
      'On paper, the hydro provinces: Quebec, B.C., and Manitoba. In practice all three are now rationing. Quebec through a roughly 13 cent per kWh data-centre rate and paused crypto allocations, B.C. through a capped 400 MW competitive process and a crypto ban, and Manitoba by rejecting a 500 MW project outright as it nears peak capacity.',
  },
]

export default function Page() {
  return (
    <SeriesChapter
      slug="power"
      description={DESCRIPTION}
      updated={[
        {
          date: POLICY_UPDATE_DATE,
          note: (
            <>
            Adds Ontario&rsquo;s proposed Data Centre Playbook to the provincial rationing section. Announced in
            August 2026, it would screen projects on economic development, digital sovereignty and community benefits,
            and move large new loads into a separate electricity rate class, potentially those above 1 MW, so that the
            cost of serving them is not recovered from existing ratepayers. Consultation closes 12 September 2026 and
            nothing is final. The chapter previously said Ontario has no hard cap, which remains literally true and had
            started to imply the province rations only by scarcity. It is now proposing to ration by assessed value.
            </>
          ),
        },
        {
          date: CBRE_UPDATE_DATE,
        note: (
          <>
            Adds a section on how far the behind-the-meter workaround has spread: CBRE reports grid capacity booked through 2030
            across most North American markets, interconnection running 24 to 48-plus months, and bring-your-own-power now
            routine in utility load studies. The chapter&rsquo;s Alberta argument is unchanged, but it no longer implies the
            workaround is uniquely Canadian &mdash; what is distinctly Canadian is the carbon consequence. Also adds CBRE&rsquo;s
            finding on Toronto Hydro and Alectra power studies.
            Also corrects the Meta section. Meta is grid-first, not gas-first: it holds roughly 970 MW of Alberta&rsquo;s
            1,200 MW Phase-1 allocation, its data centre opens years before the Greenlight gas plant runs in 2030, and a
            Capital Power contract bridges from 2028. Two sections are new: the split between fast modular reciprocating
            engines and heavy-frame turbines whose slots now run past 2030, and why speed beats price, including
            Alberta&rsquo;s Bill 8 giving self-supplying projects priority in the connection queue.
            A later pass on 23 August added a section on the regulatory envelope: what environmental review a
            behind-the-meter gas plant actually has to pass, and where the Clean Electricity Regulations, Alberta&rsquo;s
            mandatory assessment list, the EPEA Schedule of Activities and municipal zoning each stop short. The
            self-supply queue priority is also correctly attributed to Alberta&rsquo;s Data Centre Regulation rather
            than to its enabling bill.
          </>
        ),
        },
      ]}
    >
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm text-gray-700">
          <strong className="text-zeever-text">The short version.</strong>{' '}The scarce input in Canada&rsquo;s AI data-centre boom isn&rsquo;t land, capital, or chips. It&rsquo;s a grid connection. Alberta&rsquo;s system operator is sitting on more than 21,000 megawatts of data-centre requests and will connect just 1,200 of them by 2028. So developers found a workaround: skip the clean grid and build their own natural-gas plants. In the process they are quietly inverting the clean-power advantage that was supposed to be Canada&rsquo;s whole pitch.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The constraint moved from chips to power</h2>
      <p>
        For two years the AI conversation was about GPUs. That bottleneck has moved. What now decides whether a Canadian AI campus gets built, and how fast, is whether the local grid can energize it.
      </p>
      <p>
        The gap is easiest to see in one pair of numbers. A federal pitch deck prepared for the AI Minister in January 2026 put Canada&rsquo;s current AI data-centre capacity at roughly 337 megawatts, against more than 20 gigawatts of projects &ldquo;under planning or development.&rdquo; That is a 60-fold gap between what exists and what has been announced. The government itself cautions that most of the 20 GW won&rsquo;t be built, which is exactly the point: the pipeline is enormous, and the grid is the filter that decides what survives. For scale, the national AI strategy estimates Canada will need about 5.5 GW of AI compute for commercial players by 2030.
      </p>
      <p>Announced capacity is cheap. Energized capacity is the hard part.</p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Alberta: a 21-gigawatt queue and a 1,200-megawatt door</h2>
      <p>
        Nowhere is the bottleneck sharper than Alberta, the epicentre of Canada&rsquo;s data-centre rush. By early 2026, data centres had requested 21,085 MW of grid connection from the Alberta Electric System Operator (AESO). That is more than 90 percent of the province&rsquo;s entire existing generating capacity.
      </p>
      <p>
        AESO&rsquo;s answer was a hard cap. Its interim large-load framework allows only about 1,200 MW of new large load to connect through 2028 without threatening grid reliability. That whole allocation is already spoken for. Phase 1 went to just two projects with signed load contracts: a 970 MW site (listed as &ldquo;P2936 GLDC Load&rdquo;) and the 230 MW Keephills data centre campus. Every other request in that 21 GW pile is deferred to a Phase 2 that has not been sized.
      </p>
      <p>
        So the math facing an Alberta developer is stark. Twenty-one gigawatts of ambition, a 1,200 MW door, and the door is closed. That single constraint explains almost everything else about how the boom is unfolding.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The gas inversion</h2>
      <p>
        Faced with a grid that can&rsquo;t connect them, developers stopped waiting for it. Alberta Premier Danielle Smith put it plainly to the Calgary Herald: &ldquo;If you want to move quickly, all roads lead to natural gas.&rdquo;
      </p>
      <p>
        They have. The largest projects in our dataset are built to run on on-site natural-gas generation, behind the meter, sidestepping the interconnection queue entirely:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li><strong>Wonder Valley</strong>{' '}(O&rsquo;Leary Ventures, near Grande Prairie): up to 7.5 GW, powered by off-grid gas.</li>
        <li><strong>Beacon AI Indus</strong>{' '}(near Calgary): a proposed 1,494 MW gas plant of 100 reciprocating engines to power the campus.</li>
        <li><strong>Bitdeer Fox Creek</strong>: a 101 MW on-site gas plant.</li>
        <li><strong>Synapse</strong>{' '}(Olds): a 1.4 GW gas plant, until the Alberta Utilities Commission rejected the application in March 2026 for missing information and inadequate consultation.</li>
      </ul>
      <p>
        This is the inversion worth sitting with. Canada&rsquo;s headline advantage in the global data-centre race was supposed to be an abundant, clean grid: Quebec, B.C., and Manitoba hydro, Ontario&rsquo;s low-carbon nuclear-and-hydro mix. Alberta&rsquo;s grid, by contrast, still runs around 424 to 470 gCO2/kWh (the 470 figure is from 2023; roughly 424 after the 2024 coal phase-out), against roughly 1.2 gCO2/kWh in Quebec. When the fastest path to power is a private gas plant in a high-carbon province, the &ldquo;clean Canada&rdquo; pitch starts writing itself in natural gas.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Meta is the emblem</h2>
      <p>
        The clearest expression of all this landed in July 2026, when Meta announced its first Canadian data centre, and its largest anywhere outside the United States, in Sturgeon County, Alberta. The number is more than CA$13 billion for a 1 GW facility.
      </p>
      <p>
        The obvious question is how you power a 1 GW load in a province with a 1,200 MW connection cap, and the intuitive answer is wrong. Meta did not route around the grid. It took one of the two Phase-1 allocations, roughly 970 MW of firm grid capacity, awarded under the one-time qualification process AESO ran before the cap was set. Meta&rsquo;s data centre is expected online within two to three years of the July 2026 announcement. Its dedicated gas plant, the Greenlight Electricity Centre, does not enter service until the second half of 2030. In between, Meta says it has rights to connect to Alberta&rsquo;s grid and may buy from other suppliers as needed; Capital Power has since signed a long-term agreement to make 250 MW available from the second half of 2028.
      </p>
      <p>
        Greenlight is real, and large: a CA$4.6 billion, 932 MW combined-cycle plant permitted to roughly double to 1.86 GW, built by Pembina Pipeline (47.5 percent), Morgan Stanley Infrastructure Partners (47.5 percent) and Kineticor (5 percent). But it is the second phase of the power plan, not the first. Read in the right order, the project says something sharper than &ldquo;hyperscaler builds gas plant.&rdquo; The one company big enough to secure a firm grid position took it, locked in a supply contract to bridge the gap, and is building its own generation for the decade after. Everyone behind Meta in the queue gets the third option only.
      </p>
      <p>
        One hyperscaler, one of the two scarce grid allocations, a bridging contract, a private gas plant for 2030, and CA$13 billion. That is the shape of the boom in miniature, and the order of those items is the part worth remembering.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Not all gas is fast gas</h2>
      <p>
        &ldquo;Building your own gas plant&rdquo; describes two completely different projects with about five years between them, and the distinction decides which developers can actually use the workaround.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">Heavy-frame turbines: slower than the grid</h3>
      <p>
        A large combined-cycle plant like Greenlight is not a fast option by any measure. Global turbine order books are full: GE Vernova&rsquo;s gas equipment backlog and slot reservations reached about 116 GW in 2026, and lead times on its larger frames now run roughly five to seven years, pushing delivery slots past 2030. That is why Meta&rsquo;s plant is a 2030 asset while its data centre opens years earlier. A developer choosing this route is not escaping a queue. They are joining a different one.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">Reciprocating engines: the actual workaround</h3>
      <p>
        The fast path is smaller, modular and unglamorous: banks of gas-fired reciprocating engines, the same machines that power remote industrial sites. They arrive as factory-built modules, scale by repetition rather than by size, and can be energized in months. VoltaGrid, which is behind the proposed Saint John project, ships its units in 25 MW packages and has said it can deploy up to 50 MW a month, ordering 1.5 GW of Jenbacher engines in 2026 for delivery through 2028. Beacon&rsquo;s Indus proposal is the Alberta expression of this: not one big plant, but <strong>100 reciprocating engines</strong>{' '}totalling 1,494 MW.
      </p>
      <p>
        So the honest version of the gas story is narrower than &ldquo;developers are building gas plants.&rdquo; Developers who need power within two years are installing engine farms. Developers with a decade-long horizon, or a grid slot to bridge the gap, are contracting for turbines. Only the first group is genuinely beating the interconnection queue.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Why speed beats price, and why Alberta pays you to skip the grid</h2>
      <p>
        There is an economic question underneath all of this. On-site generation means buying, fuelling and running a power plant you did not previously want to own. Why would that ever beat simply buying electricity?
      </p>
      <p>
        Because at AI-era revenue, electricity is close to a rounding error. A rough calculation, using our own assumptions rather than a published figure: one megawatt of facility power supports on the order of 900 current-generation accelerators once cooling and networking overhead are counted. At $1.50 to $2.50 per GPU-hour and high utilization, that megawatt can gross something like $10 to $17 million a year. The electricity to run it, at around C$80 per megawatt-hour, costs roughly C$700,000. Power is a few percent of revenue, while a year of delay on a 100 MW site forgoes something north of a billion dollars. Faced with those numbers, a developer will pay well over the odds for electrons that arrive sooner. Price is not the deciding variable. Time is.
      </p>
      <p>
        Alberta then adds a second incentive that has nothing to do with congestion. Behind-the-meter self-supply sidesteps the transmission tariff that grid-served load pays, and provincial policy goes further. The <strong>Data Centre Regulation</strong>{' '}under the Electric Utilities Act, in force since 9 June 2026, sets a framework for &ldquo;large&rdquo; data centres, meaning those with a maximum demand above 75 MW, and directs the AESO to <strong>prioritize projects that bring their own power</strong>{' '}over those seeking a grid connection. That priority comes paired with a new levy on large grid-connected data centres, and with the enabling legislation&rsquo;s assignment of transmission upgrade costs to proponents rather than to ratepayers generally. The AESO cap explains why developers started looking for another way to get power. Provincial policy explains why that other way is gas, and why choosing it improves your position in the queue you were trying to escape.
      </p>
      <p>
        Two caveats keep this from being a free ride. The Alberta Utilities Commission has placed real obstacles in front of pure self-supply arrangements. And as Bennett Jones notes, most large data centres want a grid connection regardless of what they build on site, because their reliability requirements exceed what an isolated plant can promise. In practice the pattern is not gas <em>instead of</em>{' '}the grid. It is gas <em>plus</em>{' '}the grid, with the mix set by whichever one shows up first.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The emissions math, and the dispute inside it</h2>
      <p>
        If 18 GW of Alberta capacity gets built on gas, what does it emit? Here the numbers split sharply depending on who is counting, and the gap itself is a finding.
      </p>
      <p>
        The government&rsquo;s own August 2025 briefing note estimated that 18 GW of gas-supported data centres would generate about 20 megatonnes of CO2e a year, roughly 3 percent of Canada&rsquo;s entire 2023 emissions. That works out to about 1.1 Mt per gigawatt.
      </p>
      <p>
        The Pembina Institute&rsquo;s analysis of Wonder Valley alone implies a rate three to four times higher. Its 7.5 GW would emit an estimated 25.7 to 30.5 Mt a year, or roughly 3.4 to 4.1 Mt per gigawatt. Phase 1&rsquo;s 1.4 GW alone comes to about 4.7 Mt a year, falling to about 1.3 Mt only if carbon capture runs at 80 percent efficacy, which is promised but not built. Apply Pembina&rsquo;s rate to the government&rsquo;s own 18 GW and you get 60 to 70 Mt, not 20.
      </p>
      <p>
        Which is right? Data centres run baseload, flat out, around the clock, and a gigawatt of baseload gas physically emits somewhere around 2.8 to 4 Mt a year at a high capacity factor. That range sits with Pembina. The government&rsquo;s 1.1 Mt per gigawatt looks low unless it assumes a modest capacity factor or working carbon capture. We flag both figures with their sources rather than pick one, but the direction is clear. On a baseload assumption, the official estimate likely understates the emissions, and Wonder Valley on its own would roughly erase the gains Alberta banked by phasing out coal.
      </p>
      <p className="pl-4 border-l-2 border-zeever-primary/30 text-gray-600 italic text-sm">
        One sourcing note: the Wonder Valley figure comes from a spreadsheet analysis by Pembina analyst Jason Wang, prepared for The Energy Mix in December 2025 and corroborated by Corporate Knights and Canada&rsquo;s National Observer. It is an analyst&rsquo;s workbook, not a peer-reviewed Pembina report, and should be cited that way.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What the gas route escapes</h2>
      <p>
        There is a question underneath the emissions arithmetic that gets asked less often than it should. If a gigawatt of gas generation is going to be built to run a data centre, what environmental review does it actually have to pass? For grid-served load the answer is reasonably well understood. For behind-the-meter generation it is thinner than most people assume, and the gaps are structural rather than accidental. Three of the main instruments have carve-outs that this exact design fits through.
      </p>

      <h3 className="text-base font-semibold text-zeever-text pt-2">The Clean Electricity Regulations may simply not apply</h3>
      <p>
        The federal Clean Electricity Regulations are the centrepiece of Canada&rsquo;s plan for a net-zero grid. Section 5(1) applies them to a generating unit that has a capacity of at least 25 MW, burns fossil fuel, and <em>&ldquo;is connected, directly or indirectly, to an electricity system.&rdquo;</em>{' '}A genuinely off-grid plant, which is what Wonder Valley proposes, does not meet the third condition at all.
      </p>
      <p>
        The larger opening is section 14(1). A unit is exempt from the emission limit for any calendar year in which the <strong>net supply from its facility is zero or less</strong>: generate power, consume it yourself, export nothing, and the limit does not bite. That is not an obscure edge case. It is the standard description of a data centre with its own generation. File a declaration of net supply and, under section 14(2), most of the quantification and reporting obligations fall away too.
      </p>
      <p>
        The regulations are not naive about fragmentation. Section 5(2) aggregates units under 25 MW commissioned on or after 1 January 2025 at the same facility, so a hundred small reciprocating engines cannot escape by being individually small. But aggregation and the net-supply exemption are different doors, and the second one is still open. It is also worth noting that the emission limit provisions are not yet in force, and when they arrive they start at 65 tonnes of CO2 per GWh for 2035 through 2049, reaching zero only in 2050.
      </p>

      <h3 className="text-base font-semibold text-zeever-text pt-2">Alberta does not require an environmental assessment for a gas plant</h3>
      <p>
        Provincial environmental assessment runs through the Environmental Protection and Enhancement Act and its Mandatory and Exempted Activities Regulation. An EA is mandatory for a power plant using <strong>non-gaseous fuel</strong>{' '}at 100 MW or larger. Gas-fired plants are not on the mandatory list at any size. They can be required to undergo an assessment at the discretion of a Director or the Minister, but nothing compels it.
      </p>
      <p>
        This reframes something the series has reported as a decision. Wonder Valley&rsquo;s exemption from a provincial environmental impact assessment was widely covered as the province waiving review for a favoured megaproject. It is better understood as the default: gas generation sits outside mandatory assessment in Alberta, and a discretionary review has to be actively ordered. The controversy is not that an exception was made. It is that the rule works this way.
      </p>

      <h3 className="text-base font-semibold text-zeever-text pt-2">The data centre itself is not a regulated activity</h3>
      <p>
        Data centres do not appear in EPEA&rsquo;s Schedule of Activities. No approval, registration or notice is required for the computing facility as such. Everything that regulates these projects attaches to something adjacent: the power plant, the water diversion, the release of a substance. The same definition governs Alberta&rsquo;s carbon-pricing system, so the TIER regime captures the co-located power plant rather than the data centre, and only once a facility passes 100,000 tonnes of CO2e a year. Below that, participation is voluntary.
      </p>
      <p>
        The practical effect is that Canada&rsquo;s largest new industrial electricity consumers are regulated entirely by proxy, through their inputs, and never as the thing they are.
      </p>

      <h3 className="text-base font-semibold text-zeever-text pt-2">And municipal zoning can be overridden</h3>
      <p>
        Local land-use control is the protection communities actually reach for, as Hamilton and Rocky View County have both shown. But section 619 of the Municipal Government Act provides that an AUC approval for a co-located power plant <strong>supersedes municipal land-use bylaws and statutory plans</strong>. Where the province approves the plant, the municipal instrument gives way.
      </p>

      <h3 className="text-base font-semibold text-zeever-text pt-2">What does still apply</h3>
      <p>
        This is not an unregulated space, and it would be wrong to imply otherwise:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>AUC approval of the power plant</strong>, which has real teeth. It is the mechanism that stopped Synapse at Olds in March 2026 over missing information and inadequate consultation.</li>
        <li><strong>EPEA approvals</strong>{' '}for power plants and substance releases, plus the section 109 prohibition on releases that cause or may cause a significant adverse effect, which applies even where no approval is required.</li>
        <li><strong>Water Act</strong>{' '}approvals and licences for diversion, which is the main lever on the water question in chapter six.</li>
        <li><strong>TIER</strong>{' '}carbon pricing above 100,000 tonnes of CO2e a year.</li>
        <li><strong>Federal impact assessment</strong>, where a project is designated. Beacon&rsquo;s Indus campus is on the Impact Assessment Agency registry, and Sturgeon Lake Cree Nation has sought federal review of Wonder Valley and gone to court over it.</li>
        <li><strong>Municipal development permits and zoning</strong>, except where section 619 displaces them.</li>
      </ul>

      <h3 className="text-base font-semibold text-zeever-text pt-2">The incentive runs the wrong way</h3>
      <p>
        Put the two halves of this chapter together and the shape is uncomfortable. Alberta&rsquo;s Data Centre Regulation directs the system operator to prioritize data centres that bring their own power, and levies the ones that connect to the grid. Bringing your own power, in practice, means gas. And gas generation is the option that is not subject to mandatory provincial assessment, that may fall outside the federal Clean Electricity Regulations through the net-supply exemption, and whose approval can override the municipal bylaws neighbours rely on.
      </p>
      <p>
        The province is not merely tolerating the higher-emissions path. It is giving that path queue priority, and the higher-emissions path is the one carrying the lighter environmental envelope. Whatever one concludes about the emissions arithmetic earlier in this chapter, the review that would settle the question is largely not being triggered.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The clean-grid provinces are rationing too</h2>
      <p>
        It would be tidy to say the fix is simply to build in the clean-power provinces. But those provinces have already started closing their own doors, because clean power is finite and everyone wants it at once.
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Quebec</strong>{' '}(94 percent hydro) expects data-centre demand to rise sevenfold, to more than 1,000 MW by 2035. Hydro-Qu&eacute;bec has suspended its earlier crypto allocation and proposed a new large-data-centre rate around 13 cents per kWh, roughly double its standard large-power rate, with crypto pushed toward an average of 19.5 cents. Access is now competitive for any project over 5 MW.</li>
        <li><strong>British Columbia</strong>{' '}turned Bill 31 into a capped, competitive call for demand: as much as 400 MW for AI and data centres over the first two years, plus a permanent ban on new crypto-mining grid connections. Two drought years (2023 to 2024) had already turned B.C. into a net electricity importer, even as Site C&rsquo;s 1,100 MW comes online.</li>
        <li><strong>Manitoba</strong>{' '}(more than 96 percent hydro) is within a few years of hitting its roughly 6,100 MW peak capacity, and Premier Wab Kinew flatly rejected a proposed 500 MW hyperscale campus southeast of Winnipeg, citing energy demand and environmental cost against limited benefit.</li>
        <li><strong>Ontario</strong>{' '}has no hard cap, but its grid is squeezed by simultaneous nuclear refurbishments (Bruce, Darlington, Pickering), and IESO expects only about 16 new data centres to connect over ten years even as total provincial demand climbs toward 262 TWh by 2050. In August 2026 the province proposed a Data Centre Playbook that would screen projects on economic development, digital sovereignty and community benefits, and place large new loads in a separate electricity rate class, potentially those above 1 MW, so that the cost of serving them is not recovered from existing ratepayers. The consultation closes 12 September 2026 and nothing is final, but the direction is a shift from rationing by scarcity to rationing by assessed value.</li>
      </ul>
      <p>
        The pattern across all four is the same. Even where the power is clean, it is now scarce and gated. Interconnection speed, not the theoretical existence of clean electrons, is what actually decides where AI compute lands.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Who pays for the grid?</h2>
      <p>
        Every one of these decisions eventually reaches a ratepayer. When residents in Hamilton turned out against a harbourfront data-centre proposal, one of their sharpest concerns was that a large facility could strain the local grid and push up everyone&rsquo;s utility bills, a worry that helped drive a proposed municipal moratorium. Alberta, meanwhile, passed a 2025 Water Amendment Act that lets the province approve &ldquo;low-risk&rdquo; inter-basin water transfers by ministerial order, a reminder that the power question drags land and water questions along with it. Those are the subjects of the next two chapters.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The same workaround, everywhere</h2>
      <p>
        One caution about the argument so far. It would be easy to read Alberta&rsquo;s gas build-out as a peculiarly Canadian pathology &mdash; a province routing around its own system operator. The commercial-market data says otherwise. Across North America, CBRE reports that grid capacity for existing projects is{' '}<strong>largely booked through 2030 in most markets</strong>, that interconnection timelines now run{' '}<strong>24, 36 or even 48-plus months</strong>{' '}once new high-voltage transmission or incremental generation is needed, and that &ldquo;bring your own power&rdquo; has moved from workaround to expectation: on-site generation is now &ldquo;becoming essential in load studies submitted to utilities,&rdquo; with hybrid systems pairing batteries and gas turbines, and small modular reactors floated as a practical on-site source from around 2035.
      </p>
      <p>
        So the behaviour is continental. What stays distinctly Canadian is the{' '}<em>consequence</em>. When a Texas developer builds behind the meter, they are adding gas to a grid that was already gas-heavy. When an Alberta developer does it, they are routing demand away from a national grid that is roughly 80 percent non-emitting and into one of the highest-carbon jurisdictions on the continent, while the clean provinces ration access. The inversion is not that Canada invented the workaround. It is that Canada is spending its cleanest comparative advantage to make the workaround necessary.
      </p>
      <p>
        Ontario shows the same pressure in a quieter form. CBRE&rsquo;s read of the Toronto market has developers &ldquo;committing to power studies and new application fees to both Toronto Hydro and Alectra&rdquo; for greenfield projects of 50 to 400 MW targeted at 2027 and 2028 &mdash; the paperwork equivalent of Alberta&rsquo;s queue, and an early signal that the province&rsquo;s connection process is about to become the constraint that the IESO&rsquo;s ten-year outlook implies.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The takeaway</h2>
      <p>
        The AI infrastructure race in Canada is, first and most concretely, a power race. Land can be rezoned and capital is plentiful. A firm, fast grid connection is neither. That single scarcity is producing three durable effects at once:
      </p>
      <ol className="list-decimal pl-6 space-y-1 text-sm">
        <li>A credibility gap between the roughly 337 MW built and the 20-plus GW announced, most of which the grid will never energize.</li>
        <li>A gas workaround that hollows out the clean-power advantage Canada markets itself on, not by beating the grid on price but by getting there first, and that on a baseload emissions assumption could add tens of megatonnes to the national total.</li>
        <li>Rationing in the clean provinces, where competitive allocation, pricing, and outright rejections are now the norm.</li>
      </ol>
      <p>
        Canada does have the raw ingredient the rest of the world wants: abundant clean electricity. What it does not yet have is the ability to connect new load to that electricity quickly. Until that changes, the fastest path to a Canadian AI data centre will keep running through a natural-gas plant, and the country&rsquo;s cleanest advantage will keep being spent to power its dirtiest option.
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
        Primary and reputable secondary sources: the Clean Electricity Regulations (SOR/2024-263, sections 5, 9 and 14, read directly); the Environmental Law Centre&rsquo;s June 2026 analysis of Alberta&rsquo;s data-centre framework (EPEA assessment thresholds, the Schedule of Activities, TIER scope, the Municipal Government Act section 619 override, and Alberta&rsquo;s Data Centre Regulation); CBC News (Meta&rsquo;s grid rights ahead of Greenlight, the Capital Power supply agreement, and the plant&rsquo;s 2030 in-service date); Gowling WLG and Bennett Jones (Alberta&rsquo;s Bill 8 self-supply priority, the AESO Limit Assignment Process, and the AUC&rsquo;s constraints on self-supply); GE Vernova reporting and Power Engineering (turbine backlog and lead times); VoltaGrid and INNIO (modular reciprocating-engine deployment rates); CBRE Research and CBRE Data Center Solutions (North American power-delivery timelines, BYOP and on-site generation trends, and the Toronto utility-application findings; the forward-looking portions are CBRE&rsquo;s outlook, not measurement); AESO (interim large-load framework and project list); Canada&rsquo;s National Observer (Alberta grid requests and water stress); ISED and the Canadian Press (the January 2026 pitch deck); ISED&rsquo;s National AI Strategy; Meta Data Centers and Pembina Pipeline (the Meta Sturgeon build and the Greenlight Electricity Centre); The Energy Mix, Corporate Knights, and National Observer (Wonder Valley emissions); Global News and the Canadian Press (the government emissions note); Hydro-Qu&eacute;bec; BC Hydro and the Government of B.C.; CBC News; IESO; and the Canada Energy Regulator.
      </p>
    </SeriesChapter>
  )
}
