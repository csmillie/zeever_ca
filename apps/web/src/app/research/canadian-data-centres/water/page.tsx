import type { Metadata } from 'next'
import SeriesChapter from '@/components/SeriesChapter'
import { FAQPageJsonLd } from '@/components/JsonLd'
import { getChapter, chapterUrl, CBRE_UPDATE_DATE, POLICY_UPDATE_DATE } from '@/lib/aiInfrastructureSeries'

const chapter = getChapter('water')!
const PAGE_URL = chapterUrl('water')
const DESCRIPTION =
  "Water is the least-disclosed input in Canada's AI buildout. No project publishes a measured intensity figure, and most Alberta sites sit in stressed basins."

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
    question: 'How much water do Canadian AI data centres actually use?',
    answer:
      'No one can say precisely, because no Canadian AI data centre publishes a measured water-intensity figure. The only project-level numbers that exist are a licence cap and a set of filing estimates. Wonder Valley holds a licence for up to 6 million cubic metres a year from the Smoky River, and Beacon AI Indus filings describe a draw of about 1.5 million litres a day for the campus. Both are allocation ceilings or planning estimates, not metered use.',
  },
  {
    question: 'Does closed-loop cooling mean zero water?',
    answer:
      'No. Closed-loop and direct-to-chip systems recirculate coolant and use far less water than evaporative cooling, but at hyperscale they still need makeup water for peak heat rejection. A closed-loop Meta campus in Indiana is estimated to need about 30.3 million litres a day (8 million gallons) at full buildout. In Alberta, Beacon AI Indus describes closed-loop glycol cooling with minimal process water, yet its own filings put the campus draw near 1.5 million litres a day.',
  },
  {
    question: 'How much does cooling method change water use?',
    answer:
      'By roughly an order of magnitude. Benchmark figures put evaporative or open-loop cooling around 1,800 to 2,900 litres per megawatt-hour, and up to about 4,000 in hot climates, while hyperscale water-use efficiency spans roughly 90 to 1,800 litres per megawatt-hour depending on site and climate. Air-cooled and dry systems use almost no direct water but spend more electricity. These are vendor and benchmark averages, not any Canadian project measured value.',
  },
  {
    question: 'Which Alberta data centres sit in water-stressed areas?',
    answer:
      'A Canada National Observer analysis of 38 proposed Alberta campuses found that about three-quarters sit in basins rated high or extremely high stress on the WRI Aqueduct index, and only 3 of the 38 sit in low-stress areas. The Bow and Oldman basins have been closed to new surface-water licences since 2006 because they are over-allocated, yet 13 data centres totalling 5,744 megawatts are proposed there, and 4 already have grid approval.',
  },
  {
    question: 'Is the water worry overblown for a country with as much water as Canada?',
    answer:
      'Some analysts argue it can be. The Canadian Centre for Policy Alternatives has called broad data-centre water concern overblown for water-rich Canada, while flagging water-stressed basins as the real exception. The evidence supports a split view: nationally Canada has abundant water, but the specific basins where Alberta developers want to build, and the near-total absence of measured disclosure, are the legitimate problems.',
  },
]

