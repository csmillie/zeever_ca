import type { Metadata } from 'next'
import Link from 'next/link'
import BlogPost from '@/components/BlogPost'
import { FAQPageJsonLd } from '@/components/JsonLd'
import EmailLink from '@/components/EmailLink'

const FAQS = [
  {
    question: 'What is the Zeever AI Compute Index?',
    answer: 'The Zeever AI Compute Index is a public, auditable inventory of GPU providers serving the Canadian market. It tracks 39 vendors and ranks the 14 with verified, published H100 USD per GPU-hour pricing on a normalized 0–1 scale, where 0.18 is the cheapest published rate and 1.00 is Microsoft Azure Canada Central at the ceiling of $7.50/hour.',
  },
  {
    question: 'Why H100 and not a broader GPU comparison?',
    answer: 'The H100 is the de facto current-generation training and high-end inference GPU as of Q2 2026. Most serious AI workloads target it directly or compare against it. Normalizing to a single GPU SKU eliminates per-instance configuration variance — vCPU, memory, storage — that would otherwise muddy the comparison. H200 and B200 rates are recorded in the inventory where published, but H100 is the anchor.',
  },
  {
    question: 'What does "Opaque" mean in the index?',
    answer: 'Opaque means the vendor does not publish list pricing. Most sovereign Canadian providers — TELUS, Bell AI Fabric, BUZZ HPC, Hypertec, Consensus Core, CoEvo, ThinkOn — sell through enterprise quote, not a published per-hour rate. Rather than fabricate a comparison number, the index records what is verifiable. Opaque is not "expensive." It means list pricing isn\'t public, and the only way to know the rate is to ask.',
  },
  {
    question: 'Why does sovereignty matter for AI compute?',
    answer: 'Sovereignty is a procurement criterion, not a value judgment. A Canadian region operated by a US-headquartered hyperscaler is still subject to the US CLOUD Act, which lets US authorities compel disclosure of data regardless of where it physically resides. For regulated industries — healthcare, federal government, critical infrastructure — that exposure changes the procurement calculus. The taxonomy makes the trade-off legible without prescribing a choice.',
  },
  {
    question: 'How often is the inventory updated?',
    answer: 'The full inventory is verified quarterly. Each row carries a last_verified_date field. Material vendor announcements — new Canadian regions, sovereignty milestones, major pricing changes — trigger interim updates between quarterly refreshes.',
  },
  {
    question: 'How can I correct or contribute to the inventory?',
    answer: 'Send corrections, new vendors, or pricing updates to the contact address on this page. Every claim on the page is sourced to public vendor pages, regulatory filings, or named industry audits. Per-row source URLs are recorded in the v3 CSV available on the page. The index is maintained as a public good for the Canadian AI ecosystem and is not a paid placement service.',
  },
]

const PAGE_URL = 'https://www.zeever.ca/research/mapping-canadian-ai-compute'

export const metadata: Metadata = {
  title: 'Mapping Canadian AI Compute: The Zeever Compute Index',
  description: 'Canadian AI buyers have no single comparison surface, so we built one. The methodology behind a 39-vendor inventory, H100 normalization, and sovereignty tiers.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }],
    title: 'Mapping Canadian AI Compute: The Zeever Compute Index',
    description: 'How we built a verified 39-vendor inventory of Canadian GPU providers, why we normalized on H100 USD/GPU-hour, and what the sovereignty taxonomy reveals.',
    url: PAGE_URL,
  },
}

