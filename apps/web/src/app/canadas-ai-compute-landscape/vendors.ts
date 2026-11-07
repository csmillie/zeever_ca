export type Tier = 'sov' | 'foreign' | 'us' | 'market'

export type VendorRow = {
  rank: string
  name: string
  tier: Tier
  tierLabel: string
  serviceLayer: string
  headOffice: string
  region: string
  gpus: string
  usdPerHour: string
  index: string
  indexBucket: 'low' | 'mid' | 'high' | 'opaque'
  sovereignAnchor?: boolean
}

const MAX_H100_USD = 7.5

function indexValue(h100: number): string {
  return (Math.round((h100 / MAX_H100_USD) * 100) / 100).toFixed(2)
}

function bucket(h100: number): 'low' | 'mid' | 'high' {
  const idx = h100 / MAX_H100_USD
  if (idx < 0.4) return 'low'
  if (idx < 0.7) return 'mid'
  return 'high'
}

function row(
  rank: string,
  name: string,
  tier: Tier,
  tierLabel: string,
  serviceLayer: string,
  headOffice: string,
  region: string,
  gpus: string,
  h100: number,
): VendorRow {
  return {
    rank,
    name,
    tier,
    tierLabel,
    serviceLayer,
    headOffice,
    region,
    gpus,
    usdPerHour: `$${h100.toFixed(2)}`,
    index: indexValue(h100),
    indexBucket: bucket(h100),
  }
}

function opaqueRow(
  name: string,
  serviceLayer: string,
  headOffice: string,
  region: string,
  gpus: string,
): VendorRow {
  return {
    rank: '—',
    name,
    tier: 'sov',
    tierLabel: '★ Sovereign',
    serviceLayer,
    headOffice,
    region,
    gpus,
    usdPerHour: '—',
    index: 'Opaque',
    indexBucket: 'opaque',
    sovereignAnchor: true,
  }
}

// Q3 2026 refresh (verified 2026-07-09). H100 USD/GPU·hr taken from each vendor's own
// published rate on the compilation date — on-demand where available, reserved where the
// on-demand SKU is out of stock (Oblivus). Prior Thunder ($1.38) and Oblivus ($1.45)
// figures could not be re-verified against the vendors' current pricing pages and were
// corrected upward, which makes ISAIC the cheapest verified published H100 in Canada.
export const VENDOR_ROWS: VendorRow[] = [
  row('1',  'ISAIC',                 'sov',     '★ Sovereign',    'Sovereign / Research',    'Edmonton, Canada',                 'Edmonton, AB',                                      'H100',                               1.83),
  row('2',  'RunPod',                'us',      'US CLOUD Act',   'Serverless GPU',          'Sunnyvale, USA',                   'Montreal (CA-MTL-1/2/3)',                           'H100, H200, A100, B200',             1.99),
  row('3',  'Thunder Compute',       'market',  'Unverified',     'Marketplace GPU',         'USA (unverified)',                'Quebec (directory)',                                'H100 PCIe',                          2.19),
  row('4',  'Hyperstack',            'foreign', 'Non-US foreign', 'Infrastructure (GPU)',    'NexGen Cloud, UK',                 'CANADA-1',                                          'H100, A100, L40S, H200, B200',       2.50),
  row('5',  'Fluidstack',            'market',  'Unverified',     'Infrastructure (GPU)',    'London, UK',                       'Unverified',                                        'H100, H200, A100',                   2.50),
  row('6',  'CUDO Compute',          'market',  'Unverified',     'Infrastructure (GPU)',    'Reading, UK',                      'Unverified',                                        'H100, A100, A40',                    2.69),
  row('7',  'Oblivus',               'market',  'Unverified',     'Serverless GPU',          'Unverified',                       'Montreal (mon1)',                                   'H100 (reserved), A100, RTX 5090',    2.92),
  row('8',  'DigitalOcean Gradient', 'us',      'US CLOUD Act',   'Serverless GPU',          'New York, USA',                    'Toronto (TOR1)',                                    'H100, H200, L40S, MI300X',           3.39),
  row('9',  'Together AI',           'us',      'US CLOUD Act',   'Serverless GPU / API',    'SF Bay Area, USA',                 'Montreal',                                          'H100, H200, B200',                   3.99),
  row('10', 'Lambda',                'us',      'US CLOUD Act',   'Infrastructure (GPU)',    'San Jose, USA',                    'US-only (no CA region)',                            'H100, H200, A100, B200',             3.99),
  row('11', 'AWS Canada',            'us',      'US CLOUD Act',   'Infrastructure (GPU)',    'Seattle, USA',                     'Montreal (ca-central-1), Calgary (ca-west-1)',     'P5 (H100), P4d (A100), G5/G6',       4.10),
  row('12', 'Paperspace',            'us',      'US CLOUD Act',   'Infrastructure (GPU)',    'New York, USA (DO subsidiary)',    'Toronto (via DO)',                                  'H100, A100, A6000',                  5.95),
  row('13', 'CoreWeave',             'us',      'US CLOUD Act',   'Infrastructure (GPU)',    'Livingston NJ, USA',               'Cambridge, ON · Calgary, Regina (announced)',       'H100, H200, A100, B200, GB200',      6.16),
  row('14', 'Microsoft Azure CA',    'us',      'US CLOUD Act',   'Infrastructure (GPU)',    'Redmond, USA',                     'Toronto, Quebec City',                              'H100, A100, H200',                   7.50),
  opaqueRow('TELUS Sovereign AI', 'Sovereign / Enterprise',  'Vancouver, Canada',           'Rimouski QC, Kamloops BC, Vancouver (M3)',   'H200 GaaS, Hopper, Blackwell planned'),
  opaqueRow('Bell AI Fabric',     'Sovereign / Enterprise',  'Verdun (Montreal), Canada',   'Merritt BC, Regina SK (planned)',            'GB200 NVL72 (2,304 via BUZZ), H100, H200'),
  opaqueRow('BUZZ HPC',           'Infrastructure / Sovereign', 'Vancouver, Canada',        'QC, NB, ON, BC (Merritt), GTA (planned)',    'H100, H200, A100, GB200'),
  opaqueRow('Hypertec Cloud',     'Sovereign / OEM',         'Montreal, Canada',            'QC, ON, AB',                                 'H100, H200, B200, GB200 NVL72'),
]
