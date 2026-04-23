from pydantic import BaseModel

class GraphNode(BaseModel):
    name: str
    node_type: str  # permit_type, document, step, requirement, fee, inspection, review_stream, department
    description: str = ""
    source_chunk_id: str | None = None
    properties: dict = {}

class GraphEdge(BaseModel):
    source: str  # node name
    target: str  # node name
    relationship: str  # requires, followed_by, costs, inspected_by, applies_to, submitted_to, part_of
    properties: dict = {}

class WorkflowStep(BaseModel):
    order: int
    action: str
    description: str
    requirements: list[str] = []
    next_steps: list[str] = []

class ExtractionResult(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
