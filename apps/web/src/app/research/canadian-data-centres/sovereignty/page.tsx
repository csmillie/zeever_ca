import type { Metadata } from 'next'
import SeriesChapter from '@/components/SeriesChapter'
import { FAQPageJsonLd } from '@/components/JsonLd'
import { getChapter, chapterUrl, CBRE_UPDATE_DATE, POLICY_UPDATE_DATE } from '@/lib/aiInfrastructureSeries'

const chapter = getChapter('sovereignty')!
const PAGE_URL = chapterUrl('sovereignty')
const DESCRIPTION =
  "Ottawa funded sovereign compute but not sovereign cloud. Under the U.S. CLOUD Act, a data centre in Canada does not make the data it holds Canadian-controlled."

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
    question: 'Does storing data in Canada make it sovereign?',
    answer:
      "No. Data residency means the bytes physically sit in Canada. Sovereignty means Canadian law, and only Canadian law, controls access to them. The federal government's own data-sovereignty white paper says residency does not prevent the application of foreign laws. If a cloud provider is subject to U.S. law, the U.S. CLOUD Act can compel it to hand over data in its possession, custody, or control regardless of where that data is stored.",
  },
  {
    question: 'How much has Ottawa spent on sovereign AI compute?',
    answer:
      'The Canadian Sovereign AI Compute Strategy, announced in December 2024, commits about 2 billion dollars over five years: up to 700 million for private data-centre investment, up to 1 billion for public supercomputing for researchers, and an AI Compute Access Fund, initially 300 million and since expanded. Budget 2025 added roughly 926 million more for sovereign public compute. The money targets compute, the physical hardware, not a usable Canadian cloud platform on top of it.',
  },
  {
    question: 'How much of the Canadian cloud market is American?',
    answer:
      "About 85 percent. According to a June 2026 report from the Canadian Anti-Monopoly Project, Amazon, Microsoft, and Google together hold roughly 85 percent of Canada's public cloud market. Those are market-share figures, not a spending breakdown. The government itself spent about 1.3 billion Canadian dollars on U.S. cloud services since 2021, most of it to Microsoft, though no public per-vendor dollar split exists.",
  },
  {
    question: 'What is the CLOUD Act and why does it matter here?',
    answer:
      "The U.S. Clarifying Lawful Overseas Use of Data Act, passed in 2018, lets U.S. authorities compel American providers to disclose data in their possession, custody, or control, no matter where in the world it is stored. Combined with surveillance authorities like FISA, it means a Canadian-located data centre operated by a U.S. firm remains reachable under U.S. law. Switching to a Canadian provider with U.S. operations, investors, or customers does not fully escape that architecture.",
  },
  {
    question: 'Is Ottawa building a sovereign cloud or just sovereign compute?',
    answer:
      'So far, mostly compute. The funding builds data centres and public supercomputers, and a January 2026 call for proposals seeks sovereign AI data centres over 100 megawatts. But analysts, including the Centre for International Governance Innovation, argue Canadian firms still lack a sovereign, enterprise-ready cloud layer they can actually deploy, train, and host on under Canadian jurisdiction. Funded compute does not automatically produce a sovereign cloud.',
  },
]

