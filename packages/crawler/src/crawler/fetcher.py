import asyncio
import hashlib
from dataclasses import dataclass
import httpx

MAX_RESPONSE_SIZE = 50 * 1024 * 1024  # 50MB

@dataclass
class FetchResult:
    url: str
    status_code: int
    content_type: str
    raw_content: bytes
    content_hash: str
    headers: dict

class Fetcher:
    def __init__(self, rate_limit_ms: int = 1000, user_agent: str = "CanadianAI/0.1"):
        self.rate_limit_s = rate_limit_ms / 1000
        self.user_agent = user_agent
        self._last_fetch: float = 0
        self._client = httpx.AsyncClient(
            follow_redirects=True,
            timeout=30,
            headers={"User-Agent": user_agent},
        )

    async def fetch(self, url: str) -> FetchResult:
        now = asyncio.get_event_loop().time()
        wait = self._last_fetch + self.rate_limit_s - now
        if wait > 0:
            await asyncio.sleep(wait)

        response = await self._client.get(url)
        self._last_fetch = asyncio.get_event_loop().time()

        # Fix #9 (pipeline): Raise on HTTP errors (4xx/5xx)
        response.raise_for_status()

        # Fix #8 (pipeline): Check response size
        raw = response.content
        if len(raw) > MAX_RESPONSE_SIZE:
            raise ValueError(f"Response too large ({len(raw)} bytes) for {url}")

        content_type = response.headers.get("content-type", "").split(";")[0].strip()

        return FetchResult(
            url=url,
            status_code=response.status_code,
            content_type=content_type,
            raw_content=raw,
            content_hash=hashlib.sha256(raw).hexdigest(),
            headers=dict(response.headers),
        )

    async def close(self):
        await self._client.aclose()
