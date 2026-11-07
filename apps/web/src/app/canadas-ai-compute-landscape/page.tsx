import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { WebPageJsonLd, BreadcrumbJsonLd, FAQPageJsonLd } from '@/components/JsonLd'
import ProvinceMap from './ProvinceMap'
import Methodology from './Methodology'
import { VENDOR_ROWS } from './vendors'
import { FAQS } from './faqs'
import styles from './styles.module.css'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-mono' })

const PAGE_URL = 'https://www.zeever.ca/canadas-ai-compute-landscape'

const OG_IMAGE = 'https://www.zeever.ca/og-canadas-ai-compute-landscape.png'
const OG_TITLE = "Canada's AI Compute Landscape — Zeever AI Compute Index"
// The <title> drops the index subtitle: with the sitewide ' | Zeever.ca' suffix
// the OG form runs to 67 characters and loses its tail in search results.
const TITLE = "Canada's AI Compute Landscape"
const OG_DESCRIPTION =
  'A national view of GPU infrastructure, AI services and sovereign AI in Canada. 39 verified providers, indexed by H100 USD/GPU·hr.'

export const metadata: Metadata = {
  title: TITLE,
  description:
    'A national view of GPU infrastructure, AI services and sovereign AI in Canada. 39 verified providers, indexed by H100 price and scored by province.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: PAGE_URL,
    type: 'article',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Zeever AI Compute Index — Canada AI compute capability map by province' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [OG_IMAGE],
  },
}

const TIER_CLASS: Record<string, string> = {
  sov: styles.vTierSov,
  foreign: styles.vTierForeign,
  us: styles.vTierUs,
  market: styles.vTierMarket,
}

const SCORE_CLASS: Record<string, string> = {
  low: styles.vScoreLow,
  mid: styles.vScoreMid,
  high: styles.vScoreHigh,
  opaque: styles.vScoreOpaque,
}

