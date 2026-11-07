import type { Metadata } from 'next'
import SeriesChapter from '@/components/SeriesChapter'
import { FAQPageJsonLd } from '@/components/JsonLd'
import { getChapter, chapterUrl, CBRE_UPDATE_DATE } from '@/lib/aiInfrastructureSeries'

const chapter = getChapter('capital')!
const PAGE_URL = chapterUrl('capital')
const DESCRIPTION =
  "Canadian pension and infrastructure money, from CPPIB to CDPQ to Brookfield, is deep in the AI buildout. The catch: the biggest cheques are written abroad."

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
    question: 'How much Canadian pension money is going into AI data centres?',
    answer:
      "A lot, and CPPIB is in the biggest deals. CPP Investments holds 37.5 percent of a US$15B joint venture with Equinix and Singapore’s GIC, has committed US$1.75B (C$2.4B) alongside EQT through EdgeConneX, and put up C$225M as half of the construction loan for a Cambridge, Ontario expansion anchored by Cohere. CDPQ, Quebec’s pension, provided senior debt to Vantage’s Quebec City campus (USD 75M, CAD 103M). Brookfield, headquartered in Canada, launched an AI infrastructure program of up to US$100B.",
  },
  {
    question: 'Why can you not turn hyperscaler spending into a cost per megawatt?',
    answer:
      'Because the megawatts per region are never published. Amazon names CA$4.3B (later restated as about US$2.9B, roughly CA$4B) for its Calgary region, and Microsoft names C$19B for Canada from 2023 to 2027, but neither discloses the capacity behind those regions. So those numbers are total program spend only, and dividing them by megawatts would be inventing a denominator.',
  },
  {
    question: 'What does a Canadian AI data centre actually cost per megawatt?',
    answer:
      'It can only be computed where a project discloses both the dollars and the megawatts. On that basis: QScale in Levis at about C$7.4M/MW, eStruxture CAL-3 near Calgary at about C$8.3M/MW, Vantage QC24 in Quebec City at about C$15.6M/MW for a single building, and Meta Sturgeon at about C$13M/MW for a 1 GW facility. Every one of those figures is in Canadian dollars.',
  },
  {
    question: 'Is most of this Canadian capital being invested inside Canada?',
    answer:
      "No. CPPIB’s two largest AI commitments, US$15B with Equinix and US$1.75B with EQT, fund data centres abroad. Its clearest domestic bet is far smaller: C$225M for the Cambridge, Ontario build. CDPQ’s Vantage debt sits in Quebec, and Meta’s CA$13B is in Alberta, but the headline pension tickets point outward.",
  },
  {
    question: 'Is a Canadian pension behind eStruxture’s Alberta data centres?',
    answer:
      'Possibly, but it is not confirmed. Fengate Asset Management owns eStruxture after a C$1.8B acquisition in June 2024, and Fengate manages LiUNA pension capital, so a pension link is plausible. The available sources do not confirm that pension money flows into the data centres specifically, so treat it as suspected only.',
  },
]

