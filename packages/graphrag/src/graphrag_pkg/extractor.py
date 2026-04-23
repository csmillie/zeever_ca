"""Extract entities and relationships from Toronto.ca service content."""
import json
from llm_router.fireworks_provider import FireworksProvider
from llm_router.claude_provider import ClaudeProvider
from shared.config import settings
from graphrag_pkg.models import GraphNode, GraphEdge, ExtractionResult

EXTRACTION_PROMPT = """Extract entities and relationships from this Toronto.ca city service text.

Entity types (use exactly these): service, permit_type, document, step, requirement, fee, inspection, department, program, location
Relationship types (use exactly these): requires, followed_by, costs, inspected_by, applies_to, submitted_to, part_of, offered_by, located_at

Return ONLY valid JSON in this exact format:
{{
  "nodes": [{{"name": "...", "node_type": "...", "description": "..."}}],
  "edges": [{{"source": "...", "target": "...", "relationship": "..."}}]
}}

Rules:
- Extract concrete entities, not abstract concepts
- Node names should be specific and descriptive (e.g., "residential building permit" not "permit")
- Edge source and target must match node names exactly
- Only extract what is explicitly stated in the text

Text:
{text}
"""

async def extract_entities_and_relationships(
    text: str, source_chunk_id: str | None = None
) -> ExtractionResult:
    """Extract graph entities and relationships from a text chunk."""
    if settings.fireworks_api_key:
        provider = FireworksProvider(
            api_key=settings.fireworks_api_key,
            base_url=settings.fireworks_base_url,
            model=settings.fireworks_model,
        )
    else:
        provider = ClaudeProvider(
            api_key=settings.anthropic_api_key,
            model="claude-sonnet-4-20250514",
        )

    response = await provider.generate(
        prompt=EXTRACTION_PROMPT.format(text=text),
        system="You are a precise entity extraction system. Return only valid JSON. No markdown formatting.",
        max_tokens=2048,
    )

    # Parse JSON response, handling potential markdown code blocks
    response_text = response.text.strip()
    if response_text.startswith("```"):
        # Strip markdown code block
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1])

    data = json.loads(response_text)

    nodes = [
        GraphNode(
            name=n["name"],
            node_type=n["node_type"],
            description=n.get("description", ""),
            source_chunk_id=source_chunk_id,
        )
        for n in data.get("nodes", [])
    ]

    edges = [
        GraphEdge(
            source=e["source"],
            target=e["target"],
            relationship=e["relationship"],
        )
        for e in data.get("edges", [])
    ]

    return ExtractionResult(nodes=nodes, edges=edges)
