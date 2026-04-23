"""Build knowledge graph from document chunks using LLM extraction.

Targets high-value content types (guides, pages, inspections, regulations)
and skips fee_schedule PDFs which are mostly tabular data.
"""
import asyncio
import argparse
import uuid
from sqlalchemy import select
from shared.db import get_session
from shared.models import DocumentChunk, ParsedDocument
from shared.models import GraphNode as GraphNodeORM, GraphEdge as GraphEdgeORM
from graphrag_pkg.extractor import extract_entities_and_relationships


PRIORITY_CONTENT_TYPES = ["guide", "inspection", "page", "regulation", "form"]


async def build_graph(max_chunks: int | None = None, content_types: list[str] | None = None):
    """Extract entities and relationships from filtered chunks."""
    session = get_session()

    types = content_types or PRIORITY_CONTENT_TYPES

    # Get chunks from priority content types
    query = (
        select(DocumentChunk)
        .join(ParsedDocument, DocumentChunk.parsed_document_id == ParsedDocument.id)
        .where(ParsedDocument.content_type.in_(types))
        .where(DocumentChunk.chunk_text.isnot(None))
        .order_by(ParsedDocument.content_type)
    )
    if max_chunks:
        query = query.limit(max_chunks)

    chunks = session.execute(query).scalars().all()
    print(f"Processing {len(chunks)} chunks (content types: {types})")

    node_map: dict[str, GraphNodeORM] = {}
    total_nodes = 0
    total_edges = 0

    for i, chunk in enumerate(chunks):
        chunk_id = str(chunk.id)
        # Get content type for logging
        parsed = session.get(ParsedDocument, chunk.parsed_document_id)
        ct = parsed.content_type if parsed else "unknown"

        print(f"  [{i+1}/{len(chunks)}] [{ct}] Extracting from chunk {chunk_id[:8]}...")

        try:
            result = await extract_entities_and_relationships(
                chunk.chunk_text,
                source_chunk_id=chunk_id,
            )
        except Exception as e:
            print(f"    Error: {e}")
            continue

        for node in result.nodes:
            node_key = node.name.lower().strip()
            if node_key in node_map:
                existing = node_map[node_key]
                if node.description and node.description not in (existing.description or ""):
                    existing.description = f"{existing.description}; {node.description}" if existing.description else node.description
            else:
                orm_node = GraphNodeORM(
                    name=node.name,
                    node_type=node.node_type,
                    description=node.description,
                    source_chunk_id=uuid.UUID(chunk_id),
                    properties=node.properties or {},
                )
                session.add(orm_node)
                session.flush()
                node_map[node_key] = orm_node
                total_nodes += 1

        for edge in result.edges:
            source_key = edge.source.lower().strip()
            target_key = edge.target.lower().strip()

            if source_key in node_map and target_key in node_map:
                orm_edge = GraphEdgeORM(
                    source_node_id=node_map[source_key].id,
                    target_node_id=node_map[target_key].id,
                    edge_relationship=edge.relationship,
                    weight=1.0,
                    properties=edge.properties or {},
                    source_chunk_id=uuid.UUID(chunk_id),
                )
                session.add(orm_edge)
                total_edges += 1

        session.commit()
        print(f"    +{len(result.nodes)} nodes, +{len(result.edges)} edges (total: {total_nodes} nodes, {total_edges} edges)")

    session.close()
    print(f"\nGraph build complete: {total_nodes} unique nodes, {total_edges} edges")


def main():
    parser = argparse.ArgumentParser(description="Build knowledge graph from document chunks")
    parser.add_argument("--max-chunks", type=int, default=None, help="Max chunks to process")
    parser.add_argument("--content-types", nargs="+", default=None, help="Content types to include")
    args = parser.parse_args()

    asyncio.run(build_graph(max_chunks=args.max_chunks, content_types=args.content_types))


if __name__ == "__main__":
    main()
