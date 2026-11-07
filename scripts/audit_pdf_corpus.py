"""What is actually in the PDF half of the corpus, and does any of it retrieve?

    uv run python scripts/audit_pdf_corpus.py
    uv run python scripts/audit_pdf_corpus.py --breadth evals/retrieval_breadth_20260830_025645.csv
    uv run python scripts/audit_pdf_corpus.py --class legdocs --show 25
    uv run python scripts/audit_pdf_corpus.py --urls-out resident.txt --only resident

The corpus is 10,800 parsed PDFs against 7,700 HTML pages, and the corpus-wide
breadth eval put PDF recall at 38% against 65-86% for every HTML section. Two very
different problems are inside that number.

Some PDFs are genuinely useful and retrieve badly. The Building Permit Guide and
the General Utility Brochure answer real questions, and their titles are derived
from filenames — "8Ccb Monthlyutilitybillingapplication" — which is close to
useless for an embedding and worse for a citation shown to a reader.

Others should arguably never have been indexed for a service assistant: council
background files, engineering specifications, municipal code chapters, display
panels from a 2022 construction meeting. For those, "the question a resident would
ask" is a fiction, and the eval failing to retrieve them is correct behaviour
being scored as failure.

The fixes differ, so the groups have to be separated before either is worth
doing. This classifies every PDF by URL pattern, sizes each class in pages and
chunks, and joins the breadth-eval results so each class carries its own measured
recall rather than a share of one blended average.

The decision it exists to inform: the gap analysis lists 13,695 uncrawled PDFs as
outstanding work. Fetching them would roughly double the worst-performing content
class. That should be a decision made from numbers.
"""
import argparse
import csv
import re
from collections import defaultdict

from sqlalchemy import text as sql

from crawler.pdf_classes import (
    PDF_CLASSES, REFERENCE, RESIDENT, TRANSLATED, UNKNOWN, classify,
)
from shared.db import get_session

# Ordered: the first pattern that matches wins, so put the specific ones first.

_CORPUS = """
    SELECT pd.url, count(dc.id) AS chunks
    FROM canadian_ai.parsed_documents pd
    LEFT JOIN canadian_ai.document_chunks dc ON dc.parsed_document_id = pd.id
    WHERE pd.url ILIKE '%.pdf'
    GROUP BY pd.url
"""

