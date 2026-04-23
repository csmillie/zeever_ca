"""Graph-enhanced retrieval using knowledge graph context."""
from sqlalchemy import select, or_
from shared.db import get_session
from shared.models import GraphNode, GraphEdge, Workflow
import uuid


def retrieve_graph_context(vector_chunks: list[dict]) -> dict:
    """Given vector-retrieved chunks, find related graph nodes, edges, and workflows."""
    # Get chunk IDs from vector results
    chunk_ids = []
    for c in vector_chunks:
        try:
            chunk_ids.append(uuid.UUID(str(c["id"])))
        except (ValueError, KeyError):
            continue

    if not chunk_ids:
        return {"nodes": [], "edges": [], "workflows": []}

    with get_session() as session:
        # Find graph nodes sourced from these chunks
        nodes = session.execute(
            select(GraphNode).where(GraphNode.source_chunk_id.in_(chunk_ids))
        ).scalars().all()

        if not nodes:
            return {"nodes": [], "edges": [], "workflows": []}

        node_ids = [n.id for n in nodes]

        # Find edges connected to these nodes
        edges = session.execute(
            select(GraphEdge).where(
                or_(
                    GraphEdge.source_node_id.in_(node_ids),
                    GraphEdge.target_node_id.in_(node_ids),
                )
            )
        ).scalars().all()

        # Collect all connected node IDs to fetch their names
        all_node_ids = set(node_ids)
        for edge in edges:
            all_node_ids.add(edge.source_node_id)
            all_node_ids.add(edge.target_node_id)

        all_nodes = session.execute(
            select(GraphNode).where(GraphNode.id.in_(all_node_ids))
        ).scalars().all()

        node_name_map = {n.id: n.name for n in all_nodes}

        # Find relevant workflows
        permit_type_names = [n.name for n in nodes if n.node_type == "permit_type"]
        workflows = []
        if permit_type_names:
            all_workflows = session.execute(select(Workflow)).scalars().all()
            for wf in all_workflows:
                if any(pt.lower() in wf.permit_type.lower() or wf.permit_type.lower() in pt.lower()
                       for pt in permit_type_names):
                    workflows.append(wf)

        return {
            "nodes": [
                {"name": n.name, "type": n.node_type, "description": n.description or ""}
                for n in all_nodes
            ],
            "edges": [
                {
                    "source": node_name_map.get(e.source_node_id, "Unknown"),
                    "relationship": e.edge_relationship,
                    "target": node_name_map.get(e.target_node_id, "Unknown"),
                }
                for e in edges
            ],
            "workflows": [
                {"name": wf.name, "permit_type": wf.permit_type, "steps": wf.steps}
                for wf in workflows
            ],
        }
