// Capture an Open Graph image (1200x630 PNG) from a rendered page.
//
// Usage:
//   node scripts/capture-og.mjs --url <url> --out <relative path under public/> [--clip x,y,w,h] [--wait-for <selector>]
//
// Examples:
//   pnpm og:capture -- --url http://localhost:3033/canadas-ai-compute-landscape \
//                      --out og-canadas-ai-compute-landscape.png \
//                      --wait-for "svg[aria-labelledby='province-map-title']"
//
//   # Custom clip region (skip the top 120px of the page):
//   node scripts/capture-og.mjs --url http://localhost:3033/foo --out og-foo.png --clip 0,120,1200,630
//
// Defaults:
//   - Viewport 1200x900, deviceScaleFactor 2 (retina-quality PNG)
//   - Clip 0,0,1200,630 (top of viewport)
//   - Output written under apps/web/public/
//   - Waits for `networkidle` and any --wait-for selector before snapping

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')

function parseArgs(argv) {
  const args = { clip: '0,0,1200,630' }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (flag === '--url') { args.url = value; i++ }
    else if (flag === '--out') { args.out = value; i++ }
    else if (flag === '--clip') { args.clip = value; i++ }
    else if (flag === '--wait-for') { args.waitFor = value; i++ }
  }
  if (!args.url || !args.out) {
    console.error('Usage: --url <url> --out <filename> [--clip x,y,w,h] [--wait-for <selector>]')
    process.exit(1)
  }
  const [x, y, width, height] = args.clip.split(',').map(Number)
  if ([x, y, width, height].some(Number.isNaN)) {
    console.error('Invalid --clip; expected four comma-separated integers (x,y,w,h)')
    process.exit(1)
  }
  args.clipRect = { x, y, width, height }
  return args
}

const args = parseArgs(process.argv.slice(2))
const outPath = resolve(PUBLIC_DIR, args.out)

await mkdir(dirname(outPath), { recursive: true })

const browser = await chromium.launch()
try {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  console.log(`Loading ${args.url} ...`)
  // 'networkidle' never fires under Next dev / Turbopack (HMR keeps a long-lived
  // connection open). Use 'load' and rely on --wait-for + a settle timeout.
  await page.goto(args.url, { waitUntil: 'load', timeout: 60000 })

  if (args.waitFor) {
    console.log(`Waiting for selector: ${args.waitFor}`)
    await page.waitForSelector(args.waitFor, { state: 'visible', timeout: 30000 })
  }

  // Hide Next.js dev tools indicator (the floating "N" badge) so it doesn't
  // appear in OG screenshots taken against `next dev`.
  await page.addStyleTag({
    content: 'nextjs-portal, [data-next-badge-root], [data-next-mark] { display: none !important; }',
  })

  // Give web fonts and animations a moment to settle.
  await page.waitForTimeout(500)

  console.log(`Capturing clip ${JSON.stringify(args.clipRect)} -> ${outPath}`)
  await page.screenshot({ path: outPath, clip: args.clipRect })
  console.log('Done.')
} finally {
  await browser.close()
}
