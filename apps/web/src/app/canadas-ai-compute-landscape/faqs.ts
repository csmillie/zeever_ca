export type FaqItem = { question: string; answer: string }

export const FAQS: FaqItem[] = [
  {
    question: 'What is the Zeever AI Compute Index?',
    answer:
      'A public, auditable inventory of GPU providers serving the Canadian market. It documents what is tracked (39 vendors and their data fields), how vendors are ranked (the index formula and sovereignty taxonomy), and what is excluded and why. Every claim is sourced to public vendor pages, regulatory filings, or named industry audits.',
  },
  {
    question: 'Why does this index exist?',
    answer:
      'There is no single comparison surface for Canadian GPU pricing. Vendor websites list rates that often do not reflect Canadian regional availability. Sovereign Canadian providers do not publish list prices at all. Hyperscalers list flagship GPUs in Canadian catalogs that may not be deliverable in practice. The index fixes this by maintaining a verified inventory, defining a transparent normalization formula, and publishing the methodology rather than just the conclusions.',
  },
  {
    question: 'Which vendors are in scope?',
    answer:
      'A vendor is in scope if it (a) sells GPU compute to Canadian organizations regardless of headquarters, (b) operates a Canadian data centre region offering GPU instances, or (c) maintains a Canadian sovereign AI capacity even if not commercially priced. The inventory currently tracks 39 vendors across sovereign Canadian providers, US hyperscalers in Canada, non-US foreign operators, marketplaces, and specialty operators.',
  },
  {
    question: 'How is the index calculated?',
    answer:
      'index = vendor_h100_usd_per_hour ÷ ceiling_h100_usd_per_hour, where the ceiling is $7.50 (Microsoft Azure Canada Central, the most expensive published rate at compilation). Lower index = cheaper. As of the Q3 2026 refresh the range runs 0.24 (ISAIC, $1.83 — the cheapest verified published H100 in Canada, and a sovereign Canadian provider) to 1.00 (Azure CA, $7.50). Vendors that bill per token or only sell quote-based capacity are flagged as "Opaque" — not zero, not estimated.',
  },
  {
    question: 'Why H100 specifically?',
    answer:
      'The H100 is the de facto current-generation training and high-end inference GPU as of Q3 2026. Most serious AI workloads target it directly or compare against it. Normalizing to a single GPU SKU eliminates per-instance configuration variance (vCPU, memory, storage) that would muddy the comparison. H200 and B200 rates are recorded in the inventory where published — and Blackwell (B200/GB200) is now rolling out via Together AI, Lambda, Azure Canada East, and the sovereign anchors — but the index still uses H100 as the anchor.',
  },
  {
    question: 'How is currency handled?',
    answer:
      'All index values are computed in USD. Where a vendor publishes in CAD (for example ISAIC at CAD $2.50/hour), the rate is converted at approximately 1.37 CAD/USD ≈ USD $1.83/hour. The conversion rate is recorded with the row and updated quarterly.',
  },
  {
    question: 'What does the sovereignty taxonomy mean?',
    answer:
      'Each provider is classified on three axes: Canadian-owned, Canada-hosted, and US jurisdiction risk (subject to the US CLOUD Act). The combination produces six tiers: ★ Sovereign (11), Sovereign-partial (1), Non-US foreign operator (6), US CLOUD Act (13), Marketplace (2), and Unverified (6). Sovereignty is a procurement criterion, not a value judgment — a US hyperscaler with Canadian data centres is appropriate for many workloads; a sovereign Canadian provider is appropriate for others.',
  },
  {
    question: 'Why are some vendors marked "Opaque"?',
    answer:
      'Sovereign Canadian providers like TELUS, Bell AI Fabric, BUZZ HPC, Hypertec Cloud, CoEvo, Consensus Core, and ThinkOn operate on quote-based pricing and do not publish list rates. The "Opaque" flag means list pricing is not published — not that the underlying rate is high. The only way to know is to request a quote from the vendor for live numbers and capacity.',
  },
  {
    question: 'Why are 21 vendors excluded from the cost ranking?',
    answer:
      'The 21 excluded vendors fall into transparent buckets: 6 sovereign Canadian providers without published list pricing; 7 Canadian-hosted vendors that do not sell H100s (Akamai/Linode, HOSTKEY, ITGLOBAL, Leaseweb, OVHcloud, Vultr Toronto, DataHive); 3 hyperscalers where H100 is listed but Canadian availability is unverified (Google Cloud, IBM, Oracle); 4 marketplace or variable-pricing vendors (Vast.ai, SaladCloud, Sesterce, Gcore); plus Cohere (token-API only) and eStruxture (colocation only). Each exclusion is documented with the specific reason.',
  },
  {
    question: 'How often is the index updated?',
    answer:
      'The inventory is verified quarterly; the most recent pass is the Q3 2026 refresh (2026-07-09). Each row carries a last_verified_date field. Material vendor announcements — new Canadian regions, sovereignty milestones, or major pricing changes — trigger interim updates between quarterly refreshes.',
  },
  {
    question: 'How should I use the index for procurement?',
    answer:
      'Three rules. First, the cheapest published H100 is not always the right H100 — match the price tier to the workload tier (research sandbox vs shared infrastructure vs enterprise SLA). Second, "Opaque" is not "expensive" — sovereign Canadian providers may quote rates competitive with or higher than hyperscalers. Third, sovereignty has a price, but Canadian hydroelectric, federal subsidies, and OEM-direct hardware mean some sovereign providers may actually quote lower than US hyperscalers. Always ask for a current quote before committing.',
  },
  {
    question: 'What are the data sources?',
    answer:
      'The inventory is compiled from vendor pricing pages verified directly by web request, vendor press releases, regulatory filings (CPPIB, BCE, HIVE Digital Technologies), industry audits like Founder Reality\'s Canadian GPU audit, news reporting from The Globe and Mail, The Logic, Data Center Dynamics, HPCwire, and Connect CRE, and government program documentation including ISED Canada\'s Sovereign AI Compute Strategy disclosures and the AI Sovereign Compute Infrastructure Program (SCIP), which launched in April 2026 and closed applications on 1 June 2026. Per-row source URLs are recorded in the v3 CSV under the source_urls column.',
  },
  {
    question: 'How do I report an error or add a vendor?',
    answer:
      'Use the contact address listed in the Methodology section at the bottom of the AI Compute Index page, including the vendor name, the data field that needs correction, and a public source for the new value. Every correction is reviewed and the inventory is republished. The Zeever AI Compute Index is maintained as a public good for the Canadian AI ecosystem — vendor inclusion is determined by the inclusion criteria, not by commercial relationships.',
  },
]
