"""What counts as a page worth deleting.

The corpus holds pages under URLs Toronto.ca no longer serves: checking ten
unlisted pages returned 301 for all ten, one of them ending `forms__trashed`. A
citation to such a URL sends a resident somewhere that bounces them, to read text
captured before the City moved it.

Deleting is not reversible from a script, so the classification carries the
weight here. Two mistakes would be costly in opposite directions: removing a live
page loses real content, and keeping a redirect leaves a citation that lies.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))

import prune_redirected_pages as prune  # noqa: E402

URL = "https://www.toronto.ca/city-government/some-page/"


def _client(status: int, final: str):
    client = MagicMock()
    client.get = AsyncMock(return_value=MagicMock(status_code=status, url=final))
    return client


@pytest.mark.asyncio
async def test_a_page_that_answers_at_its_own_url_is_kept():
    verdict, _ = await prune.classify(_client(200, URL), URL)
    assert verdict == prune.LIVE


@pytest.mark.asyncio
async def test_a_trailing_slash_is_not_a_redirect():
    """Toronto answers both forms. Treating the slash as a move would delete the
    entire corpus on the first run."""
    verdict, _ = await prune.classify(_client(200, URL.rstrip("/")), URL)
    assert verdict == prune.LIVE


@pytest.mark.asyncio
async def test_a_move_is_reported_with_its_destination():
    """The destination decides whether anything is actually lost, so it has to
    come back with the verdict rather than being looked up later."""
    moved = "https://www.toronto.ca/city-government/the-new-page/"
    verdict, detail = await prune.classify(_client(200, moved), URL)
    assert verdict == prune.REDIRECTED
    assert detail == moved


@pytest.mark.asyncio
async def test_404_and_410_are_gone():
    for status in (404, 410):
        verdict, _ = await prune.classify(_client(status, URL), URL)
        assert verdict == prune.GONE


@pytest.mark.asyncio
async def test_a_403_is_not_treated_as_dead():
    """Several City applications sit behind a login and answer 403. They are real
    pages, and deleting them because a crawler cannot see them would be the
    crawler's opinion standing in for the City's."""
    verdict, detail = await prune.classify(_client(403, URL), URL)
    assert verdict == prune.UNCHECKED
    assert detail == "403"


@pytest.mark.asyncio
async def test_an_unreachable_host_is_never_deleted():
    """A network failure is about us, not about the page."""
    client = MagicMock()
    client.get = AsyncMock(side_effect=TimeoutError("timed out"))
    verdict, detail = await prune.classify(client, URL)
    assert verdict == prune.UNCHECKED
    assert detail == "TimeoutError"


# --- what happens to the content when the stale copy is deleted ---------------

LISTED = {"https://www.toronto.ca/city-government/the-new-page"}


def test_a_destination_already_held_loses_nothing():
    assert prune.destination_fate(
        "https://www.toronto.ca/city-government/the-new-page/",
        LISTED, is_held=True) == prune.HELD


def test_a_destination_in_the_sitemap_will_be_collected():
    """Not held yet, but the next crawl reaches it, so the removal is recoverable."""
    assert prune.destination_fate(
        "https://www.toronto.ca/city-government/the-new-page/",
        LISTED, is_held=False) == prune.LISTED_ONLY


def test_a_destination_listed_nowhere_is_orphaned():
    """This is the case the review caught. The script used to tell the operator
    that unheld destinations were in the sitemap without checking, so deleting
    the stored copy would have lost content nothing could restore."""
    assert prune.destination_fate(
        "https://www.toronto.ca/city-government/some-other-page/",
        LISTED, is_held=False) == prune.ORPHANED


def test_an_offsite_destination_is_orphaned_even_if_it_looks_listed():
    """No crawl of ours fetches another domain, whatever the sitemap says."""
    assert prune.destination_fate(
        "https://secure.toronto.ca/pa/decisionBody/30.do",
        LISTED, is_held=False) == prune.ORPHANED
    assert prune.destination_fate(
        "https://www.bgre.com/", LISTED, is_held=False) == prune.ORPHANED


def test_the_trailing_slash_does_not_decide_recoverability():
    """The sitemap is inconsistent about trailing slashes and Toronto serves both.
    Matching on the raw string would call listed pages orphaned and quietly widen
    what the operator is asked to delete."""
    assert prune.destination_fate(
        "https://www.toronto.ca/city-government/the-new-page",
        LISTED, is_held=False) == prune.LISTED_ONLY
