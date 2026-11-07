import type { Metadata } from 'next'
import SeriesChapter from '@/components/SeriesChapter'
import { FAQPageJsonLd } from '@/components/JsonLd'
import { getChapter, chapterUrl, CBRE_UPDATE_DATE, POLICY_UPDATE_DATE } from '@/lib/aiInfrastructureSeries'

const chapter = getChapter('jobs-economics')!
const PAGE_URL = chapterUrl('jobs-economics')
const DESCRIPTION =
  'Data centres bring a construction boom and a tax base, but few permanent jobs. Roughly 0.2 to 0.35 per MW, against 25 to 40 times more for a battery plant.'

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
    question: 'How many permanent jobs does a data centre actually create?',
    answer:
      "Fewer than the announcements imply, and Canada cannot verify its own numbers. The one post-hoc government count is Virginia's, where a December 2024 legislative audit of roughly 340 buildings drawing about 5 GW found that most facilities employ fewer than 50 people in daily operations, that construction sites can employ up to 1,500, and that the majority of the industry's economic activity comes from construction rather than operations. Industry staffing benchmarks put new hyperscale capacity at roughly 0.2 to 0.35 permanent jobs per megawatt, though that ratio is sensitive to density: older, smaller colocation halls employ more people per megawatt than modern AI halls. In Canada every figure is still a projection made at announcement, because Statistics Canada has no NAICS code for data centres and the closest category bundles them with web hosts and one-person consultancies.",
  },
  {
    question: 'How many permanent jobs does a data centre actually create?',
    answer:
      "Fewer than most announcements suggest, once you separate one-time construction from ongoing operations. The industry benchmark is roughly 0.2 to 0.35 permanent jobs per megawatt, so a 100 MW facility supports on the order of 20 to 35 permanent staff, and a 380 MW hyperscale site about 75 to 130. Meta's 1 GW Sturgeon County build is projected at about 300 permanent jobs against 3,000 during construction. These operating figures are projections, not realized headcount.",
  },
  {
    question: 'What is the difference between construction jobs and permanent jobs?',
    answer:
      'Construction jobs are one-time and temporary, lasting the two to four years of the build, after which they end. Permanent jobs are the ongoing operations staff who run the facility. Meta Sturgeon illustrates the split clearly: about 3,000 construction jobs collapse to about 300 permanent once the site is running, a ten-to-one ratio. Announcements tend to lead with the larger construction number.',
  },
  {
    question: 'Why is jobs per megawatt the honest metric?',
    answer:
      "Because megawatts are the scarce, shared input every large project competes for, so comparing employment per MW shows what a given slice of grid capacity actually buys. On that measure data centres look weak: about 0.2 to 0.35 permanent jobs per MW, against roughly 8 for an EV battery plant like Volkswagen's St. Thomas site and well over 20 for an electric-arc steelworks like Algoma. That is roughly 25 to 40 times more per MW than a data centre for the battery plant, and higher still for the steelworks.",
  },
  {
    question: 'How much tax revenue does a data centre generate?',
    answer:
      "Our dataset cannot answer this precisely, and that gap is itself a finding. Tax-base-per-MW figures are essentially undisclosed across the Canadian projects we track. The one concrete number is Meta's estimate of about CA$250 million a year to Alberta from its Sturgeon County build, and even that blends taxes with broader economic activity. Property-tax base is the real economic case for a data centre, but it is rarely published in a way that allows a per-MW comparison.",
  },
  {
    question: 'Are the job numbers in announcements reliable?',
    answer:
      'Treat them as projections, not realized employment. They come from company and municipal economic-impact statements, which have every incentive to lead with the largest plausible figure, usually the construction total. Several of the high-employment alternatives in our comparison, including Northvolt in Quebec and Honda in Alliston, were themselves announced with large job counts and then cancelled or shelved, a reminder that an announced number is a plan, not a payroll.',
  },
]