def _load_breadth(path: str) -> dict[str, bool]:
    """url -> whether retrieval found it, from an eval_retrieval_breadth run."""
    out = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("error"):
                continue
            out[row["url"]] = bool(row.get("rank"))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--breadth", help="CSV from eval_retrieval_breadth.py, to join recall per class")
    ap.add_argument("--class", dest="klass", help="list example URLs from one class")
    ap.add_argument("--show", type=int, default=15, help="how many examples to list")
    ap.add_argument("--urls-out", help="write the matching URLs to this file, one per line")
    ap.add_argument("--only", choices=["resident", "reference", "unknown", "translated"],
                    help="with --urls-out, restrict to one audience group rather than one class")
    args = ap.parse_args()

    with get_session() as session:
        rows = [dict(r._mapping) for r in session.execute(sql(_CORPUS))]
    if not rows:
        print("No PDFs in parsed_documents.")
        return 2

    grouped = defaultdict(lambda: {"pages": 0, "chunks": 0, "urls": []})
    for r in rows:
        g = grouped[classify(r["url"])]
        g["pages"] += 1
        g["chunks"] += r["chunks"] or 0
        g["urls"].append(r["url"])

    if args.urls_out:
        groups = {"resident": RESIDENT, "reference": REFERENCE,
                  "unknown": UNKNOWN, "translated": TRANSLATED}
        if args.only:
            names = groups[args.only] & grouped.keys()
        elif args.klass:
            names = {args.klass} & grouped.keys()
        else:
            print("--urls-out needs --only or --class to say which URLs to write.")
            return 2
        urls = sorted(u for n in names for u in grouped[n]["urls"])
        with open(args.urls_out, "w", encoding="utf-8") as f:
            f.write("\n".join(urls) + "\n")
        print(f"Wrote {len(urls):,} URLs from {', '.join(sorted(names))} to {args.urls_out}")
        print("\nPin the before-and-after measurement to this exact set:")
        print(f"  uv run python scripts/eval_retrieval_breadth.py \\")
        print(f"    --urls {args.urls_out} --questions questions.json")
        return 0

    if args.klass:
        g = grouped.get(args.klass)
        if not g:
            print(f"No class {args.klass!r}. Try: {', '.join(sorted(grouped))}")
            return 2
        print(f"{args.klass}: {g['pages']:,} pages, {g['chunks']:,} chunks\n")
        for u in sorted(g["urls"])[:args.show]:
            print(f"  {u}")
        if g["pages"] > args.show:
            print(f"  ... and {g['pages'] - args.show:,} more")
        return 0

    breadth = _load_breadth(args.breadth) if args.breadth else {}
    total_pages = sum(g["pages"] for g in grouped.values())
    total_chunks = sum(g["chunks"] for g in grouped.values())
    print(f"{total_pages:,} PDFs, {total_chunks:,} chunks\n")

    head = f"{'class':<18}{'pages':>8}{'chunks':>9}{'share':>8}"
    if breadth:
        head += f"{'recall':>9}{'sampled':>9}"
    print(head)
    print("-" * len(head))

    for name, g in sorted(grouped.items(), key=lambda kv: -kv[1]["chunks"]):
        share = g["chunks"] / max(total_chunks, 1) * 100
        line = f"{name:<18}{g['pages']:>8,}{g['chunks']:>9,}{share:>7.1f}%"
        if breadth:
            sampled = [breadth[u] for u in g["urls"] if u in breadth]
            if sampled:
                line += f"{sum(sampled) / len(sampled):>8.0%}{len(sampled):>9}"
            else:
                line += f"{'-':>9}{0:>9}"
        print(line)

    print("\nWHAT EACH CLASS IS")
    described = {name: desc for name, _, desc in PDF_CLASSES}
    for name, g in sorted(grouped.items(), key=lambda kv: -kv[1]["chunks"]):
        print(f"  {name:<18} {described.get(name, 'Did not match any pattern')}")

    if not breadth:
        print("\nPass --breadth with a CSV from eval_retrieval_breadth.py to attach measured")
        print("recall to each class. Without it this is composition only, and composition")
        print("alone does not say which classes are worth keeping.")
        return 0

    # The question the whole script exists for: is the 38% spread evenly, or is it
    # one or two classes that no resident would ever ask about?
    # The unknown bucket must not be counted as resident facing. Doing so in the
    # first version made resident content look bad when it was 239 unclassified
    # samples swamping 16 identified ones.
    resident = {"form-application", "fact-sheet", "map-plan", "bia-profile"}
    reference = {"ecs-specs", "legdocs-mmis", "legdocs-municode", "legdocs-other",
                 "study-ea", "budget-financial", "consultation", "job-posting",
                 "council-meeting", "accessible-copy", "project-doc"}
    unknown = {"uploads-other", "unclassified"}

    def _agg(names):
        got = [breadth[u] for n in names for u in grouped[n]["urls"] if u in breadth]
        return (sum(got) / len(got), len(got)) if got else (0.0, 0)

    print("\nSPLIT BY WHAT THE DOCUMENT IS")
    for label, names in (("resident facing", resident),
                         ("reference/archive", reference),
                         ("translated copies", TRANSLATED),
                         ("still unidentified", unknown)):
        recall, n = _agg(names & grouped.keys())
        chunks = sum(grouped[x]["chunks"] for x in names & grouped.keys())
        share = chunks / max(total_chunks, 1) * 100
        note = "  <- small sample, read as indicative" if 0 < n < 20 else ""
        print(f"  {label:<19}{recall:>5.0%}  ({n} sampled, {share:.0f}% of chunks){note}")

    print("\n  Any class with fewer than about twenty samples is indicative at best.")
    print("  Draw conclusions from the unidentified bucket, which is the one large")
    print("  enough to support them and the one that decides the blended number.")

    # Guessed patterns only named 30 percent of the chunks. Rather than guess again,
    # count what the filenames in the unknown bucket actually say.
    unknown_urls = [u for n in unknown & grouped.keys() for u in grouped[n]["urls"]]
    if unknown_urls:
        tokens: dict[str, int] = defaultdict(int)
        for u in unknown_urls:
            stem = u.rsplit("/", 1)[-1].removesuffix(".pdf").lower()
            # Strip the four-hex-character prefix Toronto puts on every upload.
            stem = re.sub(r"^[0-9a-f]{4}-", "", stem)
            for tok in re.split(r"[-_0-9.]+", stem):
                if len(tok) >= 4 and not tok.isdigit():
                    tokens[tok] += 1
        print(f"\nCOMMONEST WORDS IN THE {len(unknown_urls):,} UNIDENTIFIED FILENAMES")
        print("  (what to write the next patterns from, instead of guessing)")
        top = sorted(tokens.items(), key=lambda kv: -kv[1])[:args.show * 2]
        for i in range(0, len(top), 4):
            print("   " + "".join(f"{w} {c:<6}".ljust(22) for w, c in top[i:i + 4]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
