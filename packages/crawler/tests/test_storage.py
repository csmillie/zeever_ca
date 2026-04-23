from unittest.mock import patch, MagicMock
from crawler.storage import create_crawl_run, save_raw_document
from crawler.fetcher import FetchResult

def test_create_crawl_run():
    mock_session = MagicMock()
    mock_run = MagicMock()
    mock_run.id = "test-uuid"

    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_session)
    mock_cm.__exit__ = MagicMock(return_value=False)

    with patch("crawler.storage.get_session", return_value=mock_cm):
        with patch("crawler.storage.CrawlRun", return_value=mock_run):
            run_id = create_crawl_run(config={"test": True})

    assert run_id == "test-uuid"
    mock_session.add.assert_called_once()
    mock_session.commit.assert_called_once()

def test_save_raw_document_new():
    mock_session = MagicMock()
    mock_session.execute.return_value.scalar_one_or_none.return_value = None
    mock_doc = MagicMock()
    mock_doc.id = "doc-uuid"

    result = FetchResult(
        url="https://www.toronto.ca/test",
        status_code=200,
        content_type="text/html",
        raw_content=b"content",
        content_hash="abc123",
        headers={},
    )

    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_session)
    mock_cm.__exit__ = MagicMock(return_value=False)

    with patch("crawler.storage.get_session", return_value=mock_cm):
        with patch("crawler.storage.select", return_value=MagicMock()):
            with patch("crawler.storage.RawDocument", return_value=mock_doc):
                doc_id = save_raw_document("run-id", result)

    assert doc_id == "doc-uuid"
    mock_session.add.assert_called_once()

def test_save_raw_document_duplicate():
    mock_session = MagicMock()
    mock_session.execute.return_value.scalar_one_or_none.return_value = MagicMock()  # existing doc

    result = FetchResult(
        url="https://www.toronto.ca/test",
        status_code=200,
        content_type="text/html",
        raw_content=b"content",
        content_hash="abc123",
        headers={},
    )

    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_session)
    mock_cm.__exit__ = MagicMock(return_value=False)

    with patch("crawler.storage.get_session", return_value=mock_cm):
        with patch("crawler.storage.select", return_value=MagicMock()):
            doc_id = save_raw_document("run-id", result)

    assert doc_id is None
    mock_session.add.assert_not_called()
