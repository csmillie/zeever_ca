"""A row whose content was cleared must be refillable, not treated as a duplicate.

raw_content is deleted after parsing to keep the table small. So a URL that was
parsed and then had its parsed document removed leaves a husk: the row still
matches on url and content_hash, holds no content, and re-fetching returns the
identical bytes.

save_raw_document compared on (url, content_hash) alone and returned None, which
read as "already have this" when the truth was "have a record of this and none of
the content". Four URLs sat in the gap list permanently, re-fetched on every run,
unable to acquire content by any route.
"""
from unittest.mock import MagicMock, patch

from crawler.fetcher import FetchResult
from crawler.storage import save_raw_document

RESULT = FetchResult(
    url="https://www.toronto.ca/a/",
    status_code=200,
    content_type="text/html",
    raw_content=b"<html>page</html>",
    content_hash="abc123",
    headers={},
    requested_url="https://www.toronto.ca/a/",
)


def _session_returning(existing):
    session = MagicMock()
    session.execute.return_value.scalar_one_or_none.return_value = existing
    cm = MagicMock()
    cm.__enter__ = MagicMock(return_value=session)
    cm.__exit__ = MagicMock(return_value=False)
    return cm, session


def test_a_row_that_still_has_content_is_a_duplicate():
    """The original behaviour, which is correct when the content is really there."""
    existing = MagicMock()
    existing.raw_content = b"<html>page</html>"
    cm, session = _session_returning(existing)
    with patch("crawler.storage.get_session", return_value=cm):
        assert save_raw_document("run-1", RESULT) is None
    session.commit.assert_not_called()


def test_a_husk_is_refilled_and_its_id_returned():
    """Returning the id matters as much as writing the content: the caller counts
    it as saved, which is what triggers the parse step."""
    existing = MagicMock()
    existing.raw_content = None
    existing.id = "row-1"
    cm, session = _session_returning(existing)
    with patch("crawler.storage.get_session", return_value=cm):
        assert save_raw_document("run-1", RESULT) == "row-1"
    assert existing.raw_content == b"<html>page</html>"
    session.commit.assert_called_once()


def test_a_husk_refill_does_not_add_a_second_row():
    """Inserting instead of refilling would give the URL two raw_documents rows,
    which is how raw_documents came to hold 882 more rows than distinct URLs."""
    existing = MagicMock()
    existing.raw_content = None
    cm, session = _session_returning(existing)
    with patch("crawler.storage.get_session", return_value=cm):
        save_raw_document("run-1", RESULT)
    session.add.assert_not_called()


def test_an_unseen_url_is_inserted():
    cm, session = _session_returning(None)
    with patch("crawler.storage.get_session", return_value=cm):
        save_raw_document("run-1", RESULT)
    session.add.assert_called_once()