export default function Page() {
  return (
    <SeriesChapter
      slug="sovereignty"
      description={DESCRIPTION}
      updated={[
        {
          date: POLICY_UPDATE_DATE,
          note: (
            <>
            Two changes. The January 2026 call for sovereign facilities over 100 MW now has an outcome: Ottawa says
            it is finalising partnerships proposing 850 MW of compute by 2030, scalable to 2.3 GW. Those are memoranda,
            not campuses, and the chapter labels them as pipeline rather than capacity. The AI Compute Access Fund is
            also corrected from a flat 300 million to its initial 300 million since expanded. A new section audits
            Canada&rsquo;s Responsible Data Centre Development Principles, launched 3 September 2026, against this
            chapter&rsquo;s own vocabulary: Principle 5 asks for strategic value to Canada and Ontario&rsquo;s Playbook
            names digital sovereignty as a screening pillar, and neither document defines the term.
            </>
          ),
        },
        {
          date: CBRE_UPDATE_DATE,
        note: (
          <>
            Adds the CoreWeave Cambridge case. CBRE&rsquo;s H1 2025 Toronto profile puts roughly 52 MW of GTA preleasing with
            CoreWeave, operational from June 2025; the site is Cohere&rsquo;s federally-funded anchor deployment, operated by a
            U.S. company. It is the sharpest available illustration of this chapter&rsquo;s thesis, plus a second exposure the
            debate has largely missed: neocloud tenant credit risk.
          </>
        ),
        },
      ]}
    >
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm text-gray-700">
          <strong className="text-zeever-text">The short version.</strong>{' '}Ottawa has poured money into sovereign compute: about 2 billion dollars for data centres and public supercomputers, plus a call for sovereign AI campuses over 100 megawatts. But a Canadian-located data centre does not make the data it holds Canadian-controlled. Under the U.S. CLOUD Act and FISA, foreign-operated capacity stays legally exposed, and the government&rsquo;s own Digital Sovereignty Framework says residency is not sovereignty. Three American firms hold about 85 percent of Canada&rsquo;s cloud market, and Ottawa itself spent roughly 1.3 billion Canadian dollars on U.S. cloud since 2021. Funded compute, missing cloud.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Three words that get used as one</h2>
      <p>
        Most of the confusion in this debate comes from collapsing three different things into a single word, &ldquo;sovereignty.&rdquo; They are not the same, and the gap between them is exactly where Canada&rsquo;s problem sits. So define them up front:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Data residency</strong>{' '}is about location. It means the bytes physically sit on servers inside Canada. It is a storage fact, and it is the weakest of the three.</li>
        <li><strong>Sovereign compute</strong>{' '}is about hardware. It means the physical AI infrastructure, the data centres, GPUs, and supercomputers, is located in Canada and, ideally, owned and governed here. This is the layer Ottawa is funding.</li>
        <li><strong>Sovereign cloud</strong>{' '}is about control. It means the usable platform layer on top, the services firms actually deploy, train, and host on, operates under Canadian jurisdiction and outside the legal reach of a foreign state. This is the layer Canada does not yet have.</li>
      </ul>
      <p>
        You can have all the residency and all the compute in the world and still not have sovereignty. That is not a rhetorical point. It is the finding of the government&rsquo;s own policy documents.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The money went to compute</h2>
      <p>
        On the compute side, Canada has moved with real intent. In December 2024, Innovation, Science and Economic Development Canada announced the Canadian Sovereign AI Compute Strategy: about 2 billion dollars over five years, drawn largely from Budget 2024&rsquo;s 2.4 billion dollar Securing Canada&rsquo;s AI Advantage package. The strategy splits three ways:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Up to{' '}<strong>700 million</strong>{' '}for new or expanded private data centres, through the AI Compute Challenge.</li>
        <li>Up to{' '}<strong>1 billion</strong>{' '}for AI-specific public computing infrastructure, accessible to Canadian researchers and innovators.</li>
        <li><strong>Initially 300 million, since expanded</strong>{' '}for the AI Compute Access Fund, helping small and medium-sized enterprises buy compute.</li>
      </ul>
      <p>
        Budget 2025 layered on roughly 926 million more for sovereign public compute. And in January 2026, the government opened a separate call for proposals inviting operators to build sovereign, large-scale AI data centres exceeding 100 megawatts, with the reward being a memorandum of understanding to explore government-supported development. That call now has an outcome. Ottawa says it is finalising partnerships proposing{' '}<strong>850 MW of compute by 2030, scalable to as much as 2.3 GW</strong>, involving investment in the tens of billions. The direction of travel is unmistakable: Ottawa wants gigawatts of compute on Canadian soil.
      </p>
      <p>
        Those two numbers deserve the same scepticism this series applies to every other capacity figure. They are proposals at memorandum stage. Nothing is energised, nothing has secured grid service, and no campus has been announced against them. On the five-measure taxonomy set out in the CBRE revision, they are a sixth kind of number entirely, and the discipline that applies to a press-release gigawatt applies here too.
      </p>
      <p>
        The AI Compute Access Fund even carries a sharp sovereignty tilt in its fine print. It reimburses up to two-thirds of the cost of Canadian AI compute services but only one-half for non-Canadian services. And effective April 1, 2027, spending on non-Canadian compute becomes entirely ineligible for offset under the program. That is a deliberate nudge toward domestic capacity, written into the terms.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The cloud stayed American</h2>
      <p>
        Now the other side of the ledger. However much compute Canada builds, the layer that firms and governments actually use, the public cloud, is overwhelmingly foreign-operated.
      </p>
      <p>
        In June 2026, the Canadian Anti-Monopoly Project reported that Amazon, Microsoft, and Google together control about 85 percent of Canada&rsquo;s public cloud market. The commonly cited split is Amazon around 42 percent, Microsoft around 31 percent, and Google around 12 percent. One caveat worth stating plainly: those 42, 31, and 12 figures are{' '}<em>market share</em>, not a breakdown of anyone&rsquo;s spending.
      </p>
      <p>
        The dependence runs right through Ottawa itself. The Canadian Press reported in September 2025 that federal departments spent about 1.3 billion Canadian dollars on U.S. cloud services since 2021, most of it going to Microsoft. There is no public per-vendor dollar breakdown of that 1.3 billion, so it should be cited as a total, not sliced by provider. The government that is now funding sovereign compute is at the same time one of the larger customers of the very hyperscalers it is trying to build an alternative to.
      </p>
      <p>
        The physical footprint reflects the same reality. The Canadian &ldquo;cloud regions&rdquo; that anchor much of this capacity are foreign-operated: AWS runs a Central region near Montreal and a West region in Calgary, the latter a roughly 4 billion Canadian dollar buildout with 950-plus staff, part of an estimated 17.9 billion U.S. dollar AWS commitment to Canada through 2037. Microsoft Azure and Google Cloud hold their own Canadian regions. These are in-country by residency and foreign by control.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Why residency is not sovereignty</h2>
      <p>
        Here is the legal core, and it is not our interpretation. It is Canada&rsquo;s own.
      </p>
      <p>
        The Treasury Board of Canada Secretariat published a white paper, &ldquo;Data Sovereignty and Public Cloud,&rdquo; in 2018. The government has since issued a current Digital Sovereignty Framework that supersedes it. Its blunt conclusion is that as long as a cloud service provider operating in Canada is subject to the laws of a foreign country, data residency does not prevent the application of those foreign laws. That framework names the specific instruments: the U.S. CLOUD Act and the Foreign Intelligence Surveillance Act, FISA. The government&rsquo;s position is that encryption, contractual safeguards, and careful workload selection matter more for risk than where the server sits.
      </p>
      <p>
        The mechanism is the CLOUD Act itself. Passed in 2018, it clarified that U.S. providers must disclose data within their &ldquo;possession, custody, or control,&rdquo; regardless of where that data is physically stored. So a dataset held in a Toronto data centre, on hardware operated by a company subject to U.S. law, remains reachable by U.S. legal process. Switching to a Canadian provider does not fully escape the architecture either, if that provider has U.S. operations, U.S. investors, or U.S. customers that pull it into American jurisdiction.
      </p>
      <p>
        And the reach is not uniquely American. As the ITIF has noted, an Ontario court compelled a French provider, OVHcloud, to disclose data stored in France through its Canadian subsidiary. Canada is not merely subject to extraterritorial reach; it exercises it. The lesson is that jurisdiction follows the operator and its corporate connections, not the map coordinates of the disk.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The layer nobody funded</h2>
      <p>
        Put the two sides together and the gap becomes obvious. Ottawa is funding sovereign compute, the hardware. Foreign firms own the sovereign cloud question, the control layer. And a Canadian firm that wants to build and run an AI product still, in practice, reaches for AWS, Azure, or Google Cloud, because that is where the usable, enterprise-ready platform lives.
      </p>
      <p>
        The Centre for International Governance Innovation put this precisely in April 2026: it called the 2 billion dollar compute strategy a meaningful start but warned that Canadian firms lack a sovereign, enterprise-ready cloud on which to host, train, and deploy models under Canadian jurisdiction. Raw compute and data centres are not the same as a cloud layer a business can actually deploy on. You can pour concrete and rack GPUs and still leave the sovereignty question untouched, because sovereignty lives in the software and legal layer above the metal.
      </p>
      <p>
        There are genuine domestic efforts. Canadian-owned operators like QScale, building a 142 megawatt campus in L&eacute;vis, Quebec on roughly 100 percent renewable Hydro-Qu&eacute;bec power, add real domestic sovereign compute capacity, and TELUS is among the Canadian players investing in sovereign AI infrastructure. The National AI Strategy leans on exactly this hope, noting that while current offerings are &ldquo;largely foreign-owned and controlled,&rdquo; recent Canadian investments are starting to mature a market long dominated by the hyperscalers. But maturing a market is a decade-long project, and the strategy itself estimates Canada will need about 5.5 gigawatts of AI compute for commercial players by 2030, much of it expected to be delivered by those same foreign hyperscalers.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The neocloud in the middle</h2>
      <p>
        The clearest live test of this chapter&rsquo;s argument is not a hyperscaler. It is the deal Canada points to as its sovereignty success story.
      </p>
      <p>
        Cohere, the Canadian model developer, anchors an AI data centre at Cambridge, Ontario that is built and operated by{' '}<strong>CoreWeave</strong>{' '}&mdash; a U.S.-headquartered neocloud &mdash; with up to{' '}<strong>C$240 million</strong>{' '}of federal money attached under the Sovereign AI Compute Strategy. CBRE&rsquo;s market data shows how substantial it is: CoreWeave &ldquo;led the wholesale colocation market in the GTA and Canada,&rdquo; securing roughly{' '}<strong>52 MW of preleasing</strong>{' '}in January 2025 with initial infrastructure operational by that June. On any physical measure this is Canadian AI infrastructure: Canadian soil, Canadian grid, Canadian anchor tenant, Canadian public funding.
      </p>
      <p>
        And the operating entity is American, which puts it within reach of the CLOUD Act in exactly the way this chapter has described. That is not an argument against the project, which is doing something real that no Canadian operator was positioned to do at that speed. It is an argument about vocabulary. &ldquo;Sovereign&rdquo; has been doing work here that the corporate structure does not support.
      </p>
      <p>
        There is a second-order exposure worth naming. Neoclouds are a young, capital-hungry tenant class: CBRE recorded more than{' '}<strong>$8 billion</strong>{' '}of CoreWeave-leased financing for build-to-suit projects in the second half of 2025 alone, and notes that such providers &ldquo;require heightened underwriting scrutiny&rdquo; against a sector history of investment-grade tenants. Canada has placed a meaningful share of its sovereign-compute ambition, and public money, on the credit of a single foreign operator in a fast-moving market. That is a policy risk distinct from the jurisdictional one, and it is not currently discussed as one.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">A fifth definition of sovereignty</h2>

      <p>
        On 3 September 2026 Ottawa launched Canada&rsquo;s Responsible Data Centre Development Principles. The fifth
        expectation is that a project should &ldquo;deliver strategic value to Canada.&rdquo; Ontario&rsquo;s proposed
        Playbook lists &ldquo;digital sovereignty&rdquo; as one of three screening pillars. Neither document defines the
        term.
      </p>

      <p>
        This chapter has spent its length arguing that the word carries at least three distinct meanings, and that
        collapsing them is how a country funds hardware and calls the workloads on it sovereign. Data residency,
        sovereign compute and sovereign cloud are different claims with different failure modes. Adding two more
        undefined uses to a vocabulary that was already doing too much work is not progress, and the operative question
        for both documents is which of the three they mean. On the residency reading, a foreign hyperscaler with a
        Canadian region qualifies. On the sovereign-cloud reading, it does not.
      </p>

      <p>
        The signatory list makes the ambiguity concrete. It includes the three American firms that hold roughly 85
        percent of Canada&rsquo;s public cloud market, which is the central problem this chapter describes. It also
        includes OpenAI and Anthropic, neither of which operates a Canadian facility at all. What a principle about
        local benefits and water use asks of a company that runs no data centre here is not obvious, and a framework
        whose signatories include both the operators and their tenants needs to say which obligations attach to which.
      </p>

      <p>
        None of this is an argument against the Principles. It is the same argument the chapter makes about the word
        itself: a commitment that does not specify which sovereignty it means can be honoured by a structure that
        delivers none of them.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The takeaway</h2>
      <p>
        Canada&rsquo;s sovereign AI push is real, and on the compute layer it is moving. But a country does not become digitally sovereign by counting the megawatts of data-centre capacity inside its borders. Three effects sit at the heart of the gap:
      </p>
      <ol className="list-decimal pl-6 space-y-1 text-sm">
        <li>The funding, roughly 2 billion dollars plus a Budget 2025 top-up, targets compute and public supercomputing, not the usable cloud platform layer firms deploy on.</li>
        <li>The cloud market that actually gets used is about 85 percent American, and Ottawa itself spent roughly 1.3 billion Canadian dollars on U.S. cloud since 2021.</li>
        <li>Under the CLOUD Act and FISA, and by the government&rsquo;s own admission, a Canadian address does not put foreign-operated data beyond foreign legal reach.</li>
      </ol>
      <p>
        Sovereignty is a property of control, not of location. Until Canada builds a cloud layer that firms can actually deploy on under Canadian law, a data centre in Toronto or Calgary can be entirely Canadian in residency and still hold data that is not, in the sense that matters, Canadian-controlled. Funded compute, missing cloud. That is the honest state of digital sovereignty in Canada today.
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
        Primary and reputable secondary sources: CBRE Research and CBRE Data Center Solutions (CoreWeave GTA preleasing, neocloud financing and underwriting), The Globe and Mail and DataCenterDynamics (the CoreWeave-operated Cambridge site and the Cohere funding); Innovation, Science and Economic Development Canada (the Canadian Sovereign AI Compute Strategy, the AI Compute Access Fund program guide, the January 2026 call for sovereign data centres over 100 MW, and the National AI Strategy); the Treasury Board of Canada Secretariat (the 2018 &ldquo;Data Sovereignty and Public Cloud&rdquo; white paper and the current Digital Sovereignty Framework naming the CLOUD Act and FISA); the Canadian Anti-Monopoly Project via the Canadian Press, Global News, BNN Bloomberg, and Canada&rsquo;s National Observer (the 85 percent cloud-market figure); the Canadian Press (the roughly 1.3 billion dollar federal U.S.-cloud spend); the Centre for International Governance Innovation (the sovereign-cloud gap and Budget 2025 top-up); the Information Technology and Innovation Foundation and the Balsillie Papers (CLOUD Act analysis and the OVHcloud case); and Amazon Web Services and QScale (Canadian cloud-region and campus details). Dollar figures are Canadian unless noted.
      </p>
    </SeriesChapter>
  )
}
