"""Does retrieval work across the whole corpus, or only on the 100 curated prompts?

    uv run python scripts/eval_retrieval_breadth.py --sample 300
    uv run python scripts/eval_retrieval_breadth.py --sample 300 --limit 5 --mode hybrid
    uv run python scripts/eval_retrieval_breadth.py --sample 200 --section services-payments
    uv run python scripts/eval_retrieval_breadth.py --urls resident.txt --questions q.json

The benchmark is 100 hand-written questions, and after narrowing their
expected_sources it becomes a precise target. A precise target is exactly the kind
of thing retrieval can be tuned to hit while getting worse everywhere else, and
"everywhere else" is 17,474 pages the site is supposed to answer from.

This measures the corpus instead. Sample pages, ask a local model to write the
question each page answers, then check whether retrieval returns that page. Ground
truth is exact by construction — the question came from that page — so there is no
expected_sources substring to be too loose, which is the flaw that let a whole
missing content section read as 89% recall.

Two honest limits, because a number without them would be misused:

  1. It is an UPPER BOUND. A question generated from a page inherits that page's
     vocabulary, so it is easier than what a resident would actually type. Read
     movements between runs, not the absolute value.
  2. It cannot see what the corpus does not contain. Toronto's 311 knowledge base
     is absent entirely and this eval would never notice, because it only ever
     asks about pages already indexed. Coverage of user intent is a different
     question needing different evidence.

Sampling is by URL, not by chunk. One proclamations page carries 241 chunks and
would otherwise dominate. Pass --seed to make a run reproducible.

For a before-and-after comparison, --urls fixes which pages are tested and
--questions caches the generated questions to a file and reuses them on the next
run. Both are needed. The questions come from a model, so without caching, two
runs of the same pages ask different things and any difference between them is
unreadable. With both, the only variable left is the change being measured.

    uv run python scripts/eval_retrieval_breadth.py --urls resident.txt --questions q.json
    ... make the change ...
    uv run python scripts/eval_retrieval_breadth.py --urls resident.txt --questions q.json

The same two flags are what makes a store comparison readable. --backend picks
which one to measure, and every arm runs the identical questions against the
identical pages:

    uv run python scripts/eval_retrieval_breadth.py --urls pages.txt --questions q.json --backend pgvector
    uv run python scripts/eval_retrieval_breadth.py --urls pages.txt --questions q.json --backend turbopuffer
    uv run python scripts/eval_retrieval_breadth.py --urls pages.txt --questions q.json --backend pgvectorscale
"""
import argparse
import asyncio
import csv
import json
import pathlib
import random
import re
import statistics
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from sqlalchemy import bindparam
from sqlalchemy import text as sql

from llm_router.ollama_provider import OllamaProvider
from indexer.embedder import embed_texts
from query_engine.experiment_retriever import check_arm, retrieve_arm_ranked
from shared.config import settings
from shared.db import get_session

_EMBEDDED_COUNT = ("SELECT count(*) FROM canadian_ai.document_chunks "
                   "WHERE embedding IS NOT NULL")

GENERATOR_PROMPT = """Below is an excerpt from a page on the City of Toronto website.

Write ONE question that a Toronto resident would plausibly type into a search box, which this page answers.

Rules:
- Ask about the service or topic, not about the document
- Do not quote the page title verbatim
- Do not mention "this page", "the excerpt", or "according to"
- One sentence, no preamble, no quotation marks

Excerpt:
{excerpt}"""

# Enough text to be answerable, short enough that generation stays fast.
EXCERPT_CHARS = 1200

_SAMPLE = """
    SELECT pd.url, pd.title, dc.chunk_text, dc.id AS chunk_id
    FROM canadian_ai.parsed_documents pd
    JOIN canadian_ai.document_chunks dc ON dc.parsed_document_id = pd.id
    WHERE pd.url IS NOT NULL
      AND dc.chunk_text IS NOT NULL
      AND dc.embedding IS NOT NULL
      AND length(dc.chunk_text) > 400
      {section}
"""


