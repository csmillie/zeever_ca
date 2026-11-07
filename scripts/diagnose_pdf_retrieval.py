"""Why does retrieval miss PDFs at twice the rate it misses HTML pages?

    uv run python scripts/diagnose_pdf_retrieval.py evals/probes_40.csv
    uv run python scripts/diagnose_pdf_retrieval.py evals/probes_40.csv --limit 40 --show 8

Every store we have tested returns the same shape: about 41 percent recall on
wp-content PDFs against 73 to 83 percent on HTML sections, stable across pgvector,
Turbopuffer, diskann and HNSW. A gap that survives four different indexes is not an
index problem, so this looks at the documents instead.

It separates three causes that need entirely different fixes, and which are
indistinguishable from a recall number alone:

  RANKED OUT  the right chunk is genuinely similar to the question, it just lost
              to five others. A retrieval problem: rerank, or raise the limit, or
              loosen the per-page cap.

  NOT SIMILAR the right chunk is in the corpus and is not similar to a question
              written from that same page. An embedding or extraction problem:
              usually the text is damaged, or it is a table that no longer reads
              as language once flattened.

  NO CHUNKS   the page has no embedded chunks at all. An ingestion problem, and
              invisible to any amount of retrieval tuning.

For the second case it prints text-quality signals, because a scanned form and a
clean report fail for different reasons and only one of them is worth fixing with
a better parser.
"""
import argparse
import csv
import json
import re
import statistics
from collections import Counter

from sqlalchemy import text as sql

from indexer.embedder import embed_texts
from query_engine.retriever import SIMILARITY_THRESHOLD
from shared.db import get_session

PDF_PATTERN = re.compile(r"(wp-content|\.pdf$)", re.I)

_CHUNKS_FOR_URL = sql("""
    SELECT dc.id, dc.chunk_text,
           1 - (dc.embedding <=> cast(:embedding AS vector)) AS similarity
    FROM canadian_ai.document_chunks dc
    JOIN canadian_ai.parsed_documents pd ON dc.parsed_document_id = pd.id
    WHERE pd.url = :url AND dc.embedding IS NOT NULL
    ORDER BY similarity DESC
""")

# How many chunks on OTHER pages are near-copies of this one. A question written
# from a page that exists in five hundred near-identical copies has five hundred
# right answers, and the eval credits exactly one of them, so a low recall number
# on such pages measures the ground truth rather than the retrieval.
#
# Excluded by URL rather than by chunk id, because the eval credits a hit when any
# retrieved chunk carries the target URL (eval_retrieval_breadth.py compares
# c["url"] to the row's). A second copy of a paragraph on the same page is
# therefore already a credited answer, not a missed one, and counting it would
# inflate this figure in favour of the conclusion the figure exists to test. These
# pages do repeat themselves: one target chunk in the first run was a location-map
# caption printed three times.
#
# By URL and not by parsed_document_id for the same reason: a re-crawl can produce
# a second parsed_documents row for one URL, and the eval would credit either.
_NEAR_COPIES = sql("""
    SELECT count(*)
    FROM canadian_ai.document_chunks dc
    JOIN canadian_ai.parsed_documents pd ON dc.parsed_document_id = pd.id
    WHERE dc.embedding IS NOT NULL
      AND pd.url <> :url
      AND 1 - (dc.embedding <=> (SELECT embedding FROM canadian_ai.document_chunks
                                 WHERE id = :chunk_id)) >= :threshold
""")

_RANK_OF_BEST = sql("""
    SELECT count(*) FROM canadian_ai.document_chunks dc
    WHERE dc.embedding IS NOT NULL
      AND 1 - (dc.embedding <=> cast(:embedding AS vector)) > :similarity
""")


def text_signals(chunk: str) -> dict:
    """Cheap signals for whether extracted text still reads as language.

    None of these is conclusive alone. Together they separate prose from a
    flattened table, and both from text that lost its spaces in extraction, which
    is the failure that embeds worst because every token is wrong.
    """
    body = chunk or ""
    letters = sum(c.isalpha() for c in body)
    digits = sum(c.isdigit() for c in body)
    words = body.split()
    long_words = sum(1 for w in words if len(w) > 30)
    return {
        "chars": len(body),
        "alpha": letters / max(len(body), 1),
        "digit": digits / max(len(body), 1),
        "mean_word": statistics.mean([len(w) for w in words]) if words else 0.0,
        # A run of very long "words" means the spaces did not survive extraction.
        "glued": long_words / max(len(words), 1),
    }


