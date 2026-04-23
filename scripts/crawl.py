"""Run the Toronto.ca building permit crawler."""
import asyncio
from crawler.crawl import run_crawl

if __name__ == "__main__":
    asyncio.run(run_crawl())
