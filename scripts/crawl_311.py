"""Fetch and store the 311 knowledge base articles that are reachable by link.

    uv run python scripts/crawl_311.py                  # dry run, stores nothing
    uv run python scripts/crawl_311.py --apply          # fetch and store
    uv run python scripts/crawl_311.py --apply --max-pages 600 --depth 6

The 311 knowledge base holds the City's "how do I report this" answers, and none
of it is in the corpus: toronto.ca publishes one sitemap, it lists eight
WordPress page sitemaps, and robots.txt declares no other, so sitemap-driven
discovery never sees it. Three benchmark questions previously written off as
unanswerable are all answered there.

This crawls only what is reachable by following links from public pages, which is
a deliberately modest subset. The category browse is client-rendered, so link
following finds roughly a dozen articles rather than the full set. Two larger
routes exist and neither is taken here:

  The app calls to311kb-web0.ecrm.inter.prod-toronto.ca, an internal hostname
  that is plainly not a published interface. Building on another organisation's
  internal API means depending on something nobody agreed to provide.

  find.toronto.ca exposes a public search API that could be paged to enumerate
  the set, but issuing hundreds of automated queries against a city's search
  infrastructure to harvest content is bulk extraction wearing a search box.

The better answer is to ask the City for the data, and that is being done
separately. In the meantime these articles are linked from public pages, they
include the water main and street cleaning answers known to be missing, and
crawling them proves the parse and index path end to end at negligible cost.

Storage goes through the same save_raw_document the main crawler uses, so the
existing parse and embed pipeline picks the articles up with no special cases.
Article URLs are canonicalised to the record id alone, because links carry a
searchTerm suffix describing how a reader arrived and storing those as written
would put several copies of one article in the corpus.
"""
import argparse
import asyncio
import importlib.util
import pathlib

from crawler.fetcher import Fetcher
from crawler.storage import complete_crawl_run, create_crawl_run, save_raw_document
from crawler.url_filter import is_in_scope
from shared.config import settings


def _discovery_module():
    spec = importlib.util.spec_from_file_location(
        "discover_311", pathlib.Path(__file__).with_name("discover_311.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true",
                    help="fetch and store (default is a dry run that stores nothing)")
    ap.add_argument("--max-pages", type=int, default=400, help="cap on discovery fetches")
    ap.add_argument("--depth", type=int, default=5, help="link depth from the roots")
    ap.add_argument("--rate-ms", type=int, default=settings.crawl_rate_limit_ms,
                    help="delay between requests")
    ap.add_argument("--urls", help="article URLs from a file, one per line, instead of "
                                   "discovering them here")
    args = ap.parse_args()

    if args.urls:
        # Produced by apps/web/scripts/discover-311-rendered.mjs, which renders the
        # category tree an HTTP client cannot see. Kept as a separate step so the
        # crawl path has no browser dependency.
        articles = sorted({ln.strip() for ln in open(args.urls, encoding="utf-8")
                           if ln.strip() and not ln.startswith("#")})
        print(f"Read {len(articles)} article URLs from {args.urls}")
    else:
        discover = _discovery_module()
        print("Discovering articles by following links...\n")
        found = await discover.discover(args.max_pages, args.depth, args.rate_ms)
        articles = sorted(set(found.article_ids.values()))
        print(f"\nDiscovery fetched {found.fetched} pages and found {len(articles)} articles")
        if found.capped:
            print(f"  Discovery hit its cap with {found.queued} URLs still queued, so there")
            print("  may be more. Re-run with a higher --max-pages.")
    if not articles:
        print("\nNo articles found. The page structure may have changed; re-run")
        print("scripts/discover_311.py to see what is being reached.")
        return 1

    # Every URL still has to satisfy the same scope rule the main crawler uses, so
    # this cannot become a side door into pages the crawler is meant to skip.
    in_scope = [u for u in articles if is_in_scope(u)]
    rejected = [u for u in articles if u not in in_scope]
    if rejected:
        print(f"  {len(rejected)} rejected by url_filter and skipped:")
        for u in rejected[:5]:
            print(f"    {u}")

    print(f"\n{len(in_scope)} articles to fetch, one per {args.rate_ms}ms, "
          f"about {len(in_scope) * args.rate_ms / 1000 / 60:.1f} minutes")
    for u in in_scope[:10]:
        print(f"  {u}")
    if len(in_scope) > 10:
        print(f"  ... and {len(in_scope) - 10} more")

    if not args.apply:
        print("\nDry run. Nothing was fetched or stored. Re-run with --apply to crawl.")
        print("Then parse and embed what it stored:")
        print("  uv run python scripts/manage.py pipeline --skip-crawl")
        return 0

    fetcher = Fetcher(rate_limit_ms=args.rate_ms, user_agent=settings.crawl_user_agent)
    run_id = create_crawl_run({"source": "311-knowledgebase", "articles": len(in_scope)})
    stored = duplicate = failed = 0
    error = None

    try:
        for i, url in enumerate(in_scope, 1):
            try:
                result = await fetcher.fetch(url)
            except Exception as exc:
                failed += 1
                print(f"  [{i}/{len(in_scope)}] FAILED {type(exc).__name__}: {url}")
                continue

            if not result.content_type.startswith("text/html"):
                failed += 1
                print(f"  [{i}/{len(in_scope)}] not HTML ({result.content_type}): {url}")
                continue

            # save_raw_document returns None when this exact content is already
            # stored for this URL, so a re-run is cheap rather than duplicating.
            doc_id = save_raw_document(run_id, result)
            if doc_id:
                stored += 1
            else:
                duplicate += 1
            if i % 10 == 0:
                print(f"  {i}/{len(in_scope)}  stored {stored}, unchanged {duplicate}")
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        await fetcher.close()
        complete_crawl_run(run_id, pages_found=len(in_scope), pages_crawled=stored,
                           pdfs_downloaded=0, error=error)

    print(f"\nStored {stored} new, {duplicate} already current, {failed} failed.")
    if stored:
        print("\nThey are raw documents now, not answers. Parse and embed them:")
        print("  uv run python scripts/manage.py pipeline --skip-crawl")
        print("\nThen check whether the questions they should fix now retrieve:")
        print("  uv run python scripts/inspect_retrieval.py --prompt-id bp-57 --expect 311")
        print("  uv run python scripts/inspect_retrieval.py --prompt-id bp-70 --expect 311")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
