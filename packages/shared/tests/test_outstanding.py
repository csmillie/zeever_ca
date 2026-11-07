"""A run's summary has to be able to say it did not finish.

Three incidents in one day shared a shape: work failed part way and the closing
summary reported accomplishments, so the run looked complete. A re-crawl embedded
3,350 of 9,516 chunks and printed the pages it had crawled; 6,003 chunks stayed
unsearchable for hours because nothing counted what was left.

These tests are about the reporting, which is the part that failed. The counting
queries need a database and are exercised by running the pipeline.
"""
from shared.outstanding import format_outstanding


def test_a_clean_run_says_so_plainly():
    """Silence would be ambiguous: the reader cannot tell "nothing left" from
    "nobody checked"."""
    lines = format_outstanding({"unembedded_chunks": 0, "unparsed_documents": 0,
                                "parsed_without_chunks": 0})
    assert len(lines) == 1
    assert "nothing" in lines[0].lower()


def test_the_header_says_the_run_did_not_finish():
    """The words matter more than the number. "6,003" beside a list of successes
    reads as a statistic; "did not finish everything" reads as a problem."""
    lines = format_outstanding({"unembedded_chunks": 6003, "unparsed_documents": 0,
                                "parsed_without_chunks": 0})
    assert "did not finish" in lines[0]


def test_a_structural_gap_does_not_accuse_the_run():
    """Chunkless pages are corpus-wide and usually predate the run. Reporting
    them under "this run did not finish everything" is a false accusation, and a
    reader who checks once and finds it untrue stops reading the block."""
    lines = format_outstanding({"unembedded_chunks": 0, "unparsed_documents": 0,
                                "parsed_without_chunks": 191})
    assert "did not finish" not in lines[0]
    assert "not fixed by re-running" in lines[0]


def test_the_re_run_command_appears_only_when_re_running_helps():
    """The first live run of this block reported 191 chunkless pages and told the
    operator to re-run the pipeline. Parsing had already succeeded, so a re-run
    would have changed nothing. Advice that cannot work is how a report earns
    being skipped."""
    structural = "\n".join(format_outstanding({"unembedded_chunks": 0,
                                               "unparsed_documents": 0,
                                               "parsed_without_chunks": 191}))
    assert "pipeline.py --skip-crawl" not in structural

    resumable = "\n".join(format_outstanding({"unembedded_chunks": 5,
                                              "unparsed_documents": 0,
                                              "parsed_without_chunks": 191}))
    assert "pipeline.py --skip-crawl" in resumable


def test_the_investigation_is_a_query_not_a_script_name():
    """An earlier draft pointed at scripts/audit_chunks.py, which reports
    duplicated headings and nothing about chunkless pages. Sending the reader
    somewhere useless is worse than sending them nowhere."""
    lines = "\n".join(format_outstanding({"unembedded_chunks": 0,
                                          "unparsed_documents": 0,
                                          "parsed_without_chunks": 191}))
    assert "audit_chunks" not in lines
    assert "SELECT pd.url FROM canadian_ai.parsed_documents" in lines


def test_each_count_says_why_it_matters():
    """A reader who does not know that retrieval filters on embedding IS NOT NULL
    cannot tell whether 6,003 unembedded chunks is serious."""
    lines = "\n".join(format_outstanding({"unembedded_chunks": 6003,
                                          "unparsed_documents": 70,
                                          "parsed_without_chunks": 2}))
    assert "not searchable" in lines
    assert "never turned into chunks" in lines
    assert "answer nothing" in lines


def test_zero_counts_are_not_listed():
    """Only the outstanding work appears, so the block stays short enough to read
    at the end of a thousand lines of embedding progress."""
    lines = format_outstanding({"unembedded_chunks": 5, "unparsed_documents": 0,
                                "parsed_without_chunks": 0})
    body = "\n".join(lines)
    assert "chunks with no embedding" in body
    assert "raw documents not parsed" not in body


def test_it_says_how_to_continue():
    """Whoever reads this needs the next command, not a diagnosis to look up."""
    lines = "\n".join(format_outstanding({"unembedded_chunks": 1,
                                          "unparsed_documents": 0,
                                          "parsed_without_chunks": 0}))
    assert "scripts/pipeline.py --skip-crawl" in lines


def test_numbers_are_readable_at_scale():
    """These counts reach five figures. 6003 and 60030 differ by a glance."""
    lines = "\n".join(format_outstanding({"unembedded_chunks": 60030,
                                          "unparsed_documents": 0,
                                          "parsed_without_chunks": 0}))
    assert "60,030" in lines


def test_the_pipeline_exits_non_zero_when_chunks_are_left_unembedded(monkeypatch):
    """The webhook logs a failed pipeline, so the exit code is what turns "it
    stopped early" into something visible outside the log. A run that leaves
    chunks unsearchable must not report success.

    Unparsed documents alone do not fail the run: a page that cannot be parsed
    fails every time, and a permanently non-zero exit is one nobody reads.
    """
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
    import pipeline

    monkeypatch.setattr(sys, "argv", ["pipeline.py", "--skip-crawl"])

    monkeypatch.setattr(pipeline.asyncio, "run",
                        lambda *a, **k: {"unembedded_chunks": 6003,
                                         "unparsed_documents": 0,
                                         "parsed_without_chunks": 0})
    assert pipeline.main() == 1

    monkeypatch.setattr(pipeline.asyncio, "run",
                        lambda *a, **k: {"unembedded_chunks": 0,
                                         "unparsed_documents": 70,
                                         "parsed_without_chunks": 0})
    assert pipeline.main() == 0
