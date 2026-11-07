"""Does hybrid retrieval actually beat dense? Answered over all 100 prompts.

    uv run python scripts/compare_retrieval_modes.py
    uv run python scripts/compare_retrieval_modes.py --limit 5 --categories utilities water
    uv run python scripts/compare_retrieval_modes.py --verbose
    uv run python scripts/compare_retrieval_modes.py --max-per-url 1 2 3 --modes vector
    uv run python scripts/compare_retrieval_modes.py --precise-only

No generation, no judge, no cost: this asks only whether the page a prompt is
supposed to reach is in the chunks the app would read. That is upstream of every
model question, and it runs in a couple of minutes rather than hours.

It exists because one query was not enough to decide. On bp-35 hybrid removed the
parks-recreation page that had taken two of five slots, and then handed both to a
business-licence account page instead — one contaminating page swapped for
another, with the same number of relevant chunks either way. A change that fixes
one query and breaks four is not an improvement, and the aggregate is the only way
to see which happened.

Scored on hit@k against each prompt's expected_sources, which is a URL substring.
Ties are reported as ties: with 100 prompts a difference of one or two is noise,
and the regression list matters more than the totals.
"""
import argparse
import statistics
from collections import defaultdict

from sqlalchemy import text as sql

from evals.prompts import BENCHMARK_PROMPTS
from query_engine import retriever
from shared.config import settings
from shared.db import get_session

# A prompt is only measured when its expected_sources picks out the page that
# answers it. Of the 100, 45 match 26 or more corpus URLs and 36 match 6 to 25:
# bp-85 expects "community-people", which is 1,645 pages. A hit against that says
# retrieval stayed in the right section, not that it found the answer.
#
# It is not a cosmetic problem. bp-70 expects "water" (431 URLs) and scored a hit
# on every run, while the page that answers it — a 311 knowledge base article — has
# never been crawled. The loose expectations hid a missing content section behind a
# healthy-looking 89/100.
MAX_URLS_FOR_PRECISE = 5


def _precise_prompt_ids(prompts) -> set[str]:
    """Prompts whose expected_sources identifies a page rather than a section."""
    with get_session() as session:
        urls = [r[0].lower() for r in session.execute(sql(
            "SELECT DISTINCT url FROM canadian_ai.parsed_documents WHERE url IS NOT NULL"
        )) if r[0]]
    out = set()
    for bp in prompts:
        if not bp.expected_sources:
            continue
        worst = max(sum(1 for u in urls if s.lower() in u) for s in bp.expected_sources)
        if 0 < worst <= MAX_URLS_FOR_PRECISE:
            out.add(bp.id)
    return out

MODES = ("vector", "hybrid")

# An arm is a (mode, cap) pair. Sweeping the per-URL cap matters more than the
# mode did: every ranking miss in the audit lost to a duplicate of a page that
# had already taken a slot, by margins between 0.008 and 0.052 similarity.


def _hit_rank(chunks: list[dict], expected: list[str]) -> int | None:
    """1-based rank of the first chunk matching any expected source, else None."""
    for i, c in enumerate(chunks, 1):
        url = (c.get("url") or "").lower()
        if any(e.lower() in url for e in expected):
            return i
    return None


def _run(mode: str, prompts, limit: int, cap: int | None = None) -> dict[str, dict]:
    settings.retrieval_mode = mode
    if cap is not None:
        settings.max_chunks_per_url = cap
    out = {}
    for bp in prompts:
        try:
            chunks, _ = retriever.retrieve(bp.prompt, limit=limit)
        except Exception as exc:
            out[bp.id] = {"error": f"{type(exc).__name__}: {exc}"}
            continue
        out[bp.id] = {
            "rank": _hit_rank(chunks, bp.expected_sources),
            "urls": [c.get("url") for c in chunks],
        }
    return out


