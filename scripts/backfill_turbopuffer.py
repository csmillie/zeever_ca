"""One-time backfill: mirror canadian_ai.document_chunks into Turbopuffer.

Reuses the existing Nomic embeddings verbatim. Run once before the experiment.

Usage:
    uv run python scripts/backfill_turbopuffer.py
"""
from sqlalchemy import text
from shared.db import get_session
from indexer.turbopuffer_store import chunk_row_to_tpuf, upsert_rows

BATCH = 500

QUERY = """
    SELECT dc.id, dc.chunk_text, dc.metadata,
           pd.url, pd.title, pd.content_type,
           dc.embedding
    FROM canadian_ai.document_chunks dc
    JOIN canadian_ai.parsed_documents pd ON dc.parsed_document_id = pd.id
    WHERE dc.embedding IS NOT NULL
    ORDER BY dc.id
    LIMIT :limit OFFSET :offset
"""


def main() -> None:
    offset = 0
    total = 0
    while True:
        with get_session() as session:
            rows = [dict(r._mapping) for r in session.execute(
                text(QUERY), {"limit": BATCH, "offset": offset}
            )]
        if not rows:
            break
        upsert_rows([chunk_row_to_tpuf(r) for r in rows])
        total += len(rows)
        offset += BATCH
        print(f"  upserted {total} chunks")
    print(f"Done. {total} chunks mirrored to Turbopuffer.")


if __name__ == "__main__":
    main()
