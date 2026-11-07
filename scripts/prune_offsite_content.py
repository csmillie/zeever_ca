"""Remove pages whose content came from somewhere other than toronto.ca.

    uv run python scripts/prune_offsite_content.py                 # dry run
    uv run python scripts/prune_offsite_content.py --apply
    uv run python scripts/prune_offsite_content.py --limit 200

Toronto.ca redirects some of its own pages to third parties, and the fetcher
followed those while storing the result under the toronto.ca URL. The Better
Buildings Partnership member pages are the clearest case: the corpus holds
Brookfield Properties, Crown Realty, Oxford, Greenrock and Toronto Community
Housing corporate sites, filed under

    /services-payments/water-environment/net-zero-homes-buildings/
    better-buildings-partnership/green-will-initiative/members/<company>/

along with an "Account Suspended" hosting page for one member whose site had
lapsed, and an "Access Denied" page for a licensing tribunal endpoint.

Every one of those is retrievable, and would be cited to a toronto.ca URL as
though the City had published it. That is the specific failure this whole system
exists to avoid.

The fetcher now refuses an offsite redirect, so no more will arrive. This removes
the ones already stored.

Detection is by re-fetching, not by guessing. Candidates are HTML pages whose
title lacks the "City of Toronto" suffix that City pages carry, which is a weak
signal and would take real pages with it. Each candidate is then fetched through
the fixed fetcher: if it still redirects off-host, the stored content did not come
from toronto.ca and the case is closed. Pages that fetch cleanly are left alone
however odd their title looks.
"""
import argparse
import asyncio

from sqlalchemy import text as sql

from crawler.fetcher import Fetcher, OffsiteRedirect
from parser.supersede import retire_parsed_documents
from shared.config import settings
from shared.db import get_session

# City pages carry this in the title. Its absence is a hint, not a verdict: plenty
# of real pages are missing it, which is why every candidate gets re-fetched.
CITY_SUFFIX = "City of Toronto"

# Titles that are a server talking, not a page. These are conclusive on their own.
ERROR_TITLES = ("access denied", "account suspended", "403 forbidden",
                "404 not found", "page not found", "site temporarily unavailable")

_CANDIDATES = """
    SELECT pd.id, pd.url, pd.title
    FROM canadian_ai.parsed_documents pd
    WHERE pd.source_format = 'html'
      AND pd.url IS NOT NULL
      AND (pd.title IS NULL OR pd.title NOT LIKE :suffix)
    ORDER BY pd.url
"""


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true",
                    help="remove the confirmed offsite pages (default is a dry run)")
    ap.add_argument("--limit", type=int, help="only check this many candidates")
    ap.add_argument("--rate-ms", type=int, default=settings.crawl_rate_limit_ms)
    args = ap.parse_args()

    with get_session() as session:
        rows = [dict(r._mapping) for r in
                session.execute(sql(_CANDIDATES), {"suffix": f"%{CITY_SUFFIX}%"})]
    if not rows:
        print("Every HTML page carries the City title suffix. Nothing to check.")
        return 0

    if args.limit:
        rows = rows[:args.limit]
    print(f"{len(rows)} candidates: HTML pages whose title lacks {CITY_SUFFIX!r}.")
    print("That alone proves nothing, so each is re-fetched through the fixed")
    print(f"fetcher. About {len(rows) * args.rate_ms / 1000 / 60:.1f} minutes.\n")

    fetcher = Fetcher(rate_limit_ms=args.rate_ms, user_agent=settings.crawl_user_agent)
    offsite, error_page, clean, unreachable = [], [], [], []

    try:
        for i, row in enumerate(rows, 1):
            title = (row["title"] or "").strip().lower()
            if any(t in title for t in ERROR_TITLES):
                # A server error page stored as content. No fetch needed to know
                # this is not a City page, and re-fetching may now 403 anyway.
                error_page.append(row)
                continue
            try:
                await fetcher.fetch(row["url"])
                clean.append(row)
            except OffsiteRedirect as exc:
                # From the exception, not from its message. Reading the host back
                # out of the text cut it at the first dot and printed "https://www",
                # which hid that City subdomains were being removed alongside
                # third parties, and 57 real pages were deleted before it showed.
                offsite.append((row, exc.landed or "?"))
            except Exception as exc:
                unreachable.append((row, f"{type(exc).__name__}"))
            if i % 25 == 0:
                print(f"  {i}/{len(rows)}  offsite {len(offsite)}, "
                      f"error pages {len(error_page)}, clean {len(clean)}")
    finally:
        await fetcher.close()

    print(f"\nRESULT")
    print(f"  {len(offsite):>4}  redirect off toronto.ca, so the stored content is not ours")
    print(f"  {len(error_page):>4}  stored a server error page as content")
    print(f"  {len(clean):>4}  fetch cleanly and stay, whatever the title looks like")
    print(f"  {len(unreachable):>4}  could not be checked")

    doomed = offsite + [(r, "error page") for r in error_page]
    if not doomed:
        print("\nNothing to remove.")
        return 0

    print(f"\nTO REMOVE ({len(doomed)})")
    for row, why in doomed[:40]:
        print(f"  {(row['title'] or '')[:38]:<40} -> {why[:34]:<36} {row['url'][-46:]}")
    if len(doomed) > 40:
        print(f"  ... and {len(doomed) - 40} more")

    if unreachable:
        print(f"\nCOULD NOT CHECK ({len(unreachable)}) — left in place rather than guessed at")
        for row, why in unreachable[:8]:
            print(f"  {why:<22} {row['url'][-64:]}")

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
    print("The fetcher now refuses offsite redirects, so these cannot come back.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