export default function AiComputeIndexPage() {
  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <WebPageJsonLd
        name="Canada's AI Compute Landscape"
        description="National view of Canadian GPU infrastructure, AI service layers, and the Zeever AI Compute Index."
        url={PAGE_URL}
        dateModified="2026-07-09"
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://www.zeever.ca' },
          { name: "Canada's AI Compute Landscape", url: PAGE_URL },
        ]}
      />
      <FAQPageJsonLd faqs={FAQS} />

      <div className={styles.canvas}>
        <div className={styles.content}>
          {/* MASTHEAD */}
          <header className={styles.masthead}>
            <div className={styles.mastheadTop}>
              <div>
                <div className={styles.updateBadge}>
                  <span className={styles.updateDot} aria-hidden />
                  Updated · Q3 2026
                </div>
                <h1 className={styles.title}>
                  Canada&rsquo;s AI Compute Landscape<span className={styles.leaf}>🍁</span>
                </h1>
                <div className={styles.subtitle}>Capabilities, Access, Cost &amp; Sovereignty by Province</div>
                <p className={styles.deck}>
                  A national view of GPU infrastructure, AI services and the realities that shape sovereign AI in
                  Canada — built on a verified inventory of 39&nbsp;providers across hyperscalers, neoclouds,
                  sovereign factories and marketplaces.
                </p>
              </div>

              <div className={styles.statsBadges}>
                <div className={`${styles.statBadge} ${styles.b1}`}>
                  <div className={styles.badgeIcon} aria-hidden>▣</div>
                  <div className={styles.num}>39</div>
                  <div className={styles.lbl}>Vendors<br />Tracked</div>
                </div>
                <div className={`${styles.statBadge} ${styles.b2}`}>
                  <div className={styles.badgeIcon} aria-hidden>◈</div>
                  <div className={styles.num}>6</div>
                  <div className={styles.lbl}>Provinces<br />w/ Compute</div>
                </div>
                <div className={`${styles.statBadge} ${styles.b3}`}>
                  <div className={styles.badgeIcon} aria-hidden>◐</div>
                  <div className={styles.num}>H100</div>
                  <div className={styles.lbl}>In 4&nbsp;Provinces<br />(plus planned)</div>
                </div>
                <div className={`${styles.statBadge} ${styles.b4}`}>
                  <div className={styles.badgeIcon} aria-hidden>◆</div>
                  <div className={styles.num}>11</div>
                  <div className={styles.lbl}>Sovereign<br />Canadian</div>
                </div>
              </div>
            </div>
          </header>

          {/* ANSWER CAPSULE */}
          <aside className={styles.answerCapsule} aria-label="Summary">
            <span className={styles.label}>Answer Capsule</span>
            <p>
              Canada has 39 GPU compute providers serving the local AI market, but no single comparison
              surface exists. Hyperscalers list flagship GPUs that don&rsquo;t always deliver in Canadian
              regions, sovereign Canadian providers don&rsquo;t publish list prices, and US-headquartered
              operators with Toronto and Montreal data centres are still subject to the US CLOUD Act. The
              Zeever AI Compute Index normalizes verified H100 rates against a $7.50 ceiling, producing
              index values from 0.24 to 1.00 alongside a sovereignty taxonomy. As of the Q3 2026 refresh
              the cheapest verified published H100 in Canada is ISAIC, a sovereign Canadian provider, at
              USD&nbsp;$1.83/GPU·hr — several &ldquo;marketplace floor&rdquo; rates from earlier passes no
              longer hold up against the vendors&rsquo; own pricing pages. Vendors that quote-only are
              flagged Opaque rather than estimated, because the index records what&rsquo;s verifiable rather
              than fabricating a comparison.
            </p>
          </aside>

          {/* ROW 1: PROVINCE MAP + SERVICE LAYERS */}
          <div className={`${styles.gridRow} ${styles.r1}`}>
            <div className={styles.panel}>
              <div className={styles.sectionHead}>
                <h2>
                  <span className={styles.secNum}>1.</span>
                  AI Compute Capability by Province
                </h2>
                <span className={styles.sub}>Scored across 4 dimensions · max 12</span>
              </div>

              <div className={styles.mapWrap}>
                <div className={styles.mapSvg}>
                  <ProvinceMap />
                </div>

                <div>
                  <div className={styles.legendBox}>
                    <h3>Score Range</h3>
                    <div className={styles.legendRow}>
                      <span className={`${styles.dot} ${styles.dotG}`} />
                      <span><strong className="text-good">High</strong>{' '}· 9–12</span>
                    </div>
                    <div className={styles.legendRow}>
                      <span className={`${styles.dot} ${styles.dotY}`} />
                      <span><strong className="text-warn">Medium</strong>{' '}· 5–8</span>
                    </div>
                    <div className={styles.legendRow}>
                      <span className={`${styles.dot} ${styles.dotR}`} />
                      <span><strong className="text-bad">Low</strong>{' '}· 1–4</span>
                    </div>
                    <div className={styles.legendRow}>
                      <span className={`${styles.dot} ${styles.dotN}`} />
                      <span><strong className="text-ink-mute">None</strong>{' '}· 0</span>
                    </div>
                  </div>

                  <div className={styles.dimList}>
                    <h3>4 Dimensions</h3>
                    <div className={styles.dim}>
                      <div className={styles.dimIcon} aria-hidden>▣</div>
                      <div><strong>Compute Power</strong><em>GPU tier available</em></div>
                    </div>
                    <div className={styles.dim}>
                      <div className={styles.dimIcon} aria-hidden>⊞</div>
                      <div><strong>Access Model</strong><em>Vendor density / ease</em></div>
                    </div>
                    <div className={styles.dim}>
                      <div className={styles.dimIcon} aria-hidden>◆</div>
                      <div><strong>Sovereignty</strong><em>Canadian control</em></div>
                    </div>
                    <div className={styles.dim}>
                      <div className={styles.dimIcon} aria-hidden>$</div>
                      <div><strong>Cost Accessibility</strong><em>Published H100 rate</em></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.scorecard}>
                <table>
                  <thead>
                    <tr>
                      <th>Dimension</th>
                      <th>QC</th>
                      <th>ON</th>
                      <th>AB</th>
                      <th>BC</th>
                      <th>SK</th>
                      <th>NB</th>
                      <th>MB</th>
                      <th>NS</th>
                      <th>NL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ScorecardRow label="Compute Power" cells={['g3','g3','g3','g3','r1','r1','n0','n0','n0']} />
                    <ScorecardRow label="Access Model"  cells={['g3','g3','y2','y2','r1','r1','n0','n0','n0']} />
                    <ScorecardRow label="Sovereignty"   cells={['g3','g3','g3','g3','y2','y2','n0','n0','n0']} />
                    <ScorecardRow label="Cost Access"   cells={['g3','y2','g3','n0','n0','n0','n0','n0','n0']} />
                    <tr>
                      <td><strong className="text-ink">TOTAL / 12</strong></td>
                      <td><span className={`${styles.totalCell} ${styles.totalCellG}`}>12</span></td>
                      <td><span className={`${styles.totalCell} ${styles.totalCellG}`}>11</span></td>
                      <td><span className={`${styles.totalCell} ${styles.totalCellG}`}>11</span></td>
                      <td><span className={`${styles.totalCell} ${styles.totalCellG}`}>8</span></td>
                      <td><span className={`${styles.totalCell} ${styles.totalCellR}`}>4</span></td>
                      <td><span className={`${styles.totalCell} ${styles.totalCellR}`}>4</span></td>
                      <td><span className={`${styles.totalCell} ${styles.totalCellN}`}>0</span></td>
                      <td><span className={`${styles.totalCell} ${styles.totalCellN}`}>0</span></td>
                      <td><span className={`${styles.totalCell} ${styles.totalCellN}`}>0</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.sectionHead}>
                <h2>
                  <span className={styles.secNum}>2.</span>
                  AI Service Layers
                </h2>
                <span className={styles.sub}>Common AI uses in Canada</span>
              </div>

              <ServiceLayer
                cls={styles.l1}
                icon="◇"
                title="Model / API Layer"
                desc="Ready-to-use models via API. Fastest way to build."
                examplesPrimary="Cohere"
                examplesRest=", OpenAI via Azure CA"
                bestFor="Apps, RAG, chatbots, fast adoption"
              />
              <ServiceLayer
                cls={styles.l2}
                icon="⌬"
                title="Serverless GPU / Inference"
                desc="On-demand GPUs for inference and agentic workloads."
                examplesPrimary="RunPod"
                examplesRest=", Together AI"
                bestFor="Real-time inference, burst compute"
              />
              <ServiceLayer
                cls={styles.l3}
                icon="▦"
                title="Infrastructure (GPU Rental)"
                desc="Full control GPU instances for training & large workloads."
                examplesPrimary="CoreWeave"
                examplesRest=", AWS, Azure, OVHcloud"
                bestFor="Training, scaling, ML engineers"
              />
              <ServiceLayer
                cls={styles.l4}
                icon="◆"
                title="Sovereign / Enterprise"
                desc="Canadian-controlled infrastructure for regulated workloads."
                examplesPrimary="TELUS"
                examplesRest=", Bell, ISAIC, BUZZ HPC"
                bestFor="Government, regulated industries"
              />
            </div>
          </div>

          {/* ROW 2: COST FRONTIER + LIMITATIONS + ZEEVER INDEX */}
          <div className={`${styles.gridRow} ${styles.r2}`}>
            <div className={styles.panel}>
              <div className={styles.sectionHead}>
                <h2>
                  <span className={styles.secNum}>3.</span>
                  Cost vs Capability Frontier
                </h2>
                <span className={styles.sub}>Zeever AI Compute Index, normalized</span>
              </div>

              <div className={styles.frontierWrap}>
              <div className={styles.frontier}>
                <div className={styles.frontierBg} />
                <div className={styles.frontierGrid} />

                <div className={styles.axisY}>Capability →</div>
                <div className={styles.axisX}>← LOWER COST · HIGHER COST →</div>

                <div className={`${styles.axisTick} ${styles.axisTickY}`} style={{ top: 42 }}>100</div>
                <div className={`${styles.axisTick} ${styles.axisTickY}`} style={{ top: 120 }}>75</div>
                <div className={`${styles.axisTick} ${styles.axisTickY}`} style={{ top: 198 }}>50</div>
                <div className={`${styles.axisTick} ${styles.axisTickY}`} style={{ top: 276 }}>25</div>

                <div className={`${styles.axisTick} ${styles.axisTickX}`} style={{ left: 62 }}>$1.40</div>
                <div className={`${styles.axisTick} ${styles.axisTickX}`} style={{ left: '30%' }}>$2.50</div>
                <div className={`${styles.axisTick} ${styles.axisTickX}`} style={{ left: '55%' }}>$4.00</div>
                <div className={`${styles.axisTick} ${styles.axisTickX}`} style={{ right: 30 }}>$7.50+</div>

                <div className={`${styles.bubble} ${styles.bLow}`} style={{ left: '7%', top: '78%', width: 50, height: 50, fontSize: 9 }}>Vast<br />Salad</div>
                <div className={`${styles.bubble} ${styles.bSov}`} style={{ left: '14%', top: '54%', width: 64, height: 64 }}>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>ISAIC</span><br /><span style={{ fontSize: 12 }}>$1.83</span>
                </div>
                <div className={`${styles.bubble} ${styles.bLow}`} style={{ left: '19%', top: '33%', width: 52, height: 52, fontSize: 9.5 }}>RunPod<br />$1.99</div>
                <div className={`${styles.bubble} ${styles.bLow}`} style={{ left: '25%', top: '62%', width: 52, height: 52, fontSize: 9.5 }}>Thunder<br />$2.19</div>
                <div className={`${styles.bubble} ${styles.bLow}`} style={{ left: '31%', top: '48%', width: 52, height: 52, fontSize: 9.5 }}>Hyperstack<br />$2.50</div>
                <div className={`${styles.bubble} ${styles.bLow}`} style={{ left: '39%', top: '40%', width: 52, height: 52, fontSize: 9.5 }}>Oblivus<br />$2.92</div>
                <div className={`${styles.bubble} ${styles.bMid}`} style={{ left: '47%', top: '36%', width: 54, height: 54, fontSize: 10 }}>DigitalOcean<br />$3.39</div>
                <div className={`${styles.bubble} ${styles.bMid}`} style={{ left: '55%', top: '58%', width: 54, height: 54, fontSize: 10 }}>Together&nbsp;AI<br />$3.99</div>
                <div className={`${styles.bubble} ${styles.bMid}`} style={{ left: '58%', top: '26%', width: 54, height: 54, fontSize: 10 }}>AWS&nbsp;P5<br />$4.10</div>
                <div className={`${styles.bubble} ${styles.bHigh}`} style={{ left: '75%', top: '48%', width: 54, height: 54, fontSize: 10 }}>Paperspace<br />$5.95</div>
                <div className={`${styles.bubble} ${styles.bHigh}`} style={{ left: '82%', top: '28%', width: 54, height: 54, fontSize: 10 }}>CoreWeave<br />$6.16</div>
                <div className={`${styles.bubble} ${styles.bHigh}`} style={{ left: '91%', top: '18%', width: 56, height: 56, fontSize: 10 }}>Azure&nbsp;CA<br />$7.50</div>
              </div>
              </div>

              <div className={styles.frontierLegend}>
                <div className={`${styles.item} ${styles.itemLow}`}>
                  <strong>Low cost</strong>
                  <span>Marketplace + ISAIC. Variable control.</span>
                </div>
                <div className={`${styles.item} ${styles.itemMid}`}>
                  <strong>Mid cost / flexible</strong>
                  <span>Neoclouds. Best balance.</span>
                </div>
                <div className={`${styles.item} ${styles.itemHigh}`}>
                  <strong>High cost / capability</strong>
                  <span>H100 clusters, hyperscalers.</span>
                </div>
                <div className={`${styles.item} ${styles.itemSov}`}>
                  <strong>★ Sovereign published</strong>
                  <span>ISAIC — Canadian-owned, list pricing.</span>
                </div>
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.sectionHead}>
                <h2>
                  <span className={styles.secNum}>4.</span>
                  Limitations &amp; Realities
                </h2>
                <span className={styles.sub}>Constraints shaping CA AI</span>
              </div>

              <Limitation cls={styles.lim1} icon="▲" title="GPU Scarcity"
                body="Limited H100 supply in-country; Google Cloud Montreal H100 SKUs reportedly fail to launch in practice." />
              <Limitation cls={styles.lim2} icon="◆" title="Sovereignty Gap"
                body="13 of 39 vendors are US-headquartered with Canadian regions — subject to US CLOUD Act regardless of physical location." />
              <Limitation cls={styles.lim3} icon="$" title="Pricing Opacity"
                body="7 of 11 sovereign providers (BUZZ HPC, TELUS, Bell, Hypertec, Consensus Core, CoEvo, ThinkOn) publish no list pricing." />
              <Limitation cls={styles.lim4} icon="⊟" title="Fragmented Access"
                body="No unified marketplace. No single Canadian visibility layer. Compare at vendor level, one quote at a time." />
              <Limitation cls={styles.lim5} icon="⌖" title="Regional Imbalance"
                body="Quebec and Ontario host 95% of vendor presence. Manitoba, NS, NL and PEI have effectively zero verified GPU compute." />
            </div>

            <aside className={styles.indexPanel}>
              <h3>Zeever AI Compute Index</h3>
              <p className={styles.lead}>
                Bringing clarity, comparison and sovereignty data to every Canadian AI compute decision.
              </p>

              <h4>How the Index is Calculated</h4>
              <ol>
                <li>
                  <strong>For GPU/hour providers:</strong>{' '}Normalize to USD per H100 GPU-hour from published vendor
                  rates. Per-instance pricing divided down.
                </li>
                <li>
                  <strong>For token APIs:</strong>{' '}Use published $/M&nbsp;tokens; map to GPU-hour equivalent at typical
                  workload throughput.
                </li>
                <li>
                  <strong>For contract / opaque pricing:</strong>{' '}Disclose as &ldquo;Opaque&rdquo; rather than estimate.
                  No fabrication.
                </li>
              </ol>

              <h4>Index Scale (lower&nbsp;=&nbsp;cheaper)</h4>
              <div className={styles.indexScale}>
                <IndexScaleRow swatch="#047857" range="0.0–0.4" label="Very low cost" />
                <IndexScaleRow swatch="#10b981" range="0.4–0.7" label="Low cost" />
                <IndexScaleRow swatch="#b45309" range="0.7–0.9" label="Mid cost" />
                <IndexScaleRow swatch="#b91c1c" range="0.9–1.0" label="High / premium" />
                <IndexScaleRow swatch="#71717a" range="Opaque" label="No public pricing" />
              </div>
            </aside>
          </div>

          {/* ROW 3: VENDOR TABLE */}
          <div className={`${styles.gridRow} ${styles.r3}`}>
            <div className={styles.panel}>
              <div className={styles.sectionHead}>
                <h2>
                  <span className={styles.secNum}>5.</span>
                  Leading Providers · Zeever Index Ranking
                </h2>
                <span className={styles.sub}>39-vendor inventory · 14 indexed · sorted by index ↑</span>
              </div>

              <div className={styles.vtableWrap}>
                <table className={styles.vtable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Vendor</th>
                      <th>Tier</th>
                      <th>Service Layer</th>
                      <th>Head Office</th>
                      <th>Canadian Region(s)</th>
                      <th>GPU Types</th>
                      <th className={styles.right}>USD/GPU·hr</th>
                      <th className={styles.right}>Index</th>
                    </tr>
                  </thead>
                  <tbody>
                    {VENDOR_ROWS.map(v => (
                      <tr key={v.name} className={v.sovereignAnchor ? styles.rowSov : undefined}>
                        <td className={styles.vRank}>{v.rank}</td>
                        <td className={styles.vName}>{v.name}</td>
                        <td>
                          <span className={`${styles.vTier} ${TIER_CLASS[v.tier]}`}>{v.tierLabel}</span>
                        </td>
                        <td>{v.serviceLayer}</td>
                        <td>{v.headOffice}</td>
                        <td>{v.region}</td>
                        <td>{v.gpus}</td>
                        <td className={`${styles.right}`}>{v.usdPerHour}</td>
                        <td className={`${styles.right} ${styles.vScore} ${SCORE_CLASS[v.indexBucket]}`}>
                          {v.index}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile-only card list — toggled via CSS at <=640px */}
              <ul className={styles.vendorCards} role="list">
                {VENDOR_ROWS.map(v => (
                  <li
                    key={v.name}
                    className={`${styles.vendorCard}${v.sovereignAnchor ? ' ' + styles.cardSov : ''}`}
                  >
                    <div className={styles.cardRank}>{v.rank}</div>
                    <div className={styles.cardName}>{v.name}</div>
                    <div className={styles.cardTier}>
                      <span className={`${styles.vTier} ${TIER_CLASS[v.tier]}`}>{v.tierLabel}</span>
                    </div>
                    <div className={styles.cardMeta}>
                      <strong>{v.serviceLayer}</strong>
                      <br />
                      {v.region}
                      <span className={styles.sep}>·</span>
                      {v.gpus}
                    </div>
                    <div className={styles.cardPriceRow}>
                      <span className={styles.cardPrice}>
                        {v.usdPerHour}
                        {v.usdPerHour !== '—' && <span className={styles.priceUnit}>/ GPU·hr</span>}
                      </span>
                      <span>
                        <span className={styles.cardIndexLabel}>Index</span>
                        <span
                          className={`${styles.cardIndex} ${
                            v.indexBucket === 'low'
                              ? styles.cardScoreLow
                              : v.indexBucket === 'mid'
                              ? styles.cardScoreMid
                              : v.indexBucket === 'high'
                              ? styles.cardScoreHigh
                              : styles.cardScoreOpaque
                          }`}
                        >
                          {v.index}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <p className={styles.tableNote}>
                <strong>Note:</strong>{' '}Index normalizes the cheapest verified published Canadian H100 (ISAIC, $1.83)
                as 0.24 and the most expensive (Azure CA, $7.50) as 1.00. Rates reflect the Q3 2026 refresh
                (verified 2026-07-09); Oblivus is shown at its reserved rate because the on-demand SKU was out of
                stock. Sovereign vendors marked &ldquo;Opaque&rdquo; do not publish list pricing — request a quote
                from vendor for live numbers and capacity. Vast.ai, SaladCloud and 21 other vendors are tracked in
                the full inventory but not indexed here (no Canada-specific H100 published, marketplace pricing
                varies, or no H100 offering).
              </p>
            </div>
          </div>

          {/* METHODOLOGY */}
          <div className={`${styles.gridRow} ${styles.r3}`}>
            <div className={styles.panel}>
              <div className={styles.sectionHead}>
                <h2>
                  <span className={styles.secNum}>6.</span>
                  Methodology
                </h2>
                <span className={styles.sub}>How the inventory is built and the index is calculated</span>
              </div>
              <Methodology />
            </div>
          </div>

          {/* FAQ */}
          <div className={`${styles.gridRow} ${styles.r3}`}>
            <div className={styles.panel}>
              <div className={styles.sectionHead}>
                <h2>
                  <span className={styles.secNum}>7.</span>
                  Frequently Asked Questions
                </h2>
                <span className={styles.sub}>Methodology in Q&amp;A form</span>
              </div>
              <div className={styles.prose}>
                <div className={styles.faqList}>
                  {FAQS.map(faq => (
                    <details key={faq.question} className={styles.faqItem}>
                      <summary>{faq.question}</summary>
                      <div className={styles.faqAnswer}>
                        <p>{faq.answer}</p>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* PAGE FOOTER (data provenance) */}
          <footer className={styles.pageFooter}>
            <div className={styles.footerLeft}>
              <strong>Data:</strong>{' '}Vendor pricing pages, vendor announcements, CPPIB filings, ISED SCIP
              disclosures, Founder Reality audits&nbsp;·&nbsp;<strong>Compiled:</strong>{' '}9 July 2026 (Q3
              refresh)&nbsp;·&nbsp;<strong>Methodology:</strong>{' '}
              39-vendor verified inventory, normalized H100 USD/GPU·hr&nbsp;·&nbsp;<strong>Source:</strong>{' '}
              canadian_gpu_vendors_v3.csv
            </div>
            <a
              href="/data/canadian_gpu_vendors_v3.csv"
              download
              className={styles.footerCta}
            >
              Download CSV ↓
            </a>
          </footer>
        </div>
      </div>
    </div>
  )
}

function ScorecardRow({ label, cells }: { label: string; cells: string[] }) {
  return (
    <tr>
      <td>{label}</td>
      {cells.map((c, i) => {
        const color = c[0]
        const num = c.slice(1)
        const cls =
          color === 'g' ? styles.pillG
          : color === 'y' ? styles.pillY
          : color === 'r' ? styles.pillR
          : styles.pillN
        return (
          <td key={i}>
            <span className={`${styles.pill} ${cls}`}>{num}</span>
          </td>
        )
      })}
    </tr>
  )
}

function ServiceLayer({
  cls, icon, title, desc, examplesPrimary, examplesRest, bestFor,
}: {
  cls: string
  icon: string
  title: string
  desc: string
  examplesPrimary: string
  examplesRest: string
  bestFor: string
}) {
  return (
    <div className={`${styles.layer} ${cls}`}>
      <div className={styles.layerIcon} aria-hidden>{icon}</div>
      <div className={styles.layerInfo}>
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
      <div className={styles.layerEg}>
        <div className={styles.lbl}>Examples</div>
        <div className={styles.v}>
          <strong>{examplesPrimary}</strong>{examplesRest}
        </div>
      </div>
      <div className={styles.layerBest}>
        <div className={styles.lbl}>Best For</div>
        <div className={styles.v}>{bestFor}</div>
      </div>
    </div>
  )
}

function Limitation({ cls, icon, title, body }: { cls: string; icon: string; title: string; body: string }) {
  return (
    <div className={`${styles.limit} ${cls}`}>
      <div className={styles.limitIcon} aria-hidden>{icon}</div>
      <div className={styles.limitText}>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  )
}

function IndexScaleRow({ swatch, range, label }: { swatch: string; range: string; label: string }) {
  return (
    <div className={styles.indexScaleRow}>
      <span className={styles.range}>
        <span className={styles.swatch} style={{ background: swatch }} />
        {range}
      </span>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
