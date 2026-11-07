"""What is in the application's corpus and not in the benchmark copy.

    uv run python scripts/compare_arm_corpora.py
    uv run python scripts/compare_arm_corpora.py --urls a.txt

The pgvectorscale arm searches its own database, so the two are only comparable
while they hold the same pages. They drift: the copy was 2 chunks behind when it
was built and 6 behind an hour later, because production keeps indexing.

That drift is not cosmetic. A page present in the application's corpus and absent
from the copy is scored as a retrieval miss for that arm when it is really a
missing document, which is how an arm can look worse at recall while returning
exactly what the others return. Run this before reading any recall difference as
a property of the index.

Without --urls it reports the totals and lists the pages the copy is missing.
With --urls it checks only those pages, which is what to do with the specific
pages that separated two arms.
"""
import argparse

from sqlalchemy import text as sql

from indexer.pgvectorscale_store import _session as benchmark_session
from shared.db import get_session

_TOTAL = sql("SELECT count(*) FROM canadian_ai.document_chunks WHERE embedding IS NOT NULL")

_BY_URL = sql("""
    SELECT pd.url, count(*) AS chunks
    FROM canadian_ai.document_chunks dc
    JOIN canadian_ai.parsed_documents pd ON dc.parsed_document_id = pd.id
    WHERE dc.embedding IS NOT NULL
    GROUP BY pd.url
""")


def _counts(execute) -> tuple[int, dict[str, int]]:
    total = execute(_TOTAL).scalar()
    return total, {r[0]: r[1] for r in execute(_BY_URL)}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--urls", help="check only these URLs, one per line")
    ap.add_argument("--show", type=int, default=20, help="how many differing pages to list")
    args = ap.parse_args()

    with get_session() as session:
        app_total, app_by_url = _counts(session.execute)
    bench = benchmark_session()
    try:
        bench_total, bench_by_url = _counts(bench.execute)
    finally:
        bench.close()

    print(f"application corpus: {app_total:,} embedded chunks, {len(app_by_url):,} pages")
    print(f"benchmark copy:     {bench_total:,} embedded chunks, {len(bench_by_url):,} pages")
    print(f"difference:         {app_total - bench_total:,} chunks\n")

    if args.urls:
        wanted = [ln.strip() for ln in open(args.urls, encoding="utf-8") if ln.strip()]
        print(f"{'app':>5} {'bench':>6}  url")
        for url in wanted:
            here, there = app_by_url.get(url, 0), bench_by_url.get(url, 0)
            flag = "" if here == there else "   <- differs"
            print(f"{here:>5} {there:>6}  {url}{flag}")
        return 0

    missing = sorted(u for u in app_by_url if u not in bench_by_url)
    short = sorted(u for u in app_by_url
                   if u in bench_by_url and bench_by_url[u] < app_by_url[u])

    print(f"pages absent from the copy: {len(missing)}")
    for url in missing[:args.show]:
        print(f"  {app_by_url[url]:>3} chunks  {url}")
    if len(missing) > args.show:
        print(f"  ... and {len(missing) - args.show} more")

    print(f"\npages present but with fewer chunks: {len(short)}")
    for url in short[:args.show]:
        print(f"  {app_by_url[url]:>3} -> {bench_by_url[url]:<3}  {url}")
    if len(short) > args.show:
        print(f"  ... and {len(short) - args.show} more")

    if not missing and not short:
        print("\nThe copy holds every page the application does. A recall difference "
              "between the arms is not explained by the corpus.")
    else:
        print("\nAny of these pages that a run scored as a miss for the pgvectorscale "
              "arm was a missing document, not a retrieval failure.")
        print("Refresh the benchmark copy before drawing a conclusion.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