def _sweep_caps(prompts, args) -> int:
    """Score each (mode, cap) arm on hit@k, and name what each cap change moves."""
    by_id = {p.id: p for p in prompts}
    original_mode = settings.retrieval_mode
    original_cap = getattr(settings, "max_chunks_per_url", 2)
    arms: dict[tuple[str, int], dict] = {}
    try:
        for mode in args.modes:
            for cap in args.max_per_url:
                print(f"  running {mode} cap={cap}...")
                arms[(mode, cap)] = _run(mode, prompts, args.limit, cap=cap)
    finally:
        settings.retrieval_mode = original_mode
        settings.max_chunks_per_url = original_cap

    head = f"\n{'mode':<10}{'cap':>5}{'hit@' + str(args.limit):>10}{'miss':>8}{'mean rank':>12}"
    print(head)
    print("-" * len(head.strip("\n")))
    for (mode, cap), rows in arms.items():
        ranks = [r["rank"] for r in rows.values() if r.get("rank")]
        errs = sum(1 for r in rows.values() if "error" in r)
        scored = len(rows) - errs
        mean = statistics.mean(ranks) if ranks else float("nan")
        print(f"{mode:<10}{cap:>5}{f'{len(ranks)}/{scored}':>10}"
              f"{scored - len(ranks):>8}{mean:>12.2f}")

    # The totals hide which prompts moved, and a cap that trades four for four is
    # not an improvement even though the count is unchanged.
    caps = sorted(args.max_per_url)
    for mode in args.modes:
        for lo, hi in zip(caps, caps[1:]):
            a, b = arms.get((mode, lo)), arms.get((mode, hi))
            if not a or not b:
                continue
            gained = [p for p in by_id if not a.get(p, {}).get("rank") and b.get(p, {}).get("rank")]
            lost = [p for p in by_id if a.get(p, {}).get("rank") and not b.get(p, {}).get("rank")]
            if not gained and not lost:
                continue
            print(f"\n{mode}: cap {lo} -> {hi}")
            for pid in sorted(gained):
                print(f"  gained  {pid:<8} {by_id[pid].category:<18} rank {b[pid]['rank']}")
            for pid in sorted(lost):
                print(f"  LOST    {pid:<8} {by_id[pid].category:<18} was rank {a[pid]['rank']}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=5, help="chunks per query (default 5, what the app uses)")
    ap.add_argument("--categories", nargs="*", help="only these categories")
    ap.add_argument("--precise-only", action="store_true",
                    help="score only prompts whose expected_sources matches <=5 corpus URLs")
    ap.add_argument("--verbose", action="store_true", help="print the URLs for every difference")
    ap.add_argument("--modes", nargs="+", choices=list(MODES), default=list(MODES),
                    help="which retrieval modes to compare (default: both)")
    ap.add_argument("--max-per-url", nargs="+", type=int,
                    help="also sweep these per-URL caps; prints a cap table instead of a mode diff")
    args = ap.parse_args()

    if settings.retrieval_backend != "turbopuffer":
        print(f"retrieval_backend is {settings.retrieval_backend!r}. Hybrid needs a lexical")
        print("index, so both arms would run dense search and the comparison would be empty.")
        print("Set RETRIEVAL_BACKEND=turbopuffer to run this.")
        return 2

    prompts = BENCHMARK_PROMPTS
    if args.categories:
        prompts = [p for p in prompts if p.category in args.categories]
    if args.precise_only:
        keep = _precise_prompt_ids(prompts)
        dropped = len(prompts) - len(keep)
        prompts = [p for p in prompts if p.id in keep]
        print(f"Scoring only the {len(prompts)} prompts with a specific expected_sources; "
              f"{dropped} dropped as section filters.\n")
    if not prompts:
        print("No prompts matched.")
        return 2

    if args.max_per_url:
        return _sweep_caps(prompts, args)

    original = settings.retrieval_mode
    try:
        print(f"Running {len(prompts)} prompts through each mode at limit {args.limit}...\n")
        results = {m: _run(m, prompts, args.limit) for m in MODES}
    finally:
        settings.retrieval_mode = original

    by_id = {p.id: p for p in prompts}

    # --- headline ---
    head = f"{'mode':<10}{'hit@' + str(args.limit):>10}{'miss':>8}{'errors':>8}{'mean rank':>12}"
    print(head)
    print("-" * len(head))
    for m in MODES:
        rows = results[m]
        errs = sum(1 for r in rows.values() if "error" in r)
        ranks = [r["rank"] for r in rows.values() if r.get("rank")]
        hits = len(ranks)
        scored = len(rows) - errs
        mean_rank = statistics.mean(ranks) if ranks else float("nan")
        print(f"{m:<10}{f'{hits}/{scored}':>10}{scored - hits:>8}{errs:>8}{mean_rank:>12.2f}")

    # --- what changed, which is the part that decides it ---
    wins, losses, moved = [], [], []
    for pid in by_id:
        v, h = results["vector"].get(pid, {}), results["hybrid"].get(pid, {})
        if "error" in v or "error" in h:
            continue
        rv, rh = v.get("rank"), h.get("rank")
        if rv is None and rh is not None:
            wins.append((pid, rv, rh))
        elif rv is not None and rh is None:
            losses.append((pid, rv, rh))
        elif rv is not None and rh is not None and rv != rh:
            moved.append((pid, rv, rh))

    def _show(items, title, note):
        print(f"\n{title} ({len(items)}) — {note}")
        if not items:
            print("  none")
            return
        for pid, rv, rh in sorted(items):
            bp = by_id[pid]
            fv = "miss" if rv is None else f"rank {rv}"
            fh = "miss" if rh is None else f"rank {rh}"
            print(f"  {pid:<8} {bp.category:<18} {fv:>7} -> {fh:<7}  {bp.prompt[:56]}")
            if args.verbose:
                print(f"           vector: {', '.join(u.split('/')[-2] or u for u in results['vector'][pid]['urls'][:3])}")
                print(f"           hybrid: {', '.join(u.split('/')[-2] or u for u in results['hybrid'][pid]['urls'][:3])}")

    _show(wins, "HYBRID WINS", "expected page reached only with BM25")
    _show(losses, "HYBRID REGRESSIONS", "expected page lost when BM25 was added")
    _show(moved, "RANK CHANGED", "both found it, at a different position")

    # --- the prompts neither mode reaches, which is the actionable set ---
    # A high hit rate hides these: 88/100 at mean rank 1.53 says retrieval is
    # broadly fine and that the failures are specific. Some are genuinely
    # unanswerable (bp-35 has no "open a water account" page on toronto.ca and
    # carries expects_refusal); the rest are either a ranking problem or a crawl
    # gap, and inspect_retrieval --expect tells them apart.
    both_miss = sorted(
        pid for pid in by_id
        if not results["vector"].get(pid, {}).get("rank")
        and not results["hybrid"].get(pid, {}).get("rank")
        and "error" not in results["vector"].get(pid, {})
    )
    print(f"\nMISSED BY BOTH MODES ({len(both_miss)}) — where retrieval actually fails")
    if not both_miss:
        print("  none")
    for pid in both_miss:
        bp = by_id[pid]
        print(f"  {pid:<8} {bp.category:<18} {bp.prompt[:60]}")
        print(f"           expected: {', '.join(bp.expected_sources)}"
              + ("   [expects_refusal]" if bp.expects_refusal else ""))
        if args.verbose:
            for u in results["vector"][pid]["urls"][:3]:
                print(f"           got: {u}")
    if both_miss:
        print("\n  Check each one before assuming a ranking fix:")
        print("    uv run python scripts/inspect_retrieval.py --prompt-id <id> "
              "--expect <substring> --depth 100")
        print("  Reachable deeper means ranking. Not in the corpus at all means the crawl.")

    # --- per category, since a mode can help one area and wreck another ---
    print("\nBY CATEGORY (hits)")
    cats = sorted({p.category for p in prompts})
    print(f"{'category':<22}{'vector':>9}{'hybrid':>9}{'delta':>8}")
    print("-" * 48)
    for c in cats:
        ids = [p.id for p in prompts if p.category == c]
        counts = {}
        for m in MODES:
            counts[m] = sum(1 for pid in ids if results[m].get(pid, {}).get("rank"))
        delta = counts["hybrid"] - counts["vector"]
        flag = "" if delta == 0 else ("  <-- worse" if delta < 0 else "  <-- better")
        print(f"{c:<22}{counts['vector']:>9}{counts['hybrid']:>9}{delta:>+8}{flag}")

    net = len(wins) - len(losses)
    print(f"\nNet: {len(wins)} won, {len(losses)} lost ({net:+d}).")
    if abs(net) <= 2:
        print("That is inside the noise for 100 prompts. Read the regression list rather")
        print("than the totals, and do not switch the default on this alone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
