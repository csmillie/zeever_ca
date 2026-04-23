from graphrag_pkg.models import GraphNode, GraphEdge, WorkflowStep, ExtractionResult

def test_graph_node():
    node = GraphNode(name="building permit", node_type="permit_type", description="A permit for construction")
    assert node.name == "building permit"
    assert node.node_type == "permit_type"
    assert node.source_chunk_id is None

def test_graph_edge():
    edge = GraphEdge(source="building permit", target="site plan", relationship="requires")
    assert edge.source == "building permit"
    assert edge.relationship == "requires"

def test_workflow_step():
    step = WorkflowStep(order=1, action="Submit application", description="Submit your permit application")
    assert step.order == 1
    assert step.requirements == []

def test_extraction_result():
    result = ExtractionResult(
        nodes=[GraphNode(name="test", node_type="permit_type")],
        edges=[GraphEdge(source="a", target="b", relationship="requires")],
    )
    assert len(result.nodes) == 1
    assert len(result.edges) == 1
