"""Map Toronto's 311 knowledge base without indexing any of it.

    uv run python scripts/discover_311.py
    uv run python scripts/discover_311.py --max-pages 400 --depth 5
    uv run python scripts/discover_311.py --out /tmp/kb-urls.txt

Toronto.ca publishes one sitemap. It lists eight WordPress page sitemaps and
nothing else, and robots.txt declares no other, so the crawler has never seen the
311 knowledge base. That is where the City publishes its "how do I report this"
answers, which is the most common shape of question this system gets, and three
benchmark questions previously written off as unanswerable are all answered
there.

Before committing to crawling it, three things need to be known and none of them
can be guessed:

  size      No sitemap means no page count. It could be 200 articles or 5,000,
            and that decides whether this is twenty minutes or a whole evening
            against a city web server.
  shape     Verified against the live site, and the opposite of what it looks
            like from search results. The static /311/knowledgebase/... paths
            301 to the 311 landing page and lose the article entirely; a fetch
            of the street-cleaning article returns the generic "311 Toronto"
            page. The live content is the query form,
            /find-service-information/article/?kb=<id>, which returns the
            article server-rendered. The id is a Salesforce record id, so it,
            not the path, is the identity of an article.
  overlap   Some of it may already be in the corpus by another route.

So this fetches pages to read their links and stores nothing. It reports what is
there and stops. Deciding to crawl is a separate step, made with these numbers in
hand.

It is polite by construction: one request per second by default, a hard page cap
that stops the run rather than warning, and a link filter that cannot leave the
knowledge base.
"""
import argparse
import asyncio
import re
from dataclasses import dataclass
from collections import Counter, defaultdict
from urllib.parse import urldefrag, urljoin, urlparse

from bs4 import BeautifulSoup
from sqlalchemy import text as sql

from crawler.fetcher import Fetcher
from shared.config import settings
from shared.db import get_session

ROOTS = [
    "https://www.toronto.ca/311/knowledgebase/",
    "https://www.toronto.ca/home/311-toronto-at-your-service/",
]

# Anything the crawl is allowed to follow. Scoped tightly: a link filter that can
# wander out of the knowledge base turns a bounded survey into a site-wide crawl.
IN_SCOPE = re.compile(r"^https://www\.toronto\.ca/(311/|home/311-toronto-at-your-service/)")

# The live article form. The kb id is a Salesforce record id and is the article's
# real identity: the same article can be linked from several category pages, and
# only the id distinguishes one article from another.
QUERY_FORM = re.compile(r"/find-service-information/article/\?kb=(?P<id>[A-Za-z0-9]+)", re.I)

# Legacy paths that 301 to the 311 landing page. Following them wastes a request
# and lands on a page that is not the article, which would then be counted as
# though it were one.
DEAD_PATH = re.compile(r"/311/knowledgebase/")

SKIP_EXT = (".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".css", ".js",
            ".ico", ".zip", ".xlsx", ".docx")


def normalize(url: str) -> str:
    """Drop the fragment and any trailing slash difference, so one page is one URL."""
    url, _ = urldefrag(url)
    return url.rstrip("/") or url


ARTICLE_BASE = ("https://www.toronto.ca/home/311-toronto-at-your-service"
                "/find-service-information/article/")


def canonical_article_url(url: str) -> str:
    """One URL per article, built from the record id alone.

    Links in the wild carry a &searchTerm= suffix describing how the reader got
    there, so the same article appears under several URLs. Storing those as
    written would put duplicate copies of one article in the corpus, which is the
    problem the per-URL cap and the parse-supersede work just removed.
    """
    aid = article_id(url)
    return f"{ARTICLE_BASE}?kb={aid}" if aid else url


def article_id(url: str) -> str | None:
    """The Salesforce record id, which identifies an article across category paths."""
    m = QUERY_FORM.search(url)
    return m.group("id") if m else None


def shape(url: str) -> str:
    """A coarse description of where a URL sits, for the shape report."""
    if article_id(url):
        return "knowledge base article (?kb=, live)"
    if DEAD_PATH.search(urlparse(url).path):
        return "legacy /knowledgebase/ path (301s away, skipped)"
    return "311 site page"


@dataclass
class Discovery:
    discovered: dict           # url -> depth first seen
    article_ids: dict          # record id -> canonical article URL
    errors: list
    fetched: int
    capped: bool
    queued: int


