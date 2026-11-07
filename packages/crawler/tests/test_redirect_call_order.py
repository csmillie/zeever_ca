"""A handoff record must be written after the cleanup that would retire it.

recrawl retires every parsed document for a URL when new content arrives, so
that a superseded parse cannot keep competing for retrieval slots. A handoff
record is a parsed document for that same URL. Writing it before the cleanup
meant it was selected as stale and retired in the same pass, taking its
Turbopuffer vector with it, so the fix undid itself on any recrawl where the
page had new content.

Ordering cannot be pinned by calling the function: recrawl_urls fetches over the
network and drives a live session. So this reads the source and asserts the
sequence, which is narrow but catches the exact regression.

Reading source is weak coverage and its limits are known. This file once sat
green over a recrawl_urls that could not run at all, because three of its
imports were in the wrong function and text matching cannot see a missing name.
That blind spot is covered by packages/shared/tests/test_no_undefined_names.py,
and crawl_gaps is exercised for real in test_crawl_gaps_counting.py. This is
kept only for the one thing neither of those can reach.
"""
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[3] / "scripts"


def _source(name: str) -> str:
    path = SCRIPTS / name
    if not path.exists():
        pytest.skip(f"{name} not present")
    return path.read_text()


def test_recrawl_records_the_handoff_after_retiring():
    source = _source("recrawl.py")
    retire = source.index("retire_parsed_documents(session, stale)")
    record = source.index("record_redirect(session, result.requested_url")
    assert retire < record, (
        "record_redirect must come after retire_parsed_documents. The cleanup "
        "retires every parsed document for the requested URL, and the handoff "
        "record is one of them, so writing it first deletes it again."
    )


def test_the_cleanup_still_selects_by_url_alone():
    """If the cleanup is ever narrowed to exclude redirect records, the ordering
    above stops being load-bearing and this test should be revisited rather than
    left asserting something that no longer matters."""
    source = _source("recrawl.py")
    assert "SELECT id FROM canadian_ai.parsed_documents WHERE url = :url" in source


@pytest.mark.parametrize("name", ["crawl_gaps.py"])
def test_other_paths_have_no_retire_after_record_hazard(name):
    """crawl_gaps and crawl.py write the handoff and never retire afterwards.
    Asserted so a later edit that adds a cleanup has to think about this."""
    source = _source(name)
    if "retire_parsed_documents" not in source:
        return
    record = source.index("record_redirect(")
    retire = source.index("retire_parsed_documents(")
    assert retire < record, f"{name} now retires after recording a handoff"
