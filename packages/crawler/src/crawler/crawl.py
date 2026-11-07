"""Main crawl orchestrator for Toronto.ca building permits."""
import asyncio
from crawler.fetcher import Fetcher, OffsiteRedirect
from crawler.redirects import record_redirect
from shared.db import get_session
from crawler.sitemap import parse_sitemap_index, parse_sitemap, extract_permit_urls
from crawler.url_filter import is_in_scope
from crawler.pdf_detector import extract_pdf_links
from crawler.storage import create_crawl_run, save_raw_document, complete_crawl_run
from shared.config import settings

SITEMAP_URL = "https://www.toronto.ca/sitemap.xml"

# Priority seed URLs to ensure we crawl even if sitemap misses them
SEED_URLS = [
    # Building & Construction hub
    "https://www.toronto.ca/services-payments/building-construction/",

    # Building permits
    "https://www.toronto.ca/services-payments/building-construction/building-permit/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/when-do-i-need-a-building-permit/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/building-permit-application-guides/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/building-permit-fees/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/building-permit-review-streams/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/express-building-permits/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/conditional-permit-applications/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/preliminary-zoning-reviews-information/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/electronic-submission-guidelines/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/after-you-apply-for-a-building-permit/building-inspections/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/after-you-apply-for-a-building-permit/plan-review-process/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/forms-documents-additional-resources/toronto-building-forms-index/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/forms-documents-additional-resources/building-permit-regulations/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/adding-new-units-to-residential-properties/",
    "https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/pre-approved-garden-and-laneway-suite-plans/",

    # Certified plans
    "https://www.toronto.ca/services-payments/building-construction/certifying-your-building-plans/",

    # Sign permits
    "https://www.toronto.ca/services-payments/building-construction/sign-permits-information/",

    # Tree and ravine protection
    "https://www.toronto.ca/services-payments/building-construction/tree-ravine-protection-permits/",

    # Land and property surveys
    "https://www.toronto.ca/services-payments/building-construction/land-and-property-surveys/",

    # Infrastructure and city construction
    "https://www.toronto.ca/services-payments/building-construction/infrastructure-city-construction/",
    "https://www.toronto.ca/services-payments/building-construction/infrastructure-city-construction/construction-standards-permits/",

    # Tier 2: Property taxes & utilities
    "https://www.toronto.ca/services-payments/property-taxes-utilities/",
    "https://www.toronto.ca/services-payments/property-taxes-utilities/property-tax/",
    "https://www.toronto.ca/services-payments/property-taxes-utilities/utility-bill/",
    "https://www.toronto.ca/services-payments/property-taxes-utilities/municipal-land-transfer-tax-mltt/",
    "https://www.toronto.ca/services-payments/property-taxes-utilities/vacant-home-tax/",
    "https://www.toronto.ca/services-payments/property-taxes-utilities/municipal-accommodation-tax/",
    "https://www.toronto.ca/services-payments/property-taxes-utilities/small-business-property-tax-subclass/",
    "https://www.toronto.ca/services-payments/property-taxes-utilities/tax-utility-certificate-service/",

    # Tier 2: Licences & permits
    "https://www.toronto.ca/services-payments/permits-licences-bylaws/",
    "https://www.toronto.ca/services-payments/permits-licences-bylaws/find-licence-permit-types/",
    "https://www.toronto.ca/services-payments/permits-licences-bylaws/lottery-licences/",
    "https://www.toronto.ca/services-payments/permits-licences-bylaws/common-resources/",
    "https://www.toronto.ca/business-economy/new-businesses-startups/business-regulations/business-licences-permits-application-portal/",

    # Tier 3: Recycling, organics & garbage
    "https://www.toronto.ca/services-payments/recycling-organics-garbage/",
    "https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/",
    "https://www.toronto.ca/services-payments/recycling-organics-garbage/apartments-condos-co-ops/",
    "https://www.toronto.ca/services-payments/recycling-organics-garbage/non-residential/",
    "https://www.toronto.ca/services-payments/recycling-organics-garbage/drop-off-depots/",
    "https://www.toronto.ca/services-payments/recycling-organics-garbage/waste-management/",

    # Tier 3: Streets, parking & transportation
    "https://www.toronto.ca/services-payments/streets-parking-transportation/",
    "https://www.toronto.ca/services-payments/streets-parking-transportation/applying-for-a-parking-permit/",
    "https://www.toronto.ca/services-payments/streets-parking-transportation/road-restrictions-closures/",
    "https://www.toronto.ca/services-payments/streets-parking-transportation/road-maintenance/",
    "https://www.toronto.ca/services-payments/streets-parking-transportation/cycling-in-toronto/",
    "https://www.toronto.ca/services-payments/streets-parking-transportation/road-safety/",
    "https://www.toronto.ca/services-payments/streets-parking-transportation/traffic-management/",

    # Tier 3: Tickets, fines & penalties
    "https://www.toronto.ca/services-payments/tickets-fines-penalties/",
    "https://www.toronto.ca/services-payments/tickets-fines-penalties/parking-violations/",
    "https://www.toronto.ca/services-payments/tickets-fines-penalties/automated-speed-enforcement-penalties/",
    "https://www.toronto.ca/services-payments/tickets-fines-penalties/red-light-camera-penalties/",
    "https://www.toronto.ca/services-payments/tickets-fines-penalties/courts/",

    # Complete Services & Payments: Grants, incentives & rebates
    "https://www.toronto.ca/services-payments/grants-incentives-rebates/",
    "https://www.toronto.ca/services-payments/grants-incentives-rebates/arts-culture-grants/",
    "https://www.toronto.ca/services-payments/grants-incentives-rebates/community-partnership-investment-funds/",
    "https://www.toronto.ca/services-payments/grants-incentives-rebates/housing-homelessness-grants/",

    # Complete Services & Payments: Venues, facilities & bookings
    "https://www.toronto.ca/services-payments/venues-facilities-bookings/",
    "https://www.toronto.ca/services-payments/venues-facilities-bookings/booking-city-facilities/",
    "https://www.toronto.ca/services-payments/venues-facilities-bookings/getting-married/",
    "https://www.toronto.ca/services-payments/venues-facilities-bookings/booking-park-recreation-facilities/",

    # Complete Services & Payments: Water, environment & trees
    "https://www.toronto.ca/services-payments/water-environment/",
    "https://www.toronto.ca/services-payments/water-environment/tap-water-in-toronto/",
    "https://www.toronto.ca/services-payments/water-environment/managing-rain-melted-snow/",
    "https://www.toronto.ca/services-payments/water-environment/your-water-pipes-meter/",
    "https://www.toronto.ca/services-payments/water-environment/trees/",
    "https://www.toronto.ca/services-payments/water-environment/how-to-use-less-water/",
    "https://www.toronto.ca/services-payments/water-environment/managing-sewage-in-toronto/",
    "https://www.toronto.ca/services-payments/water-environment/environmental-grants-incentives/",
    "https://www.toronto.ca/services-payments/water-environment/water-sewer-related-permits-and-bylaws/",

    # Phase 1: City Government - Planning & Development
    "https://www.toronto.ca/city-government/planning-development/",
    "https://www.toronto.ca/city-government/planning-development/official-plan-guidelines/",
    "https://www.toronto.ca/city-government/planning-development/zoning-by-law-preliminary-zoning-reviews/",
    "https://www.toronto.ca/city-government/planning-development/application-forms-fees/",
    "https://www.toronto.ca/city-government/planning-development/committee-of-adjustment/",
    "https://www.toronto.ca/city-government/planning-development/heritage-preservation/",
    "https://www.toronto.ca/city-government/planning-development/planning-studies-initiatives/",
    "https://www.toronto.ca/city-government/planning-development/planning-great-neighbourhoods/",
    "https://www.toronto.ca/city-government/planning-development/waterfront/",

    # Phase 1: City Government - Public Notices & Bylaws
    "https://www.toronto.ca/city-government/public-notices-bylaws/",

    # Phase 1: City Government - Budget & Finances
    "https://www.toronto.ca/city-government/budget-finances/",
    "https://www.toronto.ca/city-government/budget-finances/city-budget/",

    # Phase 1: City Government - Council
    "https://www.toronto.ca/city-government/council/",

    # Phase 1: City Government - Data, Research & Maps
    "https://www.toronto.ca/city-government/data-research-maps/",
    "https://www.toronto.ca/city-government/data-research-maps/open-data/",

    # Phase 1: City Government - Accessibility & Human Rights
    "https://www.toronto.ca/city-government/accessibility-human-rights/",

    # Phase 1: City Government - Accountability & Operations
    "https://www.toronto.ca/city-government/accountability-operations-customer-service/",

    # Phase 1: City Government - Elections
    "https://www.toronto.ca/city-government/elections/",

    # Phase 1: City Government - Awards & Tributes
    "https://www.toronto.ca/city-government/awards-tributes/",

    # Phase 2: Community & People
    "https://www.toronto.ca/community-people/",
    "https://www.toronto.ca/community-people/housing-shelter/",
    "https://www.toronto.ca/community-people/employment-social-support/",
    "https://www.toronto.ca/community-people/health-wellness-care/",
    "https://www.toronto.ca/community-people/community-partners/",
    "https://www.toronto.ca/community-people/get-involved/",
    "https://www.toronto.ca/community-people/children-parenting/",

    # Phase 3: Explore & Enjoy
    "https://www.toronto.ca/explore-enjoy/",
    "https://www.toronto.ca/explore-enjoy/recreation/",
    "https://www.toronto.ca/explore-enjoy/parks-gardens-beaches/",
    "https://www.toronto.ca/explore-enjoy/festivals-events/",
    "https://www.toronto.ca/explore-enjoy/history-art-culture/",

    # Phase 4: Business & Economy
    "https://www.toronto.ca/business-economy/",
    "https://www.toronto.ca/business-economy/new-businesses-startups/",
    "https://www.toronto.ca/business-economy/business-operation-growth/",
    "https://www.toronto.ca/business-economy/industry-sector-support/",
]