export default function Page() {
  return (
    <BlogPost
      title="Mapping Canadian AI Compute: The Zeever Compute Index"
      description="Canadian AI buyers have no single comparison surface, so we built one. The methodology behind a 39-vendor inventory, H100 normalization, and sovereignty tiers."
      date="2026-05-02"
      url={PAGE_URL}
    >
      <FAQPageJsonLd faqs={FAQS} />

      <p>
        Today we launched <Link href="/canadas-ai-compute-landscape" className="text-zeever-text underline hover:text-zeever-primary">Canada&rsquo;s AI Compute Landscape</Link> — a national view of GPU infrastructure, AI service layers, and sovereign AI capacity built on a verified inventory of 39 providers. This post explains why the page exists, how the methodology was put together, and what we learned during the research that surprised us.
      </p>

      <p>
        The page is the public surface. The work behind it is methodology.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The gap that prompted this</h2>
      <p>
        Canadian organizations choosing where to run AI workloads face a fragmented market with no single comparison surface. Three patterns kept showing up:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Vendor websites list rates that don&rsquo;t reflect Canadian regional availability.</li>
        <li>Sovereign Canadian providers — the providers most relevant to regulated industries and federal procurement — don&rsquo;t publish list prices at all.</li>
        <li>Hyperscalers list flagship GPUs in their Canadian catalogs that, in practice, may not be deliverable from a Canadian region today.</li>
      </ul>
      <p>
        The result is that procurement teams compare what&rsquo;s easy to compare (US hyperscaler list prices) and ignore what they can&rsquo;t (sovereign Canadian capacity, non-US foreign operators, marketplace pricing). The decisions get made on incomplete information.
      </p>
      <p>
        The Zeever AI Compute Index is an attempt to fix that. Not by writing a buyer&rsquo;s guide, but by maintaining a verified inventory, defining a transparent normalization formula, and publishing the methodology rather than just the conclusions.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Scope: what counts as Canadian GPU compute</h2>
      <p>
        A vendor is in scope for the inventory if it meets at least one of three tests:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Sells GPU compute to Canadian organizations, regardless of vendor headquarters.</li>
        <li>Operates a Canadian data centre region offering GPU instances.</li>
        <li>Maintains Canadian sovereign AI capacity — even if not commercially priced (e.g. Mila&rsquo;s academic allocation under the Pan-Canadian AI Strategy).</li>
      </ul>
      <p>
        The current inventory tracks 39 vendors split across six categories: 11 sovereign Canadian, 13 US-headquartered hyperscalers in Canada, 6 non-US foreign operators with Canadian regions, 3 marketplace and distributed providers, 3 specialty or unverified Canadian-presence vendors, and 1 sovereign-partial (Cohere, which is Canadian-owned but operates via a US-managed compute partner).
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Why we normalized on H100 USD/GPU·hr</h2>
      <p>
        The index is opinionated about one thing:{' '}<strong>published, verified pricing matters</strong>. Vendors that publish list rates appear in the cost ranking. Vendors that operate on quote-only pricing are flagged separately as &ldquo;Opaque&rdquo; — not because they&rsquo;re hiding something, but because their pricing model genuinely doesn&rsquo;t translate to a per-hour comparison.
      </p>
      <p>
        For vendors with verified, published H100 rates in a Canadian region, the formula is:
      </p>
      <pre className="bg-gray-50 border border-zeever-accent/20 rounded-lg px-4 py-3 text-xs overflow-x-auto"><code>index = vendor_h100_usd_per_hour ÷ ceiling_h100_usd_per_hour</code></pre>
      <p>
        Where the ceiling is $7.50/GPU·hr — Microsoft Azure Canada Central, the most expensive published rate at compilation. Lower index = cheaper. The current range runs from 0.18 (Thunder Compute, $1.38) to 1.00 (Azure CA, $7.50).
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">Why H100 specifically</h3>
      <p>
        The H100 is the de facto current-generation training and high-end inference GPU as of Q2 2026. Most serious AI workloads target it directly or compare against it. Normalizing to a single GPU SKU eliminates per-instance configuration variance — vCPU, memory, storage — that would otherwise make the comparison incoherent.
      </p>
      <p>
        H200 and B200 rates are recorded in the inventory where published, but H100 is the anchor. As newer generations become standard, the anchor will move; the formula stays the same.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">Currency and conversion</h3>
      <p>
        All index values are computed in USD. The most significant CAD-denominated rate in the ranking is ISAIC at CAD $2.50/hour, converted at approximately 1.37 CAD/USD ≈ USD $1.83/hour. The conversion rate is recorded with each row and refreshed quarterly.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The sovereignty taxonomy</h2>
      <p>
        Cost alone doesn&rsquo;t answer the question Canadian procurement teams actually ask. The other half is jurisdiction. The &ldquo;Tier&rdquo; column on the public table classifies each vendor on three axes:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li><strong>Canadian-owned</strong>{' '}(Yes / No / Unknown)</li>
        <li><strong>Canada-hosted</strong>{' '}(Yes / Partial / Marketplace / No / Unknown)</li>
        <li><strong>US jurisdiction risk</strong>{' '}(Yes / No / Partial — based on whether the operating entity is US-headquartered and therefore subject to the US CLOUD Act)</li>
      </ul>
      <p>
        The combinations produce six tiers: Sovereign (11 vendors), Sovereign-partial (1), Non-US foreign operator (6), US CLOUD Act (13), Marketplace (2), and Unverified (6).
      </p>
      <p className="pl-4 border-l-2 border-zeever-primary/30 text-gray-600 italic">
        Sovereignty is a procurement criterion, not a value judgment. A US hyperscaler with Canadian data centres is appropriate for many workloads; a sovereign Canadian provider is appropriate for others. The taxonomy makes the trade-off legible.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Why &ldquo;Opaque&rdquo; matters more than another estimate</h2>
      <p>
        The hardest methodology decision was what to do with vendors that don&rsquo;t publish list pricing. Seven of the 11 sovereign Canadian providers fall into this bucket: BUZZ HPC, TELUS, Bell AI Fabric, Hypertec, Consensus Core, CoEvo, ThinkOn.
      </p>
      <p>
        The easy path would be to estimate. Pull a few public reference points, eyeball the cost structure, publish a number with a footnote. We chose not to.
      </p>
      <p>
        The reason is that the readers of this page are procurement teams making real spend decisions. A fabricated estimate, even with a hedge, gets quoted back as fact. So we mark these vendors{' '}<strong>Opaque</strong>{' '}in the index column and surface four of them as sovereign anchors on the cost frontier visualization without a numeric position. The page tells you who they are, what they offer, and that the only way to compare them on price is to request a quote.
      </p>
      <p>
        That&rsquo;s less satisfying than a clean ranked list. It&rsquo;s also more honest.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What we found in the research</h2>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">Hyperscaler Canadian H100 availability is thinner than the catalogs suggest</h3>
      <p>
        Google Cloud Canada lists H100 in <code>northamerica-northeast1</code> (Montreal), but founder reports indicate instances reportedly fail to launch in practice. Oracle Cloud lists BM.GPU.H100 in some regions; Canada-specific availability and pricing weren&rsquo;t pulled cleanly in this verification pass. IBM Cloud Canada launched the Toronto MZR in 2023 but current-gen GPU SKU availability remains limited.
      </p>
      <p>
        Three hyperscalers are tracked but not indexed because the catalog says yes and the console says no. If those become verifiable, they&rsquo;ll move into the ranked tier.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">The cheapest published H100 in Canada is a sovereign provider</h3>
      <p>
        ISAIC, the AI Sandbox at the University of Alberta, publishes CAD $2.50/hour (≈ USD $1.83/hour) — cheaper than every commercial neocloud in the inventory except Thunder Compute and Oblivus. It&rsquo;s also Canadian-owned, Canada-hosted, and outside US CLOUD Act reach. The catch: it&rsquo;s a research sandbox without commercial SLAs. The trade-off is real, but the data point upends the assumption that sovereign Canadian capacity is automatically the premium option.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">13 of 39 vendors are US CLOUD Act exposed</h3>
      <p>
        A third of the Canadian-region GPU market is operated by US-headquartered companies. AWS, Azure, GCP, Oracle, IBM, CoreWeave, DigitalOcean, Vultr, RunPod, Paperspace, Akamai/Linode, plus DataHive (now Cologix). The data lives in Canada; the operator answers to a US legal regime. For most workloads this doesn&rsquo;t change anything. For regulated workloads it changes everything.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">Two provinces host 95% of vendor presence</h3>
      <p>
        Quebec and Ontario together account for nearly all verified Canadian GPU compute. Alberta and British Columbia have meaningful sovereign and hyperscaler presence. Saskatchewan and New Brunswick have limited capacity. Manitoba, Nova Scotia, and Newfoundland have effectively zero verified GPU compute. The province scorecard on the page makes the regional imbalance visible — and underlines that &ldquo;Canadian sovereign AI&rdquo; today is mostly Quebec hydroelectric and Ontario Bell-and-Hypertec capacity.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Limitations we&rsquo;re explicit about</h2>
      <p>
        Honest methodology means saying what it can&rsquo;t do well. The page calls out:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Canadian H100 availability changes faster than this page updates. Capacity that was constrained last quarter may be available next; quoted rates change with cloud-provider promotions.</li>
        <li>The Azure Canada Central H100 ceiling of $7.50/hour is a midpoint estimate. Azure pricing varies by SKU, region, and reservation tier; production decisions should pull from the Azure Pricing API directly.</li>
        <li>Oracle Cloud and IBM Cloud Canadian H100 rates were not pulled in this version. They&rsquo;re tracked in the inventory but their indexed values are blank.</li>
        <li>Marketplace pricing is real but not directly comparable. A Vast.ai host may offer H100 at $1.00/hour with no SLA. SaladCloud delivers consumer-grade GPU compute at sub-$0.30/hour rates. These are legitimate options for the right workloads but aren&rsquo;t comparable to enterprise-grade dedicated capacity.</li>
      </ul>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Data sources</h2>
      <p>
        Every claim on the page is sourced. The vendor inventory is compiled from:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Vendor pricing pages verified directly via web request on the compilation date.</li>
        <li>Vendor press releases and announcements for capacity, partnership, and regional launch claims.</li>
        <li>Regulatory filings including CPPIB infrastructure investment disclosures, Bell Canada/BCE filings, and HIVE Digital Technologies (TSXV: HIVE) public filings for BUZZ HPC capacity claims.</li>
        <li>Industry audits including Founder Reality&rsquo;s Canadian GPU audit for hyperscaler ground-truth pricing and availability.</li>
        <li>News reporting from The Globe and Mail, The Logic, Data Center Dynamics, HPCwire, and Connect CRE for Canadian sovereign AI capacity announcements.</li>
        <li>Government program documentation including Innovation, Science and Economic Development Canada&rsquo;s $2-billion Sovereign AI Compute Strategy disclosures.</li>
      </ul>
      <p>
        Per-row source URLs are recorded in the v3 CSV under the <code>source_urls</code> column. The full CSV is available for download from the landscape page.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What&rsquo;s next</h2>
      <p>
        This is v3 of the inventory. The next compilation pass will tighten three areas:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Pull verified H100 rates for Oracle Cloud Canada, IBM Cloud Canada, and Vultr Toronto so they can move into the ranked tier.</li>
        <li>Re-verify Google Cloud Montreal H100 launch behaviour. If practice catches up to catalog, they enter the index. If not, the limitation note stays.</li>
        <li>Add reserved/committed-use pricing where vendors publish it. The current ranking is on-demand only; long-running training workloads get materially different economics with a 1- or 3-year commit.</li>
      </ul>
      <p>
        If you find an error, want to add a vendor, or have pricing data we haven&rsquo;t verified, email{' '}
        <EmailLink user="info" domain="zeever.ca" className="text-zeever-text hover:text-zeever-primary transition-colors" />. The inventory is maintained as a public good for the Canadian AI ecosystem — corrections are reviewed and the page is republished.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">See it</h2>
      <p>
        <Link href="/canadas-ai-compute-landscape" className="text-zeever-text underline hover:text-zeever-primary">Canada&rsquo;s AI Compute Landscape</Link> · <Link href="/canadas-ai-compute-landscape#methodology" className="text-zeever-text underline hover:text-zeever-primary">Full methodology</Link> · <a href="/data/canadian_gpu_vendors_v3.csv" download className="text-zeever-text underline hover:text-zeever-primary">Download v3 CSV</a>
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
    </BlogPost>
  )
}
