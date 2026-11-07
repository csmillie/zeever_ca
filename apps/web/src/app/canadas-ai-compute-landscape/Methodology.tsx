import Link from 'next/link'
import EmailLink from '@/components/EmailLink'
import styles from './styles.module.css'

export default function Methodology() {
  return (
    <article className={styles.prose}>
      <h2 id="what-this-page-is">What this page is</h2>
      <p>
        This is the methodology backbone for the{' '}
        <Link href="/canadas-ai-compute-landscape">Zeever AI Compute Index</Link> — a public, auditable
        inventory of GPU providers serving the Canadian market. It documents three things:
      </p>
      <ol>
        <li><strong>What&rsquo;s tracked</strong>{' '}— the 39 vendors in scope and what data fields are recorded</li>
        <li><strong>How vendors are ranked</strong>{' '}— the index formula, the sovereignty taxonomy, and the eligibility rules</li>
        <li><strong>What&rsquo;s excluded and why</strong>{' '}— every vendor that doesn&rsquo;t appear in the cost ranking, with the specific reason</li>
      </ol>
      <p>
        If you find an error or want to add a vendor, contact us at{' '}
        <EmailLink user="info" domain="zeever.ca" />. Every claim on this page is sourced to
        public vendor pages, regulatory filings, or named industry audits — listed at the bottom.
      </p>

      <hr />

      <h2 id="why-this-index-exists">Why this index exists</h2>
      <p>
        Canadian organizations choosing where to run AI workloads face a fragmented market. There
        is no single comparison surface for Canadian GPU pricing. Vendor websites list rates that
        often don&rsquo;t reflect Canadian regional availability. Sovereign Canadian providers
        don&rsquo;t publish list prices at all. Hyperscalers list flagship GPUs in Canadian
        catalogs that, in practice, may not be deliverable.
      </p>
      <p>
        The Zeever AI Compute Index is an attempt to fix that — by maintaining a verified
        inventory, defining a transparent normalization formula, and publishing the methodology
        rather than just the conclusions.
      </p>
      <p>
        The index is opinionated about one thing:{' '}<strong>published, verified pricing matters</strong>.
        Vendors that publish list rates appear in the cost ranking. Vendors that operate on
        quote-only pricing are tracked separately and flagged as &ldquo;Opaque&rdquo; — not
        because the vendor is hiding something, but because their pricing model genuinely
        doesn&rsquo;t translate to a per-hour comparison.
      </p>

      <hr />

      <h2 id="scope-and-inclusion">Scope and inclusion</h2>
      <p>A vendor is in scope for the inventory if it meets at least one of:</p>
      <ul>
        <li><strong>Sells GPU compute to Canadian organizations</strong>, regardless of vendor headquarters</li>
        <li><strong>Operates a Canadian data centre region</strong>{' '}offering GPU instances</li>
        <li><strong>Maintains a Canadian sovereign AI capacity</strong>{' '}(defined below), even if not commercially priced</li>
      </ul>
      <p>The inventory currently tracks{' '}<strong>39 vendors</strong>{' '}across these categories:</p>

      <div className={styles.tableScroll}>
        <table className={styles.proseTable}>
          <thead>
            <tr>
              <th>Category</th>
              <th className={styles.right}>Count</th>
              <th>Examples</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sovereign Canadian (owned + hosted + no US CLOUD Act exposure)</td>
              <td className={styles.right}>11</td>
              <td>TELUS, Bell AI Fabric, BUZZ HPC, Hypertec, ISAIC, Consensus Core, CoEvo, ThinkOn, eStruxture, Canadian Web Hosting, PAICE/Mila</td>
            </tr>
            <tr>
              <td>US-headquartered hyperscalers in Canada</td>
              <td className={styles.right}>13</td>
              <td>AWS, Azure, GCP, Oracle, IBM, CoreWeave, DigitalOcean, Vultr, RunPod, Paperspace, Akamai/Linode, DataHive (now Cologix)</td>
            </tr>
            <tr>
              <td>Non-US foreign operators with Canadian regions</td>
              <td className={styles.right}>6</td>
              <td>OVHcloud, Leaseweb (iWeb), Hyperstack, ITGLOBAL, HOSTKEY, Gcore</td>
            </tr>
            <tr>
              <td>Marketplace / distributed</td>
              <td className={styles.right}>3</td>
              <td>Vast.ai, SaladCloud, Sesterce</td>
            </tr>
            <tr>
              <td>Specialty / unverified Canada presence</td>
              <td className={styles.right}>3</td>
              <td>CUDO, Fluidstack, Lambda</td>
            </tr>
            <tr>
              <td>Sovereign-partial (Canadian-owned, US-operator hosting)</td>
              <td className={styles.right}>1</td>
              <td>Cohere</td>
            </tr>
            <tr>
              <td>Multi-tenant data centre operators</td>
              <td className={styles.right}>2</td>
              <td>DataHive/Cologix, eStruxture</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <em>(Some vendors appear in more than one category — Cohere is both sovereign-partial and operates via CoreWeave-managed Cambridge ON capacity, for example.)</em>
      </p>

      <hr />

      <h2 id="the-index-formula">The index formula</h2>
      <p>
        For vendors with verified, published H100 USD per GPU-hour rates in a Canadian region:
      </p>
      <pre><code>index = vendor_h100_usd_per_hour ÷ ceiling_h100_usd_per_hour</code></pre>
      <p>
        Where <code>ceiling_h100_usd_per_hour = $7.50</code> — Microsoft Azure Canada Central, the most
        expensive published rate at time of compilation.
      </p>
      <p>
        <strong>Result:</strong>{' '}lower index = cheaper. As of the Q3 2026 refresh the range runs 0.24 (ISAIC,
        $1.83 — the cheapest verified published H100 in Canada, and a sovereign Canadian provider) to 1.00
        (Azure CA, $7.50).
      </p>
      <p>
        For vendors that bill per token (Cohere) or only sell quote-based capacity (TELUS, Bell, BUZZ, Hypertec,
        Consensus Core, CoEvo, ThinkOn), the index is{' '}<strong>&ldquo;Opaque&rdquo;</strong>{' '}— not zero, not
        estimated. The index records{' '}<em>what&rsquo;s verifiable</em>{' '}rather than fabricating a comparison
        number.
      </p>

      <h3>Why H100 specifically</h3>
      <p>
        The H100 is the de facto current-generation training and high-end inference GPU as of Q3 2026. Most
        serious AI workloads target it directly or compare against it. Normalizing to a single GPU SKU
        eliminates per-instance configuration variance (vCPU, memory, storage) that would otherwise muddy the
        comparison.
      </p>
      <p>H200 and B200 rates are recorded in the inventory where published, but the index uses H100 as the anchor.</p>

      <h3>Currency and conversion</h3>
      <p>
        All index values are computed in USD. ISAIC publishes CAD $2.50/hour, which is converted at
        approximately 1.37 CAD/USD ≈ USD $1.83/hour. The conversion rate is recorded with the row and
        updated quarterly.
      </p>

      <hr />

      <h2 id="sovereignty-taxonomy">Sovereignty taxonomy</h2>
      <p>The &ldquo;Tier&rdquo; badge in the vendor table classifies each provider on three axes:</p>
      <ul>
        <li><strong>Canadian-owned</strong>{' '}(Yes / No / Unknown)</li>
        <li><strong>Canada-hosted</strong>{' '}(Yes / Partial / Marketplace / No / Unknown)</li>
        <li><strong>US jurisdiction risk</strong>{' '}(Yes / No / Partial — based on whether the operating entity is US-headquartered and therefore subject to the US CLOUD Act)</li>
      </ul>
      <p>The combination produces six tiers:</p>

      <div className={styles.tableScroll}>
        <table className={styles.proseTable}>
          <thead>
            <tr>
              <th>Tier</th>
              <th>Definition</th>
              <th className={styles.right}>Count</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>★ Sovereign</strong></td>
              <td>Canadian-owned + Canada-hosted + no foreign jurisdiction reach</td>
              <td className={styles.right}>11</td>
            </tr>
            <tr>
              <td><strong>Sovereign-partial</strong></td>
              <td>Canadian-owned + Canada-hosted, but third-party operator creates exposure (e.g. Cohere via CoreWeave-managed compute)</td>
              <td className={styles.right}>1</td>
            </tr>
            <tr>
              <td><strong>Non-US foreign operator</strong></td>
              <td>Non-Canadian operator, Canadian region, but not subject to US CLOUD Act (e.g. OVHcloud, Leaseweb, Hyperstack)</td>
              <td className={styles.right}>6</td>
            </tr>
            <tr>
              <td><strong>US CLOUD Act</strong></td>
              <td>Canadian region but US-headquartered operator</td>
              <td className={styles.right}>13</td>
            </tr>
            <tr>
              <td><strong>Marketplace</strong></td>
              <td>Distributed or aggregator pricing without a fixed Canadian region (Vast.ai, SaladCloud)</td>
              <td className={styles.right}>2</td>
            </tr>
            <tr>
              <td><strong>Unverified</strong></td>
              <td>Canadian residency claimed but not verified</td>
              <td className={styles.right}>6</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Sovereignty is a procurement criterion, not a value judgment. A US hyperscaler with Canadian data
        centres is appropriate for many workloads; a sovereign Canadian provider is appropriate for others.
        The taxonomy makes the trade-off legible.
      </p>

      <hr />

      <h2 id="excluded-vendors">Excluded vendors — bucket-by-bucket reasoning</h2>
      <p>
        The Index ranks 14 vendors with published H100 pricing and surfaces 4 sovereign anchors as
        &ldquo;Opaque&rdquo; examples. The other{' '}<strong>21 vendors</strong>{' '}in the inventory are excluded
        from the ranking for transparent reasons.
      </p>

      <h3>Bucket 1: Other sovereign Canadian providers without published list pricing (6 vendors)</h3>
      <p>These are tracked as sovereign Canadian capacity but do not publish per-hour rates:</p>
      <div className={styles.tableScroll}>
        <table className={styles.proseTable}>
          <thead>
            <tr><th>Vendor</th><th>Why excluded from ranking</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>CoEvo AI</strong>{' '}(Vancouver)</td><td>Quote-based; H100 cluster sold via enterprise contract</td></tr>
            <tr><td><strong>Consensus Core</strong>{' '}(Montreal)</td><td>Quote-based; clusters from 8 to 10,000+ GPUs, NVIDIA Cloud Partner</td></tr>
            <tr><td><strong>ThinkOn</strong>{' '}(Toronto/Montreal)</td><td>Quote-based; government cloud anchor with eStruxture/Hypertec</td></tr>
            <tr><td><strong>Canadian Web Hosting</strong>{' '}(Vancouver)</td><td>Sells RTX professional GPUs only — no H100 in catalog</td></tr>
            <tr><td><strong>PAICE / TamIA (Mila)</strong></td><td>Academic allocation under Pan-Canadian AI Strategy — not commercially priced</td></tr>
            <tr><td><strong>Cohere</strong>{' '}(Toronto)</td><td>Token-API only; doesn&rsquo;t bill per GPU-hour</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        The four sovereign anchors shown in the public ranking (TELUS, Bell AI Fabric, BUZZ HPC, Hypertec
        Cloud) are representative — not exclusive. The full inventory carries all 11 sovereign Canadian providers.
      </p>
      <p>
        <strong>Q3 2026 sovereign developments.</strong>{' '}On 18 June 2026 Bell AI Fabric, Cohere, Hypertec and
        BUZZ HPC (a HIVE Digital Technologies company) announced a roughly three-year, ~USD $220M deal to stand
        up what is billed as Canada&rsquo;s first fully domestic end-to-end AI stack — a 2,304-GPU NVIDIA
        GB200 NVL72 cluster at Bell&rsquo;s Merritt, BC data centre, expected live late 2026 to early 2027.
        Separately, TELUS reported that its Rimouski, QC sovereign AI factory sold out within months and is
        expanding, with a Kamloops, BC facility and a broader BC cluster scaling toward 60,000+ GPUs and
        150+ MW by 2032 (85 MW initially secured from BC Hydro). These remain quote-only for pricing and so
        stay flagged Opaque, but they materially change sovereign capacity.
      </p>

      <h3>Bucket 2: Canadian-hosted but H100 not in current catalog (7 vendors)</h3>
      <p>
        These vendors operate Canadian data centres but don&rsquo;t sell H100s. They appear in the full
        inventory because they&rsquo;re legitimate Canadian compute options for non-H100 workloads:
      </p>
      <div className={styles.tableScroll}>
        <table className={styles.proseTable}>
          <thead>
            <tr><th>Vendor</th><th>What they offer</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Akamai Cloud / Linode</strong>{' '}(Toronto)</td><td>RTX PRO 6000 Blackwell, RTX 4000 Ada, Quadro RTX 6000 — strong for inference at the edge, no training GPUs</td></tr>
            <tr><td><strong>HOSTKEY</strong>{' '}(Toronto)</td><td>Consumer/prosumer GPUs (RTX 4090, A4000/A5000/A6000, T4) on VPS/dedicated servers</td></tr>
            <tr><td><strong>ITGLOBAL.com</strong>{' '}(Toronto)</td><td>A100/A800 only — no H100 in VMware-based AI cloud</td></tr>
            <tr><td><strong>Leaseweb (iWeb)</strong>{' '}(Montreal)</td><td>Bare-metal A100 and RTX-series; no H100 verified</td></tr>
            <tr><td><strong>OVHcloud Canada</strong>{' '}(Beauharnois QC)</td><td>Older V100/V100S in Canadian region; H100/A100/L40S primarily in EU regions (Gravelines FR)</td></tr>
            <tr><td><strong>Vultr Toronto</strong></td><td>H100/A100/L40S listed but Toronto-specific rate not pulled in this verification pass</td></tr>
            <tr><td><strong>DataHive / Cologix CGY1</strong>{' '}(Calgary)</td><td>Colocation only — customer-supplied GPUs</td></tr>
          </tbody>
        </table>
      </div>

      <h3>Bucket 3: Hyperscalers with H100 listed but Canadian availability unverified (3 vendors)</h3>
      <p>These are tracked but not indexed because the{' '}<em>catalog says yes but the console says no</em>:</p>
      <div className={styles.tableScroll}>
        <table className={styles.proseTable}>
          <thead>
            <tr><th>Vendor</th><th>The issue</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Google Cloud Canada</strong></td><td>H100 listed for Montreal (<code>northamerica-northeast1</code>) but founder reports indicate instances reportedly fail to launch in practice. Current-gen GPU presence in Canadian regions is minimal as of recent audits.</td></tr>
            <tr><td><strong>IBM Cloud Canada</strong></td><td>Toronto MZR launched 2023; current-gen GPU SKU availability in Canada is limited. H100 not confirmed in Canadian catalog.</td></tr>
            <tr><td><strong>Oracle Cloud Canada</strong></td><td>OCI lists BM.GPU.H100 in some regions; Canada-specific availability and pricing not pulled in this verification pass.</td></tr>
          </tbody>
        </table>
      </div>
      <p>If these become verifiable, they&rsquo;ll move into the ranked tier.</p>

      <h3>Bucket 4: Marketplace or variable pricing (4 vendors)</h3>
      <div className={styles.tableScroll}>
        <table className={styles.proseTable}>
          <thead>
            <tr><th>Vendor</th><th>Why excluded</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Vast.ai</strong></td><td>Real-time marketplace where individual hosts set per-second prices. No fixed Canadian rate. Canadian hosts may exist but inventory is filtered live.</td></tr>
            <tr><td><strong>SaladCloud</strong></td><td>Distributed consumer-GPU edge network — primarily RTX 4090/5080/5090. No H100 offering. No Canadian residency guarantee.</td></tr>
            <tr><td><strong>Sesterce</strong>{' '}(France)</td><td>Canadian footprint per directory listings only. Specific operating model (owned vs partner) unverified. Pricing starts at $0.30/GPU·hr but no specific H100 rate published.</td></tr>
            <tr><td><strong>Gcore</strong>{' '}(Luxembourg)</td><td>Toronto presence per directory; Canadian GPU SKU availability and pricing not verified.</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Marketplace and aggregator-listed vendors don&rsquo;t fit a fixed-rate ranking. They&rsquo;re tracked for completeness.
      </p>

      <h3>Bucket 5: Colocation operators (1 vendor not already counted above)</h3>
      <p>
        <strong>eStruxture</strong>{' '}(Montreal/Toronto/Vancouver/Calgary) — Canadian-owned colocation
        operator that anchors the ThinkOn government cloud and hosts compute for several sovereign
        providers. Not a GPU rental but a foundational Canadian sovereignty enabler. Tracked in the
        sovereign Canadian count.
      </p>

      <hr />

      <h2 id="reconciliation">Reconciliation</h2>
      <div className={styles.tableScroll}>
        <table className={styles.proseTable}>
          <thead>
            <tr><th>Cohort</th><th className={styles.right}>Count</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Total v3 inventory</strong></td><td className={styles.right}><strong>39</strong></td></tr>
            <tr><td>Indexed in Zeever AI Compute Index</td><td className={styles.right}>14</td></tr>
            <tr><td>Sovereign anchors (Opaque) on public card</td><td className={styles.right}>4</td></tr>
            <tr><td>Other sovereign Canadian, no published rate</td><td className={styles.right}>6</td></tr>
            <tr><td>Canadian-hosted, no H100 in catalog</td><td className={styles.right}>7</td></tr>
            <tr><td>Hyperscaler H100 listed, CA availability unverified</td><td className={styles.right}>3</td></tr>
            <tr><td>Marketplace / variable pricing</td><td className={styles.right}>4</td></tr>
            <tr><td>Colocation only (sovereign tracking)</td><td className={styles.right}>1 (eStruxture; DataHive in bucket 3)</td></tr>
            <tr><td>Cohere (sovereign-partial, token-API)</td><td className={styles.right}>1</td></tr>
          </tbody>
        </table>
      </div>
      <p>The numbers tie out: 14 indexed + 25 excluded = 39 in scope.</p>

      <hr />

      <h2 id="limitations">Limitations and known gaps</h2>
      <p>This methodology is honest about what it can&rsquo;t do well:</p>
      <ul>
        <li><strong>Canadian H100 availability changes faster than this page updates.</strong>{' '}Capacity that was constrained last quarter may be available next; quoted rates change with cloud-provider promotions. Verify with the vendor before procurement.</li>
        <li><strong>Microsoft Azure Canada Central H100 pricing ($7.50/GPU·hr) is a midpoint estimate.</strong>{' '}Azure pricing varies by SKU, region, and reservation tier; pull from the Azure Pricing API for production decisions.</li>
        <li><strong>Oracle Cloud and IBM Cloud Canadian H100 rates are not pulled in this version.</strong>{' '}They are tracked in the inventory but indexed values are blank.</li>
        <li><strong>Sovereign Canadian providers don&rsquo;t publish list rates.</strong>{' '}The four anchors flagged &ldquo;Opaque&rdquo; — TELUS, Bell, BUZZ HPC, Hypertec — and the additional sovereign opaques (CoEvo, Consensus Core, ThinkOn, etc.) require direct vendor conversations for pricing and capacity. Request a quote from the vendor for live numbers and capacity.</li>
        <li><strong>Marketplace pricing is real but not directly comparable.</strong>{' '}Vast.ai hosts may offer H100 at $1.00/hour with no SLA. SaladCloud delivers consumer GPU compute at sub-$0.30/hour rates. These are legitimate options for the right workloads but aren&rsquo;t comparable to enterprise-grade dedicated capacity.</li>
        <li><strong>Some rates in earlier passes could not be re-verified.</strong>{' '}The Q2 2026 compilation carried Thunder Compute at $1.38 and Oblivus at $1.45. On the Q3 2026 re-verification pass (2026-07-09) neither figure appeared on the vendor&rsquo;s own pricing page: Thunder&rsquo;s published H100 PCIe rate is $2.19, and Oblivus&rsquo; on-demand H100 SXM5 is $4.31 with the SKU out of stock. Both were corrected — Oblivus is indexed at its reserved rate ($2.92) since on-demand was unavailable — and the correction is what moves ISAIC to the top of the ranking.</li>
        <li><strong>DigitalOcean Gradient&rsquo;s Toronto (TOR1) GPU availability is capacity-constrained.</strong>{' '}The published $3.39/GPU·hr H100 rate holds, but GPU Droplet creation in TOR1 has been reported as intermittently disabled. Confirm live provisioning in-console before committing to the Toronto region.</li>
      </ul>

      <hr />

      <h2 id="update-cadence">Update cadence</h2>
      <p>
        The inventory is verified quarterly. The most recent compilation pass is the Q3 2026 refresh
        (2026-07-09). Each row carries a <code>last_verified_date</code> field — most rows are dated to the
        most recent pass; a few (notably Canadian Web Hosting) carry older verification dates and are flagged
        accordingly.
      </p>
      <p>
        Material vendor announcements (new Canadian regions, sovereignty milestones, major pricing changes)
        trigger interim updates between quarterly refreshes.
      </p>

      <hr />

      <h2 id="how-to-read">How to read the index responsibly</h2>
      <p>
        The Zeever AI Compute Index is a starting point for procurement, not a substitute for one. Three rules:
      </p>
      <p>
        <strong>1. The cheapest published H100 is not always the right H100.</strong>{' '}ISAIC at CAD $2.50/hour
        is a research sandbox without SLAs. RunPod Community Cloud at $1.99/hour is shared infrastructure.
        AWS P5 at $4.10/hour comes with capacity guarantees, network performance, and enterprise support that
        the cheaper options don&rsquo;t. Match the price tier to the workload tier.
      </p>
      <p>
        <strong>2. &ldquo;Opaque&rdquo; is not &ldquo;expensive.&rdquo;</strong>{' '}The four sovereign anchors
        marked Opaque on the public card may quote rates competitive with hyperscalers — or higher. The point
        of the Opaque flag is that{' '}<em>list pricing isn&rsquo;t published</em>, not that the underlying rate
        is high. The only way to know is to request a quote.
      </p>
      <p>
        <strong>3. Sovereignty has a price, but the price isn&rsquo;t always what you think.</strong>{' '}Some
        sovereign Canadian providers may quote rates higher than US hyperscalers. Some may quote rates lower
        because their cost structure (Canadian hydroelectric, federal infrastructure subsidies, OEM-direct
        hardware) is genuinely different. Ask, and compare.
      </p>

      <hr />

      <h2 id="data-sources">Data sources</h2>
      <p>The vendor inventory is compiled from:</p>
      <ul>
        <li><strong>Vendor pricing pages</strong>{' '}verified directly via web request on the compilation date</li>
        <li><strong>Vendor press releases and announcements</strong>{' '}for capacity, partnership, and regional launch claims</li>
        <li><strong>Regulatory filings</strong>{' '}including CPPIB infrastructure investment disclosures, Bell Canada/BCE filings, and HIVE Digital Technologies (TSXV: HIVE) public filings for BUZZ HPC capacity claims</li>
        <li><strong>Industry audits</strong>{' '}including <a href="https://founderreality.com/blog/gpu-cloud-shopping-in-canada-whats-actually-available-2" target="_blank" rel="noopener noreferrer">Founder Reality&rsquo;s Canadian GPU audit</a> for hyperscaler ground-truth pricing and availability</li>
        <li><strong>News reporting</strong>{' '}from The Globe and Mail, The Logic, Data Center Dynamics, HPCwire, and Connect CRE for Canadian sovereign AI capacity announcements</li>
        <li><strong>Government program documentation</strong>{' '}including Innovation, Science and Economic Development Canada&rsquo;s Sovereign AI Compute Strategy disclosures. As of the Q3 2026 refresh, ISED&rsquo;s AI Sovereign Compute Infrastructure Program (SCIP) — the ~$890M &ldquo;infrastructure build&rdquo; layer — launched in April 2026 and closed applications on 1 June 2026; awards were still under evaluation at compilation time and are not yet reflected in vendor capacity.</li>
      </ul>
      <p>
        Per-row source URLs are recorded in the v3 CSV under the <code>source_urls</code> column. The full CSV
        is available for download at <Link href="/canadas-ai-compute-landscape">zeever.ca/canadas-ai-compute-landscape</Link>.
      </p>

      <hr />

      <h2 id="contact">Contact and corrections</h2>
      <p>
        Found an error? Vendor pricing changed? New vendor we should track? Email{' '}
        <EmailLink user="info" domain="zeever.ca" /> or file an issue. Every correction is reviewed
        and the inventory is republished.
      </p>
      <p>
        The Zeever AI Compute Index is maintained as a public good for the Canadian AI ecosystem. It is not a
        paid placement service — vendor inclusion is determined by the inclusion criteria above, not by
        commercial relationships.
      </p>
    </article>
  )
}
