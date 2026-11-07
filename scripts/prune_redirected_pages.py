"""Remove pages stored under a URL that Toronto.ca no longer serves.

    uv run python scripts/prune_redirected_pages.py                  # dry run
    uv run python scripts/prune_redirected_pages.py --apply
    uv run python scripts/prune_redirected_pages.py --section city-government

The corpus holds pages that are absent from the sitemap. Checking ten of them
returned 301 for every one, including a page whose path ends `forms__trashed`.
They are not deleted and not current: Toronto redirects them somewhere else, and
we are holding the old content under the old address.

That matters because a citation is a promise. An answer citing

    /city-government/.../about-the-archives/forms__trashed/

sends a resident to a URL that bounces them elsewhere, to read text we captured
before the City moved it.

Re-crawling these makes it worse rather than better. The fetcher stores content
under the URL it requested, so re-fetching a redirect files the destination's
text under the stale address, and the citation becomes confidently wrong instead
of merely stale.

So they are pruned, and the destination is reported. If the destination is
already in the corpus the content is not lost at all, only the duplicate under
the wrong name. If it is missing, the run says so, and a crawl will pick it up
from the sitemap where it is now listed.

Detection is by fetching, never by absence from the sitemap alone. A page can be
missing from a sitemap and perfectly alive, and those are left in place: they
need a by-URL re-crawl, which is a different job from this one.
"""
import argparse
import asyncio
from collections import Counter

import httpx
from sqlalchemy import text as sql

from crawler.sitemap import extract_urls_with_dates, parse_sitemap_index
from crawler.fetcher import Fetcher
from parser.supersede import retire_parsed_documents
from shared.config import settings
from shared.db import get_session

_STORED = """
    SELECT pd.id, pd.url, pd.title
    FROM canadian_ai.parsed_documents pd
    WHERE pd.url IS NOT NULL
      AND pd.raw_document_id IS NOT NULL
      AND pd.url NOT LIKE '%.pdf'
      {section}
    ORDER BY pd.url
"""

# Trailing slashes are compared away here for the same reason as in the sitemap
# check: Toronto serves both forms and neither the sitemap nor our stored URLs
# are consistent. An exact match errs safely, since it can only under-report what
# is held and therefore keep more, but it would report a destination we already
# have as unrecoverable, and the counts in this summary are what the operator
# uses to decide whether to run --apply.
_IN_CORPUS = sql(
    "SELECT 1 FROM canadian_ai.parsed_documents "
    "WHERE rtrim(url, '/') = rtrim(:url, '/') LIMIT 1"
)

# Verdicts. Only REDIRECTED and GONE are removed.
LIVE, REDIRECTED, GONE, UNCHECKED = "live", "redirected", "gone", "unchecked"

# What becomes of a redirect's destination, which decides whether removing the
# stale copy loses anything.
HELD, LISTED_ONLY, ORPHANED = "held", "listed", "orphaned"


def destination_fate(destination: str, listed: set[str], is_held: bool) -> str:
    """Whether the content survives the removal of the page pointing at it.

    Checked rather than assumed. An earlier version told the operator that
    unheld destinations "are in the sitemap and the next crawl will collect
    them" without testing it, which would have turned an irreversible command
    into a mistake for any destination that is listed nowhere.

    `listed` is expected without trailing slashes; Toronto serves both forms and
    the sitemap is not consistent about which it publishes.
    """
    if not destination.startswith("https://www.toronto.ca"):
        # Off toronto.ca. No crawl of ours will ever fetch it.
        return ORPHANED
    if is_held:
        return HELD
    if destination.rstrip("/") in listed:
        return LISTED_ONLY
    return ORPHANED


async def classify(client: httpx.AsyncClient, url: str) -> tuple[str, str]:
    """(verdict, detail) for one stored URL, decided by asking the site."""
    try:
        response = await client.get(url)
    except Exception as exc:
        return UNCHECKED, type(exc).__name__

    final = str(response.url)
    if response.status_code in (404, 410):
        return GONE, str(response.status_code)
    if response.status_code >= 400:
        # A 403 is a login wall, not a dead page, and several City applications
        # answer that way. Removing them would delete real pages.
        return UNCHECKED, str(response.status_code)
    if final.rstrip("/") != url.rstrip("/"):
        return REDIRECTED, final
    return LIVE, str(response.status_code)


