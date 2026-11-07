"""What is still undone after a run, rather than what the run did.

Three separate incidents in one day had the same shape: work failed part way and
the closing summary made it look finished.

  * a re-crawl embedded 3,350 of 9,516 chunks, aborted on a provider error, and
    reported the pages it had crawled. 6,003 chunks sat with no embedding, which
    retrieval filters out, so a section of the corpus was unsearchable and nothing
    said so
  * a deploy pulled, skipped the build, reloaded the old bundle and reported
    success
  * a page retirement failed to delete its vectors and continued

Each was found by someone counting rows hours later. In each case the fix was
small and the finding was slow, because every summary printed its accomplishments
and none printed its remainder.

A count of what was done cannot distinguish a complete run from a partial one.
Only a count of what is left can.
"""
from sqlalchemy import text as sql

from shared.db import get_session

# Chunks whose text is empty are excluded: the embedder skips them by design, so
# counting them would report permanent outstanding work and train the reader to
# ignore this block.
_UNEMBEDDED = sql("""
    SELECT count(*) FROM canadian_ai.document_chunks
    WHERE embedding IS NULL AND chunk_text IS NOT NULL AND chunk_text <> ''
""")

# Raw documents still holding content that nothing has parsed. raw_content is
# cleared once a document is parsed, so anything still holding it is unfinished
# rather than merely old.
_UNPARSED = sql("""
    SELECT count(*) FROM canadian_ai.raw_documents rd
    WHERE rd.raw_content IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd
                      WHERE pd.raw_document_id = rd.id)
""")

# A parsed page that produced no chunks answers nothing. Redirect handoff records
# are parsed documents by design and have no chunks, so they are excluded by
# requiring a raw document behind the row.
_PARSED_WITHOUT_CHUNKS = sql("""
    SELECT count(*) FROM canadian_ai.parsed_documents pd
    WHERE pd.raw_document_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM canadian_ai.document_chunks dc
                      WHERE dc.parsed_document_id = pd.id)
""")


def outstanding_work() -> dict[str, int]:
    """Counts of work left undone. All zeros means the corpus is fully processed."""
    with get_session() as session:
        return {
            "unembedded_chunks": session.execute(_UNEMBEDDED).scalar() or 0,
            "unparsed_documents": session.execute(_UNPARSED).scalar() or 0,
            "parsed_without_chunks": session.execute(_PARSED_WITHOUT_CHUNKS).scalar() or 0,
        }


# Two different kinds of outstanding work, and conflating them made the report
# give advice that could not help. A re-crawl reported 191 parsed pages with no
# chunks and told the operator to re-run the pipeline; parsing had already
# succeeded, so a re-run would change nothing. A block that recommends a no-op is
# one people learn to skip, which is the failure this module exists to prevent.
#
# RESUMABLE: the run stopped early and running it again continues the work.
# STRUCTURAL: the corpus contains pages that answer nothing. Running anything
# again will not change that, and it probably was not caused by this run.
RESUMABLE = ("unembedded_chunks", "unparsed_documents")

_EXPLANATIONS = {
    "unembedded_chunks": ("chunks with no embedding",
                          "not searchable until embedded"),
    "unparsed_documents": ("raw documents not parsed",
                           "fetched, never turned into chunks"),
    "parsed_without_chunks": ("parsed pages with no chunks",
                              "indexed as a page but answer nothing"),
}

# The query rather than a script name. An earlier draft pointed at
# scripts/audit_chunks.py, which reports duplicated headings and says nothing
# about chunkless pages: advice that sends the reader somewhere useless is worse
# than no advice, and this block is meant to be trustworthy.
_INVESTIGATE = (
    "  Not resumable, and may predate this run. To list them:\n"
    "    SELECT pd.url FROM canadian_ai.parsed_documents pd WHERE pd.raw_document_id\n"
    "    IS NOT NULL AND NOT EXISTS (SELECT 1 FROM canadian_ai.document_chunks dc\n"
    "    WHERE dc.parsed_document_id = pd.id) LIMIT 20;"
)


def format_outstanding(counts: dict[str, int] | None = None) -> list[str]:
    """Lines for a run's closing summary. Says so plainly when nothing is left."""
    counts = outstanding_work() if counts is None else counts
    remaining = {k: v for k, v in counts.items() if v}
    if not remaining:
        return ["OUTSTANDING: nothing. Every parsed page has chunks and every "
                "chunk has an embedding."]

    resumable = {k: v for k, v in remaining.items() if k in RESUMABLE}
    # The header claims about the run, so it may only be about the work the run
    # could have finished. Structural gaps are reported without accusing the run
    # of leaving them.
    header = ("OUTSTANDING WORK: this run did not finish everything" if resumable
              else "CORPUS GAPS: not left by this run, and not fixed by re-running")

    width = max(len(_EXPLANATIONS[k][0]) for k in remaining)
    lines = [header]
    for key, value in remaining.items():
        label, why = _EXPLANATIONS[key]
        lines.append(f"  {label:<{width}}  {value:>7,}   ({why})")
    if resumable:
        lines.append("  Re-run to continue: uv run python scripts/pipeline.py --skip-crawl")
    if "parsed_without_chunks" in remaining:
        lines.append(_INVESTIGATE)
    return lines