# A question written from a Delegated Approval Form has hundreds of correct
# answers: the City publishes the same authority table in every one of them, and
# one chunk was measured with 2,236 near-copies on other pages. Crediting only the
# page the question came from scores retrieval as wrong for returning an identical
# answer from a different URL.
EQUIVALENT_SIMILARITY = 0.95

_EQUIVALENT = sql("""
    SELECT dc.id,
           1 - (dc.embedding <=> (SELECT embedding FROM canadian_ai.document_chunks
                                  WHERE id = :source_id)) AS similarity
    FROM canadian_ai.document_chunks dc
    WHERE dc.id IN :ids AND dc.embedding IS NOT NULL
""").bindparams(bindparam("ids", expanding=True))

# "What is the process" was generated from a real page in a real run, scored 0.427
# against it and ranked 9,777th. A question that names nothing cannot identify a
# page, and counting it as a retrieval failure blames retrieval for the generator.
MIN_QUESTION_WORDS = 5
MIN_QUESTION_CHARS = 25


_warned: set[str] = set()


def _warn_once(message: str) -> None:
    """One line per distinct problem, not one per page: a broken lookup would
    otherwise print three hundred identical warnings and bury the results."""
    if message not in _warned:
        _warned.add(message)
        print(f"  [warn] {message}")


def _too_vague(question: str) -> bool:
    text = (question or "").strip()
    return len(text) < MIN_QUESTION_CHARS or len(text.split()) < MIN_QUESTION_WORDS


def _first_equivalent(chunks: list[dict], similarity_by_id: dict[str, float],
                      threshold: float = EQUIVALENT_SIMILARITY) -> int | None:
    """1-based position of the first retrieved chunk that is near-identical to the
    chunk the question was written from, or None.

    Position rather than a boolean, so a run can tell the difference between an
    equivalent answer at rank 1 and one at rank 5.
    """
    for n, chunk in enumerate(chunks, 1):
        # `or 0.0` because a NULL similarity can reach here as None, and comparing
        # None to a float raises. Not equivalent is the correct reading of unknown.
        if (similarity_by_id.get(str(chunk.get("id"))) or 0.0) >= threshold:
            return n
    return None


def _equivalent_rank(source_chunk_id, chunks: list[dict]) -> int | None:
    """Resolved against the application's corpus, which is where ground truth
    lives. The pgvectorscale arm returns ids from its own copy; those ids match,
    because the copy is a dump restore. If one ever does not resolve it scores as
    not equivalent, which is the conservative direction: this credit can only be
    given on evidence, never assumed.
    """
    ids = [str(c["id"]) for c in chunks if c.get("id")]
    if not ids or source_chunk_id is None:
        return None
    try:
        with get_session() as session:
            rows = session.execute(
                _EQUIVALENT, {"source_id": str(source_chunk_id), "ids": ids}).all()
    except Exception as exc:
        # Never fatal. This runs after the strict rank is known, so failing here
        # can only withhold a credit, and losing a 300-page run and its CSV to a
        # database hiccup in an optional lookup would be a poor trade.
        _warn_once(f"equivalence lookup failed, credits withheld: "
                   f"{type(exc).__name__}: {exc}")
        return None
    # A similarity is NULL when either side has no embedding. Treated as not
    # equivalent rather than crashing: float(None) raised here and killed a whole
    # run before its results were written.
    return _first_equivalent(
        chunks,
        {str(r.id): float(r.similarity) for r in rows if r.similarity is not None})


def _section(url: str) -> str:
    """First path segment, e.g. services-payments. Used to group results."""
    m = re.match(r"https?://[^/]+/([^/]+)", url or "")
    return m.group(1) if m else "(root)"