def classify(best_similarity: float | None, n_chunks: int) -> str:
    if not n_chunks:
        return "NO CHUNKS"
    if best_similarity is None or best_similarity < SIMILARITY_THRESHOLD:
        return "NOT SIMILAR"
    return "RANKED OUT"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv_path", help="a breadth-eval CSV, which carries url, question and rank")
    ap.add_argument("--limit", type=int, default=30, help="how many missed PDFs to diagnose")
    ap.add_argument("--show", type=int, default=6, help="how many to print in full")
    ap.add_argument("--copy-threshold", type=float, default=0.95,
                    help="cosine similarity at which two chunks count as near-copies")
    args = ap.parse_args()

    with open(args.csv_path, newline="", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if not r.get("error")]

    pdfs = [r for r in rows if PDF_PATTERN.search(r["url"])]
    html = [r for r in rows if not PDF_PATTERN.search(r["url"])]
    if not pdfs:
        print(f"No PDF pages in {args.csv_path}.")
        return 2

    def recall(rs):
        hits = sum(1 for r in rs if r["rank"])
        return hits, len(rs), hits / max(len(rs), 1)

    ph, pt, pr = recall(pdfs)
    hh, ht, hr = recall(html)
    print(f"{args.csv_path}")
    print(f"  PDFs  {ph:>3}/{pt:<4} = {pr:.1%}")
    print(f"  HTML  {hh:>3}/{ht:<4} = {hr:.1%}")
    print(f"  gap   {hr - pr:+.1%}\n")

    missed = [r for r in pdfs if not r["rank"] and r.get("question")][:args.limit]
    print(f"Diagnosing {len(missed)} missed PDFs "
          f"(of {sum(1 for r in pdfs if not r['rank'])} missed in total)\n")

    verdicts = Counter()
    signals_by_verdict: dict[str, list[dict]] = {}
    copies_seen: list[int] = []
    printed = 0

    with get_session() as session:
        for row in missed:
            url, question = row["url"], row["question"]
            embedding = str(embed_texts([question])[0])

            chunks = session.execute(
                _CHUNKS_FOR_URL, {"embedding": embedding, "url": url}).all()
            best = chunks[0] if chunks else None
            best_sim = float(best.similarity) if best else None
            verdict = classify(best_sim, len(chunks))
            verdicts[verdict] += 1

            copies = None
            if best is not None:
                sig = text_signals(best.chunk_text)
                signals_by_verdict.setdefault(verdict, []).append(sig)
                copies = session.execute(_NEAR_COPIES, {
                    "chunk_id": best.id, "url": url,
                    "threshold": args.copy_threshold}).scalar()
                copies_seen.append(copies)

            if printed < args.show:
                printed += 1
                print(f"[{verdict}] {url}")
                print(f"    Q: {question[:100]}")
                if not chunks:
                    print("    the page has no embedded chunks\n")
                    continue
                rank = session.execute(
                    _RANK_OF_BEST, {"embedding": embedding, "similarity": best_sim}).scalar()
                sig = text_signals(best.chunk_text)
                print(f"    best chunk of {len(chunks)}: similarity {best_sim:.3f}, "
                      f"ranked {rank + 1} corpus-wide, "
                      f"{copies} near-copies on other pages")
                print(f"    text: {sig['chars']} chars, {sig['alpha']:.0%} letters, "
                      f"{sig['digit']:.0%} digits, mean word {sig['mean_word']:.1f}, "
                      f"glued {sig['glued']:.1%}")
                print(f"    {' '.join((best.chunk_text or '').split())[:220]}\n")

    print("VERDICTS")
    for verdict, count in verdicts.most_common():
        print(f"  {verdict:<12} {count:>3}  ({count / max(len(missed), 1):.0%})")

    print("\nTEXT SIGNALS, mean per verdict")
    print(f"  {'verdict':<12}{'chars':>8}{'letters':>9}{'digits':>8}"
          f"{'word len':>10}{'glued':>8}")
    for verdict, sigs in signals_by_verdict.items():
        m = lambda k: statistics.mean(s[k] for s in sigs)  # noqa: E731
        print(f"  {verdict:<12}{m('chars'):>8.0f}{m('alpha'):>8.0%}{m('digit'):>8.0%}"
              f"{m('mean_word'):>10.1f}{m('glued'):>8.1%}")

    if copies_seen:
        many = sum(1 for c in copies_seen if c >= 10)
        print(f"\nNEAR-COPIES (chunks >= {args.copy_threshold} similar, on pages other "
              f"than the target)")
        print(f"  median {statistics.median(copies_seen):.0f}, max {max(copies_seen)}, "
              f"{many} of {len(copies_seen)} pages have 10 or more")
        if many > len(copies_seen) / 2:
            print("  Most of these pages are near-duplicates of other pages. A question")
            print("  written from one of them has many correct answers and the eval")
            print("  credits exactly one, so their recall measures the ground truth as")
            print("  much as the retrieval. Two separate problems live here: the eval")
            print("  should credit an equivalent page, and the corpus should probably")
            print("  not carry hundreds of copies of one form.")

    print("\nWhat each verdict implies:")
    print("  RANKED OUT   retrieval, not ingestion. Try a reranker, a larger fetch,")
    print("               or a looser per-page cap before touching the parser.")
    print("  NOT SIMILAR  the chunk is there and does not match a question written")
    print("               from its own page. Read the text signals above: damaged")
    print("               extraction and a flattened table both land here and need")
    print("               different fixes.")
    print("  NO CHUNKS    ingestion. The page never made it into the index, and no")
    print("               retrieval change will ever find it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
