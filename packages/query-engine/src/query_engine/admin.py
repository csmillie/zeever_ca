"""Admin API endpoints for crawl reporting and system stats."""
import secrets
import hashlib
import hmac
import httpx
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy import text
from shared.db import get_session
from shared.config import settings
from query_engine.limiter import limiter

WEBHOOK_URL = settings.webhook_url

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Per-IP rate limits.
# - /stats is the auth-validation endpoint that the login flow hits, so it
#   gets the strictest limit (brute-force defense).
# - /pipeline/start triggers paid LLM work, so it is also tightly capped.
# - All other read-only stats endpoints share a generous limit that is
#   well above legitimate dashboard polling.
LOGIN_LIMIT = "5/minute"
WRITE_LIMIT = "5/minute"
READ_LIMIT = "30/minute"


def verify_admin(authorization: str = Header(default="")):
    """Verify admin password via Bearer token."""
    if not settings.admin_password:
        raise HTTPException(status_code=503, detail="Admin not configured")

    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    if not token or not secrets.compare_digest(token, settings.admin_password):
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/stats")
@limiter.limit(LOGIN_LIMIT)
def get_stats(request: Request, _=Depends(verify_admin)):
    """Overview stats for the system."""
    with get_session() as session:
        raw_docs = session.execute(text("SELECT count(*) FROM canadian_ai.raw_documents")).scalar()
        raw_with_content = session.execute(text("SELECT count(*) FROM canadian_ai.raw_documents WHERE raw_content IS NOT NULL")).scalar()
        # Actionable: documents with content that haven't been parsed yet
        awaiting_parse = session.execute(text("""
            SELECT count(*) FROM canadian_ai.raw_documents rd
            WHERE raw_content IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
        """)).scalar()
        # Actionable: HTML pages with no content and no parsed doc (need crawling)
        # ILIKE throughout: the corpus holds mayoral decisions filed as .PDF,
        # and a case-sensitive match counted one of them as an HTML page needing
        # a crawl on every run, forever.
        #
        # raw_content IS NULL is what makes this "need crawling" rather than
        # "unparsed", and it was missing. The card built from it counted pages
        # that already hold content and only need parsing, then told the operator
        # to crawl them. awaiting_parse above is the other half, so the two cards
        # now name different work instead of overlapping. manage.py gaps has
        # always drawn this line correctly; the dashboard did not.
        unparsed_html = session.execute(text("""
            SELECT count(DISTINCT rd.url) FROM canadian_ai.raw_documents rd
            WHERE rd.raw_content IS NULL
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            AND rd.url NOT ILIKE '%wp-content%' AND rd.url NOT ILIKE '%.pdf'
            AND rd.url NOT LIKE '%#%' AND rd.url NOT LIKE '%?%'
        """)).scalar()
        # Not actionable: PDF link references (discovered but cleaned up or never downloaded)
        uncrawled_pdfs = session.execute(text("""
            SELECT count(DISTINCT rd.url) FROM canadian_ai.raw_documents rd
            WHERE (rd.url ILIKE '%wp-content%' OR rd.url ILIKE '%.pdf')
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
        """)).scalar()
        parsed_docs = session.execute(text("SELECT count(*) FROM canadian_ai.parsed_documents")).scalar()
        parsed_pdfs = session.execute(text("SELECT count(*) FROM canadian_ai.parsed_documents WHERE source_format = 'pdf'")).scalar()
        chunks = session.execute(text("SELECT count(*) FROM canadian_ai.document_chunks")).scalar()
        embedded = session.execute(text("SELECT count(*) FROM canadian_ai.document_chunks WHERE embedding IS NOT NULL")).scalar()
        unembedded = session.execute(text("SELECT count(*) FROM canadian_ai.document_chunks WHERE embedding IS NULL AND chunk_text IS NOT NULL AND chunk_text != ''")).scalar()
        empty_chunks = session.execute(text("SELECT count(*) FROM canadian_ai.document_chunks WHERE (chunk_text IS NULL OR chunk_text = '') AND embedding IS NULL")).scalar()
        graph_nodes = session.execute(text("SELECT count(*) FROM canadian_ai.graph_nodes")).scalar()
        graph_edges = session.execute(text("SELECT count(*) FROM canadian_ai.graph_edges")).scalar()

    # What is actually searchable, which is not the same as what is embedded.
    # Under a Turbopuffer backend a chunk is retrievable only if it also reached
    # the index, and the two stores drifted 13,188 rows apart while this page
    # reported the Postgres count and looked healthy throughout.
    indexed = None
    index_error = None
    if settings.retrieval_backend == "turbopuffer":
        try:
            from indexer.turbopuffer_store import get_namespace
            indexed = get_namespace().metadata().approx_row_count
        except Exception as exc:
            # An admin page that 500s because a third party is down is worse
            # than one that says it could not check.
            index_error = type(exc).__name__

    return {
        "retrieval_backend": settings.retrieval_backend,
        "indexed": indexed,
        "index_error": index_error,
        "urls_discovered": raw_docs,
        "raw_with_content": raw_with_content,
        "awaiting_parse": awaiting_parse,
        "unparsed_html": unparsed_html,
        "uncrawled_pdfs": uncrawled_pdfs,
        "parsed_documents": parsed_docs,
        "parsed_pdfs": parsed_pdfs,
        "chunks": chunks,
        "embedded": embedded,
        "unembedded": unembedded,
        "empty_chunks": empty_chunks,
        "graph_nodes": graph_nodes,
        "graph_edges": graph_edges,
    }


