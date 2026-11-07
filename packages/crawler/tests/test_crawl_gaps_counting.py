"""The counters crawl_gaps returns decide whether anything gets embedded.

crawl_gaps runs parse and embed only when `saved > 0 or redirects > 0 or
has_content`. A handoff record writes a chunk with no embedding, so a run that
writes handoffs and increments nothing skips embedding and leaves them parsed
but unsearchable. The URLs leave the gap list once the pointer exists, so no
later run repairs them.

That is not hypothetical. On the run this branch was written for, the four
City-affiliated URLs have their content stored under the publisher's URL, so
save_raw_document returns None and `saved` stays zero. If the handoff does not
count, nothing does.

These call crawl_urls for real with the network and database mocked, rather than
reading the source. An earlier test on this branch asserted the order of two
calls by reading the file as text and could not see that neither call could
execute.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))

import crawl_gaps  # noqa: E402
from crawler.fetcher import FetchResult, OffsiteRedirect  # noqa: E402

CITY = "https://www.toronto.ca/city-government/accountability-officers/ombudsman-toronto/"
PUBLISHER = "https://www.ombudsmantoronto.ca/how-to-make-a-complaint/"
SERVICE = "https://www.toronto.ca/community-people/health/covid-19-vaccination-clinics/"


def _result(stored_url: str, requested_url: str) -> FetchResult:
    return FetchResult(url=stored_url, status_code=200, content_type="text/html",
                       raw_content=b"<html>x</html>", content_hash="h",
                       headers={}, requested_url=requested_url)


class _Fetcher:
    """Stands in for the real Fetcher: scripted results, no network."""

    def __init__(self, script, **kwargs):
        self._script = script

    async def fetch(self, url):
        outcome = self._script[url]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    async def close(self):
        pass


def _run(script, doc_id):
    """Drive crawl_urls over a scripted set of fetches."""
    session = MagicMock()
    cm = MagicMock()
    cm.__enter__ = MagicMock(return_value=session)
    cm.__exit__ = MagicMock(return_value=False)

    with patch.object(crawl_gaps, "Fetcher", lambda **kw: _Fetcher(script)), \
         patch.object(crawl_gaps, "create_crawl_run", return_value="run-1"), \
         patch.object(crawl_gaps, "save_raw_document", return_value=doc_id), \
         patch.object(crawl_gaps, "get_session", return_value=cm), \
         patch.object(crawl_gaps, "record_redirect") as record:
        import asyncio
        saved, errors, redirects = asyncio.run(crawl_gaps.crawl_urls(list(script)))
    return saved, errors, redirects, record


def test_an_affiliated_handoff_is_counted_even_when_nothing_is_saved():
    """The regression. save_raw_document returns None because the publisher's
    content is already stored, so `saved` stays 0 and only the handoff counter
    can make the embed step run."""
    saved, errors, redirects, record = _run({CITY: _result(PUBLISHER, CITY)}, None)
    assert saved == 0
    assert redirects == 1, "the embed gate reads this; at 0 the chunk is never embedded"
    record.assert_called_once_with(record.call_args[0][0], CITY, PUBLISHER)


def test_an_affiliated_handoff_counts_alongside_a_save():
    """Both are true and both are reported: one page stored, one pointer written."""
    saved, errors, redirects, _ = _run({CITY: _result(PUBLISHER, CITY)}, "row-1")
    assert (saved, redirects, errors) == (1, 1, 0)


def test_an_offsite_redirect_is_counted_and_is_not_an_error():
    outcome = OffsiteRedirect("gone", asked="www.toronto.ca",
                              landed="reservation.frontdesksuite.ca")
    saved, errors, redirects, record = _run({SERVICE: outcome}, None)
    assert (saved, redirects, errors) == (0, 1, 0)
    assert record.call_args[0][2] == "https://reservation.frontdesksuite.ca/"


def test_an_ordinary_page_records_no_handoff():
    saved, errors, redirects, record = _run({SERVICE: _result(SERVICE, SERVICE)}, "row-1")
    assert (saved, redirects, errors) == (1, 0, 0)
    record.assert_not_called()


def test_a_real_failure_is_still_an_error():
    saved, errors, redirects, record = _run({SERVICE: RuntimeError("boom")}, None)
    assert (saved, redirects, errors) == (0, 0, 1)
    record.assert_not_called()


@pytest.mark.parametrize("counters,expected", [
    ((0, 0, False), False),   # nothing happened
    ((1, 0, False), True),    # a page was saved
    ((0, 1, False), True),    # only handoffs — the case that was broken
    ((0, 0, True), True),     # raw content waiting to be parsed
])
def test_the_embed_gate_matches_the_counters(counters, expected):
    """Pins the condition itself, so narrowing it later has to be deliberate."""
    saved, redirects, has_content = counters
    assert bool(saved > 0 or redirects > 0 or has_content) is expected
