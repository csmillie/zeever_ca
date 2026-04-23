from unittest.mock import patch, MagicMock
from query_engine.graph_retriever import retrieve_graph_context
import uuid

def test_retrieve_graph_context_empty_chunks():
    result = retrieve_graph_context([])
    assert result == {"nodes": [], "edges": [], "workflows": []}

def test_retrieve_graph_context_no_nodes():
    mock_session = MagicMock()
    mock_session.execute.return_value.scalars.return_value.all.return_value = []

    chunk_id = str(uuid.uuid4())
    chunks = [{"id": chunk_id, "chunk_text": "test", "url": "https://test.com"}]

    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_session)
    mock_cm.__exit__ = MagicMock(return_value=False)

    with patch("query_engine.graph_retriever.get_session", return_value=mock_cm):
        result = retrieve_graph_context(chunks)

    assert result["nodes"] == []
    assert result["edges"] == []
    assert result["workflows"] == []

def test_retrieve_graph_context_with_nodes():
    chunk_id = uuid.uuid4()
    node_id = uuid.uuid4()

    mock_node = MagicMock()
    mock_node.id = node_id
    mock_node.name = "building permit"
    mock_node.node_type = "permit_type"
    mock_node.description = "A building permit"
    mock_node.source_chunk_id = chunk_id

    mock_session = MagicMock()
    # First call: nodes by chunk_id
    # Second call: edges by node_ids (empty)
    # Third call: all connected nodes
    mock_session.execute.return_value.scalars.return_value.all.side_effect = [
        [mock_node],     # nodes from chunks
        [],              # edges
        [mock_node],     # all nodes
        [],              # workflows
    ]

    chunks = [{"id": str(chunk_id), "chunk_text": "test", "url": "https://test.com"}]

    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_session)
    mock_cm.__exit__ = MagicMock(return_value=False)

    with patch("query_engine.graph_retriever.get_session", return_value=mock_cm):
        result = retrieve_graph_context(chunks)

    assert len(result["nodes"]) == 1
    assert result["nodes"][0]["name"] == "building permit"