@router.get("/crawl-runs")
@limiter.limit(READ_LIMIT)
def get_crawl_runs(request: Request, _=Depends(verify_admin)):
    """List all crawl runs with stats."""
    with get_session() as session:
        results = session.execute(text("""
            SELECT id, started_at, completed_at, status,
                   pages_found, pages_crawled, pdfs_downloaded, error
            FROM canadian_ai.crawl_runs
            ORDER BY started_at DESC
            LIMIT 20
        """))
        runs = []
        for r in results:
            row = r._mapping
            runs.append({
                "id": str(row["id"]),
                "started_at": row["started_at"].isoformat() if row["started_at"] else None,
                "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
                "status": row["status"],
                "pages_found": row["pages_found"],
                "pages_crawled": row["pages_crawled"],
                "pdfs_downloaded": row["pdfs_downloaded"],
                "error": row["error"],
            })

    return {"runs": runs}


@router.get("/content-breakdown")
@limiter.limit(READ_LIMIT)
def get_content_breakdown(request: Request, _=Depends(verify_admin)):
    """Content breakdown by type and source."""
    with get_session() as session:
        # By content type
        by_type = session.execute(text("""
            SELECT content_type, count(*) as count, sum(word_count) as total_words
            FROM canadian_ai.parsed_documents
            GROUP BY content_type
            ORDER BY count DESC
        """))
        content_types = [
            {"type": r._mapping["content_type"], "count": r._mapping["count"], "total_words": r._mapping["total_words"] or 0}
            for r in by_type
        ]

        # By source format
        by_format = session.execute(text("""
            SELECT source_format, count(*) as count
            FROM canadian_ai.parsed_documents
            GROUP BY source_format
            ORDER BY count DESC
        """))
        source_formats = [
            {"format": r._mapping["source_format"], "count": r._mapping["count"]}
            for r in by_format
        ]

        # By URL section
        by_section = session.execute(text("""
            SELECT
              CASE
                WHEN url LIKE '%building-construction%' THEN 'Building & Construction'
                WHEN url LIKE '%property-taxes%' THEN 'Property Taxes & Utilities'
                WHEN url LIKE '%permits-licences%' OR url LIKE '%business-regulations%' THEN 'Licences & Permits'
                WHEN url LIKE '%recycling-organics%' THEN 'Recycling & Garbage'
                WHEN url LIKE '%streets-parking%' THEN 'Streets & Parking'
                WHEN url LIKE '%tickets-fines%' THEN 'Tickets & Fines'
                WHEN url LIKE '%grants-incentives%' THEN 'Grants & Incentives'
                WHEN url LIKE '%venues-facilities%' THEN 'Venues & Facilities'
                WHEN url LIKE '%water-environment%' THEN 'Water & Environment'
                WHEN url LIKE '%city-government%' THEN 'City Government'
                WHEN url LIKE '%community-people%' THEN 'Community & People'
                WHEN url LIKE '%explore-enjoy%' THEN 'Explore & Enjoy'
                WHEN url LIKE '%business-economy%' THEN 'Business & Economy'
                WHEN url ILIKE '%wp-content%' THEN 'PDFs'
                ELSE 'Other'
              END as section,
              count(*) as count
            FROM canadian_ai.parsed_documents
            GROUP BY section
            ORDER BY count DESC
        """))
        sections = [
            {"section": r._mapping["section"], "count": r._mapping["count"]}
            for r in by_section
        ]

    return {
        "content_types": content_types,
        "source_formats": source_formats,
        "sections": sections,
    }