async def discover_urls(fetcher: Fetcher) -> set[str]:
    """Discover permit-related URLs from sitemap + seed URLs."""
    urls = set(SEED_URLS)

    # Fetch sitemap index
    print(f"Fetching sitemap index: {SITEMAP_URL}")
    try:
        result = await fetcher.fetch(SITEMAP_URL)
        sub_sitemaps = parse_sitemap_index(result.raw_content.decode())
        print(f"Found {len(sub_sitemaps)} sub-sitemaps")

        for sitemap_url in sub_sitemaps:
            print(f"  Fetching sub-sitemap: {sitemap_url}")
            try:
                sm_result = await fetcher.fetch(sitemap_url)
                permit_urls = extract_permit_urls(sm_result.raw_content.decode())
                urls.update(permit_urls)
                print(f"    Found {len(permit_urls)} permit URLs")
            except Exception as e:
                print(f"    Error fetching {sitemap_url}: {e}")
    except Exception as e:
        print(f"Error fetching sitemap: {e}. Using seed URLs only.")

    print(f"Total unique URLs to crawl: {len(urls)}")
    return urls


async def crawl_urls(fetcher: Fetcher, urls: set[str], crawl_run_id: str, on_progress=None) -> tuple[int, int]:
    """Crawl all URLs and save to database. Returns (pages_crawled, pdfs_downloaded).

    Args:
        on_progress: optional callback(pages_crawled, pdfs_downloaded, total_urls, phase)
                     called every 10 pages to report progress.
    """
    pages_crawled = 0
    pdfs_downloaded = 0
    pdf_urls: set[str] = set()
    total_urls = len(urls)

    # Crawl HTML pages first
    for i, url in enumerate(sorted(urls)):
        try:
            print(f"Crawling: {url}")
            result = await fetcher.fetch(url)
            doc_id = save_raw_document(crawl_run_id, result)
            if result.requested_url and result.requested_url != result.url:
                # A City page that redirects to an accountability office is still
                # a pointer. The content is stored under the publisher's URL, so
                # without this the toronto.ca URL keeps no parsed document, stays
                # in the gap list, and is re-fetched on every run forever.
                with get_session() as session:
                    record_redirect(session, result.requested_url, result.url)
                    session.commit()
            if doc_id:
                pages_crawled += 1
                # Extract PDF links from HTML pages
                if result.content_type.startswith("text/html"):
                    found_pdfs = extract_pdf_links(result.raw_content.decode("utf-8", errors="replace"), url)
                    in_scope_pdfs = [p for p in found_pdfs if is_in_scope(p)]
                    pdf_urls.update(in_scope_pdfs)
            else:
                print(f"  Skipped (duplicate): {url}")
        except OffsiteRedirect as e:
            # The page is a pointer to a service someone else runs. Record where
            # it sends people; do not take their content.
            with get_session() as session:
                record_redirect(session, url, f"https://{e.landed}/")
                session.commit()
            print(f"  Redirect recorded: {url} -> {e.landed}")
        except Exception as e:
            print(f"  Error: {url} - {e}")

        if on_progress and (i + 1) % 10 == 0:
            on_progress(pages_crawled, pdfs_downloaded, total_urls, "pages")

    # Crawl discovered PDFs
    total_pdfs = len(pdf_urls)
    print(f"\nFound {total_pdfs} PDF links to fetch")
    if on_progress:
        on_progress(pages_crawled, pdfs_downloaded, total_urls, "pdfs")

    for i, pdf_url in enumerate(sorted(pdf_urls)):
        try:
            print(f"Fetching PDF: {pdf_url}")
            result = await fetcher.fetch(pdf_url)
            doc_id = save_raw_document(crawl_run_id, result)
            if doc_id:
                pdfs_downloaded += 1
            else:
                print(f"  Skipped (duplicate): {pdf_url}")
        except Exception as e:
            print(f"  Error: {pdf_url} - {e}")

        if on_progress and (i + 1) % 10 == 0:
            on_progress(pages_crawled, pdfs_downloaded, total_urls, "pdfs")

    return pages_crawled, pdfs_downloaded


async def run_crawl(on_progress=None):
    """Main entry point for the crawler.

    Args:
        on_progress: optional callback for progress reporting.
    """
    fetcher = Fetcher(
        rate_limit_ms=settings.crawl_rate_limit_ms,
        user_agent=settings.crawl_user_agent,
    )

    crawl_run_id = create_crawl_run(config={
        "rate_limit_ms": settings.crawl_rate_limit_ms,
        "user_agent": settings.crawl_user_agent,
        "seed_urls": len(SEED_URLS),
    })
    print(f"Started crawl run: {crawl_run_id}")

    try:
        urls = await discover_urls(fetcher)
        if on_progress:
            on_progress(0, 0, len(urls), "starting")
        pages_crawled, pdfs_downloaded = await crawl_urls(fetcher, urls, crawl_run_id, on_progress=on_progress)
        complete_crawl_run(crawl_run_id, len(urls), pages_crawled, pdfs_downloaded)
        print(f"\nCrawl complete: {pages_crawled} pages, {pdfs_downloaded} PDFs")
    except Exception as e:
        complete_crawl_run(crawl_run_id, 0, 0, 0, error=str(e))
        print(f"Crawl failed: {e}")
        raise