export default function Page() {
  return (
    <SeriesChapter
      slug="water"
      description={DESCRIPTION}
      updated={[
        {
          date: POLICY_UPDATE_DATE,
          note: (
            <>
            Adds a short section on Principles 3 and 4 of Canada&rsquo;s Responsible Data Centre Development
            Principles, launched 3 September 2026, which ask signatories to minimise water use and be transparent about
            local impacts. Neither carries a metric, a unit, a reporting cadence, an auditor or a consequence. That
            ordering is this chapter&rsquo;s subject: a disclosure expectation presumes the number exists, and at AWS
            Varennes it did not.
            </>
          ),
        },
        {
          date: CBRE_UPDATE_DATE,
        note: (
          <>
            Adds industry cooling benchmarks from CBRE (cooling at roughly 40 percent of load; closed-loop systems cutting
            freshwater use by up to 70 percent) and uses them to sharpen the chapter&rsquo;s existing argument: a relative
            reduction claim against an undisclosed baseline, whether CBRE&rsquo;s or an operator&rsquo;s, is not a measurement.
            A later pass on 23 August added the licence-holder wrinkle at Wonder Valley: the 24 million cubic metre
            preliminary certificate is held by the municipality, not the proponent.
            Updated 25 August with the first substantial Ontario and Quebec evidence: permit and forecast figures for
            Microsoft&rsquo;s Etobicoke and Vaughan sites, and CBC&rsquo;s finding that AWS&rsquo;s Varennes facility has
            run since 2018 with no water meter at all. The chapter&rsquo;s argument changes accordingly &mdash; the
            problem is not only non-disclosure, it is that some of this was never measured.
          </>
        ),
        },
      ]}
    >
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm text-gray-700">
          <strong className="text-zeever-text">The short version.</strong>{' '}Of every input into Canada&rsquo;s AI data-centre boom, water is the one nobody will measure in public. Not a single Canadian AI data centre has published a measured water-intensity figure. The only project-level numbers that exist are a licence cap at Wonder Valley and draw estimates in Beacon AI Indus filings, and neither is metered use. Meanwhile cooling method quietly decides everything, evaporative versus closed-loop versus air can swing water use by an order of magnitude, and roughly three-quarters of planned Alberta sites sit in basins the WRI Aqueduct index rates high or extremely high stress. Water is the least-disclosed input and the most locally contentious, and those two facts are related.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The input nobody measures</h2>
      <p>
        Power at least gets counted. Grid operators publish queues, developers file megawatt figures, regulators rule on gas plants in the open. Water is different. Across our dataset of Canadian AI data centres, not one publishes a measured, audited water-intensity figure, no litres per megawatt-hour, no annual withdrawal, no consumption number you could check against a meter. What exists instead is a scatter of licence ceilings, planning estimates, and relative marketing claims, each of which needs its own caveat.
      </p>
      <p>
        The pattern repeats project to project. QScale&rsquo;s Q01 campus in Quebec markets direct liquid cooling and up to roughly 80 percent free-air cooling, but publishes no litres per day and no water-use efficiency figure. TELUS describes its B.C. sovereign AI cluster as sealed closed-loop with &ldquo;up to 90 percent&rdquo; water reduction, a relative claim with no absolute litres and no stated baseline. The Beacon and VoltaGrid proponents in Saint John told the community they simply could not state their closed loop&rsquo;s water volume, and deferred the figure to a future environmental impact assessment. Disclosure this thin is not an accident of a young industry. It is the norm.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Two numbers, and what they really are</h2>
      <p>
        Only two Canadian projects give you anything project-specific to hold, and both come with heavy asterisks about what kind of number they are.
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li><strong>Wonder Valley</strong>{' '}(O&rsquo;Leary Ventures, near Grande Prairie) holds a water licence for up to 6 million cubic metres a year from the Smoky River, plus a preliminary certificate for up to 24 million cubic metres a year. Converted to a daily rate, the 6 million cubic metre licence works out to about 16.4 million litres a day, and the 24 million cubic metre certificate to about 65.8 million litres a day. Those are annual allocation ceilings divided by 365, not metered consumption. The company frames the withdrawal as roughly 0.0556 percent of the Smoky River&rsquo;s annual flow and under 1 percent of daily flow, restrictable in low-flow periods. Sturgeon Lake Cree Nation appealed the licence; the appeal was dismissed on April 17, 2026.</li>
        <li><strong>Beacon AI Indus</strong>{' '}(near Calgary) describes &ldquo;closed-loop glycol cooling with minimal process-water use&rdquo; in its filings. Yet those same regulatory filings, surfaced by Canada&rsquo;s National Observer, put the campus draw at up to about 1.5 million litres a day, plus roughly 750,000 litres for steam generators and fire safety. That is a filing estimate, not a meter reading, and it undercuts the &ldquo;minimal water&rdquo; framing on the project&rsquo;s own paperwork.</li>
      </ul>
      <p>
        Notice also who holds the paper. The preliminary certificate for that 24 million cubic metre diversion was granted to the{' '}<em>municipality</em>, Greenview, for industrial and commercial use across its industrial gateway, rather than to the data-centre proponent. That matters for accountability: where the water entitlement sits with a municipality rather than the operator, the project may never need a licence in its own name, and the disclosure obligations that would attach to one never attach to anybody. It is the water version of a pattern chapter four traces on the emissions side, where the regulated entity is always something adjacent to the data centre rather than the data centre itself.
      </p>
      <p>
        Notice how much work the units are doing. A licence cap in cubic metres per year, a filing draw in litres per day, a benchmark in litres per megawatt-hour, and a U.S. comparator in millions of gallons per day are four different kinds of number. Reporting that flattens them into one headline figure is the fastest way to be wrong about this file.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Cooling method drives the order of magnitude</h2>
      <p>
        The reason water use is so hard to pin down is that it is set almost entirely by a design choice that projects rarely detail: how the heat gets rejected. The spread between methods is not a rounding difference. It is roughly an order of magnitude.
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li><strong>Evaporative or open-loop</strong>{' '}cooling, the traditional workhorse, runs around 1,800 to 2,900 litres per megawatt-hour on benchmark figures, and up to roughly 4,000 in hot, dry climates. It loses water to the atmosphere by design.</li>
        <li><strong>Closed-loop and direct-to-chip</strong>{' '}systems recirculate a fixed charge of coolant. Hyperscale water-use efficiency across climate zones spans roughly 90 to 1,800 litres per megawatt-hour, and the newest builds push toward near-zero ongoing draw, fill plus makeup only.</li>
        <li><strong>Air-cooled and dry</strong>{' '}systems use almost no direct water, but shift the cost to electricity through a higher power-usage effectiveness.</li>
      </ul>
      <p>
        For scale, vendor fleet averages sit at the low end: Microsoft reports a fleet water-use efficiency near 0.30 litres per kilowatt-hour, about 300 litres per megawatt-hour, down from 0.49 in 2021, with new builds designed for zero water. A secondary estimate puts AWS near 0.19 litres per kilowatt-hour, about 190 litres per megawatt-hour. These are vendor and benchmark numbers, self-reported and not Canada-specific, and they are useful only as reference points. None of them is a measured value from a Canadian AI project, because no such published value exists.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">&ldquo;Closed-loop&rdquo; is not the same as zero-water</h2>
      <p>
        The most common reassurance from proponents is that their cooling is closed-loop, as if that settled the question. At small scale it nearly does. At hyperscale it does not, and the evidence for that is worth stating plainly.
      </p>
      <p>
        A closed-loop Meta campus in Indiana is estimated, in an academic preprint, to still require about 30.3 million litres a day (8 million gallons) of makeup water for peak heat rejection at full buildout. It is a U.S. comparator from a lower-credibility source, so treat the exact figure as indicative. But the direction is the point: a system marketed as closed-loop still consumes tens of millions of litres a day when it is large enough. Alberta&rsquo;s own Beacon AI Indus filings make the same point domestically, with a closed-loop design that still draws around 1.5 million litres a day. And in New Brunswick, Maine legislators reviewing a related VoltaGrid project flagged that even &ldquo;closed-loop&rdquo; systems can produce unaddressed wastewater discharge. Closed-loop reduces water use. It does not zero it out, and it does not remove the discharge question.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Three-quarters of Alberta&rsquo;s sites are in stressed basins</h2>
      <p>
        Disclosure would matter less if the projects sat where water is plentiful. Many do not. Canada&rsquo;s National Observer analyzed 38 proposed Alberta data-centre campuses against the WRI Aqueduct 4.0 stress index and AESO connection data, and the result is the sharpest single finding in this chapter.
      </p>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li>Roughly{' '}<strong>three-quarters</strong>{' '}of the 38 campuses sit in basins rated high stress (at least 40 percent of available supply already used) or extremely high stress (at least 80 percent). Only{' '}<strong>3 of the 38</strong>{' '}sit in low-stress areas.</li>
        <li>The{' '}<strong>Bow and Oldman basins</strong>{' '}have been closed to new surface-water licences since 2006 because they are over-allocated. Yet{' '}<strong>13 data centres totalling 5,744 megawatts</strong>{' '}are proposed within them, and{' '}<strong>4 already have grid approval</strong>.</li>
        <li>Under Alberta&rsquo;s &ldquo;first in time, first in right&rdquo; system, developers can buy or inherit senior water rights to get around a closed basin, which turns water allocation into a market rather than a public planning decision.</li>
      </ul>
      <p>
        The province has also widened its own room to maneuver. Alberta&rsquo;s 2025 Water Amendment Act lets the government approve &ldquo;low-risk&rdquo; inter-basin water transfers by ministerial order, moving water between watersheds administratively rather than through the older, slower licensing path. Combined with over-allocated basins and near-total non-disclosure, that is why water, not power, is often the flashpoint at the local level, from Wonder Valley to the Saint John opposition to residents in Olds who openly questioned Synapse&rsquo;s closed-loop cooling claims.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The counter-view, for balance</h2>
      <p>
        It would be one-sided to leave it there. Not everyone thinks data-centre water use is a crisis in the Canadian context, and the strongest counter-argument deserves a fair hearing.
      </p>
      <p>
        The Canadian Centre for Policy Alternatives has argued, through analyst Hadrian Mertins-Kirkwood, that broad data-centre water concern is overblown for a water-rich country like Canada, while explicitly flagging water-stressed basins as the exception that does warrant scrutiny. That is a defensible position, and the numbers partly support it. Nationally, Canada is not Arizona. For a sense of the U.S. baseline, the Lawrence Berkeley National Laboratory estimated American data centres used about 17 billion gallons (roughly 64 billion litres) of direct cooling water in 2023, projected to double by 2028, and Ceres found 32 percent of U.S. data centres sit in high or extremely high stress areas. Canada&rsquo;s overall endowment is far more comfortable than that.
      </p>
      <p>
        But national abundance is not the metric that decides whether a specific campus stresses a specific river. The honest synthesis is a split one. In aggregate, Canada has water to spare. In the exact basins where Alberta developers most want to build, it does not, and the absence of any measured, published water figure means the public is being asked to trust the reassurances without the meter. Both things are true at once, and the CCPA framing captures the first without dissolving the second.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What we can and cannot say</h2>
      <p>
        Strip away the marketing and the fair conclusion is narrow but firm.
      </p>
      <ol className="list-decimal pl-6 space-y-1 text-sm">
        <li>No Canadian AI data centre publishes a measured water-intensity figure. Every project-level number in circulation is a licence cap, a filing estimate, or a relative claim, and should be labelled as such.</li>
        <li>Cooling method sets water use to within an order of magnitude, and &ldquo;closed-loop&rdquo; at hyperscale is not zero-water. The reassuring word is doing more work than the physics allows.</li>
        <li>Roughly three-quarters of planned Alberta sites sit in high or extreme water-stress basins, several of which have been closed to new surface-water licences for nearly two decades.</li>
        <li>Nationally the water endowment is genuinely large, which is why the concern is best framed as basin-specific, not country-wide.</li>
      </ol>
      <p>
        The fix is not exotic. It is the meter reading itself: mandatory, audited, per-facility disclosure of withdrawal and consumption, reported in consistent units and separated from licence ceilings. Until that exists, water will stay what it is today, the least-disclosed input in the buildout and, not coincidentally, the one that keeps ending up in front of a tribunal.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">It is not only undisclosed. Some of it was never measured</h2>
      <p>
        This chapter has been built on Alberta filings, which is where the largest projects are. But the sharpest evidence about Canadian data-centre water turned up in Ontario and Quebec, and it changes what the problem actually is.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">Ontario: permits in the billions of litres</h3>
      <p>
        Microsoft has been converting seven Canadian land parcels bought in 2021 into AI-capable data centres, including a former department store in Etobicoke. That site,{' '}<strong>YTO 40</strong>, was cleared by the City of Toronto to draw up to{' '}<strong>39.75 litres of water per second</strong>{' '}for cooling, according to planning documents filed with the city. Run continuously, that permit is worth roughly{' '}<strong>1.2 billion litres a year</strong>. The building will have a gross floor area of 280,000 square feet.
      </p>
      <p>
        At a second Microsoft complex in nearby{' '}<strong>Vaughan</strong>, a city spokesperson put expected consumption at{' '}<strong>730 million litres annually</strong>. Microsoft disputes the implication, saying its new Canadian sites will use only a fraction of that because they are designed to cool with outdoor air and recycled rainwater.
      </p>
      <p>
        Both of those are worth stating precisely, because neither is a measurement. One is a permit ceiling and the other is a municipal forecast, and the operator&rsquo;s rebuttal is a design claim. Three different kinds of number, none of them metered, and no way to adjudicate between them.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">Quebec: no meter at all</h3>
      <p>
        Then there is the fact that reframes the entire chapter. Amazon Web Services has operated a data centre at{' '}<strong>Varennes, Quebec</strong>, since{' '}<strong>2018</strong>. CBC found the facility{' '}<strong>is not equipped with a water meter</strong>, so, in the municipality&rsquo;s own words, no one in Varennes knows how much water is being consumed. A city spokesperson said a meter would be installed soon. Amazon did not answer questions about consumption at the site, but said that for about 95 percent of the year it cools its Montreal-area facilities with outside air rather than water.
      </p>
      <p>
        Seven years of operation by one of the largest infrastructure companies on earth, in a municipality that bills commercial water by volume, and the quantity was simply never recorded. That is a different failure from non-disclosure. You cannot withhold a number that does not exist.
      </p>
      <h3 className="text-base font-semibold text-zeever-text pt-2">Which means the fix is metering, not just disclosure</h3>
      <p>
        The distinction matters for policy. A disclosure mandate assumes the data is sitting in a file somewhere and merely needs to be published. At Varennes there was nothing to publish. So the first requirement is instrumentation: meter the water, to a defined standard, and only then require the number to be reported.
      </p>
      <p>
        The standard already exists. Natural Resources Canada&rsquo;s{' '}<em>Best Practice Guide for Canadian Data Centres</em>{' '}adopts water usage effectiveness, litres consumed per kilowatt-hour of IT energy, as defined by ISO/IEC 30134-9:2022, and cites a US Department of Energy average of{' '}<strong>1.8 litres per kWh</strong>{' '}for reference. So does the precedent: since September 2024, data centre operators in the European Union with at least 500 kW of installed IT power have been required to report energy and water figures to a European database. Canada has the metric, and a working model for the mandate, and applies neither.
      </p>
      <p>
        There is also a partial shortcut nobody has used. Toronto and many other Canadian cities bill commercial customers by volume, which means municipal utilities already hold metered records for the sites that are connected and metered. Those records are obtainable. In Oregon, a newspaper&rsquo;s public-records suit is what eventually established that a Google data centre accounted for a quarter of The Dalles&rsquo; municipal water use in 2021, and Google had paid for the city&rsquo;s side of the litigation.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What the industry says good practice looks like</h2>
      <p>
        One benchmark is worth putting beside the Canadian silence, with a caveat attached. CBRE&rsquo;s own guidance to the market holds that cooling accounts for roughly{' '}<strong>40 percent</strong>{' '}of a data centre&rsquo;s power draw, that closed-loop cooling systems can cut freshwater use by{' '}<strong>up to 70 percent</strong>, and that free cooling &mdash; using cold outside air &mdash; can avoid water altogether. Canada&rsquo;s climate makes the last of those unusually available.
      </p>
      <p>
        That is useful as a frame and useless as evidence about any specific project, which is precisely this chapter&rsquo;s point. &ldquo;Up to 70 percent&rdquo; and TELUS&rsquo;s &ldquo;up to 90 percent&rdquo; are the same species of claim: a relative reduction against an undisclosed baseline. Neither can be checked, neither is measured, and neither tells a watershed how many litres are actually leaving it. The disclosure gap is not that Canadian operators lack good cooling designs. It is that a design claim has been allowed to stand in for a measurement.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">A principle is not a meter</h2>

      <p>
        The federal Principles announced in September 2026 ask signatories to minimise water use and environmental
        impact, and to be transparent about local impacts. Both are the right ambitions. Neither carries a metric, a
        unit, a reporting cadence, an auditor, or a consequence.
      </p>

      <p>
        That ordering is the problem this chapter exists to describe. A disclosure expectation presumes the number
        already exists, and at AWS Varennes it did not: the facility ran for seven years without a water meter. The
        European Union did not ask operators to be transparent. It required reporting under EU 2024/1364 for facilities
        above 500 kW and pointed at ISO/IEC 30134-9 for how to measure. Meter first, then mandate disclosure. A
        voluntary principle arrives in the opposite order, asking for candour about a quantity nobody is obliged to
        measure.
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
        Primary and reputable secondary sources: CBC News investigative reporting (the Etobicoke and Vaughan permit and forecast figures, and the absence of a water meter at AWS Varennes); Natural Resources Canada&rsquo;s{' '}<em>Best Practice Guide for Canadian Data Centres</em>{' '}(the WUE definition under ISO/IEC 30134-9:2022 and the reference average); the Environmental Law Centre&rsquo;s June 2026 analysis of Alberta&rsquo;s data-centre framework (Water Act approval and licence triggers, and the Wonder Valley preliminary certificate held by Greenview); CBRE Canada (cooling share of data-centre load and closed-loop water-reduction benchmarks &mdash; industry guidance, not measured project data); Canada&rsquo;s National Observer (the 38-campus Alberta water-stress investigation, using WRI Aqueduct 4.0 and AESO data, and the Wonder Valley licence reporting); CBC News and The Narwhal (Wonder Valley, Saint John, and Olds opposition); Data Center Knowledge (Alberta water challenges); the WRI Aqueduct water-risk index; Microsoft and reporting on AWS (vendor fleet water-use efficiency benchmarks); an arXiv academic preprint (the Meta Indiana closed-loop makeup-water estimate); the Lawrence Berkeley National Laboratory and Ceres, via The Conversation (U.S. aggregate water use and stress exposure); and the Canadian Centre for Policy Alternatives (the counter-view on Canadian water risk). Licence caps, filing draws, and benchmark or vendor averages are labelled distinctly throughout; none represents a measured value from a Canadian AI data centre.
      </p>
    </SeriesChapter>
  )
}