async def discover(max_pages: int, depth_limit: int, rate_ms: int,
                   progress: bool = True) -> Discovery:
    """Walk the 311 section following links, fetching nothing but HTML to read."""
    args = argparse.Namespace(max_pages=max_pages, depth=depth_limit, rate_ms=rate_ms)
    fetcher = Fetcher(rate_limit_ms=args.rate_ms, user_agent=settings.crawl_user_agent)
    seen: set[str] = set()
    discovered: dict[str, int] = {}       # url -> depth first seen
    article_ids: dict[str, str] = {}      # Salesforce record id -> first URL seen
    queue: list[tuple[str, int]] = [(normalize(r), 0) for r in ROOTS]
    errors: list[tuple[str, str]] = []
    fetched = 0
    capped = False

    if progress:
        print(f"Cap {args.max_pages} pages, depth {args.depth}, "
              f"{args.rate_ms}ms between requests.\n")

    try:
        while queue:
            if fetched >= args.max_pages:
                capped = True
                break
            url, depth = queue.pop(0)
            if url in seen:
                continue
            seen.add(url)
            discovered.setdefault(url, depth)

            # Legacy paths redirect to the landing page, so fetching one costs a
            # request and returns something that is not the article.
            if DEAD_PATH.search(urlparse(url).path):
                continue
            if depth >= args.depth:
                continue

            try:
                result = await fetcher.fetch(url)
                fetched += 1
            except Exception as exc:
                errors.append((url, f"{type(exc).__name__}: {exc}"))
                continue

            if not result.content_type.startswith("text/html"):
                continue

            soup = BeautifulSoup(result.raw_content, "lxml")
            for a in soup.find_all("a", href=True):
                link = normalize(urljoin(url, a["href"]))
                if not IN_SCOPE.match(link):
                    continue
                if link.lower().endswith(SKIP_EXT):
                    continue
                if link in seen:
                    continue
                # One article, many category paths: dedupe on the record id so a
                # page linked from four places is counted once and fetched once.
                aid = article_id(link)
                if aid:
                    if aid in article_ids:
                        continue
                    article_ids[aid] = canonical_article_url(link)
                discovered.setdefault(link, depth + 1)
                queue.append((link, depth + 1))

            if progress and fetched % 25 == 0:
                print(f"  fetched {fetched}, discovered {len(discovered)}, queue {len(queue)}")
    finally:
        await fetcher.close()

    return Discovery(discovered=discovered, article_ids=article_ids, errors=errors,
                     fetched=fetched, capped=capped, queued=len(queue))


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--max-pages", type=int, default=300,
                    help="hard cap on pages fetched (default 300)")
    ap.add_argument("--depth", type=int, default=4, help="link depth from the roots")
    ap.add_argument("--rate-ms", type=int, default=settings.crawl_rate_limit_ms,
                    help="delay between requests")
    ap.add_argument("--out", help="write every discovered URL to this file")
    args = ap.parse_args()

    print("Discovery only, nothing is stored.")
    found = await discover(args.max_pages, args.depth, args.rate_ms)
    discovered, article_ids = found.discovered, found.article_ids
    errors, fetched, capped, queue = found.errors, found.fetched, found.capped, found.queued

    print(f"\nFetched {fetched} pages, discovered {len(discovered)} URLs, "
          f"{len(errors)} errors")
    if capped:
        print(f"STOPPED AT THE CAP. {queue} URLs were still queued, so the true")
        print("size is larger than this. Re-run with a higher --max-pages to go further.")

    print("\nURL SHAPES")
    shapes = Counter(shape(u) for u in discovered)
    for name, count in shapes.most_common():
        print(f"  {count:>5}  {name}")

    print(f"\n{len(article_ids)} distinct knowledge base articles found so far")
    if article_ids:
        for aid, url in list(sorted(article_ids.items()))[:5]:
            print(f"  {aid}  {url[:96]}")

    print("\nDEPTH REACHED")
    by_depth = Counter(discovered.values())
    for d in sorted(by_depth):
        print(f"  depth {d}: {by_depth[d]}")

    # Anything already indexed by another route changes the size of the job. This
    # comes last and is allowed to fail: the fetching is the expensive part, and
    # losing a completed survey because the database is unreachable would be a
    # poor trade for one extra line of output.
    print(f"\nALREADY IN THE CORPUS")
    try:
        with get_session() as session:
            rows = session.execute(sql(
                "SELECT DISTINCT url FROM canadian_ai.parsed_documents "
                "WHERE url ILIKE '%%/311/%%' OR url ILIKE '%%311-toronto-at-your-service%%'"
            )).fetchall()
        already = {normalize(r[0]) for r in rows if r[0]}
        overlap = already & set(discovered)
        print(f"  {len(already)} matching URLs indexed, {len(overlap)} of them found by this run")
        if not already:
            print("  None. The knowledge base has never been crawled, as expected.")
    except Exception as exc:
        print(f"  Could not check: {type(exc).__name__}. The discovery above still stands.")

    if errors:
        print(f"\nERRORS ({len(errors)})")
        grouped = defaultdict(int)
        for _, msg in errors:
            grouped[msg.split(":")[0]] += 1
        for kind, count in sorted(grouped.items(), key=lambda kv: -kv[1]):
            print(f"  {count:>4}x {kind}")
        for url, msg in errors[:5]:
            print(f"    {url}\n      {msg[:110]}")

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            for u in sorted(discovered):
                f.write(u + "\n")
        print(f"\nWrote {len(discovered)} URLs to {args.out}")

    print("\nNothing was stored. Crawling this for real is a separate decision, and")
    print("these numbers are what it should be made from: how many articles exist,")
    print("whether the query-string duplicates need excluding, and how long a full")
    print(f"pass would take at {args.rate_ms}ms per request.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
