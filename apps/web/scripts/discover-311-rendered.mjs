// Map Toronto's 311 knowledge base by rendering its pages, storing nothing.
//
// Usage:
//   node scripts/discover-311-rendered.mjs
//   node scripts/discover-311-rendered.mjs --max-pages 60 --out /tmp/kb-urls.txt
//   node scripts/discover-311-rendered.mjs --headed          # watch it work
//
// Why this exists, and why it is a browser rather than a fetch.
//
// The 311 knowledge base holds the City's "how do I report this" answers, which
// is the most common shape of question a service assistant gets. It is absent
// from the corpus: toronto.ca publishes one sitemap, it lists eight WordPress
// page sitemaps, and robots.txt declares no other. Following links with an HTTP
// client found thirteen articles and then ran out, because the category browse
// is drawn client-side. A static fetch of the categories page returns the shell.
//
// So this renders the same public pages a visitor sees, expands the category
// tree the way a visitor would, and reads the article links that appear. It sees
// nothing a person with a browser could not see, and it goes through the app's
// own front door rather than around it.
//
// What it deliberately does not do:
//
//   * It never calls to311kb-web0.ecrm.inter.prod-toronto.ca. That is internal
//     infrastructure, not a published interface, and building on it would mean
//     depending on something nobody agreed to provide.
//   * It never submits anything. The service request page is a form, and this
//     only ever reads.
//   * It stores nothing. This reports what is there so the decision to crawl can
//     be made from a number rather than a guess.
//
// RESULT, 2026-08-30: it does not help, and the reason is worth keeping.
//
// A full pass exhausted its queue at 21 pages and found 16 articles, against 13
// from the plain HTTP crawl. The categories on the create-a-service-request page
// expand to service request FORMS, /create-a-service-request/service-request/
// ?request=<id>, not to knowledge base articles. It is a form picker, not a
// content index. The ?kb= articles appear only as "popular" items on
// find-service-information and in search results, which is why following links
// finds the same handful either way.
//
// So the knowledge base is not reachable by any public index, rendered or not.
// Getting it needs the City, which is why the request to Open Data matters more
// than any crawler here. This script is kept because it settled the question in
// five minutes and would cost more to rebuild than to leave in place, and because
// it will detect the change if Toronto ever links the articles properly.
//
// It is polite by construction: one page at a time, a delay between navigations,
// a hard page cap that stops the run, a link filter that cannot leave the 311
// section, and the project's own user agent so the traffic is attributable.

import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'

const ROOTS = [
  'https://www.toronto.ca/home/311-toronto-at-your-service/create-a-service-request/',
  'https://www.toronto.ca/home/311-toronto-at-your-service/find-service-information/',
  'https://www.toronto.ca/home/311-toronto-at-your-service/',
]

const IN_SCOPE = /^https:\/\/www\.toronto\.ca\/(311\/|home\/311-toronto-at-your-service\/)/
const ARTICLE = /\/find-service-information\/article\/\?kb=([A-Za-z0-9]+)/
// Legacy paths that 301 to the landing page and lose the article. Following one
// costs a request and returns something that is not the article.
const DEAD_PATH = /\/311\/knowledgebase\//

const USER_AGENT =
  'Mozilla/5.0 (compatible; CanadianAI/0.1; +https://www.zeever.ca) toronto-services-research'

function parseArgs(argv) {
  const args = { maxPages: 40, delayMs: 1000, headed: false }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (flag === '--max-pages') { args.maxPages = Number(value); i++ }
    else if (flag === '--delay-ms') { args.delayMs = Number(value); i++ }
    else if (flag === '--out') { args.out = value; i++ }
    else if (flag === '--headed') { args.headed = true }
  }
  return args
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function normalize(href) {
  try {
    const u = new URL(href)
    u.hash = ''
    // The record id is an article's identity. Links carry a &searchTerm= suffix
    // describing how a reader arrived, so keeping it would store one article
    // several times over.
    const m = u.href.match(ARTICLE)
    if (m) {
      return 'https://www.toronto.ca/home/311-toronto-at-your-service' +
             `/find-service-information/article/?kb=${m[1]}`
    }
    return u.href.replace(/\/$/, '')
  } catch {
    return null
  }
}