def _clean_question(text: str) -> str:
    """Strip the preamble a model adds however firmly it was told not to."""
    text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.DOTALL)
    text = text.strip().strip('"').strip()
    # Keep the first line that actually looks like a question.
    for line in text.split("\n"):
        line = line.strip().strip('"').strip()
        if line.endswith("?") and len(line) > 15:
            return line
    return text.split("\n")[0].strip() if text else ""



async def _timed_retrieval(question, backend, mode, limit):
    """Retrieve once, returning (chunks, milliseconds in the store).

    The query is embedded first and the vector passed in, for two reasons. Every
    arm then searches with an identical vector rather than its own call to the
    embedding API, and the timing covers the store alone: embedding is one remote
    call of roughly the same cost whatever is being measured, and leaving it
    inside would dilute exactly the difference the run exists to find.
    """
    embedding = await asyncio.to_thread(embed_texts, [question])
    t0 = time.perf_counter()
    chunks, _ = await asyncio.to_thread(
        retrieve_arm_ranked, question, backend, mode, limit, embedding[0])
    return chunks, (time.perf_counter() - t0) * 1000

async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sample", type=int, default=200, help="pages to test (default 200)")
    ap.add_argument("--limit", type=int, default=5, help="chunks retrieved per query")
    ap.add_argument("--mode", choices=["vector", "hybrid"], help="override retrieval_mode")
    ap.add_argument("--backend", choices=["pgvector", "turbopuffer", "pgvectorscale"],
                    help="which store to measure; defaults to the configured one. "
                         "pgvectorscale reads its own database, set by "
                         "PGVECTORSCALE_DATABASE_URL")
    ap.add_argument("--section", help="only pages under this first path segment")
    ap.add_argument("--seed", type=int, default=1, help="sampling seed, for reproducibility")
    ap.add_argument("--model", help="Ollama tag for question generation")
    ap.add_argument("--urls", help="test exactly these URLs (one per line) instead of sampling")
    ap.add_argument("--questions",
                    help="cache generated questions here; reused on the next run so a "
                         "before-and-after comparison asks identical questions")
    args = ap.parse_args()

    if not settings.ollama_base_url:
        print("OLLAMA_BASE_URL is not set. Question generation runs locally and free;")
        print("point it at an Ollama host before running this.")
        return 2
    if args.mode:
        settings.retrieval_mode = args.mode
    backend = args.backend or settings.retrieval_backend
    mode = settings.retrieval_mode
    # Before the corpus query and before a model writes a single question. A
    # dense-only arm under retrieval_mode=hybrid raises on every row, and the
    # script catches per row, so the run would finish with nothing scored and the
    # reason buried in the CSV. Same category as the two checks above it.
    try:
        check_arm(backend, mode)
    except ValueError as exc:
        print(f"Cannot run this arm: {exc}")
        print("Pass --mode vector to measure a dense-only store, or --backend "
              "turbopuffer to keep hybrid.")
        return 2

    where = "AND pd.url LIKE :sec" if args.section else ""
    params = {"sec": f"https://www.toronto.ca/{args.section}/%"} if args.section else {}
    with get_session() as session:
        rows = [dict(r._mapping) for r in
                session.execute(sql(_SAMPLE.format(section=where)), params)]
    if not rows:
        print("No chunks matched. Check --section, or that the corpus is populated.")
        return 2

    # One chunk per URL, chosen deterministically, then sample URLs. Sampling chunks
    # directly would let a 241-chunk page stand in for hundreds of distinct ones.
    by_url = {}
    for r in rows:
        by_url.setdefault(r["url"], r)

    if args.urls:
        wanted = [ln.strip() for ln in open(args.urls, encoding="utf-8") if ln.strip()]
        picked = [by_url[u] for u in wanted if u in by_url]
        missing = len(wanted) - len(picked)
        print(f"{len(picked)} of {len(wanted)} requested URLs are in the corpus"
              + (f", {missing} missing" if missing else ""))
        if missing:
            print("  Missing URLs are skipped rather than counted as failures: a page")
            print("  that is not indexed cannot be retrieved, and scoring it as a miss")
            print("  would blame retrieval for a gap in the corpus.")
    else:
        urls = sorted(by_url)
        random.Random(args.seed).shuffle(urls)
        picked = [by_url[u] for u in urls[:args.sample]]
        print(f"{len(by_url):,} distinct pages available; testing {len(picked)}")
    print(f"backend={backend} mode={mode} limit={args.limit} seed={args.seed}")
    if backend == "pgvectorscale":
        # Ground truth comes from the application's corpus, and this arm searches a
        # separate copy of it. A page present here and missing there is scored as a
        # retrieval miss when it is really a corpus difference, so the two counts
        # belong in the run's output rather than in someone's memory of it.
        from indexer.pgvectorscale_store import _session as _pvs_session
        with get_session() as s_app:
            here = s_app.execute(sql(_EMBEDDED_COUNT)).scalar()
        pvs = _pvs_session()
        try:
            there = pvs.execute(sql(_EMBEDDED_COUNT)).scalar()
        finally:
            pvs.close()
        print(f"corpus: {here:,} embedded chunks here, {there:,} in the benchmark "
              f"database, difference {abs(here - there):,}")
    print()

    provider = OllamaProvider(
        api_key=settings.ollama_api_key,
        base_url=settings.ollama_base_url,
        model=args.model or settings.ollama_model,
    )

    # Reusing questions is what makes two runs comparable. Generating fresh ones
    # would change the queries at the same time as the thing being tested.
    cached: dict[str, str] = {}
    cache_path = pathlib.Path(args.questions) if args.questions else None
    if cache_path and cache_path.exists():
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        print(f"Reusing {len(cached)} cached questions from {cache_path}")

    results = []
    for i, row in enumerate(picked, 1):
        if row["url"] in cached:
            question = cached[row["url"]]
            if _too_vague(question):
                results.append({"url": row["url"], "question": question, "rank": "",
                                "equivalent_rank": "",
                                "error": "question too vague to score", "search_ms": ""})
                continue
            try:
                chunks, ms = await _timed_retrieval(question, backend, mode, args.limit)
            except Exception as exc:
                results.append({"url": row["url"], "question": question, "rank": "",
                                "equivalent_rank": "",
                                "error": f"{type(exc).__name__}: {exc}", "search_ms": ""})
                continue
            rank = next((n for n, c in enumerate(chunks, 1) if c.get("url") == row["url"]), None)
            equivalent = rank or _equivalent_rank(row["chunk_id"], chunks)
            results.append({"url": row["url"], "question": question,
                            "rank": rank or "", "equivalent_rank": equivalent or "",
                            "error": "", "search_ms": round(ms, 1)})
            if i % 25 == 0:
                hits = sum(1 for r in results if r["rank"])
                print(f"  {i}/{len(picked)}  recall so far {hits / i:.1%}")
            continue

        excerpt = (row["chunk_text"] or "")[:EXCERPT_CHARS]
        try:
            generated = await provider.generate(
                prompt=GENERATOR_PROMPT.format(excerpt=excerpt), max_tokens=80)
            question = _clean_question(generated.text)
        except Exception as exc:
            results.append({"url": row["url"], "question": "", "rank": "",
                            "equivalent_rank": "",
                            "error": f"{type(exc).__name__}: {exc}", "search_ms": ""})
            continue
        if not question:
            results.append({"url": row["url"], "question": "", "rank": "",
                            "equivalent_rank": "",
                            "error": "no question generated", "search_ms": ""})
            continue
        if _too_vague(question):
            results.append({"url": row["url"], "question": question, "rank": "",
                            "equivalent_rank": "",
                            "error": "question too vague to score", "search_ms": ""})
            continue

        try:
            chunks, ms = await _timed_retrieval(question, backend, mode, args.limit)
        except Exception as exc:
            results.append({"url": row["url"], "question": question, "rank": "",
                            "equivalent_rank": "",
                            "error": f"{type(exc).__name__}: {exc}", "search_ms": ""})
            continue

        rank = next((n for n, c in enumerate(chunks, 1) if c.get("url") == row["url"]), None)
        equivalent = rank or _equivalent_rank(row["chunk_id"], chunks)
        results.append({"url": row["url"], "question": question,
                        "rank": rank or "", "equivalent_rank": equivalent or "",
                        "error": "", "search_ms": round(ms, 1)})
        if i % 25 == 0:
            hits = sum(1 for r in results if r["rank"])
            print(f"  {i}/{len(picked)}  recall so far {hits / i:.1%}")

    scored = [r for r in results if not r["error"]]
    errors = [r for r in results if r["error"]]
    hits = [r for r in scored if r["rank"]]

    equivalent = [r for r in scored if r.get("equivalent_rank")]
    vague = [r for r in errors if r["error"] == "question too vague to score"]

    print(f"\nRECALL@{args.limit}")
    print(f"  the page itself          {len(hits)}/{len(scored)} = "
          f"{len(hits) / max(len(scored), 1):.1%}")
    print(f"  or an equivalent page    {len(equivalent)}/{len(scored)} = "
          f"{len(equivalent) / max(len(scored), 1):.1%}")
    print(f"  ({len(errors)} errors"
          + (f", of which {len(vague)} were questions too vague to score" if vague else "")
          + ")")
    if len(equivalent) > len(hits):
        print(f"  {len(equivalent) - len(hits)} page(s) were answered by different URLs "
              f"carrying near-identical text.")
        print("  Both numbers are printed because the second can be gamed by a corpus")
        print("  full of duplicates, and the first punishes retrieval for finding one.")
    if hits:
        ranks = [int(r["rank"]) for r in hits]
        at_one = sum(1 for r in ranks if r == 1)
        print(f"  rank 1 for {at_one}/{len(hits)} of the hits, mean rank "
              f"{sum(ranks) / len(ranks):.2f}")

    timings = sorted(r["search_ms"] for r in scored if r["search_ms"] != "")
    if timings:
        print(f"\nSEARCH LATENCY (the store only, embedding excluded)")
        print(f"  median {statistics.median(timings):.0f}ms   "
              f"p95 {timings[min(len(timings) - 1, int(len(timings) * 0.95))]:.0f}ms   "
              f"max {timings[-1]:.0f}ms   n={len(timings)}")
        print("  The three stores sit at different network distances from this host,")
        print("  so this compares deployments and not index implementations.")

    by_section = defaultdict(lambda: [0, 0])
    for r in scored:
        s = by_section[_section(r["url"])]
        s[1] += 1
        if r["rank"]:
            s[0] += 1
    print(f"\nBY SECTION (pages with at least 5 sampled)")
    print(f"{'section':<34}{'recall':>10}{'n':>6}")
    print("-" * 50)
    for section, (hit, total) in sorted(by_section.items(), key=lambda kv: kv[1][0] / kv[1][1]):
        if total >= 5:
            print(f"{section:<34}{hit / total:>9.0%}{total:>6}")

    if cache_path:
        cache_path.write_text(json.dumps(
            {**cached, **{r["url"]: r["question"] for r in results if r["question"]}},
            indent=1), encoding="utf-8")
        print(f"\nQuestions cached to {cache_path}. Re-run with the same --urls and")
        print("--questions after the change to compare like with like.")

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    # The backend is in the filename because three arms of the same comparison
    # differ only by timestamp otherwise, and a mislabelled arm is worse than
    # no result.
    out = Path("evals") / f"retrieval_breadth_{backend}_{stamp}.csv"
    out.parent.mkdir(exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["url", "question", "rank",
                                               "equivalent_rank", "error", "search_ms"])
        writer.writeheader()
        writer.writerows(results)
    print(f"\nSaved to {out}")
    print("\nThis is an upper bound: questions written from a page share its wording,")
    print("so they are easier than a resident's. Compare runs rather than quoting the")
    print("number, and remember it says nothing about pages the corpus lacks.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
