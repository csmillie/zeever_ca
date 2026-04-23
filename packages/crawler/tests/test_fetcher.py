import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from crawler.fetcher import Fetcher, FetchResult

@pytest.mark.asyncio
async def test_fetcher_returns_result():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "text/html; charset=utf-8"}
    mock_response.content = b"<html>test</html>"

    # Mock the async context manager
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("httpx.AsyncClient", return_value=mock_client):
        fetcher = Fetcher(rate_limit_ms=0)
        result = await fetcher.fetch("https://www.toronto.ca/test")

    assert result.status_code == 200
    assert result.content_type == "text/html"
    assert b"test" in result.raw_content
    assert len(result.content_hash) == 64  # SHA-256 hex

def test_fetch_result_dataclass():
    result = FetchResult(
        url="https://example.com",
        status_code=200,
        content_type="text/html",
        raw_content=b"test",
        content_hash="abc123",
        headers={},
    )
    assert result.url == "https://example.com"