@router.get("/embedding-status")
@limiter.limit(READ_LIMIT)
def get_embedding_status(request: Request, _=Depends(verify_admin)):
    """Check embedding coverage."""
    with get_session() as session:
        results = session.execute(text("""
            SELECT
              pd.content_type,
              count(dc.id) as total_chunks,
              count(dc.embedding) as embedded,
              count(dc.id) - count(dc.embedding) as unembedded
            FROM canadian_ai.document_chunks dc
            JOIN canadian_ai.parsed_documents pd ON dc.parsed_document_id = pd.id
            GROUP BY pd.content_type
            ORDER BY total_chunks DESC
        """))
        breakdown = [
            {
                "content_type": r._mapping["content_type"],
                "total_chunks": r._mapping["total_chunks"],
                "embedded": r._mapping["embedded"],
                "unembedded": r._mapping["unembedded"],
            }
            for r in results
        ]

    return {"breakdown": breakdown}


@router.get("/gaps")
@limiter.limit(READ_LIMIT)
def get_gaps(request: Request, _=Depends(verify_admin)):
    """Detailed gap analysis for the admin dashboard."""
    with get_session() as session:
        awaiting_parse = session.execute(text("""
            SELECT count(*) FROM canadian_ai.raw_documents rd
            WHERE raw_content IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
        """)).scalar()

        unparsed_html = session.execute(text("""
            SELECT count(DISTINCT rd.url) FROM canadian_ai.raw_documents rd
            WHERE NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            AND rd.url NOT ILIKE '%wp-content%' AND rd.url NOT ILIKE '%.pdf'
            AND rd.url NOT LIKE '%#%' AND rd.url NOT LIKE '%?%'
        """)).scalar()

        unparsed_html_needs_crawl = session.execute(text("""
            SELECT count(DISTINCT rd.url) FROM canadian_ai.raw_documents rd
            WHERE rd.raw_content IS NULL
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            AND rd.url NOT ILIKE '%wp-content%' AND rd.url NOT ILIKE '%.pdf'
            AND rd.url NOT LIKE '%#%' AND rd.url NOT LIKE '%?%'
        """)).scalar()

        unparsed_pdfs = session.execute(text("""
            SELECT count(DISTINCT rd.url) FROM canadian_ai.raw_documents rd
            WHERE (rd.url ILIKE '%wp-content%' OR rd.url ILIKE '%.pdf')
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
        """)).scalar()

        parsed_pdfs = session.execute(text("""
            SELECT count(*) FROM canadian_ai.parsed_documents WHERE source_format = 'pdf'
        """)).scalar()

        # Unparsed HTML by section
        sections = session.execute(text("""
            SELECT split_part(rd.url, '/', 4) as section, count(DISTINCT rd.url) as cnt
            FROM canadian_ai.raw_documents rd
            WHERE NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            AND rd.url NOT ILIKE '%wp-content%' AND rd.url NOT ILIKE '%.pdf'
            AND rd.url NOT LIKE '%#%' AND rd.url NOT LIKE '%?%'
            GROUP BY section ORDER BY cnt DESC LIMIT 10
        """)).fetchall()

    return {
        "awaiting_parse": awaiting_parse,
        "unparsed_html": unparsed_html,
        "unparsed_html_needs_crawl": unparsed_html_needs_crawl,
        "unparsed_html_has_content": unparsed_html - unparsed_html_needs_crawl,
        "unparsed_pdfs": unparsed_pdfs,
        "parsed_pdfs": parsed_pdfs,
        "sections": [{"section": r._mapping["section"], "count": r._mapping["cnt"]} for r in sections],
    }