/**
 * Expand whatever the page hides behind a click, then read every link.
 *
 * The category tree renders as accordions and "show more" controls. A visitor
 * clicks them; so does this. Nothing here submits, and the selectors are limited
 * to expanders so a stray "Delete" or "Submit" can never be hit.
 */
async function expandAndCollect(page) {
  const EXPANDERS = [
    '[aria-expanded="false"]',
    'button.accordion-toggle',
    '.cot-accordion__trigger',
    'a[data-toggle="collapse"]',
  ].join(', ')

  for (let round = 0; round < 3; round++) {
    const controls = await page.locator(EXPANDERS).all()
    if (controls.length === 0) break
    for (const control of controls) {
      try {
        if (await control.isVisible()) await control.click({ timeout: 1500 })
      } catch {
        // A control that will not open is not worth retrying or reporting.
      }
    }
    await page.waitForTimeout(400)
  }

  return page.$$eval('a[href]', (as) => as.map((a) => a.href))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const browser = await chromium.launch({ headless: !args.headed })
  const context = await browser.newContext({ userAgent: USER_AGENT })
  const page = await context.newPage()

  const seen = new Set()
  const queue = ROOTS.map(normalize)
  const articles = new Map()   // record id -> canonical URL
  const pages = new Set()
  const errors = []
  let fetched = 0
  let capped = false

  console.log(`Render and discover. Nothing is stored.`)
  console.log(`Cap ${args.maxPages} pages, ${args.delayMs}ms between them, ` +
              `headless=${!args.headed}\n`)

  try {
    while (queue.length) {
      if (fetched >= args.maxPages) { capped = true; break }
      const url = queue.shift()
      if (!url || seen.has(url)) continue
      seen.add(url)
      if (DEAD_PATH.test(url)) continue

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
        fetched++
      } catch (err) {
        errors.push([url, err.message.split('\n')[0]])
        continue
      }

      const hrefs = await expandAndCollect(page)
      let newArticles = 0
      for (const href of hrefs) {
        const link = normalize(href)
        if (!link || !IN_SCOPE.test(link)) continue
        const m = link.match(ARTICLE)
        if (m) {
          if (!articles.has(m[1])) { articles.set(m[1], link); newArticles++ }
          continue
        }
        if (!seen.has(link) && !DEAD_PATH.test(link)) {
          pages.add(link)
          queue.push(link)
        }
      }

      console.log(`  [${fetched}/${args.maxPages}] +${newArticles} articles ` +
                  `(${articles.size} total, ${queue.length} queued)  ${url.slice(50, 130)}`)
      await sleep(args.delayMs)
    }
  } finally {
    await browser.close()
  }

  console.log(`\nRendered ${fetched} pages, found ${articles.size} distinct articles, ` +
              `${errors.length} errors`)
  if (capped) {
    console.log(`STOPPED AT THE CAP with ${queue.length} URLs still queued, so the`)
    console.log(`true count is higher. Re-run with a larger --max-pages.`)
  }

  // The number that decides whether this is worth building on. Thirteen was what
  // following links without a browser managed.
  const gain = articles.size - 13
  console.log(`\nLink-following without a browser found 13. This found ` +
              `${articles.size}, a difference of ${gain >= 0 ? '+' : ''}${gain}.`)
  if (articles.size < 40) {
    console.log('That is not enough to justify a browser dependency in the crawl path.')
  } else {
    console.log('That is enough to change what Zeever can answer. Worth crawling.')
  }

  if (errors.length) {
    console.log(`\nERRORS (${errors.length})`)
    for (const [url, msg] of errors.slice(0, 5)) console.log(`  ${url}\n    ${msg.slice(0, 110)}`)
  }

  if (args.out) {
    await writeFile(args.out, [...articles.values()].sort().join('\n') + '\n', 'utf8')
    console.log(`\nWrote ${articles.size} article URLs to ${args.out}`)
    console.log('Nothing was stored in the corpus. To fetch and index them:')
    console.log(`  uv run python scripts/crawl_311.py --urls ${args.out} --apply`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
