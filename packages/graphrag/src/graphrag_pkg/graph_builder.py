"""Build knowledge graph from document chunks using LLM extraction."""
import uuid
from sqlalchemy import func, select
from shared.db import get_session
from shared.models import DocumentChunk, GraphNode as GraphNodeORM, GraphEdge as GraphEdgeORM
from graphrag_pkg.extractor import extract_entities_and_relationships
from graphrag_pkg.models import GraphNode, GraphEdge


async def build_graph(max_chunks: int | None = None):
    """Extract entities and relationships from all chunks and store in graph tables.

    Args:
        max_chunks: Optional limit on number of chunks to process (for cost control).
    """
    with get_session() as session:
        # Get chunks to process
        query = select(DocumentChunk).where(DocumentChunk.chunk_text.isnot(None))
        if max_chunks:
            query = query.limit(max_chunks)
        chunks = session.execute(query).scalars().all()

        print(f"Processing {len(chunks)} chunks for graph extraction")

        # Track all extracted nodes for deduplication
        node_map: dict[str, GraphNodeORM] = {}  # name -> ORM node
        total_nodes = 0
        total_edges = 0
        total_tokens = 0

        for i, chunk in enumerate(chunks):
            chunk_id = str(chunk.id)
            print(f"  [{i+1}/{len(chunks)}] Extracting from chunk {chunk_id[:8]}...")

            try:
                result = await extract_entities_and_relationships(
                    chunk.chunk_text,
                    source_chunk_id=chunk_id,
                )
            except Exception as e:
                print(f"    Error: {e}")
                continue

            # Deduplicate and store nodes
            for node in result.nodes:
                node_key = node.name.lower().strip()
                if node_key in node_map:
                    # Merge: append description if new info
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

            # Store edges (only if both source and target nodes exist)
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
                else:
                    missing = []
                    if source_key not in node_map:
                        missing.append(f"source '{edge.source}'")
                    if target_key not in node_map:
                        missing.append(f"target '{edge.target}'")
                    print(f"    Skipping edge: missing {', '.join(missing)}")

            session.commit()
            print(f"    Extracted {len(result.nodes)} nodes, {len(result.edges)} edges")

    print(f"\nGraph build complete: {total_nodes} unique nodes, {total_edges} edges")


def get_graph_stats() -> dict:
    """Get basic statistics about the current graph."""
    with get_session() as session:
        node_count = session.execute(select(func.count()).select_from(GraphNodeORM)).scalar()
        edge_count = session.execute(select(func.count()).select_from(GraphEdgeORM)).scalar()

        nodes = session.execute(select(GraphNodeORM.node_type)).all()
        node_types = {}
        for (node_type,) in nodes:
            node_types[node_type] = node_types.get(node_type, 0) + 1

        edges = session.execute(select(GraphEdgeORM.edge_relationship)).all()
        edge_types = {}
        for (rel,) in edges:
            edge_types[rel] = edge_types.get(rel, 0) + 1

        return {
            "total_nodes": node_count,
            "total_edges": edge_count,
            "node_types": node_types,
            "edge_types": edge_types,
        }