export default function Page() {
  return (
    <SeriesChapter
      slug="capital"
      description={DESCRIPTION}
      updated={{
        date: CBRE_UPDATE_DATE,
        note: (
          <>
            Adds the CBRE evidence behind the cost-per-megawatt spread: 60 to 132 kW per rack in Toronto AI deployments,
            build-out costs above C$13M per project, rent premiums for AI-optimized space, the inversion of the old
            10 MW-plus volume discount, site costs above $8M per acre, record SASB CMBS issuance, and a near-halving of
            investment volume for operational assets. The Cambridge financing entry now names CoreWeave as the operator.
          </>
        ),
      }}
    >
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm text-gray-700">
          <strong className="text-zeever-text">The short version.</strong>{' '}The AI buildout is a capital story as much as a technology one, and Canadian money is deep in it. CPPIB, CDPQ, Brookfield, and Fengate are all funding AI infrastructure. But the biggest Canadian cheques are being written for data centres in the United States and elsewhere, not at home. Where a project discloses both its dollars and its megawatts, you can read a real cost per megawatt. Where it does not, as with every hyperscaler region, you cannot, and the honest answer is to say so.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The buildout runs on capital, and the capital is partly Canadian</h2>
      <p>
        The AI race is usually told as a story about chips and models. Underneath it is a capital story. A gigawatt-scale campus is one of the most expensive things a private developer can build, and someone has to underwrite it before a single rack is powered. The striking fact in the Canadian data is how much of that underwriting traces back to Canadian pension and infrastructure funds.
      </p>
      <p>
        Four names recur: CPP Investments (CPPIB), the Caisse de d&eacute;p&ocirc;t et placement du Qu&eacute;bec (CDPQ), Brookfield, and Fengate. Between them they touch data centres in Ontario, Quebec, Alberta, the United States, and a global mandate that spans all of the above. The money is real, it is large, and, as we will see, most of the biggest commitments are aimed outside the country.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Cost per megawatt, only where the numbers allow it</h2>
      <p>
        The cleanest way to compare data-centre projects is cost per megawatt: total announced capital divided by capacity. The trap is that most announcements give you one number and not the other. So the rule we hold to is simple. Compute a cost per megawatt only where a single source discloses both the dollars and the megawatts for the same scope. Everywhere else, say it cannot be derived.
      </p>
      <p>
        Four Canadian projects clear that bar, and all four report in Canadian dollars:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>QScale Q01</strong>{' '}(L&eacute;vis, Quebec): about C$1.05B in total capital across a 142 MW campus, which works out to roughly C$7.4M/MW (CAD). The financing syndicate was Desjardins, Scotiabank, and Export Development Canada, and the campus was acquired by Goldman Sachs Alternatives in 2025.</li>
        <li><strong>eStruxture CAL-3</strong>{' '}(near Calgary): CA$750M for 90 MW, about C$8.3M/MW (CAD). Sources also cite a US$540M equivalent for the same build.</li>
        <li><strong>Vantage QC24</strong>{' '}(Quebec City): $500M CAD for the 32 MW final building, about C$15.6M/MW (CAD) for that single building. The roughly C$2.5B (CAD) covers Vantage&rsquo;s broader Canadian portfolio of about 178 MW across Montreal and Quebec City, not the 86 MW Quebec City campus alone, so the single-building ratio is the honest one to quote.</li>
        <li><strong>Meta Sturgeon</strong>{' '}(Sturgeon County, Alberta): CA$13 billion or more for a 1 GW data centre, about C$13M/MW (CAD). Meta stated the figure in Canadian dollars in its own newsroom.</li>
      </ul>
      <p>
        The spread itself is a finding. A commodity campus in Quebec lands near C$7M to C$8M per megawatt, while a single high-density building can run above C$15M per megawatt, and a hyperscaler flagship sits around C$13M. Density, cooling, and how much shell and land are bundled into the number all move it. Which is exactly why announced ratios can mislead. Wonder Valley, for instance, pencils out to about C$9.3M/MW (CAD) on paper, but that is an aspirational figure for a 7.5 GW project that has not been financed or broken ground, so it measures ambition, not cost.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Why hyperscaler spending cannot be reduced to a per-megawatt number</h2>
      <p>
        The largest dollar figures in the dataset belong to the cloud giants, and they are the ones you cannot convert into cost per megawatt. Amazon Web Services has cited CA$4.3B for its Calgary region (a 2021 estimate), later restated as more than US$2.9B, roughly CA$4B, through 2037, all of it part of an up-to-CA$24.8B national plan across both Canadian regions. Microsoft has announced C$19B (CAD) for Canada from 2023 to 2027, with the latest tranche of more than C$7.5B aimed at expanding Azure Canada Central and East.
      </p>
      <p>
        Those are enormous numbers, and they tell you nothing about cost per megawatt, because neither company publishes the capacity behind a region. A cloud region is spread across multiple availability zones and buildings, capitalized over many years, and reported as a program rather than a facility. Dividing CA$4B or C$19B by a guessed megawatt count would be manufacturing a denominator. So we carry these strictly as total program spend, in the currency each company used, and leave the per-megawatt column blank.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Who is actually funding it</h2>
      <p>
        Strip the projects back to their funders and a short list of Canadian institutions does most of the heavy lifting:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>CPP Investments (CPPIB)</strong>, the federal public pension, is the most active. It owns 37.5 percent of a US$15B joint venture formed with Equinix and Singapore&rsquo;s sovereign fund GIC in October 2024 to build US hyperscale capacity. It has committed US$1.75B (C$2.4B) alongside Sweden&rsquo;s EQT through the developer EdgeConneX. And it put up C$225M, half of the senior construction loan (Deutsche Bank took the other half), for a 54 MW expansion in Cambridge, Ontario &mdash; the CoreWeave-operated site anchored by the Canadian AI firm Cohere.</li>
        <li><strong>CDPQ</strong>, Quebec&rsquo;s pension, provided senior debt to Vantage&rsquo;s Quebec City campus: USD 75M (CAD 103M) on one building, part of a broader USD 130M (CAD 179M) facility underwritten by Soci&eacute;t&eacute; G&eacute;n&eacute;rale.</li>
        <li><strong>Brookfield</strong>, the Canada-headquartered asset manager, launched the Brookfield AI Infrastructure Program: up to US$100B of AI-infrastructure assets, with a US$10B equity target and US$5B already committed. Its named backers include Nvidia and the Kuwait Investment Authority, alongside a US$5B power framework with Bloom Energy. The mandate is global.</li>
        <li><strong>Fengate Asset Management</strong>, an infrastructure and alternatives manager, became majority owner of eStruxture through a C$1.8B acquisition in June 2024, putting it behind the CAL-3 build near Calgary. Fengate manages LiUNA pension capital, which makes a pension link plausible, though the sources do not confirm it (more on that below).</li>
      </ul>
      <p>
        There is also infrastructure-fund money inside the power side of these deals. Meta&rsquo;s Sturgeon campus will be fed from 2030 by the Greenlight Electricity Centre, a CA$4.6 billion, 932 MW gas plant where Pembina Pipeline and Morgan Stanley Infrastructure Partners hold 47.5 percent each, with Kineticor at 5 percent. Vantage itself sits under DigitalBridge, a digital-infrastructure fund. The pattern is consistent: pension and infrastructure capital is not adjacent to the AI buildout, it is inside the capital stack.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Most of the big money is going abroad</h2>
      <p>
        Here is the twist that reframes the whole chapter. When you sort CPPIB&rsquo;s commitments by size, the two largest fund data centres outside Canada. The US$15B Equinix and GIC venture is explicitly for US hyperscale sites. The US$1.75B (C$2.4B) EQT and EdgeConneX commitment is a global build-out, not a Canadian one. CPPIB&rsquo;s clearest domestic AI bet, by contrast, is the C$225M Cambridge loan, an order of magnitude smaller and structured as debt rather than equity.
      </p>
      <p>
        The same outward tilt shows up elsewhere. Brookfield&rsquo;s US$100B program is a global mandate run from a Canadian head office. Even Canadian operators follow the capital: Hut 8, a Canadian company, put its flagship AI campuses in Louisiana and Texas, not Canada, though its US$7.0B River Bend figure is a fifteen-year lease value rather than construction capital, so it is not a cost-per-megawatt number either.
      </p>
      <p>
        So the honest summary is a split screen. Canadian pension money is a genuine force in AI infrastructure, but the domestic footprint (CDPQ&rsquo;s Vantage debt in Quebec, CPPIB&rsquo;s Cambridge loan in Ontario) is dwarfed by the cheques these same institutions are writing for American and global compute. The capital is Canadian. The data centres it builds mostly are not.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The Fengate and LiUNA question, flagged not asserted</h2>
      <p>
        One thread deserves its own caution. eStruxture, which is building Alberta&rsquo;s largest data centre, is majority-owned by Fengate, and Fengate manages pension capital for LiUNA, the Labourers&rsquo; International Union of North America. It is tempting to close the loop and say a union pension is bankrolling an Alberta AI campus. The sources do not support that leap. What is documented is the ownership and the fact that Fengate manages LiUNA capital. Whether that specific pool funds the data centres is not confirmed in anything we could fetch. So this is a suspected link, not a confirmed one, and it is labelled that way throughout our records. It is the kind of connection worth chasing to a primary filing before anyone states it as fact.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Subsidy, incentives, and the missing cash grants</h2>
      <p>
        A related surprise is what is not in the data: disclosed cash subsidies. Across the projects, the incentives on offer are mostly siting advantages and process, not cheques. QScale and Vantage benefit from Hydro-Qu&eacute;bec&rsquo;s renewable power rather than a grant. eStruxture and the Beacon campuses appear on the Alberta Major Projects list with no specific subsidy figure disclosed. Microsoft&rsquo;s Canadian expansion is wrapped in a Sovereign AI Landing Zone and a threat-intelligence hub, but no disclosed cash grant. Even Meta&rsquo;s Alberta deal is framed around a federal-provincial memorandum and regulatory abeyance, not a subsidy. The public leverage here is regulatory and infrastructural (power access, permitting, land), which means the public exposure is harder to see than a line item and harder to claw back if a project underdelivers.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What AI density is doing to the numbers</h2>
      <p>
        The cost-per-megawatt spread above has a direction of travel, and it is upward for a specific reason: the machines got denser. CBRE&rsquo;s Toronto data has AI deployments arriving at{' '}<strong>60 to 132 kW per rack</strong>, densities that force liquid cooling and, on CBRE&rsquo;s read, push build-out costs{' '}<strong>above C$13 million per project</strong>. That is the mechanism behind Vantage QC24&rsquo;s C$15.6M/MW sitting at double QScale&rsquo;s C$7.4M/MW: not inefficiency, but a different class of building.
      </p>
      <p>
        The market is paying for it. Operators with AI-optimized facilities &mdash; liquid cooling, high-density racks &mdash; are capturing rent premiums over conventional colocation, and the old volume discount has inverted: where 10 MW-plus deployments once bought a price break, CBRE reports that neoclouds, GPU-as-a-service providers and AI startups are now{' '}<em>paying premiums for scale</em>, because contiguous power is the scarce good.
      </p>
      <p>
        The same scarcity has repriced land. Site costs for recent and pending transactions in Northern Virginia and the U.S. Northeast have{' '}<strong>exceeded $8 million per acre</strong>, and buyers are prioritizing sites with more than 200 MW of available power. Toronto shows the Canadian version: CBRE reports data-centre development land commanding a premium over ordinary industrial land because so few sites have the grid capacity, pointing to Prologis&rsquo;s 40-acre Mississauga acquisition. What is being bought is not the dirt. It is the interconnection.
      </p>
      <p>
        On the financing side, 2025 was a year of structure rather than volume. Annual issuance of single-asset single-borrower CMBS hit an all-time high of{' '}<strong>$11.2 billion</strong>, with data centres about 11 percent of it, also a record; an investor consortium agreed to acquire Aligned Data Centers for{' '}<strong>$40 billion</strong>. Yet investment volume for{' '}<em>operational</em>{' '}data centres fell by nearly half, to roughly $3 billion, as supply-chain, power-delivery and entitlement problems stretched transaction timelines. Capital is flowing into building things, not into buying things that are already built &mdash; which is another way of saying the scarce asset is delivery, not ownership.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The takeaway</h2>
      <p>
        AI infrastructure in Canada is being financed, in significant part, by Canadians, through the pensions and infrastructure funds that manage their retirement savings. That is worth knowing on its own terms. Three things follow from the numbers:
      </p>
      <ol className="list-decimal pl-6 space-y-1 text-sm">
        <li>Cost per megawatt is real but selective. It can be read only where a project discloses both dollars and megawatts (QScale, eStruxture, Vantage QC24, Meta), and it ranges from about C$7.4M to about C$15.6M per megawatt in CAD.</li>
        <li>Hyperscaler spend is not a per-megawatt number. AWS at roughly CA$4B and Microsoft at C$19B are total program figures, because per-region capacity is never published.</li>
        <li>The biggest Canadian cheques are aimed abroad. CPPIB&rsquo;s US$15B and US$1.75B commitments build foreign compute, while its domestic AI bet is the far smaller C$225M Cambridge loan.</li>
      </ol>
      <p>
        The uncomfortable implication is that Canadian capital is helping build the AI infrastructure of other countries faster than it is building Canada&rsquo;s. That is a policy choice as much as a market outcome, and it is the natural bridge to the questions in the chapters ahead: what else that money and that power could be doing, and what a coordinated Canadian strategy would have to change to keep more of the buildout at home.
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
        Primary and reputable secondary sources: CBRE Research and CBRE Data Center Solutions (rack densities and Toronto build-out costs, AI-optimized rent premiums, per-acre site costs, SASB CMBS issuance and investment volumes); CPP Investments (the Cambridge construction financing and the EQT and Equinix commitments); The Logic (the Maple 8 pension AI investment reporting); CDPQ and Vantage Data Centers (the Quebec City campus financing); QScale and DataCenterDynamics (the Q01 financing and capacity); eStruxture and DataCenterDynamics (CAL-3 and the Fengate acquisition); Brookfield Asset Management and DataCenterDynamics (the up-to-US$100B AI infrastructure program); Meta Data Centers, Pembina Pipeline, and Global News (the Sturgeon build and the Greenlight power plant); Amazon (AWS Canada regions) and CBC News; Microsoft and BetaKit (the C$19B Canadian expansion); and Hut 8 (the US River Bend and Beacon Point campuses). All figures are labelled CAD or USD as reported.
      </p>
    </SeriesChapter>
  )
}