export default function Page() {
  return (
    <SeriesChapter
      slug="jobs-economics"
      description={DESCRIPTION}
      updated={[
        {
          date: POLICY_UPDATE_DATE,
          note: (
            <>
            Adds a short section on Principle 1 of the federal Principles and the economic-development pillar of
            Ontario&rsquo;s proposed Playbook. Both need employment figures Canada cannot produce, because Statistics
            Canada has no NAICS code for data centres. A screen applied to proponent projections rewards the proponent
            who projects most confidently.
            </>
          ),
        },
        {
          date: CBRE_UPDATE_DATE,
        note: (
          <>
            Adds the strongest version of the counterargument and answers it: CBRE&rsquo;s finding that data centres will
            supply nearly half of Loudoun County&rsquo;s property tax revenue in 2026, alongside its published position that the
            benefits of data-centre growth outweigh the drawbacks. CBRE is identified as a data-centre services provider
            rather than a neutral party. Also adds the skilled-trades constraint on construction costs.
            Updated 25 August with the first post-hoc government audit of data-centre employment, Virginia&rsquo;s
            JLARC review, which confirms the construction-versus-operations asymmetry but implies a higher jobs-per-
            megawatt rate than our benchmark. The chapter now states the density sensitivity rather than a single ratio,
            and explains why no Canadian equivalent of that audit can currently exist: there is no NAICS code for data
            centres.
          </>
        ),
        },
      ]}
    >
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm text-gray-700">
          <strong className="text-zeever-text">The short version.</strong>{' '}A data centre is a construction project with a small permanent staff bolted on. The build creates a real, temporary boom, and the finished site adds to the local property-tax base. But the ongoing payroll is thin. The honest way to compare is jobs per megawatt, because megawatts are the scarce input every project fights over. On that measure data centres deliver roughly 0.2 to 0.35 permanent jobs per MW, while an EV battery plant delivers 25 to 40 times more jobs per MW, and steel and petrochemical complexes more still. Meta&rsquo;s CA$13 billion, 1 gigawatt Alberta build lands at about 300 permanent jobs.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Two numbers, and only one of them lasts</h2>
      <p>
        Every data-centre announcement comes with a jobs figure, and almost every one of them is really two figures blended into a headline. The first is construction employment, which is large, temporary, and gone the moment the concrete cures. The second is permanent operations employment, which is what the community actually keeps. Reporting them as one number is where the jobs story goes wrong.
      </p>
      <p>
        Meta&rsquo;s Sturgeon County project is the cleanest illustration in our data. The company projects roughly 3,000 construction jobs during the build and about 300 permanent jobs once the 1 gigawatt facility is running. That is a ten-to-one collapse. The construction crews frame the ribbon-cutting; the 300 operators keep the lights on for the next twenty years. Both numbers are worth having, but only if you keep them apart, and only if you remember they are projections in a company newsroom post, not realized payroll.
      </p>
      <p>
        Hold on to that word, projections. Nearly every employment figure in this chapter, for data centres and for the alternatives alike, comes from an announcement or an economic-impact statement written by a party with a reason to make the number large. We treat them as plans, not headcounts.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Jobs per megawatt, benchmarked</h2>
      <p>
        Raw job totals are unfair comparisons, because a bigger project should employ more people. The question worth asking is how much employment you get per unit of the one input everyone is competing for: grid power. Megawatts are scarce, they are shared, and in Alberta they are rationed. So jobs per megawatt is the metric that actually decides whether a given slice of the grid was well spent.
      </p>
      <p>
        Here is where the comparison lands, drawn from our project data. One caution before the numbers, and it matters more than a footnote. The data-centre figure is an industry staffing benchmark, not a measured Canadian facility, and it is highly sensitive to how dense the building is: an older colocation hall employs far more people per megawatt than a modern AI hall of the same footprint. Treat it as a rule of thumb for new hyperscale capacity, which is what Meta&rsquo;s own numbers describe, and see the section below for where that rule of thumb strains:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Hyperscale data centre:</strong>{' '}about 0.2 to 0.35 permanent jobs per MW. At 380 MW that is roughly 75 to 130 permanent staff; at 100 MW, about 20 to 35. Meta&rsquo;s 1 GW Sturgeon build sits right in the band at 0.3 (about 300 permanent).</li>
        <li><strong>EV battery cell plant:</strong>{' '}Volkswagen PowerCo in St. Thomas, Ontario draws a dedicated 380 MW line to support about 3,000 permanent jobs, roughly 8 jobs per MW, or 25 to 40 times the data-centre rate for the same power.</li>
        <li><strong>Steel (electric-arc furnace):</strong>{' '}Algoma Steel in Sault Ste. Marie runs a roughly 2,800-person integrated steelworks on about 110 to 115 MW of self-generation. That headline is total workforce rather than net-new hires, but the per-MW employment still dwarfs a data centre at the same load.</li>
        <li><strong>Petrochemicals:</strong>{' '}Dow&rsquo;s Path2Zero complex in Fort Saskatchewan projects 400 to 500 permanent plus 7,000 to 8,000 construction jobs. Its grid draw is not disclosed, so we cannot compute a clean per-MW figure, but the employment scale is an order of magnitude above a data centre.</li>
        <li><strong>For context, non-industrial uses:</strong>{' '}the Toronto Port Lands housing plan turns former industrial land into about 5,000 homes and roughly 2,900 jobs while drawing very little dedicated power, and the Port of Montreal&rsquo;s Contrecoeur terminal projects 1,200 operational jobs plus up to 8,000 during construction.</li>
      </ul>
      <p>
        The pattern is consistent and it is not close. A megawatt routed to a battery plant, a steel mill, or a port employs far more people than a megawatt routed to a data centre. That does not make data centres worthless, but it does puncture the idea that they are jobs engines. They are not. They are capital-intensive infrastructure that happens to need a modest crew to run.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What an actual audit found, and where our number strains</h2>
      <p>
        Everything above rests on benchmarks and announcements. There is one place where a government has gone back and audited the industry after it was built, and it is worth taking seriously because it is the largest data-centre market on earth.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">Virginia counted, and the shape matches</h3>
      <p>
        In December 2024 Virginia&rsquo;s Joint Legislative Audit and Review Commission reported on the roughly 340 data-centre buildings drawing about 5 GW in the state. It found the industry supports around{' '}<strong>74,000 jobs</strong>,{' '}<strong>$5.5 billion</strong>{' '}in labour income and{' '}<strong>$9.1 billion</strong>{' '}in annual GDP &mdash; and that the majority of that activity comes from{' '}<strong>construction rather than ongoing operations</strong>. A construction site can employ up to 1,500 workers. For daily operations, JLARC found,{' '}<strong>most facilities will employ fewer than 50 people</strong>.
      </p>
      <p>
        That is this chapter&rsquo;s central claim, confirmed by a legislative auditor rather than by an advocacy group or a broker: the economic benefit is front-loaded into the build, and the permanent workforce is small.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">But the per-megawatt ratio does not survive contact with it</h3>
      <p>
        Run JLARC&rsquo;s figures against Virginia&rsquo;s fleet and our rule of thumb looks too low. Five gigawatts across 340 buildings averages about{' '}<strong>14.7 MW per building</strong>. At fewer than 50 operations staff each, that implies somewhere between roughly 1.4 and 3.4 direct operations jobs per megawatt. Our 0.2 to 0.35 band, applied to the same 5 GW, would produce only about 1,000 to 1,750 jobs statewide, or three to five people per building &mdash; which is implausibly thin for a facility that needs security, mechanical and electrical staff around the clock.
      </p>
      <p>
        The reconciliation is density, and it is the useful part. Virginia&rsquo;s fleet is full of older, smaller, lower-density colocation halls at under 15 MW apiece, and those are staff-heavy per megawatt. A new 100 MW AI hall concentrates the same power into far fewer buildings with far fewer people. So the honest statement is not a single ratio but a direction of travel:{' '}<strong>employment per megawatt falls as facilities get denser</strong>, and the AI buildout is the densest construction the industry has ever done. The Canadian announcements straddle the range for exactly this reason &mdash; Meta&rsquo;s Sturgeon campus at 0.3 jobs per MW, Beacon&rsquo;s Foothills hub at 0.75.
      </p>
      <p>
        Both framings point the same way against the alternatives in this chapter. Even at JLARC&rsquo;s more generous implied rate, a battery plant at roughly 8 jobs per MW still employs several times more people for the same power.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">Canada cannot check any of this, because the statistics do not exist</h3>
      <p>
        The obvious response is to look up what Canadian data centres actually employ. You cannot, and the reason is structural rather than a matter of corporate secrecy.
      </p>
      <p>
        <strong>There is no NAICS code for data centres.</strong>{' '}Statistics Canada classifies establishments by primary business activity, and the closest category is subsector 518, renamed in the 2022 revision to &ldquo;computing infrastructure providers, data processing, web hosting, and related services.&rdquo; It bundles hyperscale facilities together with web hosts, payroll processors, and one-person cloud consultancies. As of 2025 that subsector contained{' '}<strong>1,419 employer establishments and 3,282 non-employers or indeterminate</strong>{' '}ones nationally, spread as 715 employers in Ontario, 259 in British Columbia, 216 in Quebec and 136 in Alberta. The size profile gives the game away: in 2023,{' '}<strong>46.2 percent of employer establishments in the category had fewer than five employees</strong>, another 47.4 percent were small, and just 1.4 percent had more than 500 people on payroll.
      </p>
      <p>
        A classification in which nearly half of all establishments are fewer than five people is not measuring gigawatt campuses. It cannot be filtered down to them either, because an establishment is assigned to a code by whichever product earns it the most revenue, so a data centre operated by a telecom lands under telecommunications and one run in-house by a bank lands under banking.
      </p>
      <p>
        The consequence is that no Canadian government can currently answer the question this chapter asks. Not because operators refuse to say, but because nobody collects it in a form that isolates the industry. Every Canadian number in circulation &mdash; AWS&rsquo;s 950-plus FTE for the Calgary region, Meta&rsquo;s 300 permanent at Sturgeon County, Beacon&rsquo;s 300 &mdash; is a projection made at announcement, and not one of them has been checked against payroll after opening. It is the same failure as the water meter at Varennes, in a different department: the number was never collected, so there is nothing to disclose.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The capital-per-job problem</h2>
      <p>
        The weakness sharpens when you put the money next to the payroll. Data centres are expensive per megawatt: our capital data puts Meta Sturgeon at roughly CA$13 million per MW, QScale in Quebec at about CA$7.4 million, eStruxture&rsquo;s Calgary build at CA$8.3 million, Beacon&rsquo;s Alberta campuses near CA$10 million, and Vantage&rsquo;s Quebec City site at CA$15.6 million. That capital buys chips, cooling, and power, not staff.
      </p>
      <p>
        Divide the spend by the permanent jobs and the ratio is stark. Meta&rsquo;s CA$13 billion facility, at about 300 permanent jobs, works out to roughly CA$43 million of capital per permanent job. Volkswagen&rsquo;s St. Thomas battery plant, at about CA$7 billion for around 3,000 jobs, is closer to CA$2.3 million per job. On capital-per-permanent-job, the battery plant is nearly twenty times more labour-efficient. Both figures come straight from the announced totals, and both should be read as planning numbers, but the direction is unambiguous.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The tax base we mostly cannot see</h2>
      <p>
        If the jobs case is weak, the honest counter is the tax case. A large data centre is a durable, high-assessed-value property that pays municipal and provincial taxes for decades, and unlike a battery plant it does not need thousands of workers, houses, or schools to support it. In principle that is the real economic argument for welcoming one.
      </p>
      <p>
        In practice, we cannot verify it, and that is a finding in itself. Across the Canadian projects we track, tax-base-per-megawatt is essentially undisclosed. The alternative-land-use dataset carries an explicit tax-base column, and for every project in it, that field is empty. The single concrete economic-return figure anywhere in our records is Meta&rsquo;s estimate of about CA$250 million a year to Alberta from the Sturgeon build, and even that number blends taxes with broader economic activity rather than isolating property tax. So the strongest argument for data centres is also the least documented one. Anyone claiming a data centre pays for itself in tax revenue is, on the public record, asking to be taken on faith.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What the incentives actually buy</h2>
      <p>
        Follow the incentives and the difference in kind becomes clear. The alternatives in our data were pulled in with cash: Honda&rsquo;s Ontario EV hub was offered up to CA$5 billion in government support, Umicore&rsquo;s battery-materials plant about CA$1 billion, Dow&rsquo;s petrochemical complex roughly CA$1.8 billion in provincial incentive-program support, and Air Products&rsquo; hydrogen complex about CA$461 million. Those subsidies were explicitly tied to manufacturing jobs and supply-chain anchoring.
      </p>
      <p>
        The data centres in our data mostly did not get cash. What they got was regulatory acceleration and power-siting advantage. For most projects the government-incentive field reads &ldquo;no cash subsidy disclosed.&rdquo; What stands out instead is Alberta scrapping the provincial environmental impact assessment for Kevin O&rsquo;Leary&rsquo;s Wonder Valley in April 2026, and Premier Smith citing the abeyance of federal Clean Electricity Regulations as part of the backdrop to Meta&rsquo;s build. The public gives data centres speed and clearance rather than dollars. That is a cheaper deal for the treasury, but it also means the province is spending its regulatory and clean-power capital rather than getting paid for it, and getting few permanent jobs in return.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">When a data centre is, and is not, a good deal</h2>
      <p>
        None of this makes data centres a bad idea everywhere. There is a version of the trade that is clearly worth it: a facility that lands on brownfield land nobody else wants, connects without displacing higher-value load from the grid, pays a well-documented property-tax stream, and anchors a sovereign-AI capability the country actually needs. On stranded power or genuinely surplus capacity, 300 permanent jobs plus a tax base plus strategic compute is a fine outcome.
      </p>
      <p>
        The deal turns bad when the ingredients are scarce. When a data centre takes one of only two Phase-1 grid connections Alberta will issue before 2028, or draws down finite hydro that a battery plant or a steel mill could have used to employ twenty-five times as many people, the opportunity cost is real and large. That is the case the next chapters take up: the capital flowing into this build, and the alternative uses the same land, power, and money could have served.
      </p>
      <p>
        A caveat cuts both ways here. The high-employment alternatives are not guaranteed either. Northvolt&rsquo;s 3,000-job Quebec gigafactory went bankrupt in 2025, and Honda&rsquo;s Ontario hub was shelved in 2026 amid soft EV demand. Their job numbers were projections too, and some of those projections evaporated. The point is not that batteries always beat data centres. It is that when you compare on jobs per megawatt, honestly and with the construction and permanent numbers kept separate, the data centre is close to the bottom of the list.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The tax-base counterargument, and what it is worth</h2>
      <p>
        The industry&rsquo;s answer to the jobs-per-megawatt problem is that jobs are the wrong metric, and the honest thing to do is state that case at its strongest. CBRE &mdash; which sells data-centre services, and should be read with that in mind &mdash; published a brief in May 2026 titled{' '}<em>Benefits Far Outweigh Drawbacks of Rising Data Center Development</em>, arguing that growth delivers jobs, tax revenue and infrastructure upgrades despite rising local opposition.
      </p>
      <p>
        The tax half of that argument has a real number behind it. In Loudoun County, Virginia &mdash; the densest data-centre cluster on earth &mdash; CBRE reports data centres will contribute{' '}<strong>nearly half of local property tax revenue in 2026</strong>. That is a genuinely large public benefit, and any Canadian municipality weighing a proposal should want to know it.
      </p>
      <p>
        Two things temper it. First, Loudoun is the extreme case: it is what happens after two decades and four gigawatts of concentration, not what a single 100 MW campus delivers to a mid-sized Ontario city. Second, a property-tax base is not an employment base, and the two are financed by the same megawatts. The comparison this chapter makes is not data centres against nothing; it is data centres against the other things that could use the same power. A battery plant also pays property tax, and employs 25 to 40 times more people per megawatt while doing it.
      </p>
      <p>
        There is also a cost pressure on the construction-jobs side. CBRE reports a shortage of skilled trades &mdash; mechanics, electricians, plumbers, labourers &mdash; and expects that attracting them from other industries will raise development costs. The construction boom is real, but it is bidding against the same trades every other Canadian megaproject needs.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Two screens that need a number Canada does not have</h2>

      <p>
        The federal Principles ask projects to create lasting local benefits. Ontario&rsquo;s proposed Playbook makes
        economic development one of three screening pillars, which is stronger: a pillar decides who gets grid access.
      </p>

      <p>
        Both need employment figures Canada cannot produce. Statistics Canada has no NAICS code for data centres, and
        the closest category bundles them with web hosts and one-person consultancies. Every Canadian jobs figure in
        this chapter is a projection made at announcement, by the proponent, before construction. A screen applied to
        proponent projections rewards the proponent who projects most confidently, and the one post-hoc government count
        that exists anywhere, Virginia&rsquo;s JLARC audit, found most facilities employing fewer than fifty people.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The takeaway</h2>
      <p>
        Data centres are sold as economic development, and the label is only half right. The construction boom is real but temporary. The tax base may be real but is almost never disclosed in a way anyone can check. The permanent employment is small, on the order of 0.2 to 0.35 jobs per megawatt, and Meta&rsquo;s flagship 1 gigawatt project confirms it at about 300 jobs. Measured against the batteries, steel, and petrochemicals competing for the same scarce power, that is tens of times fewer jobs for each megawatt spent, 25 to 40 times against an EV battery plant and more against steel. The right way to greet a data-centre announcement is not to ask how many jobs, but how many permanent jobs per megawatt, and then to ask what else that megawatt could have done.
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
        Primary and reputable secondary sources: Virginia&rsquo;s Joint Legislative Audit and Review Commission (the December 2024 audit of the state&rsquo;s data-centre industry, the only post-hoc government count of operations employment available); Statistics Canada and ISED Canadian Industry Statistics (NAICS subsector 518 establishment counts and size distribution, cited to show what the classification cannot measure); CBRE Research (Loudoun County property-tax share and construction-labour constraints; the &ldquo;benefits outweigh drawbacks&rdquo; framing is CBRE&rsquo;s own position as a data-centre services provider); Meta Data Centers and Global News (the Sturgeon County build, its construction and permanent job projections, and the CA$250 million annual figure); Volkswagen Group and Hydro One (the St. Thomas PowerCo battery plant and its 380 MW line); Algoma Steel and Northern Ontario Business (the electric-arc furnace conversion); Dow and CBC News (the Path2Zero petrochemical complex); Waterfront Toronto and CreateTO (the Port Lands housing plan); the Canada Infrastructure Bank and the Prime Minister&rsquo;s Office (Contrecoeur); QScale, eStruxture, Vantage Data Centers, and Beacon AI Centers (per-megawatt capital costs); the Government of Canada, CBC News, and Electrek (the Honda, Umicore, Dow, and Air Products incentive figures); and National Observer (the Wonder Valley environmental-assessment exemption). Job and tax figures are announcement projections unless otherwise noted, and tax-base-per-megawatt is largely undisclosed across the dataset.
      </p>
    </SeriesChapter>
  )
}
