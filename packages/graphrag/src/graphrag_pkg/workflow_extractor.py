"""Extract permit workflows from the knowledge graph."""
import json
from sqlalchemy import select
from shared.db import get_session
from shared.models import GraphNode as GraphNodeORM, GraphEdge as GraphEdgeORM, Workflow as WorkflowORM
from graphrag_pkg.models import WorkflowStep
from llm_router.claude_provider import ClaudeProvider
from shared.config import settings


WORKFLOW_PROMPT = """Based on the following graph entities and relationships about Toronto city services,
extract a clear step-by-step workflow for the process described.

Entities:
{entities}

Relationships:
{relationships}

Return ONLY valid JSON in this format:
{{
  "name": "Descriptive workflow name",
  "permit_type": "The type of permit this workflow applies to",
  "steps": [
    {{"order": 1, "action": "Short action title", "description": "Detailed description", "requirements": ["list of requirements"]}},
    ...
  ]
}}

If the entities don't describe a clear sequential workflow, return:
{{"name": "N/A", "permit_type": "N/A", "steps": []}}
"""


async def extract_workflows_from_graph():
    """Extract permit workflows by analyzing graph structure and using LLM."""
    with get_session() as session:
        # Get all nodes grouped by permit_type
        permit_nodes = session.execute(
            select(GraphNodeORM).where(GraphNodeORM.node_type == "permit_type")
        ).scalars().all()

        print(f"Found {len(permit_nodes)} permit type nodes")

        provider = ClaudeProvider(
            api_key=settings.anthropic_api_key,
            model="claude-sonnet-4-20250514",
        )

        workflows_created = 0

        for permit_node in permit_nodes:
            # Find all edges connected to this permit type
            edges = session.execute(
                select(GraphEdgeORM).where(
                    (GraphEdgeORM.source_node_id == permit_node.id) |
                    (GraphEdgeORM.target_node_id == permit_node.id)
                )
            ).scalars().all()

            if not edges:
                continue

            # Collect connected nodes
            connected_node_ids = set()
            for edge in edges:
                connected_node_ids.add(edge.source_node_id)
                connected_node_ids.add(edge.target_node_id)

            connected_nodes = session.execute(
                select(GraphNodeORM).where(GraphNodeORM.id.in_(connected_node_ids))
            ).scalars().all()

            # Format entities and relationships for the prompt
            entities_text = "\n".join([
                f"- {n.name} (type: {n.node_type}): {n.description or 'No description'}"
                for n in connected_nodes
            ])
            relationships_text = "\n".join([
                f"- {_get_node_name(session, e.source_node_id)} --[{e.edge_relationship}]--> {_get_node_name(session, e.target_node_id)}"
                for e in edges
            ])

            print(f"\nExtracting workflow for: {permit_node.name}")

            try:
                response = await provider.generate(
                    prompt=WORKFLOW_PROMPT.format(
                        entities=entities_text,
                        relationships=relationships_text,
                    ),
                    system="You are a workflow extraction system. Return only valid JSON.",
                    max_tokens=2048,
                )

                response_text = response.text.strip()
                if response_text.startswith("```"):
                    lines = response_text.split("\n")
                    response_text = "\n".join(lines[1:-1])

                data = json.loads(response_text)

                if data.get("steps"):
                    # Get source URLs from the chunks that produced these nodes
                    source_urls = set()
                    for node in connected_nodes:
                        if node.source_chunk_id:
                            from shared.models import DocumentChunk, ParsedDocument
                            chunk = session.get(DocumentChunk, node.source_chunk_id)
                            if chunk:
                                parsed = session.get(ParsedDocument, chunk.parsed_document_id)
                                if parsed:
                                    source_urls.add(parsed.url)

                    workflow = WorkflowORM(
                        name=data["name"],
                        permit_type=data["permit_type"],
                        steps=data["steps"],
                        source_urls=list(source_urls) or [permit_node.name],
                    )
                    session.add(workflow)
                    session.commit()
                    workflows_created += 1
                    print(f"  Created workflow: {data['name']} ({len(data['steps'])} steps)")
                else:
                    print(f"  No sequential workflow found for {permit_node.name}")

            except Exception as e:
                print(f"  Error extracting workflow: {e}")
                session.rollback()

    print(f"\nWorkflow extraction complete: {workflows_created} workflows created")


def _get_node_name(session, node_id) -> str:
    """Helper to get a node name by ID."""
    node = session.get(GraphNodeORM, node_id)
    return node.name if node else "Unknown"