@router.get("/pdf-categories")
@limiter.limit(READ_LIMIT)
def get_pdf_categories(request: Request, _=Depends(verify_admin)):
    """Get counts of uncrawled PDFs by category."""
    with get_session() as session:
        rows = session.execute(text("""
            SELECT
              CASE
                WHEN rd.url LIKE '%/bylaws/%' OR rd.url LIKE '%bylaw%' THEN 'bylaws'
                WHEN rd.url LIKE '%/agenda%' OR rd.url LIKE '%/minutes%' THEN 'agendas'
                WHEN rd.url LIKE '%legdocs%' THEN 'legal'
                WHEN rd.url LIKE '%budget%' THEN 'budget'
                WHEN rd.url LIKE '%report%' THEN 'reports'
                WHEN rd.url LIKE '%consultation%' OR rd.url LIKE '%engagement%' THEN 'consultations'
                WHEN rd.url LIKE '%permit%' OR rd.url LIKE '%building%' THEN 'building'
                WHEN rd.url LIKE '%form%' OR rd.url LIKE '%application%' THEN 'forms'
                WHEN rd.url LIKE '%policy%' OR rd.url LIKE '%procedure%' THEN 'policies'
                WHEN rd.url LIKE '%plan%' OR rd.url LIKE '%strategy%' THEN 'plans'
                WHEN rd.url LIKE '%map%' THEN 'maps'
                WHEN rd.url LIKE '%guide%' OR rd.url LIKE '%handbook%' THEN 'guides'
                ELSE 'other'
              END as category,
              count(DISTINCT rd.url) as cnt
            FROM canadian_ai.raw_documents rd
            WHERE (rd.url ILIKE '%wp-content%' OR rd.url ILIKE '%.pdf')
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            GROUP BY category
            ORDER BY cnt DESC
        """)).fetchall()

    return {
        "categories": [
            {"category": r._mapping["category"], "count": r._mapping["cnt"]}
            for r in rows
        ]
    }


def _sign_payload(payload: str) -> str:
    """Sign a payload with the deploy webhook secret."""
    secret = settings.deploy_webhook_secret
    if not secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")
    mac = hmac.new(secret.encode(), payload.encode(), hashlib.sha256)
    return f"sha256={mac.hexdigest()}"


from typing import Literal


class PipelineRequest(BaseModel):
    skip_crawl: bool = False
    action: Literal["pipeline", "gaps", "recrawl", "download-pdfs"] = "pipeline"
    categories: list[str] = []


@router.get("/pipeline/status")
@limiter.limit(READ_LIMIT)
def get_pipeline_status(request: Request, _=Depends(verify_admin)):
    """Check if the pipeline is currently running."""
    try:
        resp = httpx.get(f"{WEBHOOK_URL}/pipeline/status", timeout=5)
        return resp.json()
    except Exception:
        return {"running": False, "error": "Could not reach webhook server"}


@router.post("/pipeline/start")
@limiter.limit(WRITE_LIMIT)
def start_pipeline(request: Request, body: PipelineRequest = PipelineRequest(), _=Depends(verify_admin)):
    """Trigger the data pipeline (crawl + parse + embed)."""
    if not settings.deploy_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    import json
    payload_data = {"skip_crawl": body.skip_crawl, "action": body.action}
    if body.categories:
        payload_data["categories"] = body.categories
    payload = json.dumps(payload_data)
    signature = _sign_payload(payload)

    try:
        resp = httpx.post(
            f"{WEBHOOK_URL}/pipeline",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": signature,
            },
            timeout=10,
        )
        if resp.status_code == 409:
            return {"status": "already_running"}
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Pipeline server returned an error")
        return {"status": "started", "skip_crawl": body.skip_crawl, "action": body.action}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach pipeline server")
