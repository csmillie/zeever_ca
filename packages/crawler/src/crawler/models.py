from pydantic import BaseModel


class CrawlConfig(BaseModel):
    rate_limit_ms: int
    user_agent: str
    max_pages: int | None


class CrawlResult(BaseModel):
    url: str
    status_code: int
    content_type: str
    content_hash: str