async def sitemap_urls(fetcher: Fetcher) -> set[str]:
    result = await fetcher.fetch("https://www.toronto.ca/sitemap.xml")
    urls: set[str] = set()
    for sitemap in parse_sitemap_index(result.raw_content.decode()):
        try:
            page = await fetcher.fetch(sitemap)
            urls.update(e["url"] for e in extract_urls_with_dates(page.raw_content.decode()))
        except Exception as exc:
            print(f"  could not read {sitemap}: {type(exc).__name__}: {exc}")
    return urls


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true",
                    help="remove the confirmed redirected and gone pages (default is a dry run)")
    ap.add_argument("--section", help="limit to one first path segment, e.g. city-government")
    ap.add_argument("--limit", type=int, help="only check this many candidates")
    ap.add_argument("--include-orphaned", action="store_true",
                    help="also remove pages whose redirect destination is neither held "
                         "nor in the sitemap. That content is not recoverable afterwards")
    ap.add_argument("--rate-ms", type=int, default=settings.crawl_rate_limit_ms)
    args = ap.parse_args()

    where = "AND pd.url LIKE :section" if args.section else ""
    params = {"section": f"https://www.toronto.ca/{args.section}/%"} if args.section else {}
    with get_session() as session:
        stored = [dict(r._mapping) for r in
                  session.execute(sql(_STORED.format(section=where)), params)]

    fetcher = Fetcher(rate_limit_ms=args.rate_ms, user_agent=settings.crawl_user_agent)
    try:
        print("Reading the sitemap to narrow the candidates...")
        listed = await sitemap_urls(fetcher)
    finally:
        await fetcher.close()
    if not listed:
        print("Could not read the sitemap. Refusing to guess which pages are stale.")
        return 2
    print(f"  {len(listed):,} URLs listed")

    # Absence from the sitemap is the cheap filter, not the verdict. Every
    # candidate is then asked directly, because a page can be unlisted and alive.
    candidates = [r for r in stored if r["url"] not in listed]
    if args.limit:
        candidates = candidates[:args.limit]
    if not candidates:
        print("Every stored page is listed in the sitemap. Nothing to check.")
        return 0

    print(f"  {len(stored):,} stored, {len(candidates):,} of them unlisted")
    print(f"Checking each one. About {len(candidates) * args.rate_ms / 1000 / 60:.1f} minutes.\n")

    verdicts: dict[str, list] = {LIVE: [], REDIRECTED: [], GONE: [], UNCHECKED: []}
    async with httpx.AsyncClient(follow_redirects=True, timeout=30,
                                 headers={"User-Agent": settings.crawl_user_agent}) as client:
        for i, row in enumerate(candidates, 1):
            verdict, detail = await classify(client, row["url"])
            verdicts[verdict].append((row, detail))
            await asyncio.sleep(args.rate_ms / 1000)
            if i % 25 == 0:
                print(f"  {i}/{len(candidates)}  redirected {len(verdicts[REDIRECTED])}, "
                      f"gone {len(verdicts[GONE])}, live {len(verdicts[LIVE])}")

    print("\nRESULT")
    print(f"  {len(verdicts[REDIRECTED]):>4}  redirect elsewhere: stored under a URL the City moved")
    print(f"  {len(verdicts[GONE]):>4}  return 404 or 410")
    print(f"  {len(verdicts[LIVE]):>4}  answer normally and stay, though the sitemap omits them")
    print(f"  {len(verdicts[UNCHECKED]):>4}  could not be judged, left in place")

    if verdicts[LIVE]:
        print("\n  The live ones are a separate problem: they are real pages the")
        print("  sitemap does not list, so a section re-crawl never reaches them.")
        print("  They need a by-URL re-crawl, not pruning.")

    # Whether the destination survives decides whether pruning loses anything.
    # Three cases, and only the first two are safe:
    #
    #   held      the destination is already in the corpus. Removing the stale
    #             copy loses nothing at all.
    #   listed    not held, but in the sitemap, so the next crawl collects it.
    #   orphaned  neither held nor listed, or off toronto.ca entirely. Nothing
    #             will bring it back, and deleting the stale copy is real content
    #             loss.
    #
    # An earlier version printed "those destinations are in the sitemap and the
    # next crawl will collect them" without checking, which is the kind of
    # reassurance that turns an irreversible command into a mistake.
    listed_normalised = {u.rstrip("/") for u in listed}
    held, listed_only, orphaned = [], [], []
    with get_session() as session:
        buckets = {HELD: held, LISTED_ONLY: listed_only, ORPHANED: orphaned}
        for row, destination in verdicts[REDIRECTED]:
            is_held = bool(session.execute(_IN_CORPUS, {"url": destination}).first())
            buckets[destination_fate(destination, listed_normalised, is_held)].append(
                (row, destination))

    # Gone pages have no destination to preserve, and a 404 is the City saying
    # the page does not exist, so they are removed regardless.
    doomed = held + listed_only + verdicts[GONE]
    if args.include_orphaned:
        doomed += orphaned

    print(f"\nTO REMOVE ({len(doomed)})")
    for row, detail in doomed[:30]:
        print(f"  {detail[:52]:<54} {row['url'][-52:]}")
    if len(doomed) > 30:
        print(f"  ... and {len(doomed) - 30} more")

    print(f"\n  {len(held)} redirect to pages already in the corpus. Nothing is lost.")
    print(f"  {len(listed_only)} redirect to pages in the sitemap but not yet held, so the")
    print("  next crawl collects them.")

    if orphaned:
        print(f"\n  {len(orphaned)} redirect somewhere neither held nor listed in the sitemap,")
        print("  or off toronto.ca entirely. Nothing will collect those, so removing")
        print("  the stored copy loses the content for good.")
        for row, destination in orphaned[:8]:
            print(f"    {destination[:60]:<62} <- {row['url'][-44:]}")
        if len(orphaned) > 8:
            print(f"    ... and {len(orphaned) - 8} more")
        if args.include_orphaned:
            print("  --include-orphaned given, so these are being removed too.")
        else:
            print("  Kept. Pass --include-orphaned to remove them as well, knowing that.")

    if not doomed:
        print("\nNothing to remove.")
        return 0

    if not args.apply:
        print("\nDry run. Nothing was changed. Re-run with --apply to remove them.")
        return 0

    with get_session() as session:
        try:
            parsed, chunks = retire_parsed_documents(session, [r["id"] for r, _ in doomed])
            session.commit()
        except Exception as exc:
            session.rollback()
            print(f"\nFAILED: {type(exc).__name__}: {exc}")
            print("Rolled back. Nothing was deleted from Postgres.")
            return 1
    print(f"\nRemoved {parsed} documents and {chunks} chunks.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
