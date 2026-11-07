"""Show what retrieval returns for a query, and where an expected page ranks.

    uv run python scripts/inspect_retrieval.py "How do I pay my water bill in Toronto?"
    uv run python scripts/inspect_retrieval.py "..." --expect pay-your-utility-bill
    uv run python scripts/inspect_retrieval.py --prompt-id bp-33
    uv run python scripts/inspect_retrieval.py --prompt-id bp-33 --depth 100
    uv run python scripts/inspect_retrieval.py --prompt-id bp-35 --mode hybrid

Every model in a benchmark run answers from identical chunks, so when they all
do badly on a question the model is rarely the problem. This shows the chunks a
question actually gets, at the limit the app uses and at a deeper limit, so a
page that exists but ranks poorly can be told apart from one that is missing.

--expect takes a substring of a URL you believe should be retrieved. It reports
the rank that page reaches, if any, which distinguishes three different bugs:
not in the corpus at all, in the corpus but ranked below the cut, or retrieved
and simply not used by the model.
"""
import argparse
import textwrap

from evals.prompts import BENCHMARK_PROMPTS
from query_engine.retriever import retrieve
from shared.config import settings

APP_LIMIT = 5  # what /api/query and the benchmark use


def _excerpt(text: str, width: int = 92, lines: int = 2) -> str:
    flat = " ".join((text or "").split())
    wrapped = textwrap.wrap(flat, width=width)[:lines]
    out = "\n".join("        " + w for w in wrapped)
    return out + ("…" if len(wrapped) == lines and len(flat) > sum(len(w) for w in wrapped) else "")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("query", nargs="?", help="the question to retrieve for")
    ap.add_argument("--prompt-id", help="use a benchmark prompt instead, e.g. bp-33")
    ap.add_argument("--expect", help="URL substring that should be retrieved")
    ap.add_argument("--depth", type=int, default=50, help="how deep to look when hunting --expect (default 50)")
    ap.add_argument("--mode", choices=["vector", "hybrid"],
                    help="override settings.retrieval_mode for this call, to A/B one query")
    args = ap.parse_args()

    query = args.query
    if args.prompt_id:
        match = next((p for p in BENCHMARK_PROMPTS if p.id == args.prompt_id), None)
        if not match:
            print(f"No benchmark prompt {args.prompt_id!r}. Try one of: "
                  f"{', '.join(p.id for p in BENCHMARK_PROMPTS[:8])}…")
            return 2
        query = match.prompt
        print(f"prompt {match.id} ({match.category}): {query}")
        if getattr(match, "expected_sources", None):
            print(f"expected sources: {', '.join(match.expected_sources)}")
    if not query:
        ap.error("give a query or --prompt-id")

    if args.mode:
        settings.retrieval_mode = args.mode
    print(f"backend: {settings.retrieval_backend}  mode: {settings.retrieval_mode}\n")

    chunks, _ = retrieve(query, limit=APP_LIMIT)
    print(f"TOP {APP_LIMIT} — what the app and the benchmark actually see")
    print("-" * 100)
    if not chunks:
        print("  (nothing retrieved — the similarity filter rejected everything)")
    for i, c in enumerate(chunks, 1):
        sim = c.get("similarity")
        sim_s = f"{sim:.3f}" if isinstance(sim, (int, float)) else "?"
        print(f"  {i}. sim={sim_s}  {c.get('title') or '(untitled)'}")
        print(f"        {c.get('url')}")
        print(_excerpt(c.get("chunk_text", "")))
    print()

    if not args.expect:
        return 0

    # Where does the page we expected actually rank?
    #
    # The deep retrieval is a SEPARATE call at a different limit, and the dedup
    # layer over-fetches then caps per-URL, so the deep result set is not a superset
    # of the top-5 one — two chunks tied at the same similarity can swap places. A
    # rank in the deep list therefore says nothing about membership of the top 5.
    # Deciding "the models had it" from that rank claimed the app saw a page it did
    # not: on bp-35 it reported rank 5 for a PDF while the app's own rank 5 was a
    # different URL. Membership is now checked against the top-5 set the app uses.
    needle = args.expect.lower()

    def _matches(chunk) -> bool:
        return needle in (chunk.get("url") or "").lower()

    in_app_view = [c for c in chunks if _matches(c)]

    deep, _ = retrieve(query, limit=args.depth)
    hits = [(i, c) for i, c in enumerate(deep, 1) if _matches(c)]

    print(f"EXPECTED PAGE — searching {len(deep)} chunks for {args.expect!r}")
    print("-" * 100)

    if in_app_view:
        chunk = in_app_view[0]
        rank = next(i for i, c in enumerate(chunks, 1) if _matches(c))
        sim = chunk.get("similarity")
        sim_s = f"{sim:.3f}" if isinstance(sim, (int, float)) else "?"
        print(f"  IN the top {APP_LIMIT} the app uses, at rank {rank}  sim={sim_s}")
        print(f"  {chunk.get('url')}")
        print(_excerpt(chunk.get("chunk_text", ""), lines=3))
        print(f"\n  The models had this and did not use it. That one is a generation problem.")
        return 0

    if not hits:
        print(f"  NOT FOUND in the top {APP_LIMIT} the app uses, nor in the top {len(deep)}.")
        print("  Either the page is not in the corpus, or it is chunked/embedded such that this")
        print("  question does not come near it. Check the crawl before blaming the ranking:")
        print("    uv run python scripts/manage.py status")
        return 1

    rank, chunk = hits[0]
    sim = chunk.get("similarity")
    sim_s = f"{sim:.3f}" if isinstance(sim, (int, float)) else "?"
    print(f"  NOT in the top {APP_LIMIT} the app uses.")
    print(f"  Reachable at rank {rank} of {len(deep)} when retrieving deeper  sim={sim_s}")
    print(f"  {chunk.get('url')}")
    print(_excerpt(chunk.get("chunk_text", ""), lines=3))
    print(f"\n  It exists but does not make the cut, so no model could have answered from")
    print("  it. This is a ranking problem, not a model problem.")

    # A near-tie means the cut is arbitrary rather than a clear ranking failure.
    cutoff = chunks[-1].get("similarity") if chunks else None
    if isinstance(sim, (int, float)) and isinstance(cutoff, (int, float)):
        gap = cutoff - sim
        if gap <= 0.01:
            print(f"\n  It sits {gap:.3f} below the last chunk that made the cut ({cutoff:.3f}).")
            print("  That is a tie, not a ranking failure — which chunk survives is arbitrary.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
